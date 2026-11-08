import { metrics } from '@opentelemetry/api';
import type { Request, Response, NextFunction } from 'express';
/** Fixed route labels prevent request paths or user data from becoming metric attributes. */
export function httpMetrics(api: string) {
 const meter = metrics.getMeter('nexquiz-http', '1.0.0');
 const requests = meter.createCounter('nexquiz_http_requests', { description: 'Completed HTTP requests' });
 const duration = meter.createHistogram('nexquiz_http_duration_seconds', { description: 'HTTP duration in seconds', advice: { explicitBucketBoundaries: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10] } });
 let ready: number | undefined;
 meter.createObservableGauge('nexquiz_service_ready', { description: 'Last HTTP readiness result; absent until first readiness probe' }).addCallback(result => {
  if (ready !== undefined) result.observe(ready, { api });
 });
 return (req: Request, res: Response, next: NextFunction) => {
  const started = process.hrtime.bigint();
  const route = ['/api/v1/health/live','/api/v1/health/ready','/openapi.json','/docs','/docs/'].includes(req.path) ? req.path : 'other';
  const method = ['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'].includes(req.method) ? req.method : 'OTHER';
  res.once('finish', () => {
   const attributes = { api, method, route, status_code: String(res.statusCode) };
   requests.add(1, attributes);
   duration.record(Number(process.hrtime.bigint() - started) / 1e9, attributes);
   if (req.method === 'GET' && route === '/api/v1/health/ready') ready = res.statusCode === 200 ? 1 : 0;
  });
  next();
 };
}
