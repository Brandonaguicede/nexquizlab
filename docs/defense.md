# Guía para la defensa

Respuestas cortas, con el lugar del código donde se ven, para las preguntas que plantea el enunciado.

## ¿Qué problema resuelve y cómo se usa en clase?

Permite hacer evaluaciones rápidas de Verdadero o Falso en vivo:

1. El docente crea un cuestionario (con imágenes), abre una sala y comparte el código.
2. Los estudiantes entran desde el celular con su cuenta.
3. Todos ven la misma pregunta a la vez y responden una sola vez.
4. Al cerrar la pregunta se revela la respuesta.
5. Al final queda guardada una clasificación (1 punto por acierto).

La demostración paso a paso está en el [README](../README.md#cómo-demostrar-el-juego).

## Estilo de arquitectura y organización interna: beneficios y costos

| Decisión | Beneficio | Costo |
| --- | --- | --- |
| Auth y Game como **APIs separadas**, cada una con su base de datos. Game verifica el JWT RS256 solo con la clave pública y con audiencia `nexquiz-game-api` | Se despliegan por separado. Game nunca toca los datos de Auth, y otro proyecto puede usar Auth o Game por red | Dos despliegues y dos bases. Un logout tarda hasta 300 s en invalidar los tokens ya emitidos |
| Game como **monolito modular** (cuestionarios, imágenes, salas y partida) | Una sola transacción para la copia del cuestionario, las respuestas y la clasificación. Más simple que varios microservicios | Los módulos no escalan por separado |
| **N-Capas** con puertos (`application/*.port.ts`) y composición en `modules`. `scripts/check-architecture.cjs` lo hace cumplir | Las reglas se prueban sin NestJS ni Prisma (`test/game-domain.spec.ts`) y los adaptadores se pueden cambiar | Más archivos e indirección que un controlador con acceso directo a datos |
| **Comandos por REST y avisos por Socket.IO** | Un solo lugar de autorización y validación; todo queda documentado en Scalar; un cliente sin sockets puede jugar o consultar | Una petición HTTP extra por respuesta, algo despreciable en una clase |
| Temporizador y salas **en el proceso** | Simple y sin Redis. El estado vive en PostgreSQL y se recupera al reiniciar | Una sola instancia de Game |

## ¿Cómo llega una pregunta a los participantes?

1. El anfitrión ejecuta `POST /sessions/:id/start` o `/next` → `SessionController` → `ManageSessions.command` (`application/manage-sessions.ts`).
2. `PrismaGameRepository.transition` bloquea la sesión (`SELECT … FOR UPDATE`), verifica que quien llama sea el anfitrión, cierra la pregunta si ya venció, aplica la regla `start` o `next` de `domain/game.ts` (que fija el `deadline`) y guarda el cambio.
3. `LiveEvents.announce` compara el estado anterior y el nuevo, publica `question:opened` sin la respuesta correcta y programa el temporizador.
4. `LiveBroadcaster` emite el evento solo en la sala `session:{id}`, donde únicamente pudieron entrar el anfitrión y los participantes (`LiveGateway.subscribe`).
5. El cliente (`use-live-session.ts`) aplica el evento si su `version` es la siguiente; si detecta un salto, se resincroniza con `session:subscribe`.

## ¿Dónde se valida una respuesta y cómo se evita sumar puntos dos veces?

- `POST /sessions/:id/answers` → `PlaySessions.answer`. La hora de recepción se toma antes de esperar cualquier bloqueo.
- `PrismaGameRepository.submitAnswer` bloquea la sesión en modo compartido, de modo que un cierre no puede intercalarse. Luego verifica que quien responde sea participante y que la pregunta pertenezca a la sala, y aplica `assertAnswerWindow`: pregunta abierta, que sea la actual y `recibida ≤ deadline`.
- **La garantía de una sola respuesta está en la base de datos:** `UNIQUE(gameQuestionId, participantId)`, con un insert `ON CONFLICT DO NOTHING`. Un reenvío o un doble clic devuelve la primera respuesta con `duplicate: true`.
- El puntaje es la cantidad de respuestas correctas guardadas, y se calcula una sola vez al terminar, en la misma transacción. La prueba de carga lo confirma con 150 participantes que responden dos veces: 0 puntajes incorrectos.

## ¿Cómo se ejecuta en otra máquina?

Con Git y Docker: `git clone`, `scripts/start.sh` (o `start.ps1`). El script genera `.env` y las claves en un contenedor de Node, construye o descarga las imágenes, aplica las migraciones, carga el seed por la API e imprime las URL y las cuentas. Los datos persisten en volúmenes con nombre. Ver el [README](../README.md#inicio-y-detención).

## ¿Cómo consume la API otro proyecto?

Igual que `apps/results-client`:

1. `POST /auth/api/v1/auth/login` (con la cabecera `X-NexQuiz-CSRF: 1`) devuelve un `accessToken`.
2. Con `Authorization: Bearer` se llama a `GET /game/api/v1/sessions`, `/sessions/:id` y `/sessions/:id/results`.
3. Si quiere el canal en vivo, se conecta a Socket.IO en `/live` con `auth.token` ([protocolo](api/realtime.md)).

No comparte código ni base de datos: solo URL de configuración y contratos documentados en Scalar.

## Reconexión

Socket.IO reconecta solo, y el cliente también reacciona al evento `offline` del navegador. Al volver, envía `session:subscribe` y recibe el estado vigente: la pregunta, el `deadline`, su respuesta y su puntaje. Como existen `UNIQUE(sessionId, userId)` y la restricción única de respuestas, no se duplica nada. Se prueba en `tests/live/live.spec.ts`: sin red y recarga de página.
