import { CanActivate, Controller, ExecutionContext, Get, Header, Injectable, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { GameError } from '../domain/game';
import { GetIdentity } from '../application/get-identity';
type IdentityRequest = Request & { identity: { userId: string; sessionId: string; expiresAt: Date; name?: string; role?: 'TEACHER' | 'STUDENT' } };
@Injectable()
export class IdentityGuard implements CanActivate {
 constructor(private readonly identity: GetIdentity) {}
 async canActivate(context: ExecutionContext) {
  const req = context.switchToHttp().getRequest<IdentityRequest>();
  const match = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(req.headers.authorization || '');
  if (!match?.[1]) throw new UnauthorizedException('Invalid or expired access token');
  req.identity = await this.identity.execute(match[1]);
  return true;
 }
}
@ApiTags('Identity') @Controller('identity')
export class IdentityController {
 @Get() @UseGuards(IdentityGuard) @ApiBearerAuth() @Header('Cache-Control', 'no-store')
 @ApiOperation({ summary: 'Verify Auth identity independently', description: 'Offline public-key verification of RS256, issuer, audience and expiration. Never queries Auth persistence. Revoked access tokens can remain valid for at most 300 seconds.' })
 @ApiResponse({ status: 200, schema: { type: 'object', required: ['userId','sessionId'], properties: { userId: { type: 'string', format: 'uuid' }, sessionId: { type: 'string', format: 'uuid' }, name: { type: 'string', description: 'Display name claim, if present' } } } })
 @ApiResponse({ status: 401, description: 'Missing, tampered, expired, wrong-issuer, wrong-audience or unknown-key token' })
 identity(@Req() req: IdentityRequest) { const { userId, sessionId, name } = req.identity; return { userId, sessionId, ...(name ? { name } : {}) }; }
}

@Injectable()
export class TeacherGuard implements CanActivate {
 canActivate(context: ExecutionContext) {
  if (context.switchToHttp().getRequest<IdentityRequest>().identity.role !== 'TEACHER') throw new GameError('FORBIDDEN', 'Solo el profesor puede administrar cuestionarios y salas.');
  return true;
 }
}
