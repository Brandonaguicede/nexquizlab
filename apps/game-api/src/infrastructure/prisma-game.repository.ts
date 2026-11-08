import { randomInt, randomUUID } from 'node:crypto';
import { Prisma } from '../../generated/client';
import { CopyImage, GameRepository, NewSession, SessionAction, SessionRecord } from '../application/game-repository.port';
import { assertAnswerWindow, assertCanJoin, assertHost, assertNotHost, cancel, expire, GameError, generateJoinCode, isCorrect, isTerminal, rank, SessionState } from '../domain/game';
import { PrismaService } from './prisma.service';

type Transaction = Prisma.TransactionClient;
const TERMINAL = ['FINISHED', 'CANCELLED'] as const;
const sessionFields = { id: true, code: true, hostId: true, sourceQuizId: true, title: true, description: true, status: true, questionSeconds: true, maxParticipants: true, currentPosition: true, openedAt: true, deadline: true, version: true, createdAt: true, startedAt: true, finishedAt: true, _count: { select: { questions: true } } } as const;
const questionFields = { id: true, sessionId: true, position: true, prompt: true, correctAnswer: true, imageId: true } as const;
const participantFields = { id: true, sessionId: true, userId: true, displayName: true, joinedAt: true } as const;
const answerFields = { id: true, gameQuestionId: true, participantId: true, value: true, correct: true, receivedAt: true } as const;
type AnswerLookup = { participantId: string; position: number | null; correctAnswer: boolean | null; answerId: string | null; value: boolean | null; correct: boolean | null; receivedAt: Date | null };
type SessionRow = Prisma.GameSessionGetPayload<{ select: typeof sessionFields }>;
const toRecord = ({ _count, ...row }: SessionRow): SessionRecord => ({ ...row, questionCount: _count.questions });
const notFound = () => new GameError('NOT_FOUND', 'Resource not found');
/** Applies a domain transition to the full record; keeps identity when nothing changed, which persist() relies on. */
const apply = (before: SessionRecord, next: SessionState): SessionRecord => next === before ? before : { ...before, ...next };

export class PrismaGameRepository extends GameRepository {
 constructor(private readonly db: PrismaService) { super(); }
 async createSession(input: NewSession, copyImage: CopyImage) {
  return this.db.$transaction(async tx => {
   // FOR SHARE blocks authoring mutations (FOR UPDATE) until the snapshot commits, so images cannot be detached mid-copy.
   const [quiz] = await tx.$queryRaw<{ title: string; description: string }[]>`SELECT title, description FROM "Quiz" WHERE id = ${input.quizId}::uuid AND "ownerId" = ${input.hostId}::uuid AND "deletedAt" IS NULL FOR SHARE`;
   if (!quiz) throw notFound();
   const source = await tx.question.findMany({ where: { quizId: input.quizId, deletedAt: null }, orderBy: { position: 'asc' }, select: { id: true, prompt: true, correctAnswer: true, imageId: true } });
   if (!source.length) throw new GameError('EMPTY_QUIZ', 'The quiz has no questions');
   const sessionId = randomUUID();
   const questions = source.map((question, position) => ({ id: randomUUID(), sessionId, sourceQuestionId: question.id, position, prompt: question.prompt, correctAnswer: question.correctAnswer, imageId: question.imageId ? randomUUID() : null, sourceImageId: question.imageId }));
   for (const question of questions) if (question.sourceImageId && question.imageId) await copyImage(question.sourceImageId, question.imageId);
   // Serialize code allocation only; held until commit, after the slow image copies.
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('nexquiz.game.join-code'))::text`;
   const code = await this.freeCode(tx);
   await tx.gameSession.create({ data: { id: sessionId, code, hostId: input.hostId, sourceQuizId: input.quizId, title: quiz.title, description: quiz.description, questionSeconds: input.questionSeconds, maxParticipants: input.maxParticipants } });
   const images = questions.flatMap(question => question.imageId ? [{ id: question.imageId, sessionId }] : []);
   if (images.length) await tx.gameImage.createMany({ data: images });
   await tx.gameQuestion.createMany({ data: questions.map(({ sourceImageId: _source, ...question }) => question) });
   return toRecord(await tx.gameSession.findUniqueOrThrow({ where: { id: sessionId }, select: sessionFields }));
  }, { timeout: 60000 });
 }
 private async freeCode(tx: Transaction) {
  for (let attempt = 0; attempt < 20; attempt++) {
   const code = generateJoinCode(max => randomInt(max));
   if (!await tx.gameSession.findFirst({ where: { code, status: { notIn: [...TERMINAL] } }, select: { id: true } })) return code;
  }
  throw new GameError('INVALID_STATE', 'Could not allocate a room code; try again');
 }
 private async locked<T>(sessionId: string, mode: 'update' | 'share', work: (tx: Transaction, session: SessionRecord) => Promise<T>): Promise<T> {
  return this.db.$transaction(async tx => {
   const rows = mode === 'update'
    ? await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "GameSession" WHERE id = ${sessionId}::uuid FOR UPDATE`
    : await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "GameSession" WHERE id = ${sessionId}::uuid FOR SHARE`;
   if (!rows[0]) throw notFound();
   return work(tx, toRecord(await tx.gameSession.findUniqueOrThrow({ where: { id: sessionId }, select: sessionFields })));
  }, { timeout: 15000 });
 }
 async session(sessionId: string) {
  const row = await this.db.gameSession.findUnique({ where: { id: sessionId }, select: sessionFields });
  if (!row) throw notFound();
  return toRecord(row);
 }
 async activeSessionByCode(code: string) {
  const row = await this.db.gameSession.findFirst({ where: { code, status: { notIn: [...TERMINAL] } }, select: sessionFields });
  if (!row) throw new GameError('ROOM_NOT_FOUND', 'Room code not found');
  return toRecord(row);
 }
 join(sessionId: string, userId: string, displayName: string) {
  // The exclusive lock makes the participant limit exact under concurrent joins.
  return this.locked(sessionId, 'update', async (tx, session) => {
   assertNotHost(session.hostId, userId);
   const existing = await tx.participant.findUnique({ where: { sessionId_userId: { sessionId, userId } }, select: participantFields });
   const participantCount = await tx.participant.count({ where: { sessionId } });
   assertCanJoin(session.status, !!existing, participantCount, session.maxParticipants);
   if (existing) return { participant: existing, created: false, participantCount };
   return { participant: await tx.participant.create({ data: { sessionId, userId, displayName }, select: participantFields }), created: true, participantCount: participantCount + 1 };
  });
 }
 private async persist(tx: Transaction, before: SessionRecord, after: SessionRecord, now: Date) {
  if (after === before) return before;
  const data: Prisma.GameSessionUpdateInput = { status: after.status, currentPosition: after.currentPosition, openedAt: after.openedAt, deadline: after.deadline, version: after.version };
  if (before.status === 'LOBBY' && after.status === 'QUESTION_OPEN') data.startedAt = now;
  if (isTerminal(after.status) && !isTerminal(before.status)) data.finishedAt = now;
  const updated = toRecord(await tx.gameSession.update({ where: { id: before.id }, data, select: sessionFields }));
  if (after.status === 'FINISHED' && before.status !== 'FINISHED') await this.writeResults(tx, before.id);
  return updated;
 }
 private async writeResults(tx: Transaction, sessionId: string) {
  const participants = await tx.participant.findMany({ where: { sessionId }, select: { id: true, displayName: true, _count: { select: { answers: { where: { correct: true } } } } } });
  const ranked = rank(participants.map(({ id, displayName, _count }) => ({ participantId: id, displayName, score: _count.answers, correctCount: _count.answers })));
  if (ranked.length) await tx.gameResult.createMany({ data: ranked.map(({ participantId, score, correctCount, rank }) => ({ sessionId, participantId, score, correctCount, rank })) });
 }
 transition(sessionId: string, hostId: string, action: SessionAction, now: Date) {
  return this.locked(sessionId, 'update', async (tx, before) => {
   assertHost(before.hostId, hostId);
   return { before, after: await this.persist(tx, before, apply(before, action(expire(before, now), now)), now) };
  });
 }
 expire(sessionId: string, now: Date) {
  return this.locked(sessionId, 'update', async (tx, before) => {
   return { before, after: await this.persist(tx, before, apply(before, expire(before, now)), now) };
  });
 }
 async openDeadlines() {
  const rows = await this.db.gameSession.findMany({ where: { status: 'QUESTION_OPEN', deadline: { not: null } }, select: { id: true, deadline: true } });
  return rows.flatMap(row => row.deadline ? [{ sessionId: row.id, deadline: row.deadline }] : []);
 }
 async cancelAbandoned(before: Date, now: Date) {
  const stale = await this.db.gameSession.findMany({ where: { OR: [{ status: 'LOBBY', createdAt: { lt: before } }, { status: { in: ['QUESTION_OPEN', 'QUESTION_CLOSED'] }, openedAt: { lt: before } }] }, select: { id: true }, take: 500 });
  const cancelled: string[] = [];
  // Each session goes through the normal locked path, so a host acting at the same moment wins cleanly.
  for (const { id } of stale) {
   const transition = await this.locked(id, 'update', async (tx, session) => {
    const last = session.openedAt ?? session.createdAt;
    if (isTerminal(session.status) || last.getTime() >= before.getTime()) return null;
    return this.persist(tx, session, apply(session, cancel(session)), now);
   });
   if (transition) cancelled.push(id);
  }
  return cancelled;
 }
 submitAnswer(sessionId: string, userId: string, gameQuestionId: string, value: boolean, receivedAt: Date) {
  // Shared lock: answers run concurrently with each other but never interleave with a close or advance.
  return this.locked(sessionId, 'share', async (tx, session) => {
   // One round trip for the caller's participant, the question and any earlier answer (the hot path of a live game).
   const [found] = await tx.$queryRaw<AnswerLookup[]>`SELECT p.id AS "participantId", q.position, q."correctAnswer", a.id AS "answerId", a.value, a.correct, a."receivedAt"
    FROM "Participant" p
    LEFT JOIN "GameQuestion" q ON q.id = ${gameQuestionId}::uuid AND q."sessionId" = p."sessionId"
    LEFT JOIN "Answer" a ON a."gameQuestionId" = q.id AND a."participantId" = p.id
    WHERE p."sessionId" = ${sessionId}::uuid AND p."userId" = ${userId}::uuid`;
   if (!found) throw new GameError('FORBIDDEN', 'Join the session before answering');
   if (found.position === null || found.correctAnswer === null) throw notFound();
   const { participantId } = found, version = session.version;
   if (found.answerId) return { answer: { id: found.answerId, gameQuestionId, participantId, value: found.value!, correct: found.correct!, receivedAt: found.receivedAt! }, duplicate: true, version };
   assertAnswerWindow(session, found.position, receivedAt);
   const answer = { id: randomUUID(), gameQuestionId, participantId, value, correct: isCorrect(value, found.correctAnswer), receivedAt };
   // skipDuplicates emits ON CONFLICT DO NOTHING: the unique index, not this code path, guarantees a single answer.
   const { count } = await tx.answer.createMany({ data: [answer], skipDuplicates: true });
   if (count === 1) return { answer, duplicate: false, version };
   // A concurrent request of the same participant won the insert.
   return { answer: await tx.answer.findUniqueOrThrow({ where: { gameQuestionId_participantId: { gameQuestionId, participantId } }, select: answerFields }), duplicate: true, version };
  });
 }
 participant(sessionId: string, userId: string) { return this.db.participant.findUnique({ where: { sessionId_userId: { sessionId, userId } }, select: participantFields }); }
 participants(sessionId: string) { return this.db.participant.findMany({ where: { sessionId }, orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }], select: participantFields }); }
 participantCount(sessionId: string) { return this.db.participant.count({ where: { sessionId } }); }
 question(sessionId: string, position: number) { return this.db.gameQuestion.findUnique({ where: { sessionId_position: { sessionId, position } }, select: questionFields }); }
 questionById(sessionId: string, gameQuestionId: string) { return this.db.gameQuestion.findFirst({ where: { id: gameQuestionId, sessionId }, select: questionFields }); }
 answersFor(gameQuestionId: string) { return this.db.answer.findMany({ where: { gameQuestionId }, select: answerFields }); }
 answerCount(gameQuestionId: string) { return this.db.answer.count({ where: { gameQuestionId } }); }
 scoreOf(participantId: string) { return this.db.answer.count({ where: { participantId, correct: true } }); }
 async scores(sessionId: string) {
  const rows = await this.db.answer.groupBy({ by: ['participantId'], where: { correct: true, participant: { sessionId } }, _count: { _all: true } });
  return new Map(rows.map(row => [row.participantId, row._count._all]));
 }
 async history(userId: string, role: 'host' | 'participant', page: number, pageSize: number) {
  const summary = { id: true, title: true, code: true, finishedAt: true, _count: { select: { questions: true, participants: true } } } as const;
  const order = [{ finishedAt: 'desc' as const }, { id: 'asc' as const }], skip = (page - 1) * pageSize;
  if (role === 'host') {
   const where = { hostId: userId, status: 'FINISHED' as const };
   const [rows, total] = await this.db.$transaction([this.db.gameSession.findMany({ where, orderBy: order, skip, take: pageSize, select: summary }), this.db.gameSession.count({ where })], { isolationLevel: 'RepeatableRead' });
   return { items: rows.map(row => ({ sessionId: row.id, title: row.title, code: row.code, finishedAt: row.finishedAt, questionCount: row._count.questions, participantCount: row._count.participants })), total, page, pageSize };
  }
  const where = { userId, session: { status: 'FINISHED' as const } };
  const [rows, total] = await this.db.$transaction([this.db.participant.findMany({ where, orderBy: order.map(entry => ({ session: entry })), skip, take: pageSize, select: { session: { select: summary }, result: { select: { score: true, rank: true } } } }), this.db.participant.count({ where })], { isolationLevel: 'RepeatableRead' });
  return { items: rows.map(({ session, result }) => ({ sessionId: session.id, title: session.title, code: session.code, finishedAt: session.finishedAt, questionCount: session._count.questions, participantCount: session._count.participants, score: result?.score ?? 0, rank: result?.rank ?? 0 })), total, page, pageSize };
 }
 async results(sessionId: string) {
  const rows = await this.db.gameResult.findMany({ where: { sessionId }, orderBy: [{ rank: 'asc' }, { participant: { displayName: 'asc' } }], select: { participantId: true, score: true, correctCount: true, rank: true, participant: { select: { displayName: true } } } });
  return rows.map(({ participant, ...result }) => ({ ...result, displayName: participant.displayName }));
 }
}
