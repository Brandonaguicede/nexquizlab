import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import jwt, { SignOptions } from 'jsonwebtoken';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { RsaIdentityVerifier } from '../src/infrastructure/rsa-identity-verifier';
import { GetIdentity } from '../src/application/get-identity';
import { IdentityController, IdentityGuard } from '../src/presentation/identity.controller';
import { ErrorFilter } from '../src/presentation/error.filter';
describe('independent real RS256 verifier and protected HTTP endpoint', () => {
 const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
 const directory = mkdtempSync(join(tmpdir(),'nexquiz-identity-test-'));
 const publicPath = join(directory,'public.pem');
 const subject = randomUUID(), sessionId = randomUUID();
 const options: SignOptions = { algorithm: 'RS256', header: { alg: 'RS256', typ: 'at+jwt' }, issuer: 'https://auth.test.invalid', audience: 'nexquiz-game-api', keyid: 'test-key', subject, jwtid: randomUUID(), expiresIn: 300 };
 let app: INestApplication;
 const token = (changes: SignOptions = {}, payload: object = { sid: sessionId }) => jwt.sign(payload, keys.privateKey, { ...options, ...changes });
 beforeAll(async () => {
  writeFileSync(publicPath, keys.publicKey.export({ type: 'spki', format: 'pem' }));
  const verifier = new RsaIdentityVerifier({ publicKeyPath: publicPath, issuer: 'https://auth.test.invalid', audience: 'nexquiz-game-api', keyId: 'test-key' });
  const module = await Test.createTestingModule({ controllers: [IdentityController], providers: [IdentityGuard, { provide: GetIdentity, useValue: new GetIdentity(verifier) }] }).compile();
  app = module.createNestApplication(); app.setGlobalPrefix('api/v1'); app.useGlobalFilters(new ErrorFilter()); await app.init();
 });
 afterAll(async () => { await app.close(); rmSync(directory, { recursive: true, force: true }); });
 it('recovers identity with only public key and no database provider', () => request(app.getHttpServer()).get('/api/v1/identity').auth(token(), { type: 'bearer' }).expect(200).expect({ userId: subject, sessionId }));
 it('exposes the optional display name claim', () => request(app.getHttpServer()).get('/api/v1/identity').auth(token({}, { sid: sessionId, name: 'Ana' }), { type: 'bearer' }).expect(200).expect({ userId: subject, sessionId, name: 'Ana' }));
 it.each([42, 'x'.repeat(101)])('rejects a malformed name claim %#', name => request(app.getHttpServer()).get('/api/v1/identity').auth(token({}, { sid: sessionId, name }), { type: 'bearer' }).expect(401));
 it('rejects a missing bearer', () => request(app.getHttpServer()).get('/api/v1/identity').expect(401));
 for (const [name, changes] of Object.entries({ expired: { expiresIn: -1 }, audience: { audience: 'another-api' }, issuer: { issuer: 'https://evil.test.invalid' }, kid: { keyid: 'untrusted' }, lifetime: { expiresIn: 600 }, type: { header: { alg: 'RS256', typ: 'JWT' } } } satisfies Record<string, SignOptions>)) {
  it('rejects '+name, () => request(app.getHttpServer()).get('/api/v1/identity').auth(token(changes), { type: 'bearer' }).expect(401));
 }
 it('rejects manipulated signed content', () => {
  const parts = token().split('.');
  const malicious = Buffer.from(JSON.stringify({ sub: randomUUID(), sid: sessionId })).toString('base64url');
  return request(app.getHttpServer()).get('/api/v1/identity').auth(parts[0]+'.'+malicious+'.'+parts[2], { type: 'bearer' }).expect(401);
 });
 it('rejects a token from another signing key', () => {
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return request(app.getHttpServer()).get('/api/v1/identity').auth(jwt.sign({ sid: sessionId }, other.privateKey, options), { type: 'bearer' }).expect(401);
 });
 it('rejects unsigned tokens', () => request(app.getHttpServer()).get('/api/v1/identity').auth(jwt.sign({ sid: sessionId, sub: subject }, null, { algorithm: 'none' }), { type: 'bearer' }).expect(401));
 it('rejects missing session claims', () => request(app.getHttpServer()).get('/api/v1/identity').auth(token({}, {}), { type: 'bearer' }).expect(401));
 it('rejects future issuance', () => request(app.getHttpServer()).get('/api/v1/identity').auth(token({}, { sid: sessionId, iat: Math.floor(Date.now()/1000)+60 }), { type: 'bearer' }).expect(401));
 it('rejects missing expiry', () => {
  const { expiresIn: _expiry, ...withoutExpiry } = options;
  return request(app.getHttpServer()).get('/api/v1/identity').auth(jwt.sign({ sid: sessionId }, keys.privateKey, withoutExpiry), { type: 'bearer' }).expect(401);
 });
});
