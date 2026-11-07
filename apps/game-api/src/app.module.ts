import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health.module';
import { IdentityModule } from './modules/identity.module';
import { QuizModule } from './modules/quiz.module';
import { SessionModule } from './modules/session.module';
@Module({ imports: [HealthModule, IdentityModule, QuizModule, SessionModule] })
export class AppModule {}
