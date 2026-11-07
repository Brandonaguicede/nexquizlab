/** Versioned public transport contracts only. No persistence or framework dependencies. */
export interface HealthResponse { status: 'ok' | 'unavailable'; service: string; }
export interface IdentityClaims { sub: string; iss: string; aud: string | string[]; exp: number; iat: number; }
export interface QuizResponse { id: string; title: string; description: string; createdAt: string; updatedAt: string; }
export interface QuestionResponse { id: string; quizId: string; prompt: string; correctAnswer: boolean; position: number; imageId: string | null; createdAt: string; updatedAt: string; }
export interface QuizDetailResponse extends QuizResponse { questions: QuestionResponse[]; }
export interface QuizPageResponse { items: (QuizResponse & { questionCount: number })[]; total: number; page: number; pageSize: number; }
// Live game (Hito 4). REST: /game/api/v1/sessions. Realtime: namespace /live (docs/api/realtime.md).
export type SessionStatus = 'LOBBY' | 'QUESTION_OPEN' | 'QUESTION_CLOSED' | 'FINISHED' | 'CANCELLED';
export interface AnswerCounts { true: number; false: number; none: number; }
export interface PublicQuestion { id: string; position: number; total: number; prompt: string; hasImage: boolean; }
export interface CurrentQuestion extends PublicQuestion { openedAt: string; deadline: string; answered: number; correctAnswer?: boolean; counts?: AnswerCounts; }
export interface Standing { participantId: string; displayName: string; score: number; correctCount: number; rank: number; }
export interface SessionState {
 id: string; code: string; title: string; status: SessionStatus; role: 'host' | 'participant'; version: number; serverNow: string;
 questionCount: number; questionSeconds: number; maxParticipants: number; participantCount: number;
 currentQuestion: CurrentQuestion | null;
 me?: { participantId: string; displayName: string; score: number; answer: { value: boolean; correct?: boolean } | null };
 participants?: { id: string; displayName: string }[];
 ranking?: Standing[];
}
export interface SessionCreated { id: string; code: string; status: 'LOBBY'; title: string; questionCount: number; questionSeconds: number; maxParticipants: number; }
export interface Joined { sessionId: string; participantId: string; displayName: string; status: SessionStatus; rejoined: boolean; }
export interface AnswerAccepted { gameQuestionId: string; value: boolean; receivedAt: string; duplicate: boolean; }
export interface SessionResults { sessionId: string; title: string; finishedAt: string; questionCount: number; ranking: Standing[]; }
interface LiveBase { sessionId: string; version: number; }
export interface LiveEvents {
 'question:opened': LiveBase & { question: PublicQuestion; openedAt: string; deadline: string; serverNow: string };
 'question:closed': LiveBase & { gameQuestionId: string; position: number; correctAnswer: boolean; counts: AnswerCounts };
 'answer:result': LiveBase & { gameQuestionId: string; answered: boolean; correct: boolean; score: number };
 'answer:count': LiveBase & { gameQuestionId: string; answered: number; participantCount: number };
 'participant:joined': LiveBase & { participant: { id: string; displayName: string }; participantCount: number };
 'participant:online': LiveBase & { participant: { id: string; displayName: string } };
 'participant:offline': LiveBase & { participant: { id: string; displayName: string } };
 'session:finished': LiveBase & { ranking: Standing[] };
 'session:cancelled': LiveBase;
 'auth:expired': { message: string };
}
export interface HistoryItem { sessionId: string; title: string; code: string; finishedAt: string; questionCount: number; participantCount: number; score?: number; rank?: number; }
export interface HistoryPage { items: HistoryItem[]; total: number; page: number; pageSize: number; }
