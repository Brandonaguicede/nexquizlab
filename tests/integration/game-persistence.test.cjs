// Explicit opt-in PostgreSQL integration for live game persistence. Uses random owners; never resets/deletes data.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const url = process.env.NEXQUIZ_GAME_TEST_DATABASE_URL;
if (!url) throw new Error('Set NEXQUIZ_GAME_TEST_DATABASE_URL to a migrated local nexquiz_game database (a disposable container is recommended).');
const parsed = new URL(url);
if (parsed.pathname !== '/nexquiz_game' || !['localhost','127.0.0.1'].includes(parsed.hostname)) throw new Error('Expected a local nexquiz_game database');
process.env.GAME_DATABASE_URL = url;
const images = fs.mkdtempSync(path.join(os.tmpdir(), 'nexquiz-game-images-'));
process.env.IMAGE_STORAGE_PATH = images;
const app = path.join(__dirname, '../../apps/game-api');
require(path.join(app, 'node_modules/ts-node')).register({ project: path.join(app, 'tsconfig.json'), transpileOnly: true });
const sharp = require(path.join(app, 'node_modules/sharp'));
const { PrismaService } = require(path.join(app, 'src/infrastructure/prisma.service.ts'));
const { PrismaQuizRepository } = require(path.join(app, 'src/infrastructure/prisma-quiz.repository.ts'));
const { PrismaGameRepository } = require(path.join(app, 'src/infrastructure/prisma-game.repository.ts'));
const { LocalImageStorage, uploadRoot } = require(path.join(app, 'src/infrastructure/local-image.storage.ts'));
const { start, close, next } = require(path.join(app, 'src/domain/game.ts'));
const db = new PrismaService(), quizzes = new PrismaQuizRepository(db), games = new PrismaGameRepository(db), storage = new LocalImageStorage();
const copy = (source, target) => storage.copy(source, target);
const errorCode = async promise => { try { await promise; return 'NONE'; } catch (error) { return error.code ?? error.message; } };
before(async () => storage.initialize());
after(async () => { await db.$disconnect(); fs.rmSync(images, { recursive: true, force: true }); });

async function quizWithImage(owner, answers = [true, false, true]) {
 const quiz = await quizzes.create(owner, { title: 'Integración', description: '' });
 const questions = [];
 for (const [index, correctAnswer] of answers.entries()) questions.push(await quizzes.addQuestion(owner, quiz.id, { prompt: 'Pregunta ' + index, correctAnswer }));
 const upload = path.join(uploadRoot(), randomUUID());
 await sharp({ create: { width: 8, height: 8, channels: 3, background: 'blue' } }).png().toFile(upload);
 const asset = await quizzes.allocateImage(owner);
 await storage.save(asset.id, upload);
 await quizzes.attachImage(owner, quiz.id, questions[0].id, asset.id);
 return { quiz, questions };
}
async function session(options = {}) {
 const host = randomUUID(), { quiz, questions } = await quizWithImage(host, options.answers);
 const created = await games.createSession({ hostId: host, quizId: quiz.id, questionSeconds: options.seconds ?? 20, maxParticipants: options.max ?? 50 }, copy);
 return { host, quiz, questions, session: created };
}

test('snapshot is immutable and keeps its own image copy', async () => {
 const { host, quiz, questions, session: created } = await session();
 assert.match(created.code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
 assert.equal(created.status, 'LOBBY');
 assert.equal(created.questionCount, 3);
 await quizzes.updateQuestion(host, quiz.id, questions[0].id, { prompt: 'Editada', correctAnswer: false });
 await quizzes.attachImage(host, quiz.id, questions[0].id, null);
 await quizzes.removeQuestion(host, quiz.id, questions[2].id);
 const first = await games.question(created.id, 0), third = await games.question(created.id, 2);
 assert.deepEqual([first.prompt, first.correctAnswer, third.prompt], ['Pregunta 0', true, 'Pregunta 2']);
 assert.ok(first.imageId);
 assert.ok(fs.existsSync(path.join(images, first.imageId + '.webp')));
});

test('only the owner can snapshot a non-empty quiz', async () => {
 const owner = randomUUID(), { quiz } = await quizWithImage(owner);
 assert.equal(await errorCode(games.createSession({ hostId: randomUUID(), quizId: quiz.id, questionSeconds: 20, maxParticipants: 5 }, copy)), 'NOT_FOUND');
 const empty = await quizzes.create(owner, { title: 'Vacío', description: '' });
 assert.equal(await errorCode(games.createSession({ hostId: owner, quizId: empty.id, questionSeconds: 20, maxParticipants: 5 }, copy)), 'EMPTY_QUIZ');
});

test('concurrent sessions receive distinct active codes', async () => {
 const host = randomUUID(), { quiz } = await quizWithImage(host);
 const created = await Promise.all(Array.from({ length: 8 }, () => games.createSession({ hostId: host, quizId: quiz.id, questionSeconds: 20, maxParticipants: 5 }, copy)));
 assert.equal(new Set(created.map(item => item.code)).size, 8);
 assert.equal((await games.activeSessionByCode(created[0].code)).id, created[0].id);
});

test('participant limit is exact under concurrent joins, rejoin is idempotent and the host cannot join', async () => {
 const { host, session: created } = await session({ max: 2 });
 const results = await Promise.allSettled(Array.from({ length: 6 }, (_v, index) => games.join(created.id, randomUUID(), 'Jugador ' + index)));
 assert.equal(results.filter(result => result.status === 'fulfilled').length, 2);
 assert.ok(results.filter(result => result.status === 'rejected').every(result => result.reason.code === 'ROOM_FULL'));
 const joined = results.find(result => result.status === 'fulfilled').value.participant;
 const again = await games.join(created.id, joined.userId, 'Otro nombre');
 assert.deepEqual([again.created, again.participant.id], [false, joined.id]);
 assert.equal(await games.participantCount(created.id), 2);
 assert.equal(await errorCode(games.join(created.id, host, 'Host')), 'FORBIDDEN');
});

test('one answer per participant and question under concurrent resubmission', async () => {
 const { host, session: created } = await session();
 const user = randomUUID(), { participant } = await games.join(created.id, user, 'Ana');
 await games.transition(created.id, host, start, new Date());
 const question = await games.question(created.id, 0);
 const submissions = await Promise.all(Array.from({ length: 10 }, (_v, index) => games.submitAnswer(created.id, user, question.id, index % 2 === 0, new Date())));
 assert.equal(submissions.filter(result => !result.duplicate).length, 1);
 assert.equal(new Set(submissions.map(result => result.answer.id)).size, 1);
 assert.equal((await games.answersFor(question.id)).length, 1);
 assert.equal(await games.answerCount(question.id), 1);
 const score = await games.scoreOf(participant.id);
 assert.equal(score, submissions.find(result => !result.duplicate).answer.correct ? 1 : 0);
 assert.equal((await games.scores(created.id)).get(participant.id) ?? 0, score);
});

test('late answers, non-participants and non-hosts are rejected', async () => {
 const { host, session: created } = await session({ seconds: 5 });
 const user = randomUUID();
 await games.join(created.id, user, 'Beto');
 const openedLongAgo = new Date(Date.now() - 60_000);
 await games.transition(created.id, host, start, openedLongAgo);
 const question = await games.question(created.id, 0);
 assert.equal(await errorCode(games.submitAnswer(created.id, user, question.id, true, new Date())), 'ANSWER_WINDOW_CLOSED');
 assert.equal(await errorCode(games.submitAnswer(created.id, randomUUID(), question.id, true, openedLongAgo)), 'FORBIDDEN');
 assert.equal(await errorCode(games.transition(created.id, user, close, new Date())), 'FORBIDDEN');
 assert.equal((await games.answersFor(question.id)).length, 0);
});

test('timer close and host close race to a single transition; restart sees open deadlines', async () => {
 const { host, session: created } = await session({ seconds: 5 });
 const opened = (await games.transition(created.id, host, start, new Date(Date.now() - 10_000))).after;
 assert.ok((await games.openDeadlines()).some(item => item.sessionId === created.id));
 const now = new Date();
 const results = await Promise.allSettled([games.expire(created.id, now), games.transition(created.id, host, close, now), games.expire(created.id, now)]);
 const final = await games.session(created.id);
 assert.equal(final.status, 'QUESTION_CLOSED');
 assert.equal(final.version, opened.version + 1);
 assert.ok(results.filter(result => result.status === 'rejected').every(result => result.reason.code === 'INVALID_STATE'));
 assert.ok(!(await games.openDeadlines()).some(item => item.sessionId === created.id));
});

test('finishing persists the ranking with shared ranks', async () => {
 const { host, session: created } = await session({ answers: [true, false] });
 const ana = randomUUID(), beto = randomUUID(), carla = randomUUID();
 for (const [user, name] of [[ana, 'Ana'], [beto, 'Beto'], [carla, 'Carla']]) await games.join(created.id, user, name);
 const answer = async (position, user, value) => games.submitAnswer(created.id, user, (await games.question(created.id, position)).id, value, new Date());
 await games.transition(created.id, host, start, new Date());
 await answer(0, ana, true); await answer(0, beto, true); await answer(0, carla, false);
 await games.transition(created.id, host, close, new Date());
 await games.transition(created.id, host, next, new Date());
 await answer(1, ana, false); await answer(1, beto, false);
 await games.transition(created.id, host, close, new Date());
 const finished = (await games.transition(created.id, host, next, new Date())).after;
 assert.equal(finished.status, 'FINISHED');
 assert.ok(finished.finishedAt);
 const fresh = new PrismaGameRepository(new PrismaService());
 const ranking = await fresh.results(created.id);
 assert.deepEqual(ranking.map(item => [item.displayName, item.score, item.rank]), [['Ana', 2, 1], ['Beto', 2, 1], ['Carla', 0, 3]]);
 await assert.rejects(games.activeSessionByCode(created.code), error => error.code === 'ROOM_NOT_FOUND');
});

test('abandoned rooms are cancelled after inactivity and their codes released; recent rooms are kept', async () => {
 const stale = await session(), fresh = await session();
 await db.$executeRaw`UPDATE "GameSession" SET "createdAt" = NOW() - INTERVAL '4 hours' WHERE id = ${stale.session.id}::uuid`;
 const cancelled = await games.cancelAbandoned(new Date(Date.now() - 3 * 60 * 60 * 1000), new Date());
 assert.ok(cancelled.includes(stale.session.id));
 assert.ok(!cancelled.includes(fresh.session.id));
 const after = await games.session(stale.session.id);
 assert.equal(after.status, 'CANCELLED');
 assert.ok(after.finishedAt);
 assert.equal((await games.session(fresh.session.id)).status, 'LOBBY');
 await assert.rejects(games.activeSessionByCode(stale.session.code), error => error.code === 'ROOM_NOT_FOUND');
});
