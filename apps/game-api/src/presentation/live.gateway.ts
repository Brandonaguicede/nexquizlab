import { Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { GetIdentity } from '../application/get-identity';
import { LiveEvent, LiveNotifier } from '../application/live-ports';
import { PlaySessions } from '../application/play-sessions';
import { GameError } from '../domain/game';
import { liveConnections, liveEvents } from './game-metrics';
interface Connection { userId: string; expiresAt: Date; expiry?: ReturnType<typeof setTimeout>; sessions: Map<string, { role: 'host' | 'participant'; participant: { id: string; displayName: string } | null }>; }
type LiveSocket = Socket & { data: { live?: Connection } };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const rooms = {
 session: (sessionId: string) => `session:${sessionId}`,
 host: (sessionId: string) => `session:${sessionId}:host`,
 user: (sessionId: string, userId: string) => `session:${sessionId}:user:${userId}`,
};
/** Reads one property of an untrusted message body. */
const field = (body: unknown, name: string): unknown => typeof body === 'object' && body !== null ? (body as Record<string, unknown>)[name] : undefined;
const allowedOrigin = (origin: string | undefined) => !origin || (process.env.CORS_ORIGINS ?? '').split(',').includes(origin);
/** LiveNotifier over Socket.IO rooms. Kept apart from the gateway so use cases never depend on it. */
export class LiveBroadcaster extends LiveNotifier {
 private namespace?: Namespace;
 attach(namespace: Namespace) { this.namespace = namespace; }
 publish({ audience, ...event }: LiveEvent) {
  if (!this.namespace) return;
  const room = audience.kind === 'session' ? rooms.session(event.sessionId) : audience.kind === 'host' ? rooms.host(event.sessionId) : rooms.user(event.sessionId, audience.userId);
  this.namespace.to(room).emit(event.type, event);
  liveEvents.add(1, { type: event.type });
 }
}
/**
 * Realtime channel. Commands stay on REST; sockets authenticate, subscribe to rooms they are entitled to,
 * receive versioned events and resynchronize with the authoritative state. Protocol: docs/api/realtime.md.
 */
@WebSocketGateway({ namespace: '/live', maxHttpBufferSize: 16 * 1024, cors: { origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => callback(null, allowedOrigin(origin)) } })
export class LiveGateway implements OnGatewayInit<Namespace>, OnGatewayDisconnect<LiveSocket> {
 private readonly logger = new Logger('LiveGateway');
 constructor(private readonly identity: GetIdentity, private readonly play: PlaySessions, private readonly broadcaster: LiveBroadcaster) {}
 afterInit(namespace: Namespace) {
  this.broadcaster.attach(namespace);
  // Reject during the handshake: unauthenticated clients never join any room.
  namespace.use((socket, next) => {
   const token: unknown = socket.handshake.auth?.token;
   if (typeof token !== 'string') return next(new Error('UNAUTHORIZED'));
   this.identity.execute(token).then(identity => {
    const connection: Connection = { userId: identity.userId, expiresAt: identity.expiresAt, sessions: new Map() };
    (socket as LiveSocket).data.live = connection;
    this.armExpiry(socket as LiveSocket, connection);
    liveConnections.add(1);
    next();
   }, () => next(new Error('UNAUTHORIZED')));
  });
 }
 private armExpiry(socket: LiveSocket, connection: Connection) {
  if (connection.expiry) clearTimeout(connection.expiry);
  connection.expiry = setTimeout(() => {
   socket.emit('auth:expired', { message: 'Access token expired; reconnect with a fresh token' });
   socket.disconnect(true);
  }, Math.max(0, connection.expiresAt.getTime() - Date.now()));
 }
 private failure(error: unknown) {
  if (error instanceof GameError) return { error: { code: error.code, message: error.message } };
  this.logger.warn('Realtime request failed');
  return { error: { code: 'INTERNAL', message: 'Request failed' } };
 }
 @SubscribeMessage('auth:renew')
 async renew(@ConnectedSocket() socket: LiveSocket, @MessageBody() body: unknown) {
  const connection = socket.data.live!, token = field(body, 'token');
  try {
   if (typeof token !== 'string') throw new Error();
   const identity = await this.identity.execute(token);
   if (identity.userId !== connection.userId) throw new Error();
   connection.expiresAt = identity.expiresAt;
   this.armExpiry(socket, connection);
   return { ok: true, expiresAt: identity.expiresAt.toISOString() };
  } catch {
   // A token for another user or an invalid one ends the connection instead of silently keeping the old identity.
   setImmediate(() => socket.disconnect(true));
   return { error: { code: 'UNAUTHORIZED', message: 'Invalid access token' } };
  }
 }
 @SubscribeMessage('session:subscribe')
 async subscribe(@ConnectedSocket() socket: LiveSocket, @MessageBody() body: unknown) {
  const connection = socket.data.live!, sessionId = field(body, 'sessionId');
  if (typeof sessionId !== 'string' || !UUID.test(sessionId)) return { error: { code: 'INVALID_INPUT', message: 'sessionId must be a UUID' } };
  try {
   // Same authorization as REST: only the host or a participant of this session.
   const access = await this.play.access(sessionId, connection.userId), { session, role, participant } = access;
   const wasOnline = !participant || (await socket.nsp.in(rooms.user(sessionId, connection.userId)).fetchSockets()).length > 0;
   await socket.join([rooms.session(sessionId), rooms.user(sessionId, connection.userId), ...(role === 'host' ? [rooms.host(sessionId)] : [])]);
   connection.sessions.set(sessionId, { role, participant: participant && { id: participant.id, displayName: participant.displayName } });
   if (participant && !wasOnline) this.broadcaster.publish({ type: 'participant:online', sessionId, version: session.version, audience: { kind: 'host' }, participant: { id: participant.id, displayName: participant.displayName } });
   return { state: await this.play.state(sessionId, connection.userId, access) };
  } catch (error) { return this.failure(error); }
 }
 @SubscribeMessage('session:unsubscribe')
 async unsubscribe(@ConnectedSocket() socket: LiveSocket, @MessageBody() body: unknown) {
  const sessionId = field(body, 'sessionId');
  if (typeof sessionId !== 'string') return { ok: true };
  await this.leave(socket, sessionId);
  return { ok: true };
 }
 private async leave(socket: LiveSocket, sessionId: string) {
  const connection = socket.data.live!, entry = connection.sessions.get(sessionId);
  connection.sessions.delete(sessionId);
  for (const room of [rooms.session(sessionId), rooms.host(sessionId), rooms.user(sessionId, connection.userId)]) await socket.leave(room);
  if (!entry?.participant) return;
  // Presence is informational: participation and score are persisted and survive any disconnect.
  if ((await socket.nsp.in(rooms.user(sessionId, connection.userId)).fetchSockets()).length === 0) {
   this.broadcaster.publish({ type: 'participant:offline', sessionId, version: await this.play.version(sessionId), audience: { kind: 'host' }, participant: entry.participant });
  }
 }
 async handleDisconnect(socket: LiveSocket) {
  const connection = socket.data.live;
  if (!connection) return;
  liveConnections.add(-1);
  if (connection.expiry) clearTimeout(connection.expiry);
  for (const sessionId of [...connection.sessions.keys()]) await this.leave(socket, sessionId).catch(() => undefined);
 }
}
