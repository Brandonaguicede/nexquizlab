import { createPublicKey, KeyObject } from 'node:crypto';
import { readFileSync } from 'node:fs';
import jwt, { JwtHeader, JwtPayload } from 'jsonwebtoken';
import { IdentityVerifier, VerifiedIdentity } from '../application/identity-verifier.port';
import { InvalidIdentity } from '../domain/identity';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const LIFETIME_SECONDS = 300;
type AccessClaims = JwtPayload & { sub: string; sid: string; exp: number; iat: number; jti: string; name?: string; role?: 'TEACHER' | 'STUDENT' };
export class RsaIdentityVerifier implements IdentityVerifier {
 private readonly key: KeyObject;
 constructor(private readonly config: { issuer: string; audience: string; keyId: string; publicKeyPath: string }) {
  this.key = createPublicKey(readFileSync(config.publicKeyPath));
  if (this.key.asymmetricKeyType !== 'rsa' || (this.key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) throw new Error('RSA public key of at least 2048 bits required');
 }
 /** Signature, issuer, audience and age are checked by jwt.verify; these are the Auth access-token specifics on top. */
 private accessClaims(header: JwtHeader, payload: string | JwtPayload): payload is AccessClaims {
  if (header.kid !== this.config.keyId || header.typ !== 'at+jwt' || typeof payload === 'string') return false;
  const { sub, sid, exp, iat, jti, name, role } = payload;
  return typeof sub === 'string' && UUID.test(sub) && typeof sid === 'string' && UUID.test(sid) && typeof jti === 'string'
   && Number.isInteger(exp) && Number.isInteger(iat) && iat! <= Math.floor(Date.now() / 1000) && exp! - iat! <= LIFETIME_SECONDS
   && (role === undefined || role === 'TEACHER' || role === 'STUDENT')
   && (name === undefined || (typeof name === 'string' && name.length <= 100));
 }
 async verify(bearer: string): Promise<VerifiedIdentity> {
  try {
   if (bearer.length > 4096) throw new Error();
   const { header, payload } = jwt.verify(bearer, this.key, { algorithms: ['RS256'], issuer: this.config.issuer, audience: this.config.audience, maxAge: LIFETIME_SECONDS + 's', complete: true });
   if (!this.accessClaims(header, payload)) throw new Error();
   return { role: payload.role, subject: payload.sub, sessionId: payload.sid, expiresAt: new Date(payload.exp * 1000), ...(payload.name ? { name: payload.name } : {}) };
  } catch { throw new InvalidIdentity(); }
 }
}
