import { answerCounts } from '../domain/game';
import { GameQuestionRecord, GameRepository, SessionRecord, Transition } from './game-repository.port';
import { LiveNotifier, PublicQuestion, QuestionTimer } from './live-ports';
export const publicQuestion = (question: GameQuestionRecord, total: number): PublicQuestion => ({ id: question.id, position: question.position, total, prompt: question.prompt, hasImage: question.imageId !== null });
/** Translates a persisted transition into realtime events and timer changes. */
export class LiveEvents {
 constructor(private readonly repository: GameRepository, private readonly notifier: LiveNotifier, private readonly timer: QuestionTimer) {}
 async announce({ before, after }: Transition, now: Date) {
  if (after === before) return;
  const base = { sessionId: after.id, version: after.version };
  const wasOpen = before.status === 'QUESTION_OPEN';
  const opened = after.status === 'QUESTION_OPEN' && (!wasOpen || before.currentPosition !== after.currentPosition);
  if (wasOpen && (after.status !== 'QUESTION_OPEN' || opened)) {
   this.timer.cancel(after.id);
   if (before.currentPosition !== null) await this.closed(before.currentPosition, after);
  }
  if (opened && after.currentPosition !== null && after.deadline && after.openedAt) {
   const question = await this.repository.question(after.id, after.currentPosition);
   if (question) this.notifier.publish({ ...base, type: 'question:opened', audience: { kind: 'session' }, question: publicQuestion(question, after.questionCount), openedAt: after.openedAt.toISOString(), deadline: after.deadline.toISOString(), serverNow: now.toISOString() });
   this.timer.schedule(after.id, after.deadline);
  }
  if (after.status === 'FINISHED' && before.status !== 'FINISHED') this.notifier.publish({ ...base, type: 'session:finished', audience: { kind: 'session' }, ranking: await this.repository.results(after.id) });
  if (after.status === 'CANCELLED' && before.status !== 'CANCELLED') this.notifier.publish({ ...base, type: 'session:cancelled', audience: { kind: 'session' } });
 }
 cancelled(session: SessionRecord) { this.notifier.publish({ sessionId: session.id, version: session.version, type: 'session:cancelled', audience: { kind: 'session' } }); }
 private async closed(position: number, session: SessionRecord) {
  const question = await this.repository.question(session.id, position);
  if (!question) return;
  // Three queries regardless of room size; one score query per participant made closing slow in full rooms.
  const [answers, participants, scores] = await Promise.all([this.repository.answersFor(question.id), this.repository.participants(session.id), this.repository.scores(session.id)]);
  const base = { sessionId: session.id, version: session.version, gameQuestionId: question.id };
  this.notifier.publish({ ...base, type: 'question:closed', audience: { kind: 'session' }, position, correctAnswer: question.correctAnswer, counts: answerCounts(answers.map(answer => answer.value), participants.length) });
  const byParticipant = new Map(answers.map(answer => [answer.participantId, answer]));
  for (const participant of participants) {
   const answer = byParticipant.get(participant.id);
   this.notifier.publish({ ...base, type: 'answer:result', audience: { kind: 'user', userId: participant.userId }, answered: !!answer, correct: answer?.correct ?? false, score: scores.get(participant.id) ?? 0 });
  }
 }
}
