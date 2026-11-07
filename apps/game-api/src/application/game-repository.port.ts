import { RankedStanding, SessionState } from '../domain/game';
export interface SessionRecord extends SessionState {
 id: string; code: string; hostId: string; sourceQuizId: string; title: string; description: string;
 maxParticipants: number; createdAt: Date; startedAt: Date | null; finishedAt: Date | null;
}
export interface GameQuestionRecord { id: string; sessionId: string; position: number; prompt: string; correctAnswer: boolean; imageId: string | null; }
export interface ParticipantRecord { id: string; sessionId: string; userId: string; displayName: string; joinedAt: Date; }
export interface AnswerRecord { id: string; gameQuestionId: string; participantId: string; value: boolean; correct: boolean; receivedAt: Date; }
export interface HistoryItem { sessionId: string; title: string; code: string; finishedAt: Date | null; questionCount: number; participantCount: number; score?: number; rank?: number; }
export interface HistoryPage { items: HistoryItem[]; total: number; page: number; pageSize: number; }
export interface NewSession { hostId: string; quizId: string; questionSeconds: number; maxParticipants: number; }
export interface Transition { before: SessionRecord; after: SessionRecord; }
export type SessionAction = (state: SessionState, now: Date) => SessionState;
/** Copies an authoring image file into a retained game image; called before the snapshot commits. */
export type CopyImage = (sourceImageId: string, gameImageId: string) => Promise<void>;
export abstract class GameRepository {
 /** Locks the owned quiz, copies its ordered questions and images, allocates a unique active join code. */
 abstract createSession(input: NewSession, copyImage: CopyImage): Promise<SessionRecord>;
 abstract session(sessionId: string): Promise<SessionRecord>;
 abstract activeSessionByCode(code: string): Promise<SessionRecord>;
 /** Returns the existing participant on rejoin; otherwise applies join rules under the session lock. */
 abstract join(sessionId: string, userId: string, displayName: string): Promise<{ participant: ParticipantRecord; created: boolean; participantCount: number }>;
 /** Locks the session, verifies the host, closes an expired question, applies the action and persists results on finish. */
 abstract transition(sessionId: string, hostId: string, action: SessionAction, now: Date): Promise<Transition>;
 /** Closes the session's question if its deadline passed; `before === after` reference when nothing changed. */
 abstract expire(sessionId: string, now: Date): Promise<Transition>;
 abstract openDeadlines(): Promise<{ sessionId: string; deadline: Date }[]>;
 /** Cancels live sessions whose last state change (creation or last opened question) is older than 'before'; returns their ids. */
 abstract cancelAbandoned(before: Date, now: Date): Promise<string[]>;
 /** Inserts at most one answer per participant and question; repeated submissions return the stored answer. `version` is read under the lock. */
 abstract submitAnswer(sessionId: string, userId: string, gameQuestionId: string, value: boolean, receivedAt: Date): Promise<{ answer: AnswerRecord; duplicate: boolean; version: number }>;
 abstract participant(sessionId: string, userId: string): Promise<ParticipantRecord | null>;
 abstract participants(sessionId: string): Promise<ParticipantRecord[]>;
 abstract participantCount(sessionId: string): Promise<number>;
 abstract question(sessionId: string, position: number): Promise<GameQuestionRecord | null>;
 abstract questionById(sessionId: string, gameQuestionId: string): Promise<GameQuestionRecord | null>;
 abstract answersFor(gameQuestionId: string): Promise<AnswerRecord[]>;
 abstract answerCount(gameQuestionId: string): Promise<number>;
 abstract scoreOf(participantId: string): Promise<number>;
 /** Correct answers of every participant in the session with one query; participants with none are absent. */
 abstract scores(sessionId: string): Promise<Map<string, number>>;
 abstract results(sessionId: string): Promise<RankedStanding[]>;
 /** Finished sessions the user hosted, or played with their own score and rank; newest first. */
 abstract history(userId: string, role: 'host' | 'participant', page: number, pageSize: number): Promise<HistoryPage>;
}
