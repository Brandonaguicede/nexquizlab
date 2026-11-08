import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { Authentication } from '../src/application/authentication';
import { ACCESS_TOKENS, TRAFFIC_GATE } from '../src/application/identity.ports';
import { AuthController } from '../src/presentation/auth.controller';
import { AccessGuard, SessionMutationGuard } from '../src/presentation/auth.guards';
import { ErrorFilter } from '../src/presentation/error.filter';
describe('per-source rate limit identity behind proxies', () => {
 const consume = jest.fn().mockResolvedValue(undefined);
 const user = { id: 'a7c5b3fb-8a4f-484c-8d5f-9c0064722f42', email: 'test@example.invalid', displayName: 'Test', createdAt: new Date() };
 const result = { user, accessToken: 't', tokenType: 'Bearer', expiresIn: 300, refreshToken: 'a'.repeat(43), refreshExpiresAt: new Date(Date.now() + 86400000) };
 const application = { register: jest.fn(), login: jest.fn().mockResolvedValue(result), refresh: jest.fn().mockResolvedValue(result), logout: jest.fn(), profile: jest.fn() };
 async function start(trustProxy?: string) {
  const module = await Test.createTestingModule({ controllers: [AuthController], providers: [AccessGuard, SessionMutationGuard, { provide: Authentication, useValue: application }, { provide: ACCESS_TOKENS, useValue: { verify: jest.fn() } }, { provide: TRAFFIC_GATE, useValue: { consume } }] }).compile();
  const app = module.createNestApplication<NestExpressApplication>();
  if (trustProxy) app.set('trust proxy', trustProxy);
  app.setGlobalPrefix('api/v1'); app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true })); app.useGlobalFilters(new ErrorFilter());
  await app.init();
  return app as INestApplication;
 }
 const login = (app: INestApplication) => request(app.getHttpServer()).post('/api/v1/auth/login').set('X-NexQuiz-CSRF', '1').set('X-Forwarded-For', '203.0.113.7').send({ email: 'test@example.invalid', password: 'long enough passphrase' });
 beforeEach(() => consume.mockClear());
 it('ignores X-Forwarded-For unless a trusted proxy is configured', async () => {
  const app = await start();
  await login(app).expect(200);
  expect(consume.mock.calls[0][0]).toMatch(/^auth-ip:(::ffff:)?127\.0\.0\.1$|^auth-ip:::1$/);
  expect(consume.mock.calls[0][1]).toBe(300);
  await app.close();
 });
 it('uses the forwarded client address only from a provisioned proxy network', async () => {
  const app = await start('loopback');
  await login(app).expect(200);
  expect(consume.mock.calls[0][0]).toBe('auth-ip:203.0.113.7');
  await app.close();
 });
 it('counts renewal and logout in a separate, larger allowance than credential attempts', async () => {
  const app = await start();
  await request(app.getHttpServer()).post('/api/v1/auth/refresh').set('X-NexQuiz-CSRF', '1').set('Cookie', 'nexquiz_refresh=' + 'a'.repeat(43)).send({}).expect(200);
  await request(app.getHttpServer()).post('/api/v1/auth/logout').set('X-NexQuiz-CSRF', '1').send({}).expect(204);
  expect(consume.mock.calls.map(call => [String(call[0]).split(':')[0], call[1]])).toEqual([['auth-renewal-ip', 3000], ['auth-renewal-ip', 3000]]);
  await app.close();
 });
});
