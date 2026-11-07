export const GAME_LIMITS = { questionSeconds: { min: 5, max: 120, default: 20 }, maxParticipants: { min: 1, max: 500, default: 50 }, displayName: 100 } as const;
export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const JOIN_CODE_LENGTH = 6;
export const DEFAULT_DISPLAY_NAME = 'Participante';
/** A room with no state change for this long (closed tab, forgotten lobby) is cancelled so its code is released. */
export const ABANDONED_AFTER_MS = 3 * 60 * 60 * 1000;
export type SessionStatus = 'LOBBY' | 'QUESTION_OPEN' | 'QUESTION_CLOSED' | 'FINISHED' | 'CANCELLED';
export type GameErrorCode = 'NOT_FOUND' | 'INVALID_INPUT' | 'EMPTY_QUIZ' | 'ROOM_NOT_FOUND' | 'ROOM_STARTED' | 'ROOM_FULL' | 'FORBIDDEN' | 'INVALID_STATE' | 'ANSWER_WINDOW_CLOSED';
export class GameError extends Error {
 constructor(readonly code: GameErrorCode, message: string) { super(message); }
}
/** Mutable part of a session that game rules read and transitions produce. */
export interface SessionState {
 status: SessionStatus;
 questionCount: number;
 questionSeconds: number;
 currentPosition: number | null;
 openedAt: Date | null;
 deadline: Date | null;
 version: number;
}
export const isTerminal = (status: SessionStatus) => status === 'FINISHED' || status === 'CANCELLED';
/** randomInt(max) must return a uniformly distributed integer in [0, max); infrastructure supplies a CSPRNG. */
export function generateJoinCode(randomInt: (max: number) => number): string {
 let code = '';
 for (let index = 0; index < JOIN_CODE_LENGTH; index++) code += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
 return code;
}
export function normalizeJoinCode(input: string): string {
 const code = input.trim().toUpperCase();
 if (code.length !== JOIN_CODE_LENGTH || [...code].some(symbol => !JOIN_CODE_ALPHABET.includes(symbol))) throw new GameError('ROOM_NOT_FOUND', 'Room code not found');
 return code;
}
function boundedInteger(value: number | undefined, limits: { min: number; max: number; default: number }) {
 if (value === undefined) return limits.default;
 if (!Number.isInteger(value) || value < limits.min || value > limits.max) throw new GameError('INVALID_INPUT', `Value must be an integer between ${limits.min} and ${limits.max}`);
 return value;
}
export const questionSeconds = (value?: number) => boundedInteger(value, GAME_LIMITS.questionSeconds);
export const maxParticipants = (value?: number) => boundedInteger(value, GAME_LIMITS.maxParticipants);
export function displayName(name?: string | null): string {
 const text = (name ?? '').trim().slice(0, GAME_LIMITS.displayName);
 return text || DEFAULT_DISPLAY_NAME;
}
export function assertHost(hostId: string, userId: string) {
 if (hostId !== userId) throw new GameError('FORBIDDEN', 'Only the host can control this session');
}
export function assertNotHost(hostId: string, userId: string) {
 if (hostId === userId) throw new GameError('FORBIDDEN', 'The host cannot join as a participant');
}
/** Rejoining is always allowed for existing participants of a live session; new players only enter the lobby. */
export function assertCanJoin(status: SessionStatus, alreadyParticipant: boolean, participantCount: number, limit: number) {
 if (isTerminal(status)) throw new GameError('ROOM_NOT_FOUND', 'Room code not found');
 if (alreadyParticipant) return;
 if (status !== 'LOBBY') throw new GameError('ROOM_STARTED', 'The game has already started');
 if (participantCount >= limit) throw new GameError('ROOM_FULL', 'The room is full');
}
function open(state: SessionState, position: number, now: Date): SessionState {
 return { ...state, status: 'QUESTION_OPEN', currentPosition: position, openedAt: now, deadline: new Date(now.getTime() + state.questionSeconds * 1000), version: state.version + 1 };
}
function requireStatus(state: SessionState, ...allowed: SessionStatus[]) {
 if (!allowed.includes(state.status)) throw new GameError('INVALID_STATE', `Action not allowed while ${state.status}`);
}
export function start(state: SessionState, now: Date): SessionState {
 requireStatus(state, 'LOBBY');
 if (state.questionCount < 1) throw new GameError('EMPTY_QUIZ', 'The session has no questions');
 return open(state, 0, now);
}
export function close(state: SessionState): SessionState {
 requireStatus(state, 'QUESTION_OPEN');
 return { ...state, status: 'QUESTION_CLOSED', version: state.version + 1 };
}
/** Lazy close: returns the same object when no transition is due, so callers can detect a change by identity. */
export function expire(state: SessionState, now: Date): SessionState {
 return state.status === 'QUESTION_OPEN' && state.deadline !== null && now.getTime() > state.deadline.getTime() ? close(state) : state;
}
export function next(state: SessionState, now: Date): SessionState {
 requireStatus(state, 'QUESTION_CLOSED');
 const position = (state.currentPosition ?? -1) + 1;
 return position >= state.questionCount ? finish(state) : open(state, position, now);
}
export function finish(state: SessionState): SessionState {
 requireStatus(state, 'QUESTION_OPEN', 'QUESTION_CLOSED');
 return { ...state, status: 'FINISHED', version: state.version + 1 };
}
export function cancel(state: SessionState): SessionState {
 if (isTerminal(state.status)) throw new GameError('INVALID_STATE', `Action not allowed while ${state.status}`);
 return { ...state, status: 'CANCELLED', version: state.version + 1 };
}
/** The deadline is inclusive and there is no grace period: the server clock is the only authority. */
export function assertAnswerWindow(state: SessionState, questionPosition: number, receivedAt: Date) {
 if (state.status !== 'QUESTION_OPEN' || state.currentPosition !== questionPosition || state.deadline === null || receivedAt.getTime() > state.deadline.getTime()) {
  throw new GameError('ANSWER_WINDOW_CLOSED', 'This question is no longer accepting answers');
 }
}
export const isCorrect = (value: boolean, correctAnswer: boolean) => value === correctAnswer;
export function answerCounts(values: readonly boolean[], participantCount: number) {
 const trueCount = values.filter(Boolean).length, falseCount = values.length - trueCount;
 return { true: trueCount, false: falseCount, none: Math.max(0, participantCount - values.length) };
}
/** Participants may only see images of questions already shown; the host sees every snapshot image. */
export function canViewQuestion(state: SessionState, questionPosition: number, isHost: boolean) {
 if (isHost) return true;
 return state.status !== 'LOBBY' && state.status !== 'CANCELLED' && state.currentPosition !== null && questionPosition <= state.currentPosition;
}
export interface Standing { participantId: string; displayName: string; score: number; correctCount: number; }
export interface RankedStanding extends Standing { rank: number; }
/** Competition ranking (1, 1, 3): ties share a rank and are listed by display name for a stable order. */
export function rank(standings: readonly Standing[]): RankedStanding[] {
 const ordered = [...standings].sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName, 'es') || a.participantId.localeCompare(b.participantId));
 const ranked: RankedStanding[] = [];
 for (const [index, standing] of ordered.entries()) {
  const previous = ranked[index - 1];
  ranked.push({ ...standing, rank: previous && previous.score === standing.score ? previous.rank : index + 1 });
 }
 return ranked;
}
