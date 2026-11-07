import { ACCESS_TOKEN_SECONDS, Email, IdentityError, SESSION_DAYS, UserProfile, validateName, validatePassword } from '../domain/identity';
import { AccessTokens, IdentityRepository, PasswordHasher, SessionIdentity, SessionSecrets, TrafficGate } from './identity.ports';
/** Shape of SessionSecrets.generate(): 32 random bytes in base64url. Anything else is rejected before touching the database. */
const REFRESH_TOKEN = /^[a-zA-Z0-9_-]{43}$/;
export class Authentication {
 constructor(private readonly users: IdentityRepository, private readonly passwords: PasswordHasher, private readonly tokens: AccessTokens, private readonly secrets: SessionSecrets, private readonly traffic: TrafficGate) {}
 private response(session: SessionIdentity, refreshToken: string) {
  return { user: session.user, accessToken: this.tokens.issue({ userId: session.user.id, sessionId: session.sessionId, name: session.user.displayName, role: session.user.role ?? 'TEACHER' }), tokenType: 'Bearer' as const, expiresIn: ACCESS_TOKEN_SECONDS, refreshToken, refreshExpiresAt: session.expiresAt };
 }
 private async session(user: UserProfile) {
  const refresh = this.secrets.generate();
  const session = await this.users.createSession(user.id, this.secrets.digest(refresh), new Date(Date.now() + SESSION_DAYS * 86400_000));
  return this.response(session, refresh);
 }
 async register(input: { email: string; displayName: string; password: string; role?: 'TEACHER' | 'STUDENT' }) {
  const email = new Email(input.email).value;
  if (input.role !== undefined && input.role !== 'STUDENT') throw new IdentityError('INVALID_INPUT');
  const name = validateName(input.displayName); validatePassword(input.password);
  const hash = await this.passwords.hash(input.password);
  return this.session(await this.users.register(email, name, hash, 'STUDENT'));
 }
 async login(input: { email: string; password: string }) {
  const email = new Email(input.email).value;
  await this.traffic.consume('login-email:' + email, 8);
  const user = await this.users.findByEmail(email);
  const valid = await this.passwords.verify(input.password, user?.passwordHash ?? null);
  if (!valid || !user) throw new IdentityError('UNAUTHORIZED');
  return this.session(user);
 }
 async profile(accessToken: string) {
  const identity = this.tokens.verify(accessToken);
  const user = await this.users.profile(identity.userId, identity.sessionId, new Date());
  if (!user) throw new IdentityError('UNAUTHORIZED');
  return user;
 }
 async refresh(refresh: string) {
  if (!REFRESH_TOKEN.test(refresh)) throw new IdentityError('UNAUTHORIZED');
  const replacement = this.secrets.generate();
  const session = await this.users.rotate(this.secrets.digest(refresh), this.secrets.digest(replacement), new Date());
  if (!session) throw new IdentityError('UNAUTHORIZED');
  return this.response(session, replacement);
 }
 async logout(refresh: string) {
  if (REFRESH_TOKEN.test(refresh)) await this.users.revoke(this.secrets.digest(refresh));
 }
}
