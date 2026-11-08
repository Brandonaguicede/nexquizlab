// Operator-only command: never exposed through HTTP or public registration.
const { PrismaClient } = require('../generated/client');
const { ScryptPasswords } = require('../dist/infrastructure/passwords');
const { Email, validateName, validatePassword } = require('../dist/domain/identity');
async function main() {
 const email = new Email(process.env.TEACHER_EMAIL || '').value;
 const displayName = validateName(process.env.TEACHER_NAME || 'Profesor');
 const password = process.env.TEACHER_PASSWORD || '';
 validatePassword(password);
 const db = new PrismaClient({ datasources: { db: { url: process.env.AUTH_DATABASE_URL } } });
 try {
  const passwordHash = await new ScryptPasswords().hash(password);
  await db.user.create({ data: { email, displayName, passwordHash, role: 'TEACHER' } });
  console.log('Cuenta de profesor creada.');
 } finally { await db.$disconnect(); }
}
main().catch(() => { console.error('No se pudo crear el profesor. Revisa las variables TEACHER_EMAIL, TEACHER_NAME, TEACHER_PASSWORD (12–128 caracteres), la conexión y que el correo no exista.'); process.exitCode = 1; });
