import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { authOrigin, gameApi } from './http';
export interface Profile { role: 'TEACHER' | 'STUDENT'; id: string; email: string; displayName: string; createdAt: string; }
interface Session { user: Profile; accessToken: string; expiresIn: number; }
const base = authOrigin + '/api/v1/auth';
export class SessionError extends Error {
 constructor(readonly status: number, message: string) { super(message); }
}
const messages: Record<number, string> = { 400: 'Revisa los campos e inténtalo de nuevo.', 401: 'El correo o la contraseña no son correctos, o tu sesión venció.', 403: 'No se pudo verificar la solicitud. Abre NexQuiz desde su dirección habitual.', 409: 'Este correo ya está registrado. Puedes iniciar sesión.', 429: 'Has realizado demasiados intentos. Espera unos minutos antes de volver a intentarlo.', 503: 'El servicio está ocupado. Inténtalo de nuevo en unos segundos.' };
async function mutate(action: string, body?: object): Promise<Session | null> {
 let response: Response;
 try { response = await fetch(base + '/' + action, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-NexQuiz-CSRF': '1' }, body: JSON.stringify(body ?? {}), signal: AbortSignal.timeout(12000) }); }
 catch { throw new SessionError(0, 'No pudimos conectar. Comprueba tu conexión y vuelve a intentarlo.'); }
 if (!response.ok) throw new SessionError(response.status, messages[response.status] || 'No se pudo completar la solicitud. Inténtalo más tarde.');
 return response.status === 204 ? null : response.json() as Promise<Session>;
}
let pendingRefresh: Promise<Session | null> | undefined;
async function loadProfile(session: Session | null) {
 if (!session) return null;
 const response = await fetch(base + '/profile', { headers: { Authorization: 'Bearer ' + session.accessToken }, signal: AbortSignal.timeout(7000) });
 if (!response.ok) throw new SessionError(response.status, messages[response.status] || 'No pudimos cargar tu perfil.');
 return { ...session, user: await response.json() as Profile };
}
function refreshSession() {
 // One in-flight rotation per page; Web Locks also serializes across same-origin tabs.
 return pendingRefresh ??= (async () => {
  try { return await loadProfile(navigator.locks ? await navigator.locks.request('nexquiz-session', () => mutate('refresh')) : await mutate('refresh')); }
  finally { pendingRefresh = undefined; }
 })();
}
interface SessionContextValue {
 accessToken: string | null;
 user: Profile | null; loading: boolean;
 signIn(input: { email: string; password: string }): Promise<void>;
 register(input: { email: string; displayName: string; password: string }): Promise<void>;
 signOut(): Promise<void>;
 verifyGame(): Promise<string>;
}
const SessionContext = createContext<SessionContextValue | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
 const [session, setSession] = useState<Session | null>(null);
 const [loading, setLoading] = useState(true);
 const epoch = useRef(0);
 useEffect(() => {
  let alive = true;
  const current = epoch.current;
  void refreshSession().then(value => { if (alive && epoch.current === current) setSession(value); }).catch(() => { if (alive && epoch.current === current) setSession(null); }).finally(() => { if (alive) setLoading(false); });
  return () => { alive = false; };
 }, []);
 useEffect(() => {
  if (!session) return;
  const current = epoch.current;
  const timer = window.setTimeout(() => { void refreshSession().then(value => { if (epoch.current === current) setSession(value); }).catch(() => { if (epoch.current === current) setSession(null); }); }, (session.expiresIn - 30) * 1000);
  return () => window.clearTimeout(timer);
 }, [session]);
 useEffect(() => {
  const channel = new BroadcastChannel('nexquiz-session-events');
  channel.onmessage = event => { if (event.data === 'logout') { epoch.current++; setSession(null); } };
  return () => channel.close();
 }, []);
 const value: SessionContextValue = {
  accessToken: session?.accessToken ?? null,
  user: session?.user ?? null, loading,
  async signIn(input) { setSession(await loadProfile(await mutate('login', input))); },
  async register(input) { setSession(await loadProfile(await mutate('register', input))); },
  async signOut() {
   if (pendingRefresh) await pendingRefresh.catch(() => null);
   await mutate('logout'); // Keep session visible if revocation cannot be confirmed.
   epoch.current++; setSession(null);
   const channel = new BroadcastChannel('nexquiz-session-events'); channel.postMessage('logout'); channel.close();
  },
  async verifyGame() {
   if (!session) throw new SessionError(401, 'Inicia sesión para continuar.');
   const response = await fetch(gameApi + '/identity', { headers: { Authorization: 'Bearer ' + session.accessToken }, signal: AbortSignal.timeout(7000) });
   if (!response.ok) throw new SessionError(response.status, 'No pudimos verificar tu identidad en Game API. Vuelve a iniciar sesión si venció tu acceso.');
   const identity = await response.json() as { userId: string };
   if (identity.userId !== session.user.id) throw new Error('La identidad recibida no coincide.');
   return 'Game API verificó tu identidad correctamente.';
  },
 };
 return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
export function useSession() { const value = useContext(SessionContext); if (!value) throw new Error('SessionProvider required'); return value; }
