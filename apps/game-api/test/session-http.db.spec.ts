// Opt-in: runs only with NEXQUIZ_GAME_TEST_DATABASE_URL pointing to a migrated local nexquiz_game (disposable container recommended).
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ErrorFilter } from '../src/presentation/error.filter';
const databaseUrl = process.env.NEXQUIZ_GAME_TEST_DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;
describeDb('live game over HTTP with real PostgreSQL and RS256 identities', () => {
 const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
 const directory = mkdtempSync(join(tmpdir(), 'nexquiz-session-http-'));
 const issuer = 'https://auth.test.invalid';
 let app: INestApplication;
 const token = (userId: string, name?: string) => jwt.sign({ role: userId === host ? 'TEACHER' : 'STUDENT', sid: randomUUID(), ...(name ? { name } : {}) }, keys.privateKey, { algorithm: 'RS256', header: { alg: 'RS256', typ: 'at+jwt' }, issuer, audience: 'nexquiz-game-api', keyid: 'test-key', subject: userId, jwtid: randomUUID(), expiresIn: 300 });
 const host = randomUUID(), ana = randomUUID(), beto = randomUUID(), carla = randomUUID(), outsider = randomUUID();
 const as = (userId: string, name?: string) => {
  const bearer = token(userId, name), server = () => request(app.getHttpServer());
  return {
   get: (path: string) => server().get('/api/v1' + path).auth(bearer, { type: 'bearer' }),
   post: (path: string, body?: object) => server().post('/api/v1' + path).auth(bearer, { type: 'bearer' }).send(body ?? {}),
   upload: (path: string, file: Buffer) => server().post('/api/v1' + path).auth(bearer, { type: 'bearer' }).attach('file', file, 'image.png'),
  };
 };
 beforeAll(async () => {
  const publicKey = join(directory, 'public.pem');
  writeFileSync(publicKey, keys.publicKey.export({ type: 'spki', format: 'pem' }));
  Object.assign(process.env, { GAME_DATABASE_URL: databaseUrl, IMAGE_STORAGE_PATH: join(directory, 'images'), JWT_PUBLIC_KEY_PATH: publicKey, JWT_ISSUER: issuer, JWT_AUDIENCE: 'nexquiz-game-api', JWT_KEY_ID: 'test-key', GAME_MAX_PARTICIPANTS: '3' });
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new ErrorFilter());
  await app.init();
 });
 afterAll(async () => { await app?.close(); rmSync(directory, { recursive: true, force: true }); });

 it('plays a complete game with permissions, single answers, reveal, auto close and persisted ranking', async () => {
  const teacher = as(host, 'Profe'), playerA = as(ana, 'Ana'), playerB = as(beto, 'Beto'), playerC = as(carla), stranger = as(outsider, 'Intruso');
  const quiz = (await teacher.post('/quizzes', { title: 'Ciencias' }).expect(201)).body;
  const q0 = (await teacher.post(`/quizzes/${quiz.id}/questions`, { prompt: 'El agua hierve a 100 °C al nivel del mar', correctAnswer: true }).expect(201)).body;
  await teacher.post(`/quizzes/${quiz.id}/questions`, { prompt: 'La Luna es una estrella', correctAnswer: false }).expect(201);
  await teacher.upload(`/quizzes/${quiz.id}/questions/${q0.id}/image`, await sharp({ create: { width: 8, height: 8, channels: 3, background: 'teal' } }).png().toBuffer()).expect(201);
  await stranger.post('/sessions', { quizId: quiz.id }).expect(404);
  await teacher.post('/sessions', { quizId: quiz.id, questionSeconds: 4 }).expect(400);
  const created = (await teacher.post('/sessions', { quizId: quiz.id, questionSeconds: 5, maxParticipants: 10 }).expect(201)).body;
  expect(created).toMatchObject({ status: 'LOBBY', questionCount: 2, questionSeconds: 5, maxParticipants: 3 });
  const id = created.id;

  // Lobby: joining, rejoin, host exclusion, unknown codes, access isolation.
  expect((await playerA.post('/sessions/join', { code: created.code.toLowerCase() }).expect(200)).body).toMatchObject({ sessionId: id, displayName: 'Ana', rejoined: false });
  await playerB.post('/sessions/join', { code: created.code }).expect(200);
  expect((await playerC.post('/sessions/join', { code: created.code }).expect(200)).body.displayName).toBe('Participante');
  expect((await playerA.post('/sessions/join', { code: created.code }).expect(200)).body.rejoined).toBe(true);
  expect((await stranger.post('/sessions/join', { code: created.code }).expect(409)).body.code).toBe('ROOM_FULL');
  expect((await teacher.post('/sessions/join', { code: created.code }).expect(403)).body.code).toBe('FORBIDDEN');
  expect((await stranger.post('/sessions/join', { code: 'ZZZZZZ' }).expect(404)).body.code).toBe('ROOM_NOT_FOUND');
  await stranger.get(`/sessions/${id}`).expect(404);
  expect((await teacher.get(`/sessions/${id}`).expect(200)).body).toMatchObject({ role: 'host', participantCount: 3, participants: [{ displayName: 'Ana' }, { displayName: 'Beto' }, { displayName: 'Participante' }] });

  // Quiz edits after creation never reach the game.
  await teacher.post(`/quizzes/${quiz.id}/questions`, { prompt: 'Agregada después', correctAnswer: true }).expect(201);

  // Question 1: only the host controls; answers are single, hidden until close.
  await playerA.post(`/sessions/${id}/start`).expect(403);
  const opened = (await teacher.post(`/sessions/${id}/start`).expect(200)).body;
  expect(opened).toMatchObject({ status: 'QUESTION_OPEN', questionCount: 2, currentQuestion: { position: 0, total: 2, hasImage: true } });
  expect(opened.currentQuestion).not.toHaveProperty('correctAnswer');
  const g0 = opened.currentQuestion.id;
  await playerA.post(`/sessions/${id}/next`).expect(403);
  expect((await playerA.get(`/sessions/${id}/questions/${g0}/image`).expect(200)).headers['content-type']).toContain('image/webp');
  await stranger.get(`/sessions/${id}/questions/${g0}/image`).expect(404);
  expect((await playerA.post(`/sessions/${id}/answers`, { gameQuestionId: g0, value: true }).expect(200)).body).toMatchObject({ value: true, duplicate: false });
  expect((await playerA.post(`/sessions/${id}/answers`, { gameQuestionId: g0, value: false }).expect(200)).body).toMatchObject({ value: true, duplicate: true });
  await playerB.post(`/sessions/${id}/answers`, { gameQuestionId: g0, value: false }).expect(200);
  await stranger.post(`/sessions/${id}/answers`, { gameQuestionId: g0, value: true }).expect(403);
  await playerA.post(`/sessions/${id}/answers`, { gameQuestionId: g0, value: 'yes' }).expect(400);
  const waiting = (await playerA.get(`/sessions/${id}`).expect(200)).body;
  expect(waiting.me).toEqual({ participantId: expect.any(String), displayName: 'Ana', score: 0, answer: { value: true } });
  await teacher.post(`/sessions/${id}/next`).expect(409);
  const revealed = (await teacher.post(`/sessions/${id}/close`).expect(200)).body;
  expect(revealed.currentQuestion).toMatchObject({ correctAnswer: true, counts: { true: 1, false: 1, none: 1 } });
  await teacher.post(`/sessions/${id}/close`).expect(200);
  expect((await playerC.post(`/sessions/${id}/answers`, { gameQuestionId: g0, value: true }).expect(409)).body.code).toBe('ANSWER_WINDOW_CLOSED');
  expect((await playerA.get(`/sessions/${id}`).expect(200)).body.me).toMatchObject({ score: 1, answer: { value: true, correct: true } });
  await playerA.get(`/sessions/${id}/results`).expect(409);

  // Question 2 closes by itself at the server deadline.
  const second = (await teacher.post(`/sessions/${id}/next`).expect(200)).body;
  expect(second.currentQuestion).toMatchObject({ position: 1, prompt: 'La Luna es una estrella', hasImage: false });
  await playerB.post(`/sessions/${id}/answers`, { gameQuestionId: second.currentQuestion.id, value: false }).expect(200);
  await new Promise(resolve => setTimeout(resolve, 5600));
  expect((await playerB.get(`/sessions/${id}`).expect(200)).body).toMatchObject({ status: 'QUESTION_CLOSED', currentQuestion: { correctAnswer: false } });
  expect((await playerA.post(`/sessions/${id}/answers`, { gameQuestionId: second.currentQuestion.id, value: false }).expect(409)).body.code).toBe('ANSWER_WINDOW_CLOSED');

  // Finish: the ranking is persisted and only visible to people in the game.
  expect((await teacher.post(`/sessions/${id}/next`).expect(200)).body.status).toBe('FINISHED');
  const results = (await playerC.get(`/sessions/${id}/results`).expect(200)).body;
  expect(results.ranking.map((standing: { displayName: string; score: number; rank: number }) => [standing.displayName, standing.score, standing.rank])).toEqual([['Ana', 1, 1], ['Beto', 1, 1], ['Participante', 0, 3]]);
  await stranger.get(`/sessions/${id}/results`).expect(404);
  expect((await stranger.post('/sessions/join', { code: created.code }).expect(404)).body.code).toBe('ROOM_NOT_FOUND');

  // History: own sessions only, with personal score and rank for participants.
  expect((await teacher.get('/sessions?role=host').expect(200)).body.items).toEqual([expect.objectContaining({ sessionId: id, title: 'Ciencias', questionCount: 2, participantCount: 3 })]);
  expect((await playerB.get('/sessions').expect(200)).body).toMatchObject({ total: 1, items: [{ sessionId: id, score: 1, rank: 1 }] });
  expect((await playerC.get('/sessions?role=participant').expect(200)).body.items[0]).toMatchObject({ score: 0, rank: 3 });
  expect((await stranger.get('/sessions?role=host').expect(200)).body).toMatchObject({ total: 0, items: [] });
  await teacher.get('/sessions?role=admin').expect(400);
 }, 30000);

 it('documents every session endpoint in OpenAPI', () => {
  const document = SwaggerModule.createDocument(app, new DocumentBuilder().addBearerAuth().build());
  for (const path of ['/api/v1/sessions', '/api/v1/sessions/join', '/api/v1/sessions/{id}', '/api/v1/sessions/{id}/start', '/api/v1/sessions/{id}/close', '/api/v1/sessions/{id}/next', '/api/v1/sessions/{id}/finish', '/api/v1/sessions/{id}/cancel', '/api/v1/sessions/{id}/answers', '/api/v1/sessions/{id}/results', '/api/v1/sessions/{id}/questions/{gameQuestionId}/image']) expect(document.paths).toHaveProperty([path]);
  expect(document.components?.schemas).toHaveProperty('SessionStateDto');
 });
 it('rejects an empty quiz and lets the host cancel a lobby', async () => {
  const teacher = as(host, 'Profe');
  const empty = (await teacher.post('/quizzes', { title: 'Vacío' }).expect(201)).body;
  expect((await teacher.post('/sessions', { quizId: empty.id }).expect(409)).body.code).toBe('EMPTY_QUIZ');
  await teacher.post(`/quizzes/${empty.id}/questions`, { prompt: 'Una', correctAnswer: true }).expect(201);
  const created = (await teacher.post('/sessions', { quizId: empty.id }).expect(201)).body;
  expect((await teacher.post(`/sessions/${created.id}/cancel`).expect(200)).body.status).toBe('CANCELLED');
  await teacher.post(`/sessions/${created.id}/start`).expect(409);
 });
});
