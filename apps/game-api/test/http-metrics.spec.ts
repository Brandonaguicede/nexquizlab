import { EventEmitter } from 'node:events';
import { metrics, Meter } from '@opentelemetry/api';
import type { Request, Response } from 'express';
import { httpMetrics } from '../src/config/http-metrics';
describe('NexQuiz operational metrics', () => {
 const add = jest.fn(), record = jest.fn();
 let observe!: (result: { observe: (value: number, labels: { api: string }) => void }) => void;
 beforeEach(() => {
  add.mockClear(); record.mockClear();
  const meter = { createCounter: () => ({ add }), createHistogram: () => ({ record }), createObservableGauge: () => ({ addCallback: (callback: typeof observe) => { observe = callback; } }) };
  jest.spyOn(metrics, 'getMeter').mockReturnValue(meter as unknown as Meter);
 });
 afterEach(() => jest.restoreAllMocks());
 function finish(middleware: ReturnType<typeof httpMetrics>, route: string, status: number) {
  const response = Object.assign(new EventEmitter(), { statusCode: status });
  const next = jest.fn();
  middleware({ path: route, method: 'GET' } as Request, response as unknown as Response, next);
  expect(next).toHaveBeenCalledTimes(1);
  response.emit('finish');
 }
 it('records bounded labels without exposing arbitrary request paths', () => {
  finish(httpMetrics('nexquiz-test-api'), '/private/student-id-123?secret=value', 404);
  const labels = { api: 'nexquiz-test-api', method: 'GET', route: 'other', status_code: '404' };
  expect(add).toHaveBeenCalledWith(1, labels);
  expect(record).toHaveBeenCalledWith(expect.any(Number), labels);
 });
 it('does not claim readiness before a probe and records failure/recovery', () => {
  const middleware = httpMetrics('nexquiz-test-api'), sample = jest.fn();
  observe({ observe: sample }); expect(sample).not.toHaveBeenCalled();
  finish(middleware, '/api/v1/health/ready', 503);
  observe({ observe: sample }); expect(sample).toHaveBeenLastCalledWith(0, { api: 'nexquiz-test-api' });
  finish(middleware, '/api/v1/health/ready', 200);
  observe({ observe: sample }); expect(sample).toHaveBeenLastCalledWith(1, { api: 'nexquiz-test-api' });
 });
});
