import type { HealthResponse } from '@nexquiz/shared-types';
export const services = [
 { name: 'Auth API', base: import.meta.env.VITE_AUTH_API_URL || '/auth', purpose: 'Identidad y autenticación' },
 { name: 'Game API', base: import.meta.env.VITE_GAME_API_URL || '/game', purpose: 'Evaluaciones y juego en vivo' }
] as const;
const [auth, game] = services;
export const authOrigin = auth.base.replace(/\/$/, '');
export const gameOrigin = game.base.replace(/\/$/, '');
export const gameApi = gameOrigin + '/api/v1';
/** status 0 means the request never reached the API; code is the API error code, or the status as text. */
export class ApiError extends Error { constructor(readonly status: number, readonly code: string, message: string) { super(message); } }
interface GameCall { token: string; method?: string; body?: object | FormData; signal?: AbortSignal; timeout: number; }
/** Authenticated Game API request. Failures become ApiError with the Spanish text chosen by `messageFor`. */
export async function gameFetch(path: string, { token, method = 'GET', body, signal, timeout }: GameCall, messageFor: (status: number, code: string) => string): Promise<Response> {
 const json = body !== undefined && !(body instanceof FormData);
 let response: Response;
 try {
  response = await fetch(gameApi + path, { method, headers: { Authorization: 'Bearer ' + token, ...(json ? { 'Content-Type': 'application/json' } : {}) }, body: json ? JSON.stringify(body) : body, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout) });
 } catch (error) {
  if (signal?.aborted) throw error;
  throw new ApiError(0, 'NETWORK', messageFor(0, 'NETWORK'));
 }
 if (!response.ok) {
  const detail = await response.json().catch(() => ({})) as { code?: unknown };
  const code = typeof detail.code === 'string' ? detail.code : String(response.status);
  throw new ApiError(response.status, code, messageFor(response.status, code));
 }
 return response;
}
export async function getHealth(base: string, signal?: AbortSignal): Promise<HealthResponse> {
 const timeout = AbortSignal.timeout(7000);
 const response = await fetch(base.replace(/\/$/, '') + '/api/v1/health/ready', { signal: signal ? AbortSignal.any([signal, timeout]) : timeout, headers: { Accept: 'application/json' } });
 if (!response.ok) throw new Error('Servicio no disponible');
 const body: unknown = await response.json();
 if (!body || typeof body !== 'object' || !('status' in body) || body.status !== 'ok' || !('service' in body) || typeof body.service !== 'string') throw new Error('Respuesta de servicio inválida');
 return body as HealthResponse;
}
