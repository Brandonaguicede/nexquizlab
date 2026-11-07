// Server-side provisioning only; public registration never grants teacher access.
async function ensureDemoTeacher(db, passwords, env, validators) {
 if (env.DEMO_SEED !== 'true') return;
 const email = new validators.Email(`docente@${env.DEMO_EMAIL_DOMAIN || 'nexquiz.demo'}`).value;
 const existing = await db.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
 if (existing) {
  if (existing.role !== 'TEACHER') throw new Error('Demo email already belongs to a non-teacher account.');
  return; // Never reset an existing password or promote an existing student.
 }
 validators.validatePassword(env.DEMO_PASSWORD || '');
 const passwordHash = await passwords.hash(env.DEMO_PASSWORD);
 const user = await db.user.upsert({ where: { email }, update: {}, create: { email, displayName: 'Docente Demo', passwordHash, role: 'TEACHER' } });
 if (user.role !== 'TEACHER') throw new Error('Demo email already belongs to a non-teacher account.');
}
async function start() {
 if (process.env.DEMO_SEED === 'true') {
  const { PrismaClient } = require('../generated/client');
  const { ScryptPasswords } = require('../dist/infrastructure/passwords');
  const validators = require('../dist/domain/identity');
  const db = new PrismaClient({ datasources: { db: { url: process.env.AUTH_DATABASE_URL } } });
  try { await ensureDemoTeacher(db, new ScryptPasswords(), process.env, validators); }
  finally { await db.$disconnect(); }
 }
 require('../dist/main');
}
module.exports = { ensureDemoTeacher };
if (require.main === module) start().catch(() => { console.error('Auth startup failed. Check demo configuration, database connection and account role.'); process.exitCode = 1; });
