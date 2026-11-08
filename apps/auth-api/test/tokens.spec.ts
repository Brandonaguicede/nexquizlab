import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RsaAccessTokens } from '../src/infrastructure/access-tokens';
describe('Auth token issuer', () => {
 const directory = mkdtempSync(join(tmpdir(),'nexquiz-issuer-test-'));
 const file = join(directory,'private.pem');
 const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
 let issuer: RsaAccessTokens;
 beforeAll(() => { writeFileSync(file, keys.privateKey.export({ format: 'pem', type: 'pkcs8' })); issuer = new RsaAccessTokens({ privateKeyPath: file, issuer: 'https://auth.test.invalid', audience: 'nexquiz-game-api', keyId: 'test-key' }); });
 afterAll(() => rmSync(directory, { force: true, recursive: true }));
 it('issues verifiable identity and unique tokens', () => {
  const identity = { userId: randomUUID(), sessionId: randomUUID() };
  const first = issuer.issue(identity);
  expect(issuer.verify(first)).toEqual(identity); expect(issuer.issue(identity)).not.toBe(first);
 });
 it('carries the display name as an optional name claim', () => {
  const identity = { userId: randomUUID(), sessionId: randomUUID() };
  expect(JSON.parse(Buffer.from(issuer.issue({ ...identity, name: 'Ana' }).split('.')[1]!, 'base64url').toString())).toMatchObject({ name: 'Ana', sub: identity.userId });
  expect(JSON.parse(Buffer.from(issuer.issue(identity).split('.')[1]!, 'base64url').toString())).not.toHaveProperty('name');
 });
 it('publishes public-only JWKS', () => {
  const value = issuer.jwks().keys[0];
  expect(value).toMatchObject({ kty: 'RSA', kid: 'test-key', alg: 'RS256', use: 'sig' });
  for (const field of ['d','p','q','dp','dq','qi']) expect(value).not.toHaveProperty(field);
 });
 it('maps malformed or oversized tokens to unauthorized', () => {
  for (const value of ['invalid','x'.repeat(4097)]) expect(() => issuer.verify(value)).toThrow('UNAUTHORIZED');
 });
});
