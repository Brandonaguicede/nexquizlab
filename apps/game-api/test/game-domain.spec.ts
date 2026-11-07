import { answerCounts, assertAnswerWindow, assertCanJoin, assertHost, assertNotHost, cancel, canViewQuestion, close, displayName, expire, finish, GameError, generateJoinCode, isCorrect, JOIN_CODE_ALPHABET, maxParticipants, next, normalizeJoinCode, questionSeconds, rank, SessionState, start } from '../src/domain/game';
const lobby: SessionState = { status: 'LOBBY', questionCount: 2, questionSeconds: 20, currentPosition: null, openedAt: null, deadline: null, version: 0 };
const t0 = new Date('2026-11-01T10:00:00.000Z');
const at = (ms: number) => new Date(t0.getTime() + ms);
const code = (fn: () => unknown) => { try { fn(); } catch (error) { return error instanceof GameError ? error.code : 'OTHER'; } return 'NONE'; };
describe('join codes', () => {
 it('uses only unambiguous symbols', () => {
  let n = 0;
  const value = generateJoinCode(max => n++ % max);
  expect(value).toHaveLength(6);
  expect([...value].every(symbol => JOIN_CODE_ALPHABET.includes(symbol))).toBe(true);
  expect(JOIN_CODE_ALPHABET).not.toMatch(/[01OI]/);
 });
 it('normalizes case and whitespace', () => expect(normalizeJoinCode('  abc234 ')).toBe('ABC234'));
 it.each(['', 'ABC23', 'ABC2345', 'ABC20O', 'ABC-23'])('rejects malformed code %j as not found', value => expect(code(() => normalizeJoinCode(value))).toBe('ROOM_NOT_FOUND'));
});
describe('session settings', () => {
 it('defaults and bounds question time', () => {
  expect(questionSeconds()).toBe(20);
  expect(questionSeconds(5)).toBe(5);
  expect(questionSeconds(120)).toBe(120);
  for (const value of [4, 121, 10.5, Number.NaN]) expect(code(() => questionSeconds(value))).toBe('INVALID_INPUT');
 });
 it('defaults and bounds participant limit', () => {
  expect(maxParticipants()).toBe(50);
  expect(code(() => maxParticipants(0))).toBe('INVALID_INPUT');
 });
 it('trims, truncates and falls back display names', () => {
  expect(displayName('  Ana ')).toBe('Ana');
  expect(displayName('x'.repeat(150))).toHaveLength(100);
  expect(displayName('   ')).toBe('Participante');
  expect(displayName(undefined)).toBe('Participante');
 });
});
describe('authorization and joining', () => {
 it('allows only the host to control', () => {
  expect(() => assertHost('h', 'h')).not.toThrow();
  expect(code(() => assertHost('h', 'p'))).toBe('FORBIDDEN');
 });
 it('keeps the host out of the participant list', () => {
  expect(code(() => assertNotHost('h', 'h'))).toBe('FORBIDDEN');
  expect(code(() => assertNotHost('h', 'p'))).toBe('NONE');
 });
 it('admits new participants only in an open lobby', () => {
  expect(code(() => assertCanJoin('LOBBY', false, 0, 2))).toBe('NONE');
  expect(code(() => assertCanJoin('LOBBY', false, 2, 2))).toBe('ROOM_FULL');
  expect(code(() => assertCanJoin('QUESTION_OPEN', false, 0, 2))).toBe('ROOM_STARTED');
  expect(code(() => assertCanJoin('FINISHED', false, 0, 2))).toBe('ROOM_NOT_FOUND');
  expect(code(() => assertCanJoin('CANCELLED', true, 0, 2))).toBe('ROOM_NOT_FOUND');
 });
 it('lets existing participants rejoin a running or full session', () => {
  expect(code(() => assertCanJoin('QUESTION_OPEN', true, 2, 2))).toBe('NONE');
  expect(code(() => assertCanJoin('QUESTION_CLOSED', true, 5, 2))).toBe('NONE');
 });
});
describe('state machine', () => {
 it('plays every question then finishes', () => {
  const first = start(lobby, t0);
  expect(first).toMatchObject({ status: 'QUESTION_OPEN', currentPosition: 0, openedAt: t0, deadline: at(20_000), version: 1 });
  const second = next(close(first), at(25_000));
  expect(second).toMatchObject({ status: 'QUESTION_OPEN', currentPosition: 1, deadline: at(45_000), version: 3 });
  expect(next(close(second), at(50_000))).toMatchObject({ status: 'FINISHED', version: 5 });
 });
 it('refuses to start an empty session', () => expect(code(() => start({ ...lobby, questionCount: 0 }, t0))).toBe('EMPTY_QUIZ'));
 it.each([
  ['start twice', () => start(start(lobby, t0), t0)],
  ['close in lobby', () => close(lobby)],
  ['next while open', () => next(start(lobby, t0), t0)],
  ['finish from lobby', () => finish(lobby)],
  ['cancel finished', () => cancel({ ...lobby, status: 'FINISHED' })],
 ])('rejects invalid transition: %s', (_label, fn) => expect(code(fn)).toBe('INVALID_STATE'));
 it('lets the host finish early or cancel', () => {
  expect(finish(start(lobby, t0)).status).toBe('FINISHED');
  expect(cancel(lobby).status).toBe('CANCELLED');
 });
 it('closes lazily only after the deadline', () => {
  const open = start(lobby, t0);
  expect(expire(open, at(20_000))).toBe(open);
  expect(expire(open, at(20_001)).status).toBe('QUESTION_CLOSED');
  expect(expire(lobby, at(99_000))).toBe(lobby);
 });
 it('does not mutate the previous state', () => {
  const open = start(lobby, t0);
  close(open);
  expect(open.status).toBe('QUESTION_OPEN');
 });
});
describe('answers and scoring', () => {
 const open = start(lobby, t0);
 it('accepts answers up to and including the deadline', () => {
  expect(() => assertAnswerWindow(open, 0, t0)).not.toThrow();
  expect(() => assertAnswerWindow(open, 0, at(20_000))).not.toThrow();
 });
 it.each([
  ['late', open, 0, at(20_001)],
  ['wrong question', open, 1, t0],
  ['closed', close(open), 0, t0],
  ['lobby', lobby, 0, t0],
 ] as const)('rejects %s answers', (_label, state, position, received) => expect(code(() => assertAnswerWindow(state, position, received))).toBe('ANSWER_WINDOW_CLOSED'));
 it('marks an answer correct only when it matches', () => {
  expect(isCorrect(false, false)).toBe(true);
  expect(isCorrect(true, false)).toBe(false);
 });
 it('counts true, false and missing answers', () => expect(answerCounts([true, false, true], 5)).toEqual({ true: 2, false: 1, none: 2 }));
});
describe('question visibility', () => {
 const open = start(lobby, t0);
 it('shows participants only questions already opened', () => {
  expect(canViewQuestion(open, 0, false)).toBe(true);
  expect(canViewQuestion(open, 1, false)).toBe(false);
  expect(canViewQuestion(lobby, 0, false)).toBe(false);
  expect(canViewQuestion(cancel(open), 0, false)).toBe(false);
 });
 it('shows the host every question', () => expect(canViewQuestion(lobby, 1, true)).toBe(true));
});
describe('ranking', () => {
 it('orders by score, shares ranks on ties and sorts ties by name', () => {
  const ranked = rank([
   { participantId: 'c', displayName: 'Carla', score: 1, correctCount: 1 },
   { participantId: 'b', displayName: 'Beto', score: 3, correctCount: 3 },
   { participantId: 'a', displayName: 'Ana', score: 3, correctCount: 3 },
   { participantId: 'd', displayName: 'Dani', score: 0, correctCount: 0 },
  ]);
  expect(ranked.map(entry => [entry.displayName, entry.rank])).toEqual([['Ana', 1], ['Beto', 1], ['Carla', 3], ['Dani', 4]]);
 });
 it('handles an empty room', () => expect(rank([])).toEqual([]));
});
