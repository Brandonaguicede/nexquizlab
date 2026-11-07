import { GameRepository, NewSession, CopyImage, SessionAction, SessionRecord } from '../src/application/game-repository.port';
import { ImageStorage } from '../src/application/image-storage.port';
import { LiveEvents } from '../src/application/live-events';
import { Clock, LiveEvent, LiveNotifier, QuestionTimer } from '../src/application/live-ports';
import { ManageSessions } from '../src/application/manage-sessions';
import { PlaySessions } from '../src/application/play-sessions';
import { InProcessQuestionTimer } from '../src/infrastructure/question-scheduler';
const t0 = new Date('2026-11-01T10:00:00.000Z');
const session = (changes: Partial<SessionRecord> = {}): SessionRecord => ({ id: 's1', code: 'ABC234', hostId: 'host', sourceQuizId: 'q', title: 'Quiz', description: '', status: 'LOBBY', questionCount: 2, questionSeconds: 20, maxParticipants: 50, currentPosition: null, openedAt: null, deadline: null, version: 0, createdAt: t0, startedAt: null, finishedAt: null, ...changes });
const open = (changes: Partial<SessionRecord> = {}) => session({ status: 'QUESTION_OPEN', currentPosition: 0, openedAt: t0, deadline: new Date(t0.getTime() + 20_000), version: 1, ...changes });
const question = { id: 'g0', sessionId: 's1', position: 0, prompt: '¿La Tierra es redonda?', correctAnswer: true, imageId: 'img' };
const ana = { id: 'p-ana', sessionId: 's1', userId: 'ana', displayName: 'Ana', joinedAt: t0 };
const beto = { id: 'p-beto', sessionId: 's1', userId: 'beto', displayName: 'Beto', joinedAt: t0 };
function setup(state: SessionRecord, now = t0) {
 const published: LiveEvent[] = [];
 const repository = {
  session: jest.fn(async () => state), participant: jest.fn(async (_s: string, user: string) => [ana, beto].find(p => p.userId === user) ?? null),
  participants: jest.fn(async () => [ana, beto]), participantCount: jest.fn(async () => 2),
  question: jest.fn(async (_s: string, position: number) => position === 0 ? question : { ...question, id: 'g1', position: 1, imageId: null }),
  questionById: jest.fn(async (_s: string, id: string) => id === 'g0' ? question : id === 'g1' ? { ...question, id: 'g1', position: 1 } : null),
  answersFor: jest.fn(async () => [{ id: 'a1', gameQuestionId: 'g0', participantId: 'p-ana', value: true, correct: true, receivedAt: t0 }]),
  answerCount: jest.fn(async () => 1),
  scoreOf: jest.fn(async (participantId: string) => participantId === 'p-ana' ? 1 : 0),
  scores: jest.fn(async () => new Map([['p-ana', 1]])),
  results: jest.fn(async () => [{ participantId: 'p-ana', displayName: 'Ana', score: 1, correctCount: 1, rank: 1 }]),
  expire: jest.fn(async () => ({ before: state, after: state })),
 } as unknown as Record<keyof GameRepository, jest.Mock>;
 const port = repository as unknown as GameRepository;
 const storage = { copy: jest.fn(async () => undefined), remove: jest.fn(async () => undefined), open: jest.fn(async () => (async function* () { yield new Uint8Array([1]); })()) } as unknown as jest.Mocked<ImageStorage>;
 const notifier: LiveNotifier = { publish: (event: LiveEvent) => { published.push(event); } };
 const timer = { schedule: jest.fn(), cancel: jest.fn() } as jest.Mocked<QuestionTimer>;
 const clock: Clock = { now: () => now };
 const events = new LiveEvents(port, notifier, timer);
 return { repository, storage, timer, published, events, host: new ManageSessions(port, storage, events, timer, clock, 30), play: new PlaySessions(port, storage, events, notifier, clock) };
}
const errorCode = async (promise: Promise<unknown>) => { try { await promise; return 'NONE'; } catch (error) { return (error as { code?: string }).code; } };

describe('ManageSessions', () => {
 it('caps the participant limit and removes image copies when the snapshot fails', async () => {
  const { host, repository, storage } = setup(session());
  repository.createSession = jest.fn(async (input: NewSession, copy: CopyImage) => { expect(input.maxParticipants).toBe(30); await copy('src', 'copy-1'); throw new Error('commit failed'); });
  await expect(host.create('host', { quizId: 'q', maxParticipants: 200 })).rejects.toThrow('commit failed');
  expect(storage.remove).toHaveBeenCalledWith('copy-1');
 });
 it('treats closing an already closed question as a no-op', async () => {
  const closed = open({ status: 'QUESTION_CLOSED', version: 2 });
  const { host, repository } = setup(closed);
  repository.transition = jest.fn(async (_id: string, _host: string, action: SessionAction, now: Date) => ({ before: closed, after: { ...closed, ...action(closed, now) } }));
  await expect(host.close('s1', 'host')).resolves.toMatchObject({ status: 'QUESTION_CLOSED', version: 2 });
 });
 it('cancels abandoned rooms, stops their timers and tells connected clients', async () => {
  const { host, repository, timer, published } = setup(session({ status: 'CANCELLED', version: 3 }));
  repository.cancelAbandoned = jest.fn(async () => ['s1']);
  await expect(host.cancelAbandoned()).resolves.toBe(1);
  expect(repository.cancelAbandoned.mock.calls[0][0].getTime()).toBe(t0.getTime() - 3 * 60 * 60 * 1000);
  expect(timer.cancel).toHaveBeenCalledWith('s1');
  expect(published).toEqual([expect.objectContaining({ type: 'session:cancelled', version: 3, audience: { kind: 'session' } })]);
 });
 it('re-arms timers for open questions after a restart', async () => {
  const { host, repository, timer } = setup(session());
  const deadline = new Date(t0.getTime() + 5000);
  repository.openDeadlines = jest.fn(async () => [{ sessionId: 's1', deadline }]);
  await host.recover();
  expect(timer.schedule).toHaveBeenCalledWith('s1', deadline);
 });
});

describe('LiveEvents', () => {
 it('announces an opened question without its answer and arms the timer', async () => {
  const { events, published, timer } = setup(session());
  const after = open();
  await events.announce({ before: session(), after }, t0);
  expect(published).toHaveLength(1);
  expect(published[0]).toMatchObject({ type: 'question:opened', audience: { kind: 'session' }, question: { id: 'g0', position: 0, total: 2, hasImage: true } });
  expect(JSON.stringify(published[0])).not.toContain('correctAnswer');
  expect(timer.schedule).toHaveBeenCalledWith('s1', after.deadline);
 });
 it('reveals on close: counts to the room and each result only to its owner', async () => {
  const { events, published, timer } = setup(open());
  await events.announce({ before: open(), after: open({ status: 'QUESTION_CLOSED', version: 2 }) }, t0);
  expect(timer.cancel).toHaveBeenCalledWith('s1');
  expect(published[0]).toMatchObject({ type: 'question:closed', correctAnswer: true, counts: { true: 1, false: 0, none: 1 } });
  expect(published.slice(1)).toEqual([
   expect.objectContaining({ type: 'answer:result', audience: { kind: 'user', userId: 'ana' }, answered: true, correct: true, score: 1 }),
   expect.objectContaining({ type: 'answer:result', audience: { kind: 'user', userId: 'beto' }, answered: false, correct: false, score: 0 }),
  ]);
 });
 it('closes then publishes the ranking when the host finishes during a question', async () => {
  const { events, published } = setup(open());
  await events.announce({ before: open(), after: open({ status: 'FINISHED', version: 2 }) }, t0);
  expect(published.map(event => event.type)).toEqual(['question:closed', 'answer:result', 'answer:result', 'session:finished']);
 });
 it('publishes nothing when the transition did not change state', async () => {
  const { events, published } = setup(open());
  const same = open();
  await events.announce({ before: same, after: same }, t0);
  expect(published).toEqual([]);
 });
});

describe('PlaySessions', () => {
 it('joins with a normalized code and the token name, notifying only the host of new players', async () => {
  const { play, repository, published } = setup(session());
  repository.activeSessionByCode = jest.fn(async () => session());
  repository.join = jest.fn(async (_s: string, _u: string, name: string) => ({ participant: { ...ana, displayName: name }, created: true, participantCount: 1 }));
  await expect(play.join(' abc234 ', 'ana', undefined)).resolves.toMatchObject({ sessionId: 's1', displayName: 'Participante', rejoined: false });
  expect(repository.activeSessionByCode).toHaveBeenCalledWith('ABC234');
  expect(published[0]).toMatchObject({ type: 'participant:joined', audience: { kind: 'host' }, participantCount: 1 });
  repository.join = jest.fn(async () => ({ participant: ana, created: false, participantCount: 1 }));
  await expect(play.join('ABC234', 'ana', 'Ana')).resolves.toMatchObject({ rejoined: true });
  expect(published).toHaveLength(1);
 });
 it('never reveals correctness in the answer response', async () => {
  const { play, repository, published } = setup(open());
  repository.submitAnswer = jest.fn(async () => ({ answer: { id: 'a1', gameQuestionId: 'g0', participantId: 'p-ana', value: true, correct: true, receivedAt: t0 }, duplicate: false, version: 1 }));
  const response = await play.answer('s1', 'ana', 'g0', true);
  expect(response).toEqual({ gameQuestionId: 'g0', value: true, receivedAt: t0, duplicate: false });
  expect(published[0]).toMatchObject({ type: 'answer:count', audience: { kind: 'host' }, version: 1, answered: 1, participantCount: 2 });
  repository.submitAnswer = jest.fn(async () => ({ answer: { id: 'a1', gameQuestionId: 'g0', participantId: 'p-ana', value: true, correct: true, receivedAt: t0 }, duplicate: true, version: 1 }));
  await play.answer('s1', 'ana', 'g0', false);
  expect(published).toHaveLength(1);
 });
 it('hides the answer and excludes the open question from the score', async () => {
  const { play } = setup(open());
  const view = await play.state('s1', 'ana');
  expect(view.currentQuestion).not.toHaveProperty('correctAnswer');
  expect(view.me).toEqual({ participantId: 'p-ana', displayName: 'Ana', score: 0, answer: { value: true } });
  expect(view).not.toHaveProperty('participants');
 });
 it('reveals the answer, own correctness and full score once closed', async () => {
  const { play } = setup(open({ status: 'QUESTION_CLOSED', version: 2 }));
  const view = await play.state('s1', 'ana');
  expect(view.currentQuestion).toMatchObject({ correctAnswer: true, counts: { true: 1, false: 0, none: 1 } });
  expect(view.me).toMatchObject({ score: 1, answer: { value: true, correct: true } });
 });
 it('gives the host the participant list and closes an overdue question lazily', async () => {
  const overdue = open(), now = new Date(t0.getTime() + 25_000);
  const { play, repository, published } = setup(overdue, now);
  repository.expire = jest.fn(async () => ({ before: overdue, after: open({ status: 'QUESTION_CLOSED', version: 2 }) }));
  const view = await play.state('s1', 'host');
  expect(repository.expire).toHaveBeenCalledWith('s1', now);
  expect(view).toMatchObject({ role: 'host', status: 'QUESTION_CLOSED', participants: [{ id: 'p-ana', displayName: 'Ana' }, { id: 'p-beto', displayName: 'Beto' }] });
  expect(published[0]?.type).toBe('question:closed');
 });
 it('answers 404 to users unrelated to the session', async () => {
  const { play } = setup(open({ status: 'FINISHED' }));
  for (const call of [play.state('s1', 'stranger'), play.results('s1', 'stranger'), play.image('s1', 'stranger', 'g0')]) expect(await errorCode(call)).toBe('NOT_FOUND');
 });
 it('serves results only after finishing', async () => {
  expect(await errorCode(setup(open()).play.results('s1', 'ana'))).toBe('INVALID_STATE');
  await expect(setup(open({ status: 'FINISHED' })).play.results('s1', 'ana')).resolves.toMatchObject({ ranking: [{ displayName: 'Ana', rank: 1 }] });
 });
 it('serves images of opened questions to participants and every image to the host', async () => {
  const { play } = setup(open());
  expect(await errorCode(play.image('s1', 'ana', 'g0'))).toBe('NONE');
  expect(await errorCode(play.image('s1', 'ana', 'g1'))).toBe('NOT_FOUND');
  expect(await errorCode(play.image('s1', 'host', 'g1'))).toBe('NONE');
  expect(await errorCode(play.image('s1', 'ana', 'missing'))).toBe('NOT_FOUND');
 });
});

describe('InProcessQuestionTimer', () => {
 beforeEach(() => jest.useFakeTimers({ now: t0 }));
 afterEach(() => jest.useRealTimers());
 it('fires once just after the deadline and supports rescheduling and cancel', async () => {
  const timer = new InProcessQuestionTimer(), due = jest.fn(async () => undefined);
  timer.onDue(due);
  timer.schedule('s1', new Date(t0.getTime() + 1000));
  timer.schedule('s1', new Date(t0.getTime() + 2000));
  jest.advanceTimersByTime(2000);
  expect(due).not.toHaveBeenCalled();
  jest.advanceTimersByTime(60);
  expect(due).toHaveBeenCalledTimes(1);
  timer.schedule('s2', new Date(t0.getTime()));
  timer.cancel('s2');
  jest.advanceTimersByTime(5000);
  expect(due).toHaveBeenCalledTimes(1);
 });
});
