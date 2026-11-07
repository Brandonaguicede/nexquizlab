import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/client';
import { HealthPort } from '../application/health.port';
@Injectable()
export class PrismaService extends PrismaClient implements HealthPort, OnModuleDestroy {
  constructor() { super({ datasources: { db: { url: process.env.GAME_DATABASE_URL } } }); }
  async ping(): Promise<boolean> {
    try { await this.$queryRaw`SELECT 1`; return true; } catch { return false; }
  }
  async onModuleDestroy() { await this.$disconnect(); }
}
