import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma.service';
import { CheckHealth } from '../src/application/check-health';
import { ServiceStatus } from '../src/domain/service-status';
describe('nexquiz-auth-api', () => {
 let app: INestApplication; const database = { ping: jest.fn() };
 beforeAll(async () => { const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(database).compile(); app = module.createNestApplication(); app.setGlobalPrefix('api/v1'); await app.init(); });
 afterAll(async () => { await app.close(); });
 it('rejects empty service identity', () => { expect(() => new ServiceStatus('',true)).toThrow(); });
 it('maps database state through the use case', async () => { expect((await new CheckHealth({ ping: async () => false }).execute()).available).toBe(false); });
 it('liveness does not depend on PostgreSQL', () => request(app.getHttpServer()).get('/api/v1/health/live').expect(200).expect({ status: 'ok', service: 'nexquiz-auth-api' }));
 it('readiness succeeds with database', async () => { database.ping.mockResolvedValue(true); await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200); });
 it('readiness returns 503 without database', async () => { database.ping.mockResolvedValue(false); await request(app.getHttpServer()).get('/api/v1/health/ready').expect(503); });
});
