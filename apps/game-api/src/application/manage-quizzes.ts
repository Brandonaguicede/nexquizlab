import { correctAnswer, QuestionInput, questionInput, questionPrompt, quizDescription, QuizInput, quizInput, quizTitle } from '../domain/quiz';
import { QuizRepository } from './quiz-repository.port';
export class ManageQuizzes {
 constructor(private readonly repository: QuizRepository) {}
 list(owner: string, page: number, pageSize: number) { return this.repository.list(owner, page, pageSize); }
 create(owner: string, input: QuizInput) { return this.repository.create(owner, quizInput(input)); }
 detail(owner: string, id: string) { return this.repository.detail(owner, id); }
 update(owner: string, id: string, input: Partial<QuizInput>) {
  const values: Partial<QuizInput> = {};
  if (input.title !== undefined) values.title = quizTitle(input.title);
  if (input.description !== undefined) values.description = quizDescription(input.description);
  return this.repository.update(owner, id, values);
 }
 remove(owner: string, id: string) { return this.repository.remove(owner, id); }
 addQuestion(owner: string, id: string, input: QuestionInput) { return this.repository.addQuestion(owner, id, questionInput(input)); }
 updateQuestion(owner: string, id: string, questionId: string, input: Partial<QuestionInput>) {
  const values: Partial<QuestionInput> = {};
  if (input.prompt !== undefined) values.prompt = questionPrompt(input.prompt);
  if (input.correctAnswer !== undefined) values.correctAnswer = correctAnswer(input.correctAnswer);
  return this.repository.updateQuestion(owner, id, questionId, values);
 }
 removeQuestion(owner: string, id: string, questionId: string) { return this.repository.removeQuestion(owner, id, questionId); }
 reorder(owner: string, id: string, questionIds: string[]) { return this.repository.reorder(owner, id, questionIds); }
}
