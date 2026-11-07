// Independent consumer of the NexQuiz contracts: Auth login + Game sessions/results over HTTP only.
// Configuration comes from config.js (generated from environment variables when the container starts).
const config = window.NEXQUIZ_CONFIG || {};
const authUrl = String(config.authUrl || '').replace(/\/$/, '');
const gameUrl = String(config.gameUrl || '').replace(/\/$/, '');
let accessToken = null; // memory only; never persisted
const $ = selector => document.querySelector(selector);
$('#auth-url').textContent = authUrl || 'sin configurar';
$('#game-url').textContent = gameUrl || 'sin configurar';

const messages = {
 401: 'Credenciales inválidas o token vencido. Vuelve a iniciar sesión.',
 403: 'Acceso denegado. Revisa que el origen de este cliente esté en CORS_ORIGINS.',
 404: 'La sesión no existe o tu usuario no participó en ella.',
 409: 'La sesión todavía no ha terminado: sus resultados aún no están disponibles.',
 429: 'Demasiados intentos. Espera unos minutos.',
};
async function request(url, options = {}) {
 let response;
 try { response = await fetch(url, { ...options, credentials: 'omit' }); }
 catch { throw new Error('No se pudo conectar con ' + new URL(url).origin + '. Revisa la configuración o el servicio.'); }
 const body = await response.json().catch(() => null);
 if (!response.ok) throw new Error(messages[response.status] || `Error ${response.status}${body && body.code ? ' (' + body.code + ')' : ''}`);
 return body;
}
const game = path => request(gameUrl + '/api/v1' + path, { headers: { Authorization: 'Bearer ' + accessToken } });

$('#login-form').addEventListener('submit', async event => {
 event.preventDefault();
 const data = new FormData(event.currentTarget), status = $('#login-status');
 status.textContent = 'Autenticando…'; status.className = '';
 try {
  // Auth requires its CSRF header on session mutations; the refresh cookie is not needed here.
  const session = await request(authUrl + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-NexQuiz-CSRF': '1' }, body: JSON.stringify({ email: data.get('email'), password: data.get('password') }) });
  accessToken = session.accessToken;
  status.textContent = `Token obtenido para ${session.user.displayName}. Vence en ${session.expiresIn} segundos.`; status.className = 'ok';
  $('#query-section').hidden = false;
 } catch (error) { status.textContent = error.message; status.className = 'error'; }
});

document.querySelectorAll('[data-role]').forEach(button => button.addEventListener('click', async () => {
 const list = $('#history'), status = $('#query-status');
 list.replaceChildren(); status.textContent = 'Consultando…'; status.className = '';
 try {
  const page = await game('/sessions?role=' + button.dataset.role + '&pageSize=20');
  status.textContent = page.total ? `${page.total} partida(s) terminada(s).` : 'No hay partidas terminadas.';
  for (const item of page.items) {
   const entry = document.createElement('li'), open = document.createElement('button');
   open.type = 'button'; open.textContent = `${item.title} · ${new Date(item.finishedAt).toLocaleString('es-CR')} · ${item.participantCount} participante(s)` + (item.rank ? ` · tu puesto: ${item.rank}` : '');
   open.addEventListener('click', () => { $('#session-form').sessionId.value = item.sessionId; showSession(item.sessionId); });
   entry.append(open); list.append(entry);
  }
 } catch (error) { status.textContent = error.message; status.className = 'error'; }
}));

$('#session-form').addEventListener('submit', event => { event.preventDefault(); showSession(new FormData(event.currentTarget).get('sessionId').trim()); });

async function showSession(sessionId) {
 const status = $('#query-status');
 status.textContent = 'Consultando sesión…'; status.className = '';
 try {
  const state = await game('/sessions/' + encodeURIComponent(sessionId));
  const summary = $('#session-summary');
  summary.replaceChildren(...[['Título', state.title], ['Código', state.code], ['Estado', state.status], ['Tu rol', state.role === 'host' ? 'anfitrión' : 'participante'], ['Participantes', state.participantCount], ['Preguntas', state.questionCount]].map(([label, value]) => { const row = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = label; dd.textContent = String(value); row.append(dt, dd); return row; }));
  const body = $('#ranking tbody'); body.replaceChildren();
  let raw = { session: state };
  if (state.status === 'FINISHED') {
   const results = await game('/sessions/' + encodeURIComponent(sessionId) + '/results');
   raw = { session: state, results };
   for (const standing of results.ranking) {
    const row = document.createElement('tr');
    for (const value of [standing.rank, standing.displayName, standing.score, standing.correctCount]) { const cell = document.createElement('td'); cell.textContent = String(value); row.append(cell); }
    body.append(row);
   }
   status.textContent = 'Resultados obtenidos desde la API.'; status.className = 'ok';
  } else { status.textContent = 'La sesión está en curso (' + state.status + '); los resultados aparecen al terminar.'; status.className = ''; }
  $('#raw').textContent = JSON.stringify(raw, null, 2);
  $('#result-section').hidden = false;
 } catch (error) { status.textContent = error.message; status.className = 'error'; }
}
