import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { ACCESS_TOKENS, AccessTokens, TRAFFIC_GATE, TrafficGate } from '../application/identity.ports';
export function bearer(req: Request) {
 const match = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(req.headers.authorization || '');
 if (!match?.[1]) throw new UnauthorizedException('Invalid or expired session');
 return match[1];
}
@Injectable()
export class AccessGuard implements CanActivate {
 constructor(@Inject(ACCESS_TOKENS) private readonly tokens: AccessTokens) {}
 canActivate(context: ExecutionContext) { this.tokens.verify(bearer(context.switchToHttp().getRequest<Request>())); return true; }
}
/** Per-source allowances per 15-minute window. Renewal and logout need a 32-byte refresh secret, so a classroom
 * behind one NAT address must not exhaust them; credential attempts stay tighter and per-email login limits still apply. */
const SOURCE_LIMITS = { credentials: Number(process.env.AUTH_SOURCE_LIMIT) || 300, renewal: Number(process.env.AUTH_RENEWAL_SOURCE_LIMIT) || 3000 };
@Injectable()
export class SessionMutationGuard implements CanActivate {
 constructor(@Inject(TRAFFIC_GATE) private readonly traffic: TrafficGate) {}
 async canActivate(context: ExecutionContext) {
  const req = context.switchToHttp().getRequest<Request>();
  const allowed = (process.env.CORS_ORIGINS || '').split(',');
  if (req.headers['x-nexquiz-csrf'] !== '1' || (req.headers.origin && !allowed.includes(req.headers.origin))) throw new ForbiddenException('Untrusted session request');
  // req.ip is the socket address unless TRUST_PROXY lists the proxy (see main.ts); forwarding headers are never trusted otherwise.
  const source = req.ip || req.socket.remoteAddress || 'unknown';
  const renewal = /\/auth\/(refresh|logout)$/.test(req.path);
  await this.traffic.consume((renewal ? 'auth-renewal-ip:' : 'auth-ip:') + source, renewal ? SOURCE_LIMITS.renewal : SOURCE_LIMITS.credentials);
  return true;
 }
}
