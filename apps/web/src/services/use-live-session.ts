import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { gameOrigin } from './http';
import type { LiveEvents, SessionState } from './live';
import { useSession } from './session';
export type Connection = 'connecting' | 'online' | 'reconnecting';
type Ack = { state?: SessionState; error?: { code: string; message: string } };
/** The proxy serves Socket.IO under /game/socket.io; a direct API URL (development) serves it at /socket.io. */
function connect(token: () => string | null) {
 const direct = /^https?:\/\//.test(gameOrigin);
 return io((direct ? gameOrigin : window.location.origin) + '/live', {
  path: direct ? '/socket.io' : gameOrigin + '/socket.io',
  auth: callback => callback({ token: token() }), // evaluated on every (re)connection
  reconnectionDelay: 800, reconnectionDelayMax: 5000, timeout: 10000,
 });
}
/**
 * Subscribes to a session and keeps the authoritative state. Events are applied in version order;
 * any gap, reconnection or returning tab triggers session:subscribe, which replaces the state.
 */
export function useLiveSession(sessionId: string) {
 const { accessToken } = useSession();
 const token = useRef(accessToken), socket = useRef<Socket | null>(null);
 // Mirror of the rendered state so socket handlers stay synchronous and free of updater side effects.
 const current = useRef<SessionState | null>(null);
 const [state, setState] = useState<SessionState | null>(null);
 const [connection, setConnection] = useState<Connection>('connecting');
 const [fatal, setFatal] = useState('');
 const [offset, setOffset] = useState(0);
 const [online, setOnline] = useState<Record<string, boolean>>({});
 token.current = accessToken;
 const commit = useCallback((next: SessionState | null) => { current.current = next; setState(next); }, []);
 const replace = useCallback((next: SessionState) => { setOffset(Date.parse(next.serverNow) - Date.now()); commit(next); }, [commit]);
 const resync = useCallback(async () => {
  const live = socket.current;
  if (!live?.connected) return;
  try {
   const ack = await live.timeout(8000).emitWithAck('session:subscribe', { sessionId }) as Ack;
   if (ack.state) { setFatal(''); replace(ack.state); }
   else setFatal(ack.error?.code === 'NOT_FOUND' ? 'Esta sala no existe o no formas parte de ella.' : ack.error?.message ?? 'No pudimos abrir la sala.');
  } catch { /* the next reconnection or event resynchronizes */ }
 }, [sessionId, replace]);
 useEffect(() => {
  const live = connect(() => token.current);
  socket.current = live;
  let retry: number | undefined;
  const later = () => { window.clearTimeout(retry); retry = window.setTimeout(() => { if (!live.connected) live.connect(); }, 2000); };
  /** State events: older versions are ignored, a gap applies the event and then resynchronizes. */
  const ordered = (eventVersion: number, sameVersionAllowed: boolean, apply: (state: SessionState) => SessionState) => {
   const state = current.current;
   if (!state || eventVersion < state.version || (eventVersion === state.version && !sameVersionAllowed)) return;
   commit({ ...apply(state), version: eventVersion });
   if (eventVersion > state.version + 1) void resync();
  };
  const update = (apply: (state: SessionState) => SessionState | null) => { const state = current.current; const next = state && apply(state); if (next && next !== state) commit(next); };
  live.on('connect', () => { setConnection('online'); void resync(); });
  live.on('disconnect', reason => {
   setConnection('reconnecting');
   // Server-side disconnects (token expiry) are not retried automatically by Socket.IO.
   if (reason === 'io server disconnect') later();
  });
  live.on('connect_error', () => { setConnection('reconnecting'); if (!live.active) later(); });
  live.on('question:opened', (event: LiveEvents['question:opened']) => {
   setOffset(Date.parse(event.serverNow) - Date.now());
   ordered(event.version, current.current?.currentQuestion?.position !== event.question.position, state => ({ ...state, status: 'QUESTION_OPEN', currentQuestion: { ...event.question, openedAt: event.openedAt, deadline: event.deadline, answered: 0 }, ...(state.me ? { me: { ...state.me, answer: null } } : {}) }));
  });
  live.on('question:closed', (event: LiveEvents['question:closed']) => {
   if (current.current?.currentQuestion?.id !== event.gameQuestionId) { void resync(); return; }
   ordered(event.version, false, state => {
    const answer = state.me?.answer;
    return { ...state, status: 'QUESTION_CLOSED', currentQuestion: { ...state.currentQuestion!, correctAnswer: event.correctAnswer, counts: event.counts }, ...(state.me ? { me: { ...state.me, answer: answer ? { ...answer, correct: answer.value === event.correctAnswer } : null } } : {}) };
   });
  });
  live.on('answer:result', (event: LiveEvents['answer:result']) => update(state => state.me ? { ...state, me: { ...state.me, score: event.score } } : null));
  live.on('answer:count', (event: LiveEvents['answer:count']) => update(state => state.currentQuestion?.id === event.gameQuestionId ? { ...state, participantCount: event.participantCount, currentQuestion: { ...state.currentQuestion, answered: Math.max(state.currentQuestion.answered, event.answered) } } : null));
  live.on('participant:joined', (event: LiveEvents['participant:joined']) => {
   setOnline(presence => ({ ...presence, [event.participant.id]: presence[event.participant.id] ?? false }));
   update(state => ({ ...state, participantCount: event.participantCount, ...(state.participants && !state.participants.some(participant => participant.id === event.participant.id) ? { participants: [...state.participants, event.participant] } : {}) }));
  });
  live.on('participant:online', (event: LiveEvents['participant:online']) => setOnline(presence => ({ ...presence, [event.participant.id]: true })));
  live.on('participant:offline', (event: LiveEvents['participant:offline']) => setOnline(presence => ({ ...presence, [event.participant.id]: false })));
  // Finishing during an open question emits question:closed and session:finished with the same version.
  live.on('session:finished', (event: LiveEvents['session:finished']) => ordered(event.version, true, state => ({ ...state, status: 'FINISHED', ranking: event.ranking })));
  live.on('session:cancelled', (event: LiveEvents['session:cancelled']) => ordered(event.version, true, state => ({ ...state, status: 'CANCELLED' })));
  const visible = () => { if (document.visibilityState !== 'visible') return; if (live.connected) void resync(); else live.connect(); };
  const network = () => { if (!live.connected) live.connect(); };
  // Without this, a dropped Wi-Fi is only noticed after the Socket.IO ping timeout (~45 s).
  const lost = () => { setConnection('reconnecting'); live.disconnect(); };
  document.addEventListener('visibilitychange', visible);
  window.addEventListener('online', network);
  window.addEventListener('offline', lost);
  return () => { window.clearTimeout(retry); document.removeEventListener('visibilitychange', visible); window.removeEventListener('online', network); window.removeEventListener('offline', lost); live.disconnect(); socket.current = null; };
 }, [sessionId, resync, commit]);
 // The session provider refreshes the access token before expiry; hand it to the open connection.
 useEffect(() => {
  const live = socket.current;
  if (!accessToken || !live) return;
  if (live.connected) live.emit('auth:renew', { token: accessToken });
  else if (!live.active) live.connect();
 }, [accessToken]);
 /** Local, optimistic change (e.g. own answer sent); the next event or resync stays authoritative. */
 const patch = useCallback((apply: (state: SessionState) => SessionState) => { if (current.current) commit(apply(current.current)); }, [commit]);
 return { state, connection, fatal, offset, online, resync, replace, patch };
}
/** Seconds left against the server clock (offset = serverNow - local now). */
export function useCountdown(deadline: string | undefined, offset: number) {
 const remaining = useCallback(() => deadline ? Math.max(0, Math.ceil((Date.parse(deadline) - (Date.now() + offset)) / 1000)) : 0, [deadline, offset]);
 const [seconds, setSeconds] = useState(remaining);
 useEffect(() => {
  setSeconds(remaining());
  if (!deadline) return;
  const timer = window.setInterval(() => setSeconds(remaining()), 250);
  return () => window.clearInterval(timer);
 }, [deadline, remaining]);
 return seconds;
}
