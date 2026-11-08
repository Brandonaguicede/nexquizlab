import { CredentialUser, UserProfile } from '../domain/identity';
export interface SessionIdentity { user: UserProfile; sessionId: string; expiresAt: Date; }
export interface IdentityRepository {
 register(email: string, displayName: string, passwordHash: string, role?: 'TEACHER' | 'STUDENT'): Promise<UserProfile>;
 findByEmail(email: string): Promise<CredentialUser | null>;
 createSession(userId: string, refreshHash: string, expiresAt: Date): Promise<SessionIdentity>;
 rotate(refreshHash: string, replacementHash: string, now: Date): Promise<SessionIdentity | null>;
 revoke(refreshHash: string): Promise<void>;
 profile(userId: string, sessionId: string, now: Date): Promise<UserProfile | null>;
}
export interface PasswordHasher { hash(value: string): Promise<string>; verify(value: string, hash: string | null): Promise<boolean>; }
export interface SessionSecrets { generate(): string; digest(value: string): string; }
export interface AccessIdentity { userId: string; sessionId: string; }
/** displayName travels as the `name` claim so Game can show it without querying Auth. */
export interface IssuedIdentity extends AccessIdentity { name?: string; role?: 'TEACHER' | 'STUDENT'; }
export interface AccessTokens {
 issue(identity: IssuedIdentity): string;
 verify(token: string): AccessIdentity;
 jwks(): { keys: object[] };
}
export interface TrafficGate { consume(key: string, limit: number): Promise<void>; }
export const IDENTITY_REPOSITORY = Symbol('IDENTITY_REPOSITORY');
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
export const ACCESS_TOKENS = Symbol('ACCESS_TOKENS');
export const TRAFFIC_GATE = Symbol('TRAFFIC_GATE');
