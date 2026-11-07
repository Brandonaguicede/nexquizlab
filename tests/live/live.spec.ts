import { devices, expect, test, type Browser, type BrowserContext, type Page, type APIRequestContext } from '@playwright/test';
import { api, bearer, image, register } from '../quizzes/helpers';
type User = Awaited<ReturnType<typeof register>>;
async function quiz(request: APIRequestContext, owner: User, title: string) {
 const created = await (await request.post(api + '/quizzes', { headers: bearer(owner.token), data: { title } })).json();
 const first = await (await request.post(`${api}/quizzes/${created.id}/questions`, { headers: bearer(owner.token), data: { prompt: title + ': el agua hierve a 100 °C al nivel del mar.', correctAnswer: true } })).json();
 await request.post(`${api}/quizzes/${created.id}/questions`, { headers: bearer(owner.token), data: { prompt: title + ': la Luna es una estrella.', correctAnswer: false } });
 const upload = await request.post(`${api}/quizzes/${created.id}/questions/${first.id}/image`, { headers: bearer(owner.token), multipart: { file: { name: 'agua.png', mimeType: 'image/png', buffer: await image() } } });
 expect(upload.status()).toBe(201);
 return created as { id: string; title: string };
}
const { defaultBrowserType: _phoneEngine, ...phone } = devices['iPhone 13'];
const { defaultBrowserType: _desktopEngine, ...desktop } = devices['Desktop Chrome'];
// Chromium for every context; the phone keeps the iPhone 13 viewport, touch and user agent.
async function context(browser: Browser, mobile = false) { return browser.newContext(mobile ? phone : desktop); }
/** Logs in through the real form; ProtectedRoute brings the user back to the requested page. */
async function signIn(page: Page, user: User, path: string) {
 await page.goto(path);
 await expect(page).toHaveURL(/\/login$/);
 await page.getByLabel('Correo electrónico').fill(user.email);
 await page.getByLabel('Contraseña', { exact: true }).fill(user.password);
 await page.getByRole('button', { name: 'Entrar', exact: true }).click();
 await expect(page).toHaveURL(new RegExp(path.replace(/[?]/g, '\\?') + '$'));
}
async function joinFromLink(page: Page, user: User, code: string) {
 await signIn(page, user, '/join?code=' + code);
 await expect(page.getByLabel('Código de la sala')).toHaveValue(code);
 await page.getByRole('button', { name: 'Entrar a la sala' }).click();
 await expect(page).toHaveURL(/\/play\/[0-9a-f-]+$/);
 await expect(page.getByRole('heading', { name: 'Ya estás en la sala.' })).toBeVisible();
}
const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const contexts: BrowserContext[] = [];
test.afterEach(async () => { for (const item of contexts.splice(0)) await item.close(); });

test('a full class game across desktop and phone: lobby, live questions, image, reveal, auto close and ranking', async ({ browser, request }, testInfo) => {
 test.setTimeout(120000);
 const teacher = await register(request), ana = await register(request, 'STUDENT'), beto = await register(request, 'STUDENT');
 const created = await quiz(request, teacher, 'Ciencias');
 const hostContext = await context(browser), anaContext = await context(browser), betoContext = await context(browser, true);
 contexts.push(hostContext, anaContext, betoContext);
 const host = await hostContext.newPage(), anaPage = await anaContext.newPage(), betoPage = await betoContext.newPage();

 await signIn(host, teacher, '/quizzes/' + created.id);
 await host.getByLabel('Tiempo por pregunta').selectOption('10');
 await host.getByRole('button', { name: 'Abrir sala' }).click();
 await expect(host).toHaveURL(/\/host\/[0-9a-f-]+$/);
 await expect(host.getByRole('heading', { name: 'Esperando participantes' })).toBeVisible();
 const code = (await host.locator('.live-code').textContent())!.trim();
 expect(code).toMatch(/^[A-Z2-9]{6}$/);
 await expect(host.getByRole('button', { name: 'Iniciar partida' })).toBeDisabled();

 await joinFromLink(anaPage, ana, code);
 await joinFromLink(betoPage, beto, code);
 await expect(host.locator('.live-participants li')).toHaveCount(2);
 await expect(host.getByText('2 de 50')).toBeVisible();
 await host.screenshot({ path: testInfo.outputPath('host-lobby.png'), fullPage: true });

 await host.getByRole('button', { name: 'Iniciar partida' }).click();
 for (const page of [anaPage, betoPage]) {
  await expect(page.getByRole('heading', { name: /el agua hierve/ })).toBeVisible();
  await expect(page.getByAltText('Imagen de la pregunta')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Verdadero' })).toBeEnabled();
 }
 await expect(host.getByAltText('Imagen de la pregunta')).toBeVisible();
 await betoPage.screenshot({ path: testInfo.outputPath('phone-question.png'), fullPage: true });
 expect(await noHorizontalScroll(betoPage)).toBe(true);

 await anaPage.getByRole('button', { name: 'Verdadero' }).click();
 await expect(anaPage.getByText('Respuesta enviada. Espera a que se cierre la pregunta.')).toBeVisible();
 await expect(anaPage.getByRole('button', { name: 'Falso' })).toBeDisabled();
 await betoPage.getByRole('button', { name: 'Falso' }).click();
 await expect(host.locator('.live-answered')).toContainText('2 de 2 respondieron');
 await host.getByRole('button', { name: 'Cerrar pregunta' }).click();
 await expect(anaPage.getByText('¡Correcto!')).toBeVisible();
 await expect(anaPage.getByText('Llevas 1 punto.', { exact: false })).toBeVisible();
 await expect(betoPage.getByText('Incorrecto', { exact: true })).toBeVisible();
 await expect(host.locator('.live-correct')).toContainText('Verdadero');
 await anaPage.screenshot({ path: testInfo.outputPath('desktop-reveal.png'), fullPage: true });

 await host.getByRole('button', { name: 'Siguiente pregunta' }).click();
 await expect(betoPage.getByRole('heading', { name: /la Luna es una estrella/ })).toBeVisible();
 await expect(betoPage.getByAltText('Imagen de la pregunta')).toHaveCount(0);
 await betoPage.getByRole('button', { name: 'Falso' }).click();
 // Ana does not answer; the server closes the question at its 10 s deadline.
 await expect(anaPage.getByText('Sin respuesta')).toBeVisible({ timeout: 15000 });
 await expect(betoPage.getByText('¡Correcto!')).toBeVisible();
 await host.getByRole('button', { name: 'Ver resultados finales' }).click();
 for (const page of [host, anaPage, betoPage]) await expect(page.locator('.live-ranking li')).toHaveCount(2);
 await expect(anaPage.locator('.live-ranking li.me')).toContainText('1 punto');
 await expect(betoPage.locator('.live-ranking li.me')).toContainText('1 punto');
 await expect(anaPage.locator('.live-ranking .rank').first()).toHaveText('1');
 await expect(anaPage.locator('.live-ranking .rank').nth(1)).toHaveText('1');
 await betoPage.screenshot({ path: testInfo.outputPath('phone-ranking.png'), fullPage: true });
 await host.getByRole('link', { name: 'Ver resultados guardados' }).click();
 await expect(host.getByRole('heading', { name: 'Ciencias' })).toBeVisible();
 await expect(host.locator('.live-ranking li')).toHaveCount(2);
});

test('two rooms at once stay isolated, and a reconnection restores the same participation', async ({ browser, request }) => {
 test.setTimeout(90000);
 const hostA = await register(request), hostB = await register(request), ana = await register(request, 'STUDENT'), carla = await register(request, 'STUDENT');
 const sessionFor = async (owner: User, title: string) => (await (await request.post(api + '/sessions', { headers: bearer(owner.token), data: { quizId: (await quiz(request, owner, title)).id, questionSeconds: 60 } })).json()) as { id: string; code: string };
 const roomA = await sessionFor(hostA, 'Sala A'), roomB = await sessionFor(hostB, 'Sala B');
 const anaContext = await context(browser, true), carlaContext = await context(browser);
 contexts.push(anaContext, carlaContext);
 const anaPage = await anaContext.newPage(), carlaPage = await carlaContext.newPage();
 await joinFromLink(anaPage, ana, roomA.code);
 await joinFromLink(carlaPage, carla, roomB.code);
 expect((await request.post(`${api}/sessions/${roomA.id}/start`, { headers: bearer(hostA.token) })).status()).toBe(200);
 await expect(anaPage.getByRole('heading', { name: /Sala A: el agua hierve/ })).toBeVisible();
 await expect(carlaPage.getByRole('heading', { name: 'Ya estás en la sala.' })).toBeVisible();
 expect((await request.post(`${api}/sessions/${roomB.id}/start`, { headers: bearer(hostB.token) })).status()).toBe(200);
 await expect(carlaPage.getByRole('heading', { name: /Sala B: el agua hierve/ })).toBeVisible();
 await expect(anaPage.getByText(/Sala B/)).toHaveCount(0);

 await anaPage.getByRole('button', { name: 'Verdadero' }).click();
 await expect(anaPage.getByText('Respuesta enviada.', { exact: false })).toBeVisible();
 await anaContext.setOffline(true);
 await expect(anaPage.getByText('Se perdió la conexión.', { exact: false })).toBeVisible({ timeout: 30000 });
 await anaContext.setOffline(false);
 await expect(anaPage.getByText('Se perdió la conexión.', { exact: false })).toHaveCount(0, { timeout: 30000 });
 await expect(anaPage.getByRole('button', { name: 'Verdadero' })).toHaveAttribute('aria-pressed', 'true');
 await anaPage.reload();
 await expect(anaPage.getByRole('heading', { name: /Sala A: el agua hierve/ })).toBeVisible();
 await expect(anaPage.getByRole('button', { name: 'Verdadero' })).toHaveAttribute('aria-pressed', 'true');
 await expect(anaPage.getByRole('button', { name: 'Falso' })).toBeDisabled();
 const rejoin = await request.post(api + '/sessions/join', { headers: bearer(ana.token), data: { code: roomA.code } });
 expect((await rejoin.json()).rejoined).toBe(true);
 const state = await (await request.get(`${api}/sessions/${roomA.id}`, { headers: bearer(hostA.token) })).json();
 expect(state.participantCount).toBe(1);
 expect(state.currentQuestion.answered).toBe(1);
});

test('wrong codes, foreign rooms and participant commands are refused with clear messages', async ({ browser, request }) => {
 const teacher = await register(request), ana = await register(request, 'STUDENT'), outsider = await register(request, 'STUDENT');
 const owned = await quiz(request, teacher, 'Privada');
 const room = (await (await request.post(api + '/sessions', { headers: bearer(teacher.token), data: { quizId: owned.id } })).json()) as { id: string; code: string };
 const page = await (async () => { const item = await context(browser, true); contexts.push(item); return item.newPage(); })();
 await signIn(page, outsider, '/join');
 await page.getByLabel('Código de la sala').fill('ZZZZZZ');
 await page.getByRole('button', { name: 'Entrar a la sala' }).click();
 await expect(page.getByRole('alert')).toHaveText('No encontramos una sala activa con ese código. Revísalo con tu docente.');
 await page.goto('/play/' + room.id);
 await expect(page.getByText('Esta sala no existe o no formas parte de ella.')).toBeVisible();
 // Students never reach the host screen: the route is teacher-only and sends them back to the join page.
 await page.goto('/host/' + room.id);
 await expect(page).not.toHaveURL(/\/host\//);
 await expect(page.getByRole('heading', { name: 'Únete a la partida.' })).toBeVisible();
 await request.post(api + '/sessions/join', { headers: bearer(ana.token), data: { code: room.code } });
 expect((await request.post(`${api}/sessions/${room.id}/start`, { headers: bearer(ana.token) })).status()).toBe(403);
 expect((await request.patch(`${api}/quizzes/${owned.id}`, { headers: bearer(ana.token), data: { title: 'Cambiado por un participante' } })).status()).toBe(403);
 expect((await request.post(`${api}/quizzes/${owned.id}/questions`, { headers: bearer(ana.token), data: { prompt: 'Intrusa', correctAnswer: true } })).status()).toBe(403);
 expect((await request.get(`${api}/sessions/${room.id}`, { headers: bearer(outsider.token) })).status()).toBe(404);
});
