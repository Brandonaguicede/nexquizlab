/** Access tokens are short-lived so a revoked session stops working at Game within this window. */
export const ACCESS_TOKEN_SECONDS = 300;
export const SESSION_DAYS = 7;
export class IdentityError extends Error {
 constructor(readonly code: 'INVALID_INPUT' | 'DUPLICATE_EMAIL' | 'UNAUTHORIZED' | 'RATE_LIMITED' | 'BUSY') { super(code); }
}
export class Email {
 readonly value: string;
 constructor(raw: string) {
  this.value = raw.trim().toLowerCase();
  if (this.value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.value)) throw new IdentityError('INVALID_INPUT');
 }
}
export function validatePassword(value: string) {
 if (value.length < 12 || value.length > 128 || !value.trim()) throw new IdentityError('INVALID_INPUT');
}
export function validateName(value: string) {
 const name = value.trim();
 if (!name || name.length > 100 || /[\u0000-\u001f\u007f]/.test(name)) throw new IdentityError('INVALID_INPUT');
 return name;
}
export interface UserProfile { role?: 'TEACHER' | 'STUDENT'; id: string; email: string; displayName: string; createdAt: Date; }
export interface CredentialUser extends UserProfile { passwordHash: string | null; }
