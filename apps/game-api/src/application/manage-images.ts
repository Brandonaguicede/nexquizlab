import { ImageStorage } from './image-storage.port';
import { QuizRepository } from './quiz-repository.port';
export class ManageImages {
 constructor(private readonly repository: QuizRepository, private readonly storage: ImageStorage) {}
 async upload(owner: string, quizId: string, questionId: string, temporaryPath: string) {
  await this.repository.assertQuestion(owner, quizId, questionId);
  const asset = await this.repository.allocateImage(owner);
  try {
   await this.storage.save(asset.id, temporaryPath);
   return await this.repository.attachImage(owner, quizId, questionId, asset.id);
  } catch (error) {
   // Keep the durable asset record if filesystem cleanup fails, allowing later recovery.
   try { await this.storage.remove(asset.id); await this.repository.forgetImage(asset.id); } catch { /* recovery retries stale unreferenced assets */ }
   throw error;
  }
 }
 remove(owner: string, quizId: string, questionId: string) { return this.repository.attachImage(owner, quizId, questionId, null); }
 async read(owner: string, imageId: string) { await this.repository.ownedImage(owner, imageId); return this.storage.open(imageId); }
 async collect() {
  const before = new Date(Date.now() - 60 * 60 * 1000);
  for (const image of await this.repository.garbageImages(before)) {
   await this.storage.remove(image.id);
   await this.repository.forgetImage(image.id);
  }
  await this.storage.cleanTemporary(before);
 }
}
