/** Game API consumes identity through cryptographic verification, never Auth tables. */
/** `name` is a display value only and must never be used for authorization. */
export interface VerifiedIdentity { subject: string; sessionId: string; expiresAt: Date; name?: string; role?: 'TEACHER' | 'STUDENT'; }
export interface IdentityVerifier { verify(bearer: string): Promise<VerifiedIdentity>; }
