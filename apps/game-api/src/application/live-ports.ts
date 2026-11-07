import { RankedStanding } from '../domain/game';
/** Question data safe to send while it is open: never includes the correct answer. */
export interface PublicQuestion { id: string; position: number; total: number; prompt: string; hasImage: boolean; }
export type Audience = { kind: 'session' } | { kind: 'host' } | { kind: 'user'; userId: string };
type Envelope<T extends string, D> = { type: T; sessionId: string; version: number; audience: Audience } & D;
export type LiveEvent =
 | Envelope<'question:opened', { question: PublicQuestion; openedAt: string; deadline: string; serverNow: string }>
 | Envelope<'question:closed', { gameQuestionId: string; position: number; correctAnswer: boolean; counts: { true: number; false: number; none: number } }>
 | Envelope<'answer:result', { gameQuestionId: string; answered: boolean; correct: boolean; score: number }>
 | Envelope<'answer:count', { gameQuestionId: string; answered: number; participantCount: number }>
 | Envelope<'participant:joined', { participant: { id: string; displayName: string }; participantCount: number }>
 /** Presence only: connection state never changes participation or score. */
 | Envelope<'participant:online' | 'participant:offline', { participant: { id: string; displayName: string } }>
 | Envelope<'session:finished', { ranking: RankedStanding[] }>
 | Envelope<'session:cancelled', Record<never, never>>;
/** Delivery is best effort; clients recover the authoritative state with GET /sessions/:id or session:subscribe. */
export abstract class LiveNotifier { abstract publish(event: LiveEvent): void; }
export abstract class QuestionTimer {
 abstract schedule(sessionId: string, deadline: Date): void;
 abstract cancel(sessionId: string): void;
}
export abstract class Clock { abstract now(): Date; }
