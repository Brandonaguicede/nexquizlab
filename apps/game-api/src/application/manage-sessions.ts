import { ABANDONED_AFTER_MS, close, cancel, finish, maxParticipants, next, questionSeconds, SessionState, start } from '../domain/game';
import { GameRepository, SessionAction } from './game-repository.port';
import { ImageStorage } from './image-storage.port';
import { LiveEvents } from './live-events';
import { Clock, QuestionTimer } from './live-ports';
export interface CreateSessionInput { quizId: string; questionSeconds?: number; maxParticipants?: number; }
/** Closing an already closed question is a no-op, so a host click racing the timer never fails. */
const closeOpen = (state: SessionState) => state.status === 'QUESTION_CLOSED' ? state : close(state);
/** Host-only commands. Every state change is applied under the session lock, then announced. */
export class ManageSessions {
 constructor(private readonly repository: GameRepository, private readonly storage: ImageStorage, private readonly events: LiveEvents, private readonly timer: QuestionTimer, private readonly clock: Clock, private readonly participantCap: number) {}
 async create(hostId: string, input: CreateSessionInput) {
  const settings = { hostId, quizId: input.quizId, questionSeconds: questionSeconds(input.questionSeconds), maxParticipants: Math.min(maxParticipants(input.maxParticipants ?? this.participantCap), this.participantCap) };
  const copied: string[] = [];
  try {
   return await this.repository.createSession(settings, async (sourceId, targetId) => { await this.storage.copy(sourceId, targetId); copied.push(targetId); });
  } catch (error) {
   // The snapshot rolled back; remove image copies it would have owned.
   for (const id of copied) await this.storage.remove(id).catch(() => undefined);
   throw error;
  }
 }
 private async command(sessionId: string, hostId: string, action: SessionAction) {
  const now = this.clock.now(), transition = await this.repository.transition(sessionId, hostId, action, now);
  await this.events.announce(transition, now);
  return transition.after;
 }
 start(sessionId: string, hostId: string) { return this.command(sessionId, hostId, start); }
 close(sessionId: string, hostId: string) { return this.command(sessionId, hostId, closeOpen); }
 next(sessionId: string, hostId: string) { return this.command(sessionId, hostId, next); }
 finish(sessionId: string, hostId: string) { return this.command(sessionId, hostId, finish); }
 cancel(sessionId: string, hostId: string) { return this.command(sessionId, hostId, cancel); }
 /** Timer path: closes the question once its deadline passed; harmless if the host already moved on. */
 async expire(sessionId: string) {
  const now = this.clock.now(), transition = await this.repository.expire(sessionId, now);
  await this.events.announce(transition, now);
  return transition.after;
 }
 /** Releases rooms nobody finished (closed tab, forgotten lobby); participants still connected are told it was cancelled. */
 async cancelAbandoned() {
  const now = this.clock.now(), ids = await this.repository.cancelAbandoned(new Date(now.getTime() - ABANDONED_AFTER_MS), now);
  for (const id of ids) { this.timer.cancel(id); const session = await this.repository.session(id); this.events.cancelled(session); }
  return ids.length;
 }
 /** After a restart, re-arm timers; deadlines already past fire immediately. */
 async recover() {
  for (const { sessionId, deadline } of await this.repository.openDeadlines()) this.timer.schedule(sessionId, deadline);
 }
}
