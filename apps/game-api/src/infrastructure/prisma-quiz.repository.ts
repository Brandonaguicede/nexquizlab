import { Prisma } from '../../generated/client';
import { QuizRepository } from '../application/quiz-repository.port';
import { QuestionInput, QuizError, QuizInput, QUIZ_LIMITS, validateOrder } from '../domain/quiz';
import { PrismaService } from './prisma.service';

type Transaction = Prisma.TransactionClient;
const quizFields = { id: true, title: true, description: true, createdAt: true, updatedAt: true } as const;
const questionFields = { id: true, quizId: true, prompt: true, correctAnswer: true, position: true, imageId: true, createdAt: true, updatedAt: true } as const;
const activeQuestions = { where: { deletedAt: null }, orderBy: { position: 'asc' }, select: questionFields } satisfies Prisma.QuestionFindManyArgs;
const notFound = () => new QuizError('NOT_FOUND', 'Resource not found');

export class PrismaQuizRepository extends QuizRepository {
 constructor(private readonly db: PrismaService) { super(); }
 async list(ownerId: string, page: number, pageSize: number) {
  const where = { ownerId, deletedAt: null };
  const [rows, total] = await this.db.$transaction([
   this.db.quiz.findMany({ where, select: { ...quizFields, _count: { select: { questions: { where: { deletedAt: null } } } } }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * pageSize, take: pageSize }),
   this.db.quiz.count({ where }),
  ], { isolationLevel: 'RepeatableRead' });
  return { items: rows.map(({ _count, ...quiz }) => ({ ...quiz, questionCount: _count.questions })), total, page, pageSize };
 }
 create(ownerId: string, input: Required<QuizInput>) { return this.db.quiz.create({ data: { ownerId, ...input }, select: quizFields }); }
 async detail(ownerId: string, id: string) {
  const quiz = await this.db.quiz.findFirst({ where: { id, ownerId, deletedAt: null }, select: { ...quizFields, questions: activeQuestions } });
  if (!quiz) throw notFound();
  return quiz;
 }
 private async locked<T>(ownerId: string, id: string, work: (tx: Transaction) => Promise<T>, includeDeleted = false): Promise<T> {
  return this.db.$transaction(async tx => {
   // One aggregate lock serializes all question positions, image associations and deletion.
   const rows = await tx.$queryRaw<{ deletedAt: Date | null }[]>`SELECT "deletedAt" FROM "Quiz" WHERE id = ${id}::uuid AND "ownerId" = ${ownerId}::uuid FOR UPDATE`;
   if (!rows[0] || (!includeDeleted && rows[0].deletedAt)) throw notFound();
   return work(tx);
  }, { timeout: 15000 });
 }
 private async question(tx: Transaction, quizId: string, id: string) {
  const question = await tx.question.findFirst({ where: { id, quizId, deletedAt: null }, select: questionFields });
  if (!question) throw notFound();
  return question;
 }
 private touch(tx: Transaction, id: string) { return tx.quiz.update({ where: { id }, data: { updatedAt: new Date() }, select: quizFields }); }
 update(owner: string, id: string, input: Partial<QuizInput>) {
  return this.locked(owner, id, tx => tx.quiz.update({ where: { id }, data: { ...input, updatedAt: new Date() }, select: quizFields }));
 }
 async remove(owner: string, id: string) {
  await this.locked(owner, id, async tx => {
   const questions = await tx.question.findMany({ where: { quizId: id, imageId: { not: null } }, select: { imageId: true } });
   const imageIds = questions.flatMap(q => q.imageId ? [q.imageId] : []);
   await tx.question.updateMany({ where: { quizId: id, deletedAt: null }, data: { deletedAt: new Date(), position: null, imageId: null } });
   await tx.imageAsset.updateMany({ where: { id: { in: imageIds } }, data: { detachedAt: new Date() } });
   await tx.quiz.update({ where: { id }, data: { deletedAt: new Date() } });
  }, true);
 }
 addQuestion(owner: string, id: string, input: QuestionInput) {
  return this.locked(owner, id, async tx => {
   const position = await tx.question.count({ where: { quizId: id, deletedAt: null } });
   if (position >= QUIZ_LIMITS.questions) throw new QuizError('CONFLICT', 'A quiz supports at most 200 questions');
   const question = await tx.question.create({ data: { quizId: id, ...input, position }, select: questionFields });
   await this.touch(tx, id);
   return question;
  });
 }
 updateQuestion(owner: string, id: string, questionId: string, input: Partial<QuestionInput>) {
  return this.locked(owner, id, async tx => {
   await this.question(tx, id, questionId);
   const question = await tx.question.update({ where: { id: questionId }, data: input, select: questionFields });
   await this.touch(tx, id);
   return question;
  });
 }
 private async setPositions(tx: Transaction, quizId: string, ids: string[]) {
  // NULL releases the unique slots inside this transaction, invisible to other readers.
  await tx.question.updateMany({ where: { quizId, deletedAt: null }, data: { position: null } });
  if (ids.length) await tx.$executeRaw`UPDATE "Question" AS q SET position = v.ordinality::integer - 1, "updatedAt" = NOW() FROM unnest(${ids}::uuid[]) WITH ORDINALITY AS v(id, ordinality) WHERE q.id = v.id AND q."quizId" = ${quizId}::uuid`;
 }
 async removeQuestion(owner: string, id: string, questionId: string) {
  await this.locked(owner, id, async tx => {
   const existing = await tx.question.findFirst({ where: { id: questionId, quizId: id }, select: { ...questionFields, deletedAt: true } });
   if (!existing) throw notFound();
   if (existing.deletedAt) return;
   await tx.question.update({ where: { id: questionId }, data: { deletedAt: new Date(), position: null, imageId: null } });
   if (existing.imageId) await tx.imageAsset.update({ where: { id: existing.imageId }, data: { detachedAt: new Date() } });
   const remaining = await tx.question.findMany({ where: { quizId: id, deletedAt: null }, orderBy: { position: 'asc' }, select: { id: true } });
   await this.setPositions(tx, id, remaining.map(q => q.id));
   await this.touch(tx, id);
  });
 }
 reorder(owner: string, id: string, ids: string[]) {
  return this.locked(owner, id, async tx => {
   const questions = await tx.question.findMany({ where: { quizId: id, deletedAt: null }, select: { id: true } });
   validateOrder(ids, questions.map(q => q.id));
   await this.setPositions(tx, id, ids);
   await this.touch(tx, id);
   return tx.quiz.findUniqueOrThrow({ where: { id }, select: { ...quizFields, questions: activeQuestions } });
  });
 }
 async assertQuestion(owner: string, id: string, questionId: string) { await this.locked(owner, id, tx => this.question(tx, id, questionId)); }
 allocateImage(ownerId: string) { return this.db.imageAsset.create({ data: { ownerId }, select: { id: true, createdAt: true } }); }
 attachImage(owner: string, id: string, questionId: string, imageId: string | null) {
  return this.locked(owner, id, async tx => {
   const previous = await this.question(tx, id, questionId);
   if (imageId) {
    const asset = await tx.imageAsset.findFirst({ where: { id: imageId, ownerId: owner, detachedAt: null, createdAt: { gt: new Date(Date.now() - 30 * 60 * 1000) }, question: null }, select: { id: true } });
    if (!asset) throw notFound();
   }
   const question = await tx.question.update({ where: { id: questionId }, data: { imageId }, select: questionFields });
   if (previous.imageId) await tx.imageAsset.update({ where: { id: previous.imageId }, data: { detachedAt: new Date() } });
   await this.touch(tx, id);
   return question;
  });
 }
 async ownedImage(ownerId: string, id: string) {
  const asset = await this.db.imageAsset.findFirst({ where: { id, ownerId, question: { is: { deletedAt: null, quiz: { ownerId, deletedAt: null } } } }, select: { id: true, createdAt: true } });
  if (!asset) throw notFound();
  return asset;
 }
 garbageImages(before: Date) {
  return this.db.imageAsset.findMany({ where: { question: null, OR: [{ detachedAt: { not: null } }, { createdAt: { lt: before } }] }, select: { id: true, createdAt: true }, take: 100, orderBy: { createdAt: 'asc' } });
 }
 async forgetImage(id: string) { await this.db.imageAsset.deleteMany({ where: { id, question: null } }); }
}
