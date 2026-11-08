import { gameFetch } from './http';
export type { SessionState, SessionCreated, Joined, AnswerAccepted, SessionResults, Standing, CurrentQuestion, LiveEvents, HistoryPage } from '@nexquiz/shared-types';
// Game error codes come from docs/api/realtime.md and the OpenAPI contract.
const codes: Record<string, string> = {
 NETWORK: 'No pudimos conectar con el juego. Comprueba tu conexión.',
 ROOM_NOT_FOUND: 'No encontramos una sala activa con ese código. Revísalo con tu docente.',
 ROOM_STARTED: 'La partida ya empezó. Solo pueden volver quienes ya estaban en la sala.',
 ROOM_FULL: 'La sala está llena.',
 EMPTY_QUIZ: 'Agrega al menos una pregunta antes de abrir una sala.',
 ANSWER_WINDOW_CLOSED: 'El tiempo para responder terminó.',
 INVALID_STATE: 'La partida cambió de estado. Actualizamos la pantalla.',
 FORBIDDEN: 'Esta acci?n no corresponde a tu cuenta. El profesor dirige su sala; para responder, entra con otra cuenta de estudiante.',
 NOT_FOUND: 'Esta sala no existe o no formas parte de ella.',
};
const statuses: Record<number, string> = { 400: 'Revisa los datos e inténtalo de nuevo.', 401: 'Tu acceso venció. Vuelve a iniciar sesión.', 403: codes.FORBIDDEN!, 404: codes.NOT_FOUND! };
const message = (status: number, code: string) => codes[code] ?? statuses[status] ?? 'No se pudo completar la acción. Inténtalo de nuevo.';
const call = (token: string, path: string, method = 'GET', body?: object, signal?: AbortSignal) => gameFetch(path, { token, method, body, signal, timeout: 15000 }, message);
export async function liveRequest<T>(token: string, path: string, method = 'GET', body?: object, signal?: AbortSignal): Promise<T> {
 return (await call(token, path, method, body, signal)).json() as Promise<T>;
}
export async function sessionImage(token: string, sessionId: string, gameQuestionId: string, signal: AbortSignal) {
 return (await call(token, `/sessions/${encodeURIComponent(sessionId)}/questions/${encodeURIComponent(gameQuestionId)}/image`, 'GET', undefined, signal)).blob();
}
/** Room codes are six uppercase letters or digits; anything else typed or pasted is dropped. */
export const roomCode = (input: string) => input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
