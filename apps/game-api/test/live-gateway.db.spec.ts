// Opt-in: runs only with NEXQUIZ_GAME_TEST_DATABASE_URL pointing to a migrated local nexquiz_game (disposable container recommended).
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import jwt from 'jsonwebtoken';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ErrorFilter } from '../src/presentation/error.filter';
const databaseUrl = process.env.NEXQUIZ_GAME_TEST_DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;
type Received = { type: string; payload: Record<string, unknown> };
describeDb('realtime channel over Socket.IO with real PostgreSQL and RS256 identities', () => {
 const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
 const directory = mkdtempSync(join(tmpdir(), 'nexquiz-live-'));
 const issuer = 'https://auth.test.invalid';
 let app: INestApplication, url = '';
 const sockets: Socket[] = [];
 const token = (userId: string, name?: string, expiresIn = 300) => jwt.sign({ role: name === 'Profe' ? 'TEACHER' : 'STUDENT', sid: randomUUID(), ...(name ? { name } : {}) }, keys.privateKey, { algorithm: 'RS256', header: { alg: 'RS256', typ: 'at+jwt' }, issuer, audience: 'nexquiz-game-api', keyid: 'test-key', subject: userId, jwtid: randomUUID(), expiresIn });
 const rest = (userId: string, name?: string) => {
  const bearer = token(userId, name);
  return { post: (path: string, body?: object) => request(app.getHttpServer()).post('/api/v1' + path).auth(bearer, { type: 'bearer' }).send(body ?? {}) };
 };
 const open = (auth: object) => { const socket = io(url + '/live', { auth, transports: ['websocket'], reconnection: false, forceNew: true }); sockets.push(socket); return socket; };
 const connected = (socket: Socket) => new Promise<void>((resolve, reject) => { socket.once('connect', () => resolve()); socket.once('connect_error', reject); });
 const record = (socket: Socket) => { const events: Received[] = []; socket.onAny((type: string, payload: Record<string, unknown>) => events.push({ type, payload })); return events; };
 const next = (socket: Socket, event: string, timeout = 4000) => new Promise<Record<string, unknown>>((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Timed out waiting for ' + event)), timeout); socket.once(event, payload => { clearTimeout(timer); resolve(payload); }); });
 const settle = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));
 async function player(userId: string, name?: string) { const socket = open({ token: token(userId, name) }); await connected(socket); return { socket, events: record(socket) }; }
 async function game(hostId: string, title: string) {
  const host = rest(hostId, 'Profe');
  const quiz = (await host.post('/quizzes', { title }).expect(201)).body;
  await host.post(`/quizzes/${quiz.id}/questions`, { prompt: title + ' 1', correctAnswer: true }).expect(201);
  await host.post(`/quizzes/${quiz.id}/questions`, { prompt: title + ' 2', correctAnswer: false }).expect(201);
  return (await host.post('/sessions', { quizId: quiz.id, questionSeconds: 30 }).expect(201)).body as { id: string; code: string };
 }
 beforeAll(async () => {
  const publicKey = join(directory, 'public.pem');
  writeFileSync(publicKey, keys.publicKey.export({ type: 'spki', format: 'pem' }));
  Object.assign(process.env, { GAME_DATABASE_URL: databaseUrl, IMAGE_STORAGE_PATH: join(directory, 'images'), JWT_PUBLIC_KEY_PATH: publicKey, JWT_ISSUER: issuer, JWT_AUDIENCE: 'nexquiz-game-api', JWT_KEY_ID: 'test-key', CORS_ORIGINS: 'http://localhost:5173' });
  app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new ErrorFilter());
  await app.listen(0, '127.0.0.1');
  url = 'http://127.0.0.1:' + (app.getHttpServer().address() as AddressInfo).port;
 });
 afterEach(() => { for (const socket of sockets.splice(0)) socket.disconnect(); });
 afterAll(async () => { await app?.close(); rmSync(directory, { recursive: true, force: true }); });

 it('rejects handshakes without a valid access token', async () => {
  for (const auth of [{}, { token: 'not-a-jwt' }, { token: token(randomUUID(), undefined, -10) }]) await expect(connected(open(auth))).rejects.toThrow('UNAUTHORIZED');
 });

 it('delivers each room its own events, results only to their owner, and hides answers until close', async () => {
  const hostA = randomUUID(), hostB = randomUUID(), ana = randomUUID(), beto = randomUUID(), carla = randomUUID(), outsider = randomUUID();
  const roomA = await game(hostA, 'Sala A'), roomB = await game(hostB, 'Sala B');
  await rest(ana, 'Ana').post('/sessions/join', { code: roomA.code }).expect(200);
  await rest(beto, 'Beto').post('/sessions/join', { code: roomA.code }).expect(200);
  await rest(carla, 'Carla').post('/sessions/join', { code: roomB.code }).expect(200);
  const host = await player(hostA), a = await player(ana), b = await player(beto), c = await player(carla), stranger = await player(outsider);
  expect((await host.socket.emitWithAck('session:subscribe', { sessionId: roomA.id })).state).toMatchObject({ role: 'host', status: 'LOBBY', participantCount: 2 });
  expect((await a.socket.emitWithAck('session:subscribe', { sessionId: roomA.id })).state).toMatchObject({ role: 'participant', me: { displayName: 'Ana' } });
  await b.socket.emitWithAck('session:subscribe', { sessionId: roomA.id });
  await c.socket.emitWithAck('session:subscribe', { sessionId: roomB.id });
  expect(await stranger.socket.emitWithAck('session:subscribe', { sessionId: roomA.id })).toEqual({ error: { code: 'NOT_FOUND', message: 'Resource not found' } });
  expect(await stranger.socket.emitWithAck('session:subscribe', { sessionId: 'room-a' })).toMatchObject({ error: { code: 'INVALID_INPUT' } });
  expect(host.events.filter(event => event.type === 'participant:online').map(event => (event.payload.participant as { displayName: string }).displayName)).toEqual(['Ana', 'Beto']);

  const openedA = next(a.socket, 'question:opened'), openedB = next(b.socket, 'question:opened');
  await rest(hostA).post(`/sessions/${roomA.id}/start`).expect(200);
  const [question] = await Promise.all([openedA, openedB]);
  expect(question).toMatchObject({ sessionId: roomA.id, version: 1, question: { position: 0, total: 2, prompt: 'Sala A 1', hasImage: false } });
  expect(question).not.toHaveProperty('audience');
  expect(JSON.stringify(question)).not.toContain('correctAnswer');
  expect(Date.parse(question.deadline as string) - Date.parse(question.serverNow as string)).toBe(30_000);

  const counted = next(host.socket, 'answer:count');
  await rest(ana).post(`/sessions/${roomA.id}/answers`, { gameQuestionId: (question.question as { id: string }).id, value: true }).expect(200);
  expect(await counted).toMatchObject({ answered: 1, participantCount: 2 });

  const closedB = next(b.socket, 'question:closed'), resultA = next(a.socket, 'answer:result'), resultB = next(b.socket, 'answer:result');
  await rest(hostA).post(`/sessions/${roomA.id}/close`).expect(200);
  expect(await closedB).toMatchObject({ correctAnswer: true, counts: { true: 1, false: 0, none: 1 } });
  expect(await resultA).toMatchObject({ answered: true, correct: true, score: 1 });
  expect(await resultB).toMatchObject({ answered: false, correct: false, score: 0 });
  await settle();
  expect(a.events.filter(event => event.type === 'answer:result')).toHaveLength(1);
  expect(b.events.filter(event => event.type === 'answer:count')).toHaveLength(0);
  expect(c.events).toEqual([]);
  expect(stranger.events).toEqual([]);
 }, 30000);

 it('restores the same participation after a reconnection and tracks presence for the host', async () => {
  const hostId = randomUUID(), ana = randomUUID(), room = await game(hostId, 'Reconexión');
  await rest(ana, 'Ana').post('/sessions/join', { code: room.code }).expect(200);
  const host = await player(hostId), first = await player(ana, 'Ana');
  await host.socket.emitWithAck('session:subscribe', { sessionId: room.id });
  await first.socket.emitWithAck('session:subscribe', { sessionId: room.id });
  const opened = next(first.socket, 'question:opened');
  await rest(hostId).post(`/sessions/${room.id}/start`).expect(200);
  const gameQuestionId = ((await opened).question as { id: string }).id;
  await rest(ana).post(`/sessions/${room.id}/answers`, { gameQuestionId, value: true }).expect(200);

  const offline = next(host.socket, 'participant:offline');
  first.socket.disconnect();
  expect(await offline).toMatchObject({ participant: { displayName: 'Ana' } });

  const online = next(host.socket, 'participant:online');
  const again = await player(ana, 'Ana');
  const { state } = await again.socket.emitWithAck('session:subscribe', { sessionId: room.id });
  expect(await online).toMatchObject({ participant: { displayName: 'Ana' } });
  expect(state).toMatchObject({ status: 'QUESTION_OPEN', participantCount: 1, currentQuestion: { id: gameQuestionId }, me: { score: 0, answer: { value: true } } });
  expect((await rest(ana).post('/sessions/join', { code: room.code }).expect(200)).body.rejoined).toBe(true);
  expect((await rest(ana).post(`/sessions/${room.id}/answers`, { gameQuestionId, value: false }).expect(200)).body).toMatchObject({ value: true, duplicate: true });

  const finished = next(again.socket, 'session:finished');
  await rest(hostId).post(`/sessions/${room.id}/finish`).expect(200);
  expect((await finished).ranking).toEqual([expect.objectContaining({ displayName: 'Ana', score: 1, rank: 1 })]);
 }, 30000);

 it('renews authentication for the same user and disconnects on expiry or identity change', async () => {
  const user = randomUUID();
  const renewing = open({ token: token(user, undefined, 2) });
  await connected(renewing);
  const renewed = await renewing.emitWithAck('auth:renew', { token: token(user) });
  expect(renewed).toMatchObject({ ok: true });
  await settle(2500);
  expect(renewing.connected).toBe(true);

  const expiring = open({ token: token(user, undefined, 1) });
  await connected(expiring);
  const expired = next(expiring, 'auth:expired', 3000), closed = next(expiring, 'disconnect', 3000);
  await expired; await closed;
  expect(expiring.connected).toBe(false);

  const switching = open({ token: token(user) });
  await connected(switching);
  const disconnected = next(switching, 'disconnect');
  expect(await switching.emitWithAck('auth:renew', { token: token(randomUUID()) })).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Invalid access token' } });
  await disconnected;
 }, 20000);
});
