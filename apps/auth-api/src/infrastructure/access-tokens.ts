import { createPrivateKey, createPublicKey, KeyObject, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import jwt, { JwtHeader, JwtPayload } from 'jsonwebtoken';
import { AccessIdentity, AccessTokens, IssuedIdentity } from '../application/identity.ports';
import { ACCESS_TOKEN_SECONDS, IdentityError } from '../domain/identity';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
type AccessClaims = JwtPayload & { sub: string; sid: string; exp: number; iat: number; jti: string };
export class RsaAccessTokens implements AccessTokens {
 private keys?: { privateKey: KeyObject; publicKey: KeyObject };
 constructor(private readonly config: { issuer: string; audience: string; keyId: string; privateKeyPath: string }) {}
 /** Loaded once; the public half is derived once too instead of on every verification. */
 private signingKeys() {
  if (!this.keys) {
   const privateKey = createPrivateKey(readFileSync(this.config.privateKeyPath));
   if (privateKey.asymmetricKeyType !== 'rsa' || (privateKey.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) throw new Error('RSA key of at least 2048 bits required');
   this.keys = { privateKey, publicKey: createPublicKey(privateKey) };
  }
  return this.keys;
 }
 issue(identity: IssuedIdentity) {
  return jwt.sign({ sid: identity.sessionId, role: identity.role ?? 'TEACHER', ...(identity.name ? { name: identity.name } : {}) }, this.signingKeys().privateKey, { algorithm: 'RS256', header: { alg: 'RS256', typ: 'at+jwt' }, keyid: this.config.keyId, issuer: this.config.issuer, audience: this.config.audience, subject: identity.userId, jwtid: randomUUID(), expiresIn: ACCESS_TOKEN_SECONDS });
 }
 /** Signature, issuer, audience and age are checked by jwt.verify; these are the access-token specifics on top. */
 private accessClaims(header: JwtHeader, payload: string | JwtPayload): payload is AccessClaims {
  if (header.kid !== this.config.keyId || header.typ !== 'at+jwt' || typeof payload === 'string') return false;
  const { sub, sid, exp, iat, jti } = payload;
  return typeof sub === 'string' && UUID.test(sub) && typeof sid === 'string' && UUID.test(sid) && typeof jti === 'string'
   && Number.isInteger(exp) && Number.isInteger(iat) && iat! <= Math.floor(Date.now() / 1000) && exp! - iat! <= ACCESS_TOKEN_SECONDS;
 }
 verify(token: string): AccessIdentity {
  try {
   if (token.length > 4096) throw new Error();
   const { header, payload } = jwt.verify(token, this.signingKeys().publicKey, { algorithms: ['RS256'], issuer: this.config.issuer, audience: this.config.audience, maxAge: ACCESS_TOKEN_SECONDS + 's', complete: true });
   if (!this.accessClaims(header, payload)) throw new Error();
   return { userId: payload.sub, sessionId: payload.sid };
  } catch { throw new IdentityError('UNAUTHORIZED'); }
 }
 jwks() { return { keys: [{ ...this.signingKeys().publicKey.export({ format: 'jwk' }), kid: this.config.keyId, use: 'sig', alg: 'RS256' }] }; }
}
export function tokenConfiguration() {
 return { issuer: process.env.JWT_ISSUER || 'https://auth.nexquiz.example', audience: process.env.JWT_AUDIENCE || 'nexquiz-game-api', keyId: process.env.JWT_KEY_ID || 'nexquiz-key-1', privateKeyPath: process.env.JWT_PRIVATE_KEY_PATH || resolve(__dirname, '../../../../secrets/jwt-private.pem') };
}
