import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { PasswordHasher, SessionSecrets } from '../application/identity.ports';
import { IdentityError } from '../domain/identity';
export class ScryptPasswords implements PasswordHasher {
 private active = 0;
 private async derive(value: string, salt: Buffer): Promise<Buffer> {
  if (this.active >= 4) throw new IdentityError('BUSY');
  this.active++;
  try { return await new Promise<Buffer>((resolve, reject) => scrypt(value, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key))); }
  finally { this.active--; }
 }
 async hash(value: string) {
  const salt = randomBytes(16); const key = await this.derive(value, salt);
  return ['scrypt','32768','8','3',salt.toString('hex'),key.toString('hex')].join('$');
 }
 async verify(value: string, encoded: string | null) {
  const valid = encoded && /^scrypt\$32768\$8\$3\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(encoded);
  const parts = valid ? encoded.split('$') : [];
  const actual = await this.derive(value, valid ? Buffer.from(parts[4]!, 'hex') : Buffer.alloc(16));
  return timingSafeEqual(actual, valid ? Buffer.from(parts[5]!, 'hex') : Buffer.alloc(64)) && !!valid;
 }
}
export class RandomSessionSecrets implements SessionSecrets {
 generate() { return randomBytes(32).toString('base64url'); }
 digest(value: string) { return createHash('sha256').update(value).digest('hex'); }
}
