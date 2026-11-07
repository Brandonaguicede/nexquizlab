import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { ManageQuizzes } from '../application/manage-quizzes';
import { ManageImages } from '../application/manage-images';
import { QUIZ_LIMITS } from '../domain/quiz';
import { PrismaService } from '../infrastructure/prisma.service';
import { PrismaQuizRepository } from '../infrastructure/prisma-quiz.repository';
import { LocalImageStorage, uploadRoot } from '../infrastructure/local-image.storage';
import { ImageMaintenance } from '../infrastructure/image-maintenance';
import { QuizController } from '../presentation/quiz.controller';
import { ImageController } from '../presentation/image.controller';
import { IdentityModule } from './identity.module';
@Module({
 imports: [IdentityModule, MulterModule.register({ storage: diskStorage({ destination: (_req, _file, callback) => callback(null, uploadRoot()), filename: (_req, _file, callback) => callback(null, randomUUID()) }), limits: { fileSize: QUIZ_LIMITS.imageBytes + 1, files: 1, fields: 0, headerPairs: 30 } })],
 controllers: [QuizController, ImageController],
 exports: [PrismaService, LocalImageStorage],
 providers: [PrismaService, LocalImageStorage,
  { provide: PrismaQuizRepository, useFactory: (db: PrismaService) => new PrismaQuizRepository(db), inject: [PrismaService] },
  { provide: ManageQuizzes, useFactory: (repo: PrismaQuizRepository) => new ManageQuizzes(repo), inject: [PrismaQuizRepository] },
  { provide: ManageImages, useFactory: (repo: PrismaQuizRepository, storage: LocalImageStorage) => new ManageImages(repo, storage), inject: [PrismaQuizRepository, LocalImageStorage] },
  { provide: ImageMaintenance, useFactory: (images: ManageImages, storage: LocalImageStorage) => new ImageMaintenance(images, storage), inject: [ManageImages, LocalImageStorage] },
 ],
})
export class QuizModule {}
