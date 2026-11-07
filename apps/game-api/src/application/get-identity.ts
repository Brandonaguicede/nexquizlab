import { IdentityVerifier } from './identity-verifier.port';
export class GetIdentity {
 constructor(private readonly verifier: IdentityVerifier) {}
 async execute(token: string) {
  const identity = await this.verifier.verify(token);
  return { role: identity.role, userId: identity.subject, sessionId: identity.sessionId, expiresAt: identity.expiresAt, ...(identity.name ? { name: identity.name } : {}) };
 }
}
