import { Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { Clock, QuestionTimer } from '../application/live-ports';
import { ManageSessions } from '../application/manage-sessions';
export class SystemClock extends Clock { now() { return new Date(); } }
// Fire slightly after the deadline: closing requires now > deadline (the deadline itself still accepts answers).
const DEADLINE_MARGIN_MS = 50;
/** In-process timers: one per session. State lives in PostgreSQL, so a restart only needs recover(). */
export class InProcessQuestionTimer extends QuestionTimer {
 private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
 private handler?: (sessionId: string) => Promise<unknown>;
 private readonly logger = new Logger('QuestionTimer');
 onDue(handler: (sessionId: string) => Promise<unknown>) { this.handler = handler; }
 schedule(sessionId: string, deadline: Date) {
  this.cancel(sessionId);
  const delay = Math.max(0, deadline.getTime() - Date.now() + DEADLINE_MARGIN_MS);
  this.timers.set(sessionId, setTimeout(() => {
   this.timers.delete(sessionId);
   // Lazy expiry on reads and commands closes the question even if this attempt fails.
   void this.handler?.(sessionId).catch(() => this.logger.warn('Automatic question close deferred'));
  }, delay));
 }
 cancel(sessionId: string) {
  const timer = this.timers.get(sessionId);
  if (timer) clearTimeout(timer);
  this.timers.delete(sessionId);
 }
 clear() { for (const sessionId of [...this.timers.keys()]) this.cancel(sessionId); }
}
export class QuestionScheduler implements OnApplicationBootstrap, OnModuleDestroy {
 private readonly logger = new Logger('QuestionScheduler');
 private sweeper?: ReturnType<typeof setInterval>;
 constructor(private readonly timer: InProcessQuestionTimer, private readonly sessions: ManageSessions) {}
 async onApplicationBootstrap() {
  this.timer.onDue(sessionId => this.sessions.expire(sessionId));
  try { await this.sessions.recover(); } catch { this.logger.warn('Open question recovery deferred; lazy expiry still applies'); }
  const sweep = () => this.sessions.cancelAbandoned().then(count => { if (count) this.logger.log('Cancelled ' + count + ' abandoned session(s)'); }, () => this.logger.warn('Abandoned session sweep deferred'));
  void sweep();
  this.sweeper = setInterval(() => { void sweep(); }, 10 * 60 * 1000);
  this.sweeper.unref();
 }
 onModuleDestroy() { this.timer.clear(); if (this.sweeper) clearInterval(this.sweeper); }
}
