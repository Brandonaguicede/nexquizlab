import { Authentication } from '../src/application/authentication';
import { AccessTokens, IdentityRepository, PasswordHasher, SessionSecrets, TrafficGate } from '../src/application/identity.ports';
import { Email, IdentityError, validateName, validatePassword } from '../src/domain/identity';
import { ScryptPasswords } from '../src/infrastructure/passwords';
describe('Identity domain and application', () => {
 const user = { id: 'e63a0fd1-c957-40b7-85df-68d71b370ede', email: 'teacher@example.com', displayName: 'Teacher', createdAt: new Date() };
 const session = { user, sessionId: '13ac9ce8-5b03-4cbe-bda1-a643dcf9500d', expiresAt: new Date(Date.now()+86400000) };
 let repo: jest.Mocked<IdentityRepository>, passwords: jest.Mocked<PasswordHasher>, tokens: jest.Mocked<AccessTokens>, secrets: jest.Mocked<SessionSecrets>, traffic: jest.Mocked<TrafficGate>, auth: Authentication;
 beforeEach(() => {
  repo = { register: jest.fn().mockResolvedValue(user), findByEmail: jest.fn(), createSession: jest.fn().mockResolvedValue(session), rotate: jest.fn(), revoke: jest.fn(), profile: jest.fn() };
  passwords = { hash: jest.fn().mockResolvedValue('test-hash'), verify: jest.fn() };
  tokens = { issue: jest.fn().mockReturnValue('test-token'), verify: jest.fn().mockReturnValue({ userId: user.id, sessionId: session.sessionId }), jwks: jest.fn() };
  secrets = { generate: jest.fn().mockReturnValue('a'.repeat(43)), digest: jest.fn().mockImplementation(value => 'digest:'+value) };
  traffic = { consume: jest.fn().mockResolvedValue(undefined) };
  auth = new Authentication(repo, passwords, tokens, secrets, traffic);
 });
 it('normalizes identity and rejects malformed or oversize input', () => {
  expect(new Email(' Teacher@Example.COM ').value).toBe(user.email);
  for (const value of ['bad','a@b','a'.repeat(255)+'@example.com']) expect(() => new Email(value)).toThrow(IdentityError);
  for (const value of ['short',' '.repeat(12),'x'.repeat(129)]) expect(() => validatePassword(value)).toThrow();
  expect(() => validatePassword('test long passphrase')).not.toThrow();
  expect(() => validateName('   ')).toThrow(); expect(() => validateName('bad\nname')).toThrow();
 });
 it('hashes before registration and persists only refresh digests', async () => {
  const result = await auth.register({ email: 'Teacher@Example.COM', displayName: ' Teacher ', password: 'test long passphrase' });
  expect(repo.register).toHaveBeenCalledWith(user.email, 'Teacher', 'test-hash', 'STUDENT');
  expect(repo.createSession).toHaveBeenCalledWith(user.id, 'digest:'+'a'.repeat(43), expect.any(Date));
  expect(result.expiresIn).toBe(300); expect(result.user).not.toHaveProperty('passwordHash');
 });
 it('rejects teacher and unknown roles before persisting public registrations', async () => {
  await expect(auth.register({ email: user.email, displayName: user.displayName, password: 'test long passphrase', role: 'TEACHER' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  await expect(auth.register({ email: user.email, displayName: user.displayName, password: 'test long passphrase', role: 'ADMIN' as 'TEACHER' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  expect(repo.register).not.toHaveBeenCalled();
 });
 it('performs dummy password work for unknown email and returns generic unauthorized', async () => {
  repo.findByEmail.mockResolvedValue(null); passwords.verify.mockResolvedValue(false);
  await expect(auth.login({ email: user.email, password: 'test wrong password' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  expect(passwords.verify).toHaveBeenCalledWith('test wrong password', null);
  expect(repo.createSession).not.toHaveBeenCalled();
 });
 it('rejects incorrect passwords and applies the account gate before password work', async () => {
  repo.findByEmail.mockResolvedValue({ ...user, passwordHash: 'test-hash' }); passwords.verify.mockResolvedValue(false);
  await expect(auth.login({ email: user.email, password: 'test wrong password' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  traffic.consume.mockRejectedValue(new IdentityError('RATE_LIMITED')); passwords.verify.mockClear();
  await expect(auth.login({ email: user.email, password: 'test wrong password' })).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  expect(passwords.verify).not.toHaveBeenCalled();
 });
 it('issues a session only after successful credentials', async () => {
  repo.findByEmail.mockResolvedValue({ ...user, passwordHash: 'test-hash' }); passwords.verify.mockResolvedValue(true);
  expect((await auth.login({ email: user.email, password: 'test long passphrase' })).user.id).toBe(user.id);
 });
 it('checks persisted session state for profile', async () => {
  repo.profile.mockResolvedValue(null);
  await expect(auth.profile('test-token')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  repo.profile.mockResolvedValue(user); expect(await auth.profile('test-token')).toEqual(user);
 });
 it('rotates refresh and rejects expired/reused credentials', async () => {
  repo.rotate.mockResolvedValue(session);
  expect((await auth.refresh('b'.repeat(43))).refreshToken).toBe('a'.repeat(43));
  repo.rotate.mockResolvedValue(null);
  await expect(auth.refresh('b'.repeat(43))).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  await expect(auth.refresh('invalid')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
 });
 it('logout tolerates missing cookie and revokes hashed credentials', async () => {
  await auth.logout(''); expect(repo.revoke).not.toHaveBeenCalled();
  await auth.logout('a'.repeat(43)); expect(repo.revoke).toHaveBeenCalledWith('digest:'+'a'.repeat(43));
 });
});
describe('real scrypt password adapter', () => {
 const passwords = new ScryptPasswords();
 it('uses random salts and verifies Unicode without truncation', async () => {
  const value = 'test contraseña muy extensa 🔐';
  const one = await passwords.hash(value), two = await passwords.hash(value);
  expect(one).not.toBe(two); expect(one).not.toContain(value);
  expect(await passwords.verify(value, one)).toBe(true);
  expect(await passwords.verify(value+'different', one)).toBe(false);
  expect(await passwords.verify(value, null)).toBe(false);
  expect(await passwords.verify(value, 'invalid')).toBe(false);
 });
});
