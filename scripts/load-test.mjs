// Load test for a live game against a running stack (default http://localhost:8080).
//   node scripts/load-test.mjs 10 30 50          participant counts to test, one game each
//   BASE_URL=https://mi-dominio node scripts/load-test.mjs 50
// Every simulated participant has its own account, joins over REST, subscribes over Socket.IO, answers each
// question twice concurrently (the second must be a duplicate) and must end with the server score it expects.
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
const require = createRequire(new URL('../apps/game-api/package.json', import.meta.url));
const { io } = require('socket.io-client');
const base = (process.env.BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const sizes = process.argv.slice(2).map(Number).filter(n => Number.isInteger(n) && n > 0);
if (!sizes.length) { console.error('Usage: node scripts/load-test.mjs <participants...>'); process.exit(2); }
const QUESTIONS = [true, false, true];
const percentile = (values, p) => { if (!values.length) return NaN; const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]; };
const ms = value => Number.isFinite(value) ? value.toFixed(0) + ' ms' : '—';
async function call(path, { token, method = 'GET', body } = {}) {
 const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-NexQuiz-CSRF': '1', Origin: base, ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
 const payload = await response.json().catch(() => null);
 if (!response.ok) { const error = new Error(`${method} ${path} -> ${response.status} ${payload?.code ?? ''}`); error.status = response.status; error.code = payload?.code; throw error; }
 return payload;
}
/** Limited parallelism: Auth bounds concurrent password hashing (503 when saturated). */
async function pool(items, limit, work) { const results = []; let next = 0; await Promise.all(Array.from({ length: limit }, async () => { while (next < items.length) { const index = next++; results[index] = await work(items[index], index); } })); return results; }
async function account(name, role = 'STUDENT') {
 const body = { email: `load-${randomUUID()}@example.invalid`, password: randomUUID() + 'aA1!', displayName: name, role };
 for (let attempt = 0; attempt < 5; attempt++) {
  try { return (await call('/auth/api/v1/auth/register', { method: 'POST', body })).accessToken; }
  catch (error) { if (error.status !== 503) throw error; await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1))); }
 }
 throw new Error('Auth stayed busy while registering');
}
async function game(size, host, players) {
 const quiz = await call('/game/api/v1/quizzes', { token: host, method: 'POST', body: { title: `Carga ${size}` } });
 for (const [index, correctAnswer] of QUESTIONS.entries()) await call(`/game/api/v1/quizzes/${quiz.id}/questions`, { token: host, method: 'POST', body: { prompt: `Pregunta ${index + 1}`, correctAnswer } });
 const session = await call('/game/api/v1/sessions', { token: host, method: 'POST', body: { quizId: quiz.id, questionSeconds: 30, maxParticipants: size } });
 const joinTimes = [];
 await Promise.all(players.map(async token => { const t = performance.now(); await call('/game/api/v1/sessions/join', { token, method: 'POST', body: { code: session.code } }); joinTimes.push(performance.now() - t); }));
 // One socket per participant, subscribed to the room.
 const clients = await Promise.all(players.map(token => new Promise((resolve, reject) => {
  const socket = io(base + '/live', { path: '/game/socket.io', transports: ['websocket'], auth: { token }, reconnection: false, forceNew: true });
  const client = { socket, token, opened: new Map(), results: new Map(), expected: 0 };
  socket.on('question:opened', event => client.opened.set(event.question.position, { at: performance.now(), id: event.question.id }));
  socket.on('answer:result', event => client.results.set(event.gameQuestionId, { at: performance.now(), score: event.score }));
  socket.once('connect_error', reject);
  socket.once('connect', async () => { const ack = await socket.emitWithAck('session:subscribe', { sessionId: session.id }); ack.state ? resolve(client) : reject(new Error(ack.error?.code)); });
 })));
 const overflow = await account('Extra').then(token => call('/game/api/v1/sessions/join', { token, method: 'POST', body: { code: session.code } })).then(() => 'ACCEPTED', error => error.code);
 const fanout = [], answerTimes = [], resultTimes = [], errors = [];
 let duplicates = 0;
 for (const [position, correct] of QUESTIONS.entries()) {
  const commanded = performance.now();
  await call(`/game/api/v1/sessions/${session.id}/${position === 0 ? 'start' : 'next'}`, { token: host, method: 'POST' });
  const deadline = Date.now() + 10000;
  while (clients.some(client => !client.opened.has(position)) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
  for (const client of clients) { const opened = client.opened.get(position); if (opened) fanout.push(opened.at - commanded); else errors.push(`question ${position + 1} not received`); }
  await Promise.all(clients.map(async client => {
   const opened = client.opened.get(position); if (!opened) return;
   const value = Math.random() < 0.5;
   if (value === correct) client.expected++;
   const t = performance.now();
   // Same answer twice at once: exactly one must be stored.
   const outcomes = await Promise.allSettled([0, 1].map(() => call(`/game/api/v1/sessions/${session.id}/answers`, { token: client.token, method: 'POST', body: { gameQuestionId: opened.id, value } })));
   answerTimes.push(performance.now() - t);
   for (const outcome of outcomes) { if (outcome.status === 'rejected') errors.push(outcome.reason.message); else if (outcome.value.duplicate) duplicates++; }
  }));
  const closed = performance.now();
  await call(`/game/api/v1/sessions/${session.id}/close`, { token: host, method: 'POST' });
  const until = Date.now() + 10000;
  while (clients.some(client => !client.results.has(client.opened.get(position)?.id)) && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 20));
  for (const client of clients) { const result = client.results.get(client.opened.get(position)?.id); if (result) resultTimes.push(result.at - closed); else errors.push(`result ${position + 1} not received`); }
 }
 const final = await call(`/game/api/v1/sessions/${session.id}/next`, { token: host, method: 'POST' });
 const results = await call(`/game/api/v1/sessions/${session.id}/results`, { token: host });
 const mismatches = clients.filter(client => [...client.results.values()].at(-1)?.score !== client.expected).length;
 for (const client of clients) client.socket.disconnect();
 return { size, status: final.status, ranked: results.ranking.length, mismatches, duplicates, overflow, errors, joinP95: percentile(joinTimes, 95), fanoutP50: percentile(fanout, 50), fanoutP95: percentile(fanout, 95), fanoutMax: Math.max(...fanout), answerP50: percentile(answerTimes, 50), answerP95: percentile(answerTimes, 95), resultP95: percentile(resultTimes, 95) };
}
const largest = Math.max(...sizes);
console.log(`Registering ${largest} participants and 1 host on ${base}…`);
const host = await account('Docente carga', 'TEACHER');
const players = await pool(Array.from({ length: largest }, (_, index) => 'Jugador ' + (index + 1)), 4, name => account(name));
const report = [];
for (const size of sizes) {
 const result = await game(size, host, players.slice(0, size));
 report.push(result);
 console.log(`${size} participants: ${result.status}, ranked ${result.ranked}, score mismatches ${result.mismatches}, duplicates ${result.duplicates}/${size * QUESTIONS.length}, overflow join ${result.overflow}, errors ${result.errors.length} | join p95 ${ms(result.joinP95)} | question fan-out p50 ${ms(result.fanoutP50)} p95 ${ms(result.fanoutP95)} max ${ms(result.fanoutMax)} | answer p50 ${ms(result.answerP50)} p95 ${ms(result.answerP95)} | result p95 ${ms(result.resultP95)}`);
 if (result.errors.length) console.log('  first errors: ' + [...new Set(result.errors)].slice(0, 3).join(' | '));
}
const failed = report.some(result => result.status !== 'FINISHED' || result.ranked !== result.size || result.mismatches || result.errors.length || result.duplicates !== result.size * QUESTIONS.length || result.overflow !== 'ROOM_FULL');
console.log(failed ? 'LOAD TEST FOUND PROBLEMS' : 'LOAD TEST PASSED: every participant received every question and result, scored exactly once, and the room rejected one participant over its limit.');
process.exitCode = failed ? 1 : 0;
