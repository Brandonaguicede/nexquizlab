import { Module } from '@nestjs/common';
import { LiveEvents } from '../application/live-events';
import { Clock, LiveNotifier } from '../application/live-ports';
import { ManageSessions } from '../application/manage-sessions';
import { PlaySessions } from '../application/play-sessions';
import { maxParticipants } from '../domain/game';
import { LocalImageStorage } from '../infrastructure/local-image.storage';
import { PrismaGameRepository } from '../infrastructure/prisma-game.repository';
import { PrismaService } from '../infrastructure/prisma.service';
import { SessionMetrics } from '../infrastructure/session-metrics';
import { InProcessQuestionTimer, QuestionScheduler, SystemClock } from '../infrastructure/question-scheduler';
import { LiveBroadcaster, LiveGateway } from '../presentation/live.gateway';
import { SessionController } from '../presentation/session.controller';
import { IdentityModule } from './identity.module';
import { QuizModule } from './quiz.module';
@Module({
 imports: [IdentityModule, QuizModule],
 controllers: [SessionController],
 providers: [
  { provide: PrismaGameRepository, useFactory: (db: PrismaService) => new PrismaGameRepository(db), inject: [PrismaService] },
  { provide: Clock, useClass: SystemClock },
  LiveBroadcaster,
  { provide: LiveNotifier, useExisting: LiveBroadcaster },
  LiveGateway,
  InProcessQuestionTimer,
  { provide: LiveEvents, useFactory: (repo: PrismaGameRepository, notifier: LiveNotifier, timer: InProcessQuestionTimer) => new LiveEvents(repo, notifier, timer), inject: [PrismaGameRepository, LiveNotifier, InProcessQuestionTimer] },
  { provide: ManageSessions, useFactory: (repo: PrismaGameRepository, storage: LocalImageStorage, events: LiveEvents, timer: InProcessQuestionTimer, clock: Clock) => new ManageSessions(repo, storage, events, timer, clock, maxParticipants(process.env.GAME_MAX_PARTICIPANTS ? Number(process.env.GAME_MAX_PARTICIPANTS) : undefined)), inject: [PrismaGameRepository, LocalImageStorage, LiveEvents, InProcessQuestionTimer, Clock] },
  { provide: PlaySessions, useFactory: (repo: PrismaGameRepository, storage: LocalImageStorage, events: LiveEvents, notifier: LiveNotifier, clock: Clock) => new PlaySessions(repo, storage, events, notifier, clock), inject: [PrismaGameRepository, LocalImageStorage, LiveEvents, LiveNotifier, Clock] },
  { provide: SessionMetrics, useFactory: (db: PrismaService) => new SessionMetrics(db), inject: [PrismaService] },
  { provide: QuestionScheduler, useFactory: (timer: InProcessQuestionTimer, sessions: ManageSessions) => new QuestionScheduler(timer, sessions), inject: [InProcessQuestionTimer, ManageSessions] },
 ],
})
export class SessionModule {}
