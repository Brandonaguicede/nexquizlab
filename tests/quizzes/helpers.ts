import { expect, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const requireGame = createRequire(process.cwd() + '/apps/game-api/package.json');
const sharp: typeof import('../../apps/game-api/node_modules/sharp') = requireGame('sharp');
export const api = '/game/api/v1';
export async function register(request: APIRequestContext, role: 'TEACHER' | 'STUDENT' = 'TEACHER') {
 const user = { role, email: 'quiz-test-' + randomUUID() + '@example.invalid', password: randomUUID() + '!aA7', displayName: role === 'TEACHER' ? 'Docente de prueba' : 'Estudiante de prueba' };
 const headers = { 'X-NexQuiz-CSRF': '1', Origin: 'http://localhost:8080' };
 // Public registration only creates students; teachers come from the operator-only script, as in production.
 if (role === 'TEACHER') {
  const created = spawnSync('docker', ['compose', 'exec', '-T', '-e', 'TEACHER_EMAIL', '-e', 'TEACHER_NAME', '-e', 'TEACHER_PASSWORD', 'auth-api', 'node', 'scripts/create-teacher.cjs'], { encoding: 'utf8', env: { ...process.env, TEACHER_EMAIL: user.email, TEACHER_NAME: user.displayName, TEACHER_PASSWORD: user.password } });
  expect(created.status, created.stderr).toBe(0);
 }
 const response = role === 'TEACHER'
  ? await request.post('/auth/api/v1/auth/login', { headers, data: { email: user.email, password: user.password } })
  : await request.post('/auth/api/v1/auth/register', { headers, data: user });
 expect(response.status()).toBe(role === 'TEACHER' ? 200 : 201);
 const session = await response.json();
 return { ...user, token: String(session.accessToken), id: String(session.user.id) };
}
export const bearer = (token: string) => ({ Authorization: 'Bearer ' + token });
export async function newQuiz(request: APIRequestContext, token: string) {
 const response = await request.post(api + '/quizzes', { headers: bearer(token), data: { title: 'Ciencias ' + randomUUID(), description: 'Cuestionario de aceptación' } });
 expect(response.status()).toBe(201); return response.json();
}
export async function newQuestion(request: APIRequestContext, token: string, quizId: string, prompt = 'La Tierra es un planeta.') {
 const response = await request.post(api + '/quizzes/' + quizId + '/questions', { headers: bearer(token), data: { prompt, correctAnswer: true } });
 expect(response.status()).toBe(201); return response.json();
}
export async function image(format: 'jpeg' | 'png' | 'webp' = 'png') { return sharp({ create: { width: 32, height: 24, channels: 3, background: '#203c34' } }).toFormat(format).toBuffer(); }
