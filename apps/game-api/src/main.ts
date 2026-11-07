import 'reflect-metadata';
import { telemetry } from './config/telemetry';
import { httpMetrics } from './config/http-metrics';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { scalarReference, scalarAsset, SCALAR_BUNDLE_URL } from './presentation/scalar';
import helmet from 'helmet';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';
import { environment } from './config/environment';
import { ErrorFilter } from './presentation/error.filter';
async function bootstrap() {
 const config = environment();
 const app = await NestFactory.create(AppModule, { logger: ['log','warn','error'] });
 app.use(httpMetrics('nexquiz-game-api'));
 app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'"], styleSrc: ["'self'", "'unsafe-inline'"], connectSrc: ["'self'"], imgSrc: ["'self'", 'data:'], fontSrc: ["'self'", 'data:'] } } }));
 app.enableCors({ origin: config.CORS_ORIGINS.split(','), credentials: false });
 app.setGlobalPrefix('api/v1');
 app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
 app.useGlobalFilters(new ErrorFilter());
 const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('nexquiz-game-api').setDescription('NexQuiz Game API: private quiz authoring with images, live game rooms (commands over REST, events over Socket.IO namespace /live, see docs/api/realtime.md), persisted results and history. Independent RS256 identity using only a public key; no Auth database access.').setVersion('4.0.0').addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }).build());
 app.getHttpAdapter().get('/openapi.json', (req: Request, res: Response) => res.json({ ...document, servers: [{ url: req.headers['x-forwarded-prefix'] === '/game' ? '/game' : '/' }] }));
 app.getHttpAdapter().get(SCALAR_BUNDLE_URL, scalarAsset);
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
