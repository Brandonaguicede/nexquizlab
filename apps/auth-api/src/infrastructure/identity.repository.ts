import { createHash } from 'node:crypto';
import { PrismaService } from './prisma.service';
import { IdentityRepository, TrafficGate } from '../application/identity.ports';
import { IdentityError } from '../domain/identity';
const publicUser = { role: true, id: true, email: true, displayName: true, createdAt: true } as const;
export class PrismaIdentityRepository implements IdentityRepository {
 constructor(private readonly db: PrismaService) {}
 async register(email: string, displayName: string, passwordHash: string, role: 'TEACHER' | 'STUDENT' = 'STUDENT') {
  try { return await this.db.user.create({ data: { email, displayName, passwordHash, role }, select: publicUser }); }
  catch (error) { if ((error as { code?: string }).code === 'P2002') throw new IdentityError('DUPLICATE_EMAIL'); throw error; }
 }
 findByEmail(email: string) { return this.db.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { ...publicUser, passwordHash: true } }); }
 async createSession(userId: string, refreshHash: string, expiresAt: Date) {
  const session = await this.db.session.create({ data: { userId, expiresAt, tokens: { create: { hash: refreshHash } } }, include: { user: { select: publicUser } } });
  return { user: session.user, sessionId: session.id, expiresAt: session.expiresAt };
 }
 async rotate(refreshHash: string, replacementHash: string, now: Date) {
  return this.db.$transaction(async tx => {
   const token = await tx.refreshToken.findUnique({ where: { hash: refreshHash } });
   if (!token) return null;
   // Serialize rotation and logout on the session row across processes.
   await tx.$queryRaw`SELECT id FROM "Session" WHERE id = ${token.sessionId}::uuid FOR UPDATE`;
   const session = await tx.session.findUnique({ where: { id: token.sessionId }, include: { user: { select: publicUser } } });
   if (!session || session.revokedAt || session.expiresAt <= now) return null;
   const consumed = await tx.refreshToken.updateMany({ where: { hash: refreshHash, usedAt: null }, data: { usedAt: now } });
   if (consumed.count !== 1) {
    await tx.session.update({ where: { id: session.id }, data: { revokedAt: now } });
    return null; // Commit revocation; throwing inside the transaction would roll it back.
   }
   await tx.refreshToken.create({ data: { hash: replacementHash, sessionId: session.id } });
   return { user: session.user, sessionId: session.id, expiresAt: session.expiresAt };
  });
 }
 async revoke(refreshHash: string) {
  const token = await this.db.refreshToken.findUnique({ where: { hash: refreshHash }, select: { sessionId: true } });
  if (token) await this.db.session.updateMany({ where: { id: token.sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
 }
 async profile(userId: string, sessionId: string, now: Date) {
  const session = await this.db.session.findFirst({ where: { id: sessionId, userId, revokedAt: null, expiresAt: { gt: now } }, select: { user: { select: publicUser } } });
  return session?.user ?? null;
 }
}
export class PrismaTrafficGate implements TrafficGate {
 constructor(private readonly db: PrismaService) {}
 async consume(identity: string, limit: number) {
  const window = Math.floor(Date.now() / 900_000);
  const key = createHash('sha256').update(identity).digest('hex') + ':' + window;
  const bucket = await this.db.rateBucket.upsert({ where: { key }, create: { key, expiresAt: new Date((window + 1) * 900_000) }, update: { count: { increment: 1 } } });
  if (bucket.count > limit) throw new IdentityError('RATE_LIMITED');
 }
}
