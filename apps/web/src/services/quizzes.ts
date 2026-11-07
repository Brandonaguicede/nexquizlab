import { gameFetch } from './http';
export type { QuizResponse as Quiz, QuestionResponse as Question, QuizDetailResponse as QuizDetail, QuizPageResponse as QuizPage } from '@nexquiz/shared-types';
const messages: Record<number, string> = { 0: 'No pudimos conectar. Comprueba tu conexión y vuelve a intentarlo.', 400: 'Revisa los campos. La imagen debe ser JPEG, PNG o WebP válido, sin animación y hasta 16 megapíxeles.', 401: 'Tu acceso venció. Vuelve a iniciar sesión.', 404: 'Este recurso ya no está disponible o no te pertenece.', 409: 'El cuestionario cambió. Recarga y vuelve a intentarlo.', 413: 'La imagen supera el máximo de 5 MB.' };
const message = (status: number) => messages[status] ?? 'No se pudo guardar. Inténtalo de nuevo.';
// Image uploads are the slowest authoring requests.
const call = (token: string, path: string, method = 'GET', body?: object | FormData, signal?: AbortSignal) => gameFetch(path, { token, method, body, signal, timeout: 20000 }, message);
export async function quizRequest<T>(token: string, path: string, method = 'GET', body?: object | FormData, signal?: AbortSignal): Promise<T> {
 return (await call(token, path, method, body, signal)).json() as Promise<T>;
}
export async function quizDelete(token: string, path: string): Promise<void> { await call(token, path, 'DELETE'); }
export async function imageBlob(token: string, id: string, signal: AbortSignal) {
 return (await call(token, '/images/' + encodeURIComponent(id), 'GET', undefined, signal)).blob();
}
/** Same limits the Game API enforces; checked first so a teacher is not left waiting on a doomed upload. */
export const IMAGE_RULES = { maxBytes: 5 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp'] } as const;
