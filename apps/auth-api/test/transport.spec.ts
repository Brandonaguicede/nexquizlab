import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { Authentication } from '../src/application/authentication';
import { ACCESS_TOKENS, TRAFFIC_GATE } from '../src/application/identity.ports';
import { AuthController, JwksController } from '../src/presentation/auth.controller';
import { AccessGuard, SessionMutationGuard } from '../src/presentation/auth.guards';
import { ErrorFilter } from '../src/presentation/error.filter';
describe('production cookie and HTTP security transport', () => {
 let app: INestApplication;
 const previousMode=process.env.NODE_ENV, previousOrigins=process.env.CORS_ORIGINS;
 const user={id:'a7c5b3fb-8a4f-484c-8d5f-9c0064722f42',email:'test@example.invalid',displayName:'Test',createdAt:new Date()};
 const result={user,accessToken:'test-token',tokenType:'Bearer',expiresIn:300,refreshToken:'a'.repeat(43),refreshExpiresAt:new Date(Date.now()+86400000)};
 const application={register:jest.fn().mockResolvedValue(result),login:jest.fn().mockResolvedValue(result),refresh:jest.fn().mockResolvedValue(result),logout:jest.fn().mockResolvedValue(undefined),profile:jest.fn().mockResolvedValue(user)};
 const credentials={email:'test@example.invalid',password:'test long passphrase',displayName:'Test'};
 beforeAll(async()=>{
  process.env.NODE_ENV='production';process.env.CORS_ORIGINS='https://nexquiz.test.invalid';
  const module=await Test.createTestingModule({controllers:[AuthController,JwksController],providers:[AccessGuard,SessionMutationGuard,{provide:Authentication,useValue:application},{provide:ACCESS_TOKENS,useValue:{verify:jest.fn(),jwks:()=>({keys:[]})}},{provide:TRAFFIC_GATE,useValue:{consume:jest.fn().mockResolvedValue(undefined)}}]}).compile();
  app=module.createNestApplication();app.setGlobalPrefix('api/v1');app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));app.useGlobalFilters(new ErrorFilter());await app.init();
 });
 afterAll(async()=>{await app.close();if(previousMode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previousMode;if(previousOrigins===undefined)delete process.env.CORS_ORIGINS;else process.env.CORS_ORIGINS=previousOrigins;});
 it('sets __Host Secure HttpOnly Strict cookie and strips internal secrets from JSON',async()=>{
  const response=await request(app.getHttpServer()).post('/api/v1/auth/register').set('X-NexQuiz-CSRF','1').send(credentials).expect(201);
  const cookie=String(response.headers['set-cookie']);
  for(const required of ['__Host-nexquiz_refresh=','Path=/','HttpOnly','Secure','SameSite=Strict'])expect(cookie).toContain(required);
  expect(cookie).not.toContain('Domain=');expect(response.headers['cache-control']).toBe('no-store');
  expect(response.body.refreshToken).toBeUndefined();expect(response.body.refreshExpiresAt).toBeUndefined();
 });
 it('rejects forged Origin and missing CSRF header before invoking the use case',async()=>{
  application.register.mockClear();
  await request(app.getHttpServer()).post('/api/v1/auth/register').send(credentials).expect(403);
  await request(app.getHttpServer()).post('/api/v1/auth/register').set('X-NexQuiz-CSRF','1').set('Origin','https://evil.invalid').send(credentials).expect(403);
  expect(application.register).not.toHaveBeenCalled();
 });
 it('rejects public teacher registration before invoking the use case',async()=>{
  application.register.mockClear();
  await request(app.getHttpServer()).post('/api/v1/auth/register').set('X-NexQuiz-CSRF','1').send({...credentials,role:'TEACHER'}).expect(400);
  expect(application.register).not.toHaveBeenCalled();
 });
 it('rejects extra properties without invoking registration',async()=>{
  application.register.mockClear();await request(app.getHttpServer()).post('/api/v1/auth/register').set('X-NexQuiz-CSRF','1').send({...credentials,admin:true}).expect(400);expect(application.register).not.toHaveBeenCalled();
 });
 it('clears the production cookie with matching attributes on logout',async()=>{
  const response=await request(app.getHttpServer()).post('/api/v1/auth/logout').set('X-NexQuiz-CSRF','1').set('Cookie','__Host-nexquiz_refresh='+'a'.repeat(43)).send({}).expect(204);
  expect(application.logout).toHaveBeenCalledWith('a'.repeat(43));
  const cookie=String(response.headers['set-cookie']);expect(cookie).toContain('__Host-nexquiz_refresh=;');expect(cookie).toContain('HttpOnly');expect(cookie).toContain('Secure');expect(cookie).toContain('SameSite=Strict');
 });
});
