import { QuestionInput, QuestionRecord, QuizDetail, QuizInput, QuizPage, QuizRecord } from '../domain/quiz';
export interface ImageRecord { id: string; createdAt: Date; }
export abstract class QuizRepository {
 abstract list(owner: string, page: number, pageSize: number): Promise<QuizPage>;
 abstract create(owner: string, input: Required<QuizInput>): Promise<QuizRecord>;
 abstract detail(owner: string, id: string): Promise<QuizDetail>;
 abstract update(owner: string, id: string, input: Partial<QuizInput>): Promise<QuizRecord>;
 abstract remove(owner: string, id: string): Promise<void>;
 abstract addQuestion(owner: string, id: string, input: QuestionInput): Promise<QuestionRecord>;
 abstract updateQuestion(owner: string, id: string, questionId: string, input: Partial<QuestionInput>): Promise<QuestionRecord>;
 abstract removeQuestion(owner: string, id: string, questionId: string): Promise<void>;
 abstract reorder(owner: string, id: string, questionIds: string[]): Promise<QuizDetail>;
 abstract assertQuestion(owner: string, id: string, questionId: string): Promise<void>;
 abstract allocateImage(owner: string): Promise<ImageRecord>;
 abstract attachImage(owner: string, id: string, questionId: string, imageId: string | null): Promise<QuestionRecord>;
 abstract ownedImage(owner: string, imageId: string): Promise<ImageRecord>;
 abstract garbageImages(before: Date): Promise<ImageRecord[]>;
 abstract forgetImage(id: string): Promise<void>;
}
