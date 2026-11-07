import 'reflect-metadata';
import { telemetry } from './config/telemetry';
import { httpMetrics } from './config/http-metrics';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { scalarReference, scalarAsset, SCALAR_BUNDLE_URL } from './presentation/scalar';
import helmet from 'helmet';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { ACCESS_TOKENS, AccessTokens } from './application/identity.ports';
import { AppModule } from './app.module';
import { environment } from './config/environment';
import { ErrorFilter } from './presentation/error.filter';
async function bootstrap() {
 const config = environment();
 const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['log','warn','error'], bodyParser: false });
 app.useBodyParser('json', { limit: '16kb' });
 const trustProxy = process.env.TRUST_PROXY?.trim();
 // Only explicitly provisioned proxy networks/addresses (e.g. uniquelocal for the Compose network); never a blanket true.
 if (trustProxy) {
  if (!/^[a-z0-9.:/,\s]+$/i.test(trustProxy) || /^(true|\d+)$/i.test(trustProxy)) throw new Error('TRUST_PROXY must list proxy addresses, subnets or loopback/linklocal/uniquelocal');
  app.set('trust proxy', trustProxy);
 }
 app.get<AccessTokens>(ACCESS_TOKENS).jwks(); // Fail startup on invalid signing configuration.
 app.use(httpMetrics('nexquiz-auth-api'));
 app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'"], styleSrc: ["'self'", "'unsafe-inline'"], connectSrc: ["'self'"], imgSrc: ["'self'", 'data:'], fontSrc: ["'self'", 'data:'] } } }));
 app.enableCors({ origin: config.CORS_ORIGINS.split(','), credentials: true, allowedHeaders: ['Content-Type','Authorization','X-NexQuiz-CSRF'] });
 app.setGlobalPrefix('api/v1');
 app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
 app.useGlobalFilters(new ErrorFilter());
 const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('nexquiz-auth-api').setDescription('NexQuiz Hito 2. Independent registration, login, profile, rotating refresh and real session revocation. Game access tokens expire within 300 seconds after logout. Mutations require X-NexQuiz-CSRF: 1.').setVersion('2.0.0').addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }).build());
 app.getHttpAdapter().getInstance().get('/openapi.json', (req: Request, res: Response) => res.json({ ...document, servers: [{ url: req.headers['x-forwarded-prefix'] === '/auth' ? '/auth' : '/' }] }));
 app.getHttpAdapter().getInstance().get(SCALAR_BUNDLE_URL, scalarAsset);
 app.use('/docs', scalarReference);
 await app.listen(config.PORT, '0.0.0.0');
 let closing: Promise<void> | undefined;
 const close = () => closing ??= (async () => {
  try { await app.close(); } finally { await telemetry?.shutdown(); }
 })();
 for (const signal of ['SIGINT','SIGTERM'] as const) process.once(signal, () => {
  void close().catch(() => { console.error('NexQuiz shutdown failed.'); process.exitCode = 1; });
 });
}
bootstrap().catch(async () => {
 console.error('NexQuiz startup failed. Check configuration and service logs.');
 try { await telemetry?.shutdown(); } catch { console.error('NexQuiz telemetry shutdown failed.'); }
 process.exitCode = 1;
});
