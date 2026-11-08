import { answerCounts, canViewQuestion, displayName, GameError, normalizeJoinCode } from '../domain/game';
import { GameRepository, ParticipantRecord, SessionRecord } from './game-repository.port';
import { ImageStorage } from './image-storage.port';
import { LiveEvents, publicQuestion } from './live-events';
import { Clock, LiveNotifier } from './live-ports';
export interface Access { session: SessionRecord; role: 'host' | 'participant'; participant: ParticipantRecord | null; }
const notFound = () => new GameError('NOT_FOUND', 'Resource not found');
/** Participant actions and the per-caller views shared by REST and the realtime channel. */
export class PlaySessions {
 constructor(private readonly repository: GameRepository, private readonly storage: ImageStorage, private readonly events: LiveEvents, private readonly notifier: LiveNotifier, private readonly clock: Clock) {}
 async join(code: string, userId: string, name?: string) {
  const session = await this.repository.activeSessionByCode(normalizeJoinCode(code));
  const { participant, created, participantCount } = await this.repository.join(session.id, userId, displayName(name));
  if (created) this.notifier.publish({ type: 'participant:joined', sessionId: session.id, version: session.version, audience: { kind: 'host' }, participant: { id: participant.id, displayName: participant.displayName }, participantCount });
  return { sessionId: session.id, participantId: participant.id, displayName: participant.displayName, status: session.status, rejoined: !created };
 }
 async answer(sessionId: string, userId: string, gameQuestionId: string, value: boolean) {
  const receivedAt = this.clock.now(); // captured before waiting for any lock
  const { answer, duplicate, version } = await this.repository.submitAnswer(sessionId, userId, gameQuestionId, value, receivedAt);
  if (!duplicate) {
   // Counted after commit, so concurrent answers see each other; clients keep the highest count per question.
   const [answered, participantCount] = await Promise.all([this.repository.answerCount(gameQuestionId), this.repository.participantCount(sessionId)]);
   this.notifier.publish({ type: 'answer:count', sessionId, version, audience: { kind: 'host' }, gameQuestionId, answered, participantCount });
  }
  // Correctness is revealed only when the question closes.
  return { gameQuestionId, value: answer.value, receivedAt: answer.receivedAt, duplicate };
 }
 /** Host or participant only; anyone else gets the same 404 as a missing session. */
 async access(sessionId: string, userId: string): Promise<Access> {
  const session = await this.repository.session(sessionId);
  if (session.hostId === userId) return { session, role: 'host', participant: null };
  const participant = await this.repository.participant(sessionId, userId);
  if (!participant) throw notFound();
  return { session, role: 'participant', participant };
 }
 private async current(session: SessionRecord) {
  const now = this.clock.now();
  if (session.status !== 'QUESTION_OPEN' || !session.deadline || now.getTime() <= session.deadline.getTime()) return session;
  const transition = await this.repository.expire(session.id, now);
  await this.events.announce(transition, now);
  return transition.after;
 }
 /** `known` reuses an access check the caller just made (realtime subscribe) instead of repeating it. */
 async state(sessionId: string, userId: string, known?: Access) {
  const access = known ?? await this.access(sessionId, userId), session = await this.current(access.session);
  const live = session.status === 'QUESTION_OPEN' || session.status === 'QUESTION_CLOSED', revealed = session.status === 'QUESTION_CLOSED';
  const question = live && session.currentPosition !== null ? await this.repository.question(session.id, session.currentPosition) : null;
  const [participants, answers] = await Promise.all([this.repository.participants(session.id), question ? this.repository.answersFor(question.id) : Promise.resolve([])]);
  let me;
  if (access.participant) {
   const own = question ? answers.find(answer => answer.participantId === access.participant!.id) ?? null : null;
   const score = await this.repository.scoreOf(access.participant.id);
   // While open, the score must not include the current answer, or it would leak correctness.
   me = { participantId: access.participant.id, displayName: access.participant.displayName, score: own && !revealed && own.correct ? score - 1 : score, answer: own ? { value: own.value, ...(revealed ? { correct: own.correct } : {}) } : null };
  }
  return {
   id: session.id, code: session.code, title: session.title, status: session.status, role: access.role, version: session.version, serverNow: this.clock.now(),
   questionCount: session.questionCount, questionSeconds: session.questionSeconds, maxParticipants: session.maxParticipants, participantCount: participants.length,
   currentQuestion: question ? { ...publicQuestion(question, session.questionCount), openedAt: session.openedAt, deadline: session.deadline, answered: answers.length, ...(revealed ? { correctAnswer: question.correctAnswer, counts: answerCounts(answers.map(answer => answer.value), participants.length) } : {}) } : null,
   ...(me ? { me } : {}),
   ...(access.role === 'host' ? { participants: participants.map(participant => ({ id: participant.id, displayName: participant.displayName })) } : {}),
   ...(session.status === 'FINISHED' ? { ranking: await this.repository.results(session.id) } : {}),
  };
 }
 history(userId: string, role: 'host' | 'participant', page: number, pageSize: number) { return this.repository.history(userId, role, page, pageSize); }
 /** Current version for informational events that do not change state (presence). */
 async version(sessionId: string) { return (await this.repository.session(sessionId)).version; }
 async results(sessionId: string, userId: string) {
  const { session } = await this.access(sessionId, userId);
  if (session.status !== 'FINISHED') throw new GameError('INVALID_STATE', 'Results are available when the session finishes');
  return { sessionId: session.id, title: session.title, finishedAt: session.finishedAt, questionCount: session.questionCount, ranking: await this.repository.results(session.id) };
 }
 async image(sessionId: string, userId: string, gameQuestionId: string) {
  const { session, role } = await this.access(sessionId, userId);
  const question = await this.repository.questionById(sessionId, gameQuestionId);
  if (!question?.imageId || !canViewQuestion(session, question.position, role === 'host')) throw notFound();
  return this.storage.open(question.imageId);
 }
}
