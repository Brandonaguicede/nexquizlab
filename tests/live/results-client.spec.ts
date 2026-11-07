import { expect, test, type APIRequestContext } from '@playwright/test';
import { api, bearer, register } from '../quizzes/helpers';
const clientUrl = process.env.RESULTS_CLIENT_URL || 'http://localhost:8081';
/** Plays a short game entirely through the REST API and returns the finished session. */
async function finishedGame(request: APIRequestContext) {
 const host = await register(request), ana = await register(request, 'STUDENT'), beto = await register(request, 'STUDENT');
 const quiz = await (await request.post(api + '/quizzes', { headers: bearer(host.token), data: { title: 'Consumo independiente' } })).json();
 await request.post(`${api}/quizzes/${quiz.id}/questions`, { headers: bearer(host.token), data: { prompt: 'Dos más dos es cuatro.', correctAnswer: true } });
 const session = await (await request.post(api + '/sessions', { headers: bearer(host.token), data: { quizId: quiz.id } })).json();
 for (const player of [ana, beto]) expect((await request.post(api + '/sessions/join', { headers: bearer(player.token), data: { code: session.code } })).status()).toBe(200);
 const state = await (await request.post(`${api}/sessions/${session.id}/start`, { headers: bearer(host.token) })).json();
 await request.post(`${api}/sessions/${session.id}/answers`, { headers: bearer(ana.token), data: { gameQuestionId: state.currentQuestion.id, value: true } });
 await request.post(`${api}/sessions/${session.id}/answers`, { headers: bearer(beto.token), data: { gameQuestionId: state.currentQuestion.id, value: false } });
 await request.post(`${api}/sessions/${session.id}/close`, { headers: bearer(host.token) });
 expect((await (await request.post(`${api}/sessions/${session.id}/next`, { headers: bearer(host.token) })).json()).status).toBe('FINISHED');
 return { host, ana, session: session as { id: string; code: string } };
}
test('the independent client logs in through Auth and reads a finished session from Game by configuration', async ({ page, request }) => {
 const { host, session } = await finishedGame(request);
 await page.goto(clientUrl);
 await expect(page.locator('#auth-url')).toHaveText('http://localhost:8080/auth');
 await expect(page.locator('#game-url')).toHaveText('http://localhost:8080/game');
 await page.getByLabel('Correo electrónico').fill(host.email);
 await page.getByLabel('Contraseña').fill('incorrecta-123456');
 await page.getByRole('button', { name: 'Obtener token' }).click();
 await expect(page.locator('#login-status')).toHaveText(/Credenciales inválidas/);
 await page.getByLabel('Contraseña').fill(host.password);
 await page.getByRole('button', { name: 'Obtener token' }).click();
 await expect(page.locator('#login-status')).toContainText('Token obtenido');
 await page.getByRole('button', { name: 'Partidas que organicé' }).click();
 await page.getByRole('button', { name: /Consumo independiente/ }).first().click();
 await expect(page.locator('#ranking tbody tr')).toHaveCount(2);
 await expect(page.locator('#ranking tbody tr').first()).toContainText('1');
 await expect(page.locator('#session-summary')).toContainText(session.code);
 await expect(page.locator('#raw')).toContainText('"ranking"');
 await page.getByLabel('ID de una sesión').fill('00000000-0000-4000-8000-000000000000');
 await page.getByRole('button', { name: 'Consultar sesión y resultados' }).click();
 await expect(page.locator('#query-status')).toHaveText('La sesión no existe o tu usuario no participó en ella.');
});
test('web history lists finished games with personal rank and links to saved results', async ({ page, request }) => {
 const { ana, session } = await finishedGame(request);
 await page.goto('/sessions');
 await expect(page).toHaveURL(/\/login$/);
 await page.getByLabel('Correo electrónico').fill(ana.email);
 await page.getByLabel('Contraseña', { exact: true }).fill(ana.password);
 await page.getByRole('button', { name: 'Entrar', exact: true }).click();
 await expect(page).toHaveURL(/\/sessions$/);
 await expect(page.getByText('Puesto 1 · 1 punto')).toBeVisible();
 await page.getByRole('link', { name: 'Ver resultados' }).click();
 await expect(page).toHaveURL(new RegExp('/results/' + session.id + '$'));
 await expect(page.locator('.live-ranking li')).toHaveCount(2);
 // The history view comes from the account role, not the URL: a student asking for ?role=host still gets only their own games.
 await page.goto('/sessions?role=host');
 await expect(page.getByText('Puesto 1 · 1 punto')).toBeVisible();
 await expect(page.getByText('Todavía no has terminado ninguna partida como anfitrión.')).toHaveCount(0);
});
