import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';
import { IdentityError } from '../domain/identity';
type IdentityCode = IdentityError['code'];
const STATUS: Record<IdentityCode, number> = { INVALID_INPUT: 400, DUPLICATE_EMAIL: 409, UNAUTHORIZED: 401, RATE_LIMITED: 429, BUSY: 503 };
const MESSAGE: Record<IdentityCode, string> = { INVALID_INPUT: 'Invalid identity input', DUPLICATE_EMAIL: 'Email already registered', UNAUTHORIZED: 'Invalid credentials or session', RATE_LIMITED: 'Too many attempts. Try again later.', BUSY: 'Authentication busy. Try again shortly.' };
@Catch()
export class ErrorFilter implements ExceptionFilter {
 private readonly logger = new Logger('Transport');
 catch(error: unknown, host: ArgumentsHost) {
  const res = host.switchToHttp().getResponse<Response>();
  // Identity errors and their bodies must never be cached by a browser or proxy.
  res.setHeader('Cache-Control', 'no-store');
  if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large') {
   return res.status(413).json({ statusCode: 413, code: 'BODY_TOO_LARGE', message: 'Request body exceeds 16 KB' });
  }
  if (error instanceof IdentityError) {
   // Rate buckets are fixed 15-minute windows, so the retry time is the rest of the current window.
   if (error.code === 'RATE_LIMITED') res.setHeader('Retry-After', String(900 - Math.floor(Date.now() / 1000) % 900));
   return res.status(STATUS[error.code]).json({ statusCode: STATUS[error.code], code: error.code, message: MESSAGE[error.code] });
  }
  const status = error instanceof HttpException ? error.getStatus() : 500;
  if (status === 500) this.logger.error('Unhandled request failure');
  const detail = error instanceof HttpException ? error.getResponse() : 'Internal server error';
  return res.status(status).json({ statusCode: status, code: 'HTTP_ERROR', message: typeof detail === 'string' ? detail : 'Request rejected' });
 }
}
