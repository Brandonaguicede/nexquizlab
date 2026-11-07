export const QUIZ_LIMITS = { title: 160, description: 2000, prompt: 2000, questions: 200, imageBytes: 5 * 1024 * 1024 } as const;
export type QuizErrorCode = 'NOT_FOUND' | 'INVALID_INPUT' | 'CONFLICT' | 'INVALID_IMAGE';
export class QuizError extends Error {
 constructor(readonly code: QuizErrorCode, message: string) { super(message); }
}
function requiredText(value: string, maximum: number): string {
 const text = value.trim();
 if (!text || text.length > maximum) throw new QuizError('INVALID_INPUT', 'Invalid text length');
 return text;
}
export interface QuizInput { title: string; description?: string; }
export interface QuestionInput { prompt: string; correctAnswer: boolean; }
/** Field rules, usable alone for partial updates. */
export const quizTitle = (value: string) => requiredText(value, QUIZ_LIMITS.title);
export function quizDescription(value = ''): string {
 const text = value.trim();
 if (text.length > QUIZ_LIMITS.description) throw new QuizError('INVALID_INPUT', 'Description too long');
 return text;
}
export const questionPrompt = (value: string) => requiredText(value, QUIZ_LIMITS.prompt);
export function correctAnswer(value: unknown): boolean {
 if (typeof value !== 'boolean') throw new QuizError('INVALID_INPUT', 'Answer must be true or false');
 return value;
}
export const quizInput = (input: QuizInput): Required<QuizInput> => ({ title: quizTitle(input.title), description: quizDescription(input.description) });
export const questionInput = (input: QuestionInput): QuestionInput => ({ prompt: questionPrompt(input.prompt), correctAnswer: correctAnswer(input.correctAnswer) });
export function validateOrder(ids: string[], current: string[]) {
 if (ids.length !== current.length || new Set(ids).size !== ids.length || current.some(id => !ids.includes(id))) {
  throw new QuizError('CONFLICT', 'Question order changed. Reload and try again.');
 }
}
export interface QuizRecord { id: string; title: string; description: string; createdAt: Date; updatedAt: Date; }
export interface QuestionRecord extends QuestionInput { id: string; quizId: string; position: number | null; imageId: string | null; createdAt: Date; updatedAt: Date; }
export interface QuizDetail extends QuizRecord { questions: QuestionRecord[]; }
export interface QuizPage { items: (QuizRecord & { questionCount: number })[]; total: number; page: number; pageSize: number; }
