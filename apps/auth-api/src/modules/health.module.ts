import { Module } from '@nestjs/common';
import { CheckHealth } from '../application/check-health';
import { HEALTH_PORT, HealthPort } from '../application/health.port';
import { PrismaService } from '../infrastructure/prisma.service';
import { HealthController } from '../presentation/health.controller';
@Module({ controllers: [HealthController], providers: [PrismaService, { provide: HEALTH_PORT, useExisting: PrismaService }, { provide: CheckHealth, useFactory: (port: HealthPort) => new CheckHealth(port), inject: [HEALTH_PORT] }] })
export class HealthModule {}
