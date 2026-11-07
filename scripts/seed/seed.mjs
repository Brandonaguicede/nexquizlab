// Idempotent demo data loaded through the public APIs only (no database access), like any other client.
// Auth provisions the demo teacher at startup; this client logs in and creates students and the demo quiz.
import { readFile } from 'node:fs/promises';
const authUrl = (process.env.AUTH_URL || 'http://auth-api:3001').replace(/\/$/, '');
const gameUrl = (process.env.GAME_URL || 'http://game-api:3002').replace(/\/$/, '');
const password = process.env.DEMO_PASSWORD;
const domain = process.env.DEMO_EMAIL_DOMAIN || 'nexquiz.demo';
const QUIZ_TITLE = 'Quiz de demostración';
if (process.env.DEMO_SEED === 'false') { console.log('DEMO_SEED=false: demo data skipped.'); process.exit(0); }
if (!password || password.length < 12) { console.error('DEMO_PASSWORD (12+ characters) is required. Run the start script or node scripts/setup.cjs.'); process.exit(1); }
const users = [
 { email: `docente@${domain}`, role: 'TEACHER', displayName: 'Docente Demo' },
 { email: `estudiante1@${domain}`, role: 'STUDENT', displayName: 'Estudiante Uno' },
 { email: `estudiante2@${domain}`, role: 'STUDENT', displayName: 'Estudiante Dos' },
 { email: `estudiante3@${domain}`, role: 'STUDENT', displayName: 'Estudiante Tres' },
];
const questions = [
 { prompt: 'El agua pura hierve a 100 °C al nivel del mar.', correctAnswer: true, image: true },
 { prompt: 'La Luna produce su propia luz.', correctAnswer: false },
 { prompt: 'Costa Rica tiene costas en el océano Pacífico y en el mar Caribe.', correctAnswer: true },
 { prompt: 'Los murciélagos son aves.', correctAnswer: false },
 { prompt: 'La fotosíntesis libera oxígeno.', correctAnswer: true },
 { prompt: 'El sonido viaja más rápido que la luz.', correctAnswer: false },
];
async function call(url, { method = 'GET', token, body, form } = {}) {
 const headers = { 'X-NexQuiz-CSRF': '1', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) };
 const response = await fetch(url, { method, headers, body: form ?? (body ? JSON.stringify(body) : undefined) });
 const payload = await response.json().catch(() => null);
 return { status: response.status, payload };
}
async function waitFor(url) {
 for (let attempt = 1; attempt <= 30; attempt++) {
  try { if ((await fetch(url + '/api/v1/health/ready')).ok) return; } catch { /* service still starting */ }
  await new Promise(resolve => setTimeout(resolve, 2000));
 }
 throw new Error('Service not ready: ' + url);
}
/** Logs in, or registers the account the first time. */
async function account(user) {
 const login = await call(authUrl + '/api/v1/auth/login', { method: 'POST', body: { email: user.email, password } });
 if (login.status === 200) return { token: login.payload.accessToken, created: false };
 if (user.role === 'TEACHER') throw new Error('Could not log in as the demo teacher provisioned by Auth. Check DEMO_SEED, DEMO_EMAIL_DOMAIN and the original DEMO_PASSWORD.');
 const register = await call(authUrl + '/api/v1/auth/register', { method: 'POST', body: { ...user, password } });
 if (register.status === 201) return { token: register.payload.accessToken, created: true };
 throw new Error(`Could not log in or register ${user.email} (login ${login.status}, register ${register.status}). If the account exists with another password, set the original DEMO_PASSWORD.`);
}
await waitFor(authUrl); await waitFor(gameUrl);
const sessions = [];
for (const user of users) { const result = await account(user); sessions.push(result); console.log(`${result.created ? 'Created' : 'Found'} ${user.email}`); }
const teacher = sessions[0].token;
const existing = await call(gameUrl + '/api/v1/quizzes?page=1&pageSize=50', { token: teacher });
if (existing.status !== 200) throw new Error('Could not list quizzes: ' + existing.status);
const found = existing.payload.items.find(item => item.title === QUIZ_TITLE);
if (found) {
 console.log(`Found "${QUIZ_TITLE}" (${found.questionCount} questions); nothing to create.`);
} else {
 const quiz = await call(gameUrl + '/api/v1/quizzes', { method: 'POST', token: teacher, body: { title: QUIZ_TITLE, description: 'Seis preguntas de ciencias de verdadero o falso para probar una partida en vivo.' } });
 if (quiz.status !== 201) throw new Error('Could not create quiz: ' + quiz.status);
 for (const question of questions) {
  const created = await call(`${gameUrl}/api/v1/quizzes/${quiz.payload.id}/questions`, { method: 'POST', token: teacher, body: { prompt: question.prompt, correctAnswer: question.correctAnswer } });
  if (created.status !== 201) throw new Error('Could not create question: ' + created.status);
  if (question.image) {
   const form = new FormData();
   form.append('file', new Blob([await readFile(new URL('./demo-image.png', import.meta.url))], { type: 'image/png' }), 'agua-hirviendo.png');
   const upload = await call(`${gameUrl}/api/v1/quizzes/${quiz.payload.id}/questions/${created.payload.id}/image`, { method: 'POST', token: teacher, form });
   if (upload.status !== 201) throw new Error('Could not upload demo image: ' + upload.status);
  }
 }
 console.log(`Created "${QUIZ_TITLE}" with ${questions.length} questions and one image.`);
}
console.log(`Demo ready. Teacher: ${users[0].email} · Students: ${users.slice(1).map(user => user.email).join(', ')} · Password: DEMO_PASSWORD in .env`);
