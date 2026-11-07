# Canal en vivo (Socket.IO)

Game API publica los cambios de una partida por Socket.IO. **Los comandos no viajan por el socket**: crear, unirse, iniciar, cerrar, avanzar, responder y terminar son endpoints REST documentados en Scalar (`/game/docs`). El socket sirve para suscribirse a una sala, recibir eventos sin recargar y recuperar el estado tras una reconexión.

Así hay un único punto de autorización y validación (los casos de uso de Game) y cualquier cliente externo puede jugar o consultar sin sockets.

## Conexión

| | Valor |
| --- | --- |
| Biblioteca | Socket.IO 4.8 (`socket.io-client` 4.8.3) |
| Namespace | `/live` |
| Ruta | `/game/socket.io` a través del proxy · `/socket.io` contra la API directa (puerto 3002) |
| Transporte | WebSocket con respaldo de long-polling |
| Mensaje máximo | 16 KiB |

```js
import { io } from 'socket.io-client';
const socket = io(window.location.origin + '/live', {
  path: '/game/socket.io',
  auth: cb => cb({ token: currentAccessToken() }), // se evalúa en cada (re)conexión
});
```

## Autenticación

1. **Handshake.** El cliente envía el JWT de acceso emitido por Auth en `auth.token`. Game lo verifica sin consultar Auth: firma RS256, `iss`, `aud = nexquiz-game-api`, `kid`, `typ = at+jwt`, `exp` y `sub`. Si falta o es inválido, la conexión se rechaza con `connect_error` y mensaje `UNAUTHORIZED`, y el cliente nunca entra a ninguna sala.
2. **Renovación.** Los tokens duran 300 s. Antes de que venzan, el cliente obtiene uno nuevo (`POST /auth/api/v1/auth/refresh`) y lo envía con `auth:renew`. El nuevo token debe ser del mismo usuario; si es inválido o de otro usuario, el servidor responde con error y desconecta.
3. **Expiración.** Si el `exp` del token vigente pasa sin renovación, el servidor emite `auth:expired` y desconecta. El cliente refresca el token y vuelve a conectar; la participación no se pierde.

La autorización por sala se hace en `session:subscribe`. Un usuario solo puede suscribirse a una sesión donde es anfitrión o participante. Los nombres de sala son internos: el cliente nunca elige a qué sala entra.

## Mensajes del cliente (con acknowledgement)

| Evento | Datos | Respuesta (ack) |
| --- | --- | --- |
| `session:subscribe` | `{ sessionId }` | `{ state: SessionState }` o `{ error: { code, message } }` |
| `session:unsubscribe` | `{ sessionId }` | `{ ok: true }` |
| `auth:renew` | `{ token }` | `{ ok: true, expiresAt }` o `{ error: { code: 'UNAUTHORIZED' } }` y desconexión |

`SessionState` es la misma vista que `GET /sessions/:id` (esquema `SessionStateDto` en Scalar). Los errores de `session:subscribe` son `INVALID_INPUT` (no es UUID) y `NOT_FOUND` (no existe o el usuario no pertenece a ella).

## Eventos del servidor

Todos incluyen `sessionId` y `version`.

| Evento | Destino | Datos |
| --- | --- | --- |
| `question:opened` | Toda la sala | `question { id, position, total, prompt, hasImage }`, `openedAt`, `deadline`, `serverNow`. **Nunca incluye la respuesta correcta.** |
| `answer:count` | Anfitrión | `gameQuestionId`, `answered`, `participantCount` |
| `question:closed` | Toda la sala | `gameQuestionId`, `position`, `correctAnswer`, `counts { true, false, none }` |
| `answer:result` | Solo el participante | `gameQuestionId`, `answered`, `correct`, `score` |
| `participant:joined` | Anfitrión | `participant { id, displayName }`, `participantCount`: alguien se registró en la sala (`POST /sessions/join`) |
| `participant:online` / `participant:offline` | Anfitrión | `participant { id, displayName }`: presencia del socket. No afecta participación ni puntaje |
| `session:finished` | Toda la sala | `ranking [{ participantId, displayName, score, correctCount, rank }]` |
| `session:cancelled` | Toda la sala | — |
| `auth:expired` | El socket | `message`; luego se desconecta |

La imagen de una pregunta se descarga aparte con `GET /game/api/v1/sessions/:id/questions/:gameQuestionId/image` y `Authorization: Bearer`, como Blob. Los participantes solo pueden pedir imágenes de preguntas ya abiertas.

## Orden y recuperación del estado

- `version` aumenta en cada cambio de estado de la sesión. El cliente guarda la última versión aplicada e **ignora** eventos `question:*` y `session:*` con una versión menor. Los eventos de presencia y conteo llevan la versión vigente y son informativos.
- La entrega por socket es "mejor esfuerzo". La fuente de verdad es PostgreSQL. Ante cualquier duda (reconexión, salto de versión, pestaña reactivada), el cliente vuelve a enviar `session:subscribe` y reemplaza su estado con el `state` del ack.
- **Reconexión:**
  1. Socket.IO reconecta automáticamente.
  2. En `connect`, el cliente usa un token vigente (refrescándolo si hace falta).
  3. Reenvía `session:subscribe` y pinta el `state` recibido: pregunta actual, `deadline`, su propia respuesta y su puntaje.

  Como el participante y la respuesta son únicos en la base de datos (`UNIQUE(sessionId, userId)` y `UNIQUE(gameQuestionId, participantId)`), reconectar o reenviar nunca duplica la participación ni suma puntos otra vez.
- **Reloj:** el cliente calcula `offset = serverNow - Date.now()` y muestra la cuenta regresiva como `deadline - (Date.now() + offset)`. El servidor decide: una respuesta recibida después del `deadline` se rechaza con `409 ANSWER_WINDOW_CLOSED`.

## Ejemplo de flujo

1. El anfitrión ejecuta `POST /sessions` y se suscribe.
2. Los participantes ejecutan `POST /sessions/join` y se suscriben; el anfitrión recibe `participant:joined` y `participant:online`.
3. El anfitrión ejecuta `POST /sessions/:id/start`: todos reciben `question:opened`.
4. Cada participante ejecuta `POST /sessions/:id/answers`; el anfitrión recibe `answer:count`.
5. Al llegar el `deadline`, o con `POST /close`, todos reciben `question:closed` y cada participante su `answer:result`.
6. `POST /next` abre la siguiente pregunta. Después de la última, se emite `session:finished` con la clasificación guardada.

## Límites conocidos

- Una sola instancia de Game: las salas y los temporizadores viven en el proceso. Si Game se reinicia, el estado sigue en PostgreSQL, los temporizadores se reprograman al arrancar y los clientes se resincronizan al reconectar. Escalar a varias instancias requeriría el adaptador Redis de Socket.IO, y no está incluido.
- La presencia es solo informativa. Un participante desconectado sigue en la sala y conserva su puntaje.
