import { Logger, OnModuleInit } from '@nestjs/common';
import { metrics } from '@opentelemetry/api';
import { PrismaService } from './prisma.service';
const LIVE = ['LOBBY', 'QUESTION_OPEN', 'QUESTION_CLOSED'] as const;
/** Observable gauge of non-terminal sessions by status, read from PostgreSQL at each export (every 15 s). */
export class SessionMetrics implements OnModuleInit {
 private readonly logger = new Logger('SessionMetrics');
 constructor(private readonly db: PrismaService) {}
 onModuleInit() {
  metrics.getMeter('nexquiz-game', '1.0.0').createObservableGauge('nexquiz_game_sessions', { description: 'Sessions currently in lobby or playing, by status' }).addCallback(async result => {
   try {
    const rows = await this.db.gameSession.groupBy({ by: ['status'], where: { status: { in: [...LIVE] } }, _count: { _all: true } });
    for (const status of LIVE) result.observe(rows.find(row => row.status === status)?._count._all ?? 0, { status });
   } catch { this.logger.warn('Session gauge skipped: database unavailable'); }
  });
 }
}
