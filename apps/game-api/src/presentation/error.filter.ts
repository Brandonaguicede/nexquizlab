import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';
import { InvalidIdentity } from '../domain/identity';
import { GameError, GameErrorCode } from '../domain/game';
import { QuizError, QuizErrorCode, QUIZ_LIMITS } from '../domain/quiz';
// Typed as complete records, so adding a domain error code without a status fails to compile.
const QUIZ_STATUS: Record<QuizErrorCode, number> = { NOT_FOUND: 404, INVALID_INPUT: 400, CONFLICT: 409, INVALID_IMAGE: 400 };
const GAME_STATUS: Record<GameErrorCode, number> = { NOT_FOUND: 404, ROOM_NOT_FOUND: 404, INVALID_INPUT: 400, FORBIDDEN: 403, EMPTY_QUIZ: 409, ROOM_STARTED: 409, ROOM_FULL: 409, INVALID_STATE: 409, ANSWER_WINDOW_CLOSED: 409 };
const IMAGE_LIMIT = `Image exceeds ${QUIZ_LIMITS.imageBytes / 1024 / 1024} MiB`;
const errorCode = (error: unknown) => error instanceof Error && 'code' in error ? String(error.code) : '';
@Catch()
export class ErrorFilter implements ExceptionFilter {
 private readonly logger = new Logger('Transport');
 catch(error: unknown, host: ArgumentsHost) {
  const send = (status: number, body: object) => host.switchToHttp().getResponse<Response>().status(status).json({ statusCode: status, ...body });
  if (error instanceof QuizError) return send(QUIZ_STATUS[error.code], { code: error.code, message: error.message });
  if (error instanceof GameError) return send(GAME_STATUS[error.code], { code: error.code, message: error.message });
  if (error instanceof InvalidIdentity) return send(401, { code: 'UNAUTHORIZED', message: 'Invalid or expired access token' });
  const code = errorCode(error);
  // Multer upload limits.
  if (code === 'LIMIT_FILE_SIZE') return send(413, { message: IMAGE_LIMIT });
  if (code.startsWith('LIMIT_')) return send(400, { message: 'Upload one image in multipart field file' });
  // Prisma unique violation or serialization failure under concurrent edits.
  if (code === 'P2002' || code === 'P2034') return send(409, { message: 'Concurrent change. Reload and retry.' });
  const status = error instanceof HttpException ? error.getStatus() : 500;
  if (status === 500) this.logger.error('Unhandled request failure');
  return send(status, { error: error instanceof HttpException ? error.getResponse() : 'Internal server error' });
 }
}
