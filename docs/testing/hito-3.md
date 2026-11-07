# NexQuiz — Hito 3: cuestionarios, preguntas e imágenes

Fecha de implementación: 30 de octubre de 2026. Trabajo realizado sobre el monorepo y el servicio de identidad existentes. Hito 2 no se volvió a implementar. No hay salas, partidas, puntuación ni publicación externa. Los archivos de aceptación contienen cuentas sintéticas `example.invalid`; no se usaron datos personales. Los contenedores Auth, Game, Web, PostgreSQL y monitoreo siguen en Compose con sus volúmenes persistentes.

## Funcionalidades implementadas

Los docentes autenticados crean, consultan, editan y eliminan sus cuestionarios. El listado usa páginas de 10 (ajustables de 1 a 50), muestra el total de preguntas y la fecha de actualización, ordena por fecha descendente con ID estable y ofrece estados de carga, error y vacío. El detalle incluye preguntas ordenadas. Cuestionarios admiten título obligatorio de hasta 160 caracteres y descripción opcional de hasta 2000.

Cada cuestionario admite hasta 200 preguntas de verdadero/falso. Preguntas admiten enunciado de 1 a 2000 caracteres, respuesta booleana, posición desde cero, imagen opcional y fechas. Se pueden agregar, editar, eliminar y mover con controles accesibles. Borrar pregunta compacta las posiciones; borrar cuestionario o pregunta mueve los registros a tombstones y conserva su procedencia.

Las imágenes JPEG, PNG y WebP de hasta 5 MiB se procesan desde archivos temporales, no se retienen completas en memoria de la aplicación y se reescriben a WebP sin metadatos. Se valida el formato decodificado, se rechaza animación y se limita la entrada a 16 megapíxeles. Reemplazo y eliminación son autenticados. El navegador descarga la imagen como Blob autenticado y revoca su URL local; no se guardan tokens en URLs. La imagen se lee mediante `/game/api/v1/images/:id` o el proxy `/game/api/v1/images/:id`.

## Arquitectura y almacenamiento

Se conservan Domain, Application, Infrastructure y Presentation. Domain define valores y límites de texto/preguntas; casos de uso dependen de `QuizRepository` e `ImageStorage`; Prisma y el sistema de archivos son adaptadores; DTOs, guards y controladores definen transporte. Identidad usa el guard RS256 de Hito 2 y nunca consulta Auth. Los controles de arquitectura no encontraron imports prohibidos ni ciclos.

Migración `apps/game-api/prisma/migrations/20261030040000_quiz_authoring/migration.sql`: tres tablas nuevas en `nexquiz_game`, índices de propietario/actividad/orden, posición única por cuestionario, imagen única y checks de texto/posición. No toca ni migra `nexquiz_auth`.

Cada cambio de un agregado bloquea su fila de cuestionario en una transacción PostgreSQL. El reordenamiento valida una permutación completa y escribe todas las posiciones con una sentencia SQL. La unicidad también queda protegida en la base. Listado y conteo se leen en una transacción repeatable-read con `relation count`, sin consultas N+1. El índice `ownerId, deletedAt, updatedAt DESC, id` corresponde al filtro, orden estable y cursor del listado; el límite de 200 acota agregado y operaciones.

`IMAGE_STORAGE_PATH` selecciona el adaptador local; por defecto desarrollo usa `apps/game-api/images`, mientras el contenedor usa `/app/images` (volumen nombrado `nexquiz-images`). Los IDs son UUID generados en el servidor y comprobados de nuevo por el adaptador. No se guardan rutas absolutas de Windows ni se usa el nombre o MIME enviado por el cliente como destino. La fila del recurso se crea antes de escribir; si adjuntarlo falla, se compensa el archivo. El barrido periódico y al arranque reintenta recursos no asociados de más de una hora y temporales antiguos; los fallos dejan fila para el próximo intento. El Dockerfile prepara directorio con dueño `node`; la configuración de desarrollo y producción conserva el volumen de imágenes.

## API y pantallas

Prefijo `/api/v1`, autenticación `Authorization: Bearer <JWT>` en todos los endpoints de autoría:

| Endpoint | Propósito | Respuesta |
| --- | --- | --- |
| `GET /quizzes?page=1&pageSize=10` | Listado propio paginado | `{items,total,page,pageSize}`, cada elemento incluye `questionCount` |
| `POST /quizzes` | Crear | `201`, propietario del JWT |
| `GET /quizzes/:id` | Detalle y preguntas en orden | `200` |
| `PATCH /quizzes/:id` | Editar título/descripción | `200` |
| `DELETE /quizzes/:id` | Borrado lógico idempotente propio | `204` |
| `POST /quizzes/:id/questions` | Añadir pregunta al final | `201` |
| `PATCH /quizzes/:id/questions/:questionId` | Editar enunciado/respuesta | `200` |
| `DELETE /quizzes/:id/questions/:questionId` | Tombstone y compactar | `204` |
| `PATCH /quizzes/:id/questions/reorder` | Permutación completa `questionIds` | `200`; obsoleto `409` |
| `POST /quizzes/:id/questions/:questionId/image` | Subir/reemplazar `multipart file` | `201`; sobre 5 MiB `413` |
| `DELETE /quizzes/:id/questions/:questionId/image` | Quitar asociación | `200` |
| `GET /images/:imageId` | Flujo privado `image/webp` | `200`, `private, no-store` |

DTOs rechazan campos extra como `ownerId`, nulos inválidos, booleanos convertidos y posiciones recibidas del cliente. Recurso inexistente, eliminado o ajeno retorna 404 uniforme; JWT ausente o inválido retorna 401; entrada inválida 400; conflictos/concurrencia 409. Scalar local documenta DTO, autenticación, límites y contratos de respuesta.

Web: `/quizzes` biblioteca paginada, creación, edición y confirmación de eliminación; `/quizzes/:id` formulario del cuestionario, editor de preguntas, carga y vista previa de imagen, replacement/removal y controles de orden. Componentes de formulario e imagen son reutilizables, etiquetas visibles, estados anunciados, sin overflow y sin API simulada en producción.

## Seguridad, calidad y preparación futura

El JWT es la única autoridad para propietario. Rutas y búsquedas filtran por dueño y borrado lógico; errores no revelan si un ID ajeno existe. Lecturas de archivos también comprueban que la pregunta siga activa y pertenezca al dueño. Identidad mantiene JWT RS256, issuer, audience, expiración y clave pública existentes.

Clean code: validadores de dominio reutilizados, paginación acotada, campos seleccionados explícitamente, conteo relacional, set-based reorder, límites y transacciones demostrados por pruebas. No se añadió cache ni se afirma una mejora porcentual de rendimiento. Imágenes se almacenan en disco y se decodifican con dimensiones limitadas. Las pruebas y la auditoría de arquitectura son la evidencia; no hay benchmark de carga.

Para el Hito 4, al iniciar una futura partida se debe bloquear el cuestionario y copiar título, descripción, enunciados, booleanos y orden a filas `GameQuestionSnapshot` inmutables y numeradas con `schemaVersion`; respuestas y marcador futuros referirán exclusivamente ese snapshot. Los IDs fuente son procedencia. Imágenes deben tener referencias retenidas/copiadas separadamente antes de que el colector pueda eliminar los assets de autoría. La receta y pruebas de carreras se detallan en [quiz-authoring.md](../architecture/quiz-authoring.md). Esta versión no crea partidas ni snapshot de ejecución.

## Pruebas y evidencia

| Comprobación | Resultado final |
| --- | --- |
| OpenSpec estricto antes del código | Aprobado |
| Arquitectura, ESLint/TypeScript (`pnpm lint`, `pnpm typecheck`) | Pasan |
| Jest del monorepo y Scalar HTTP | Auth 23/23; Game 44/44; Scalar 12/12; tooling 5/5 |
| Build y Prisma | Auth/Game/Web compilados; esquemas válidos; generación aislada de ambos clientes aprobada. Ver limitación local de `pnpm verify` al cierre. |
| Dominio y Sharp | 44 Game tests, JPEG/PNG/WebP, metadata, contenido corrupto/formato inválido, límite de píxeles y paths; temporales se liberan en Windows |
| REST con contenedores y PostgreSQL reales | 7/7: CRUD/paginación, dos propietarios, datos inválidos, edición/deleción, reordenamiento, mutaciones concurrentes, JWT obligatorio, uploads/lecturas privadas, reemplazo, remoción, formato y límite de 5 MiB |
| Playwright Hito 3, escritorio | 2/2: bloqueo sin login y flujo real de creación/edición/upload/reload/reordenamiento/borrado/error |
| Playwright Hito 3, móvil | 2/2, mismo flujo, sin overflow |
| Playwright Hitos 1/2 | E2E 4/4; Scalar escritorio/móvil 4/4; identidad real 10/10 |
| PostgreSQL/Auth integración real | 6/6 con `NEXQUIZ_TEST_DB_PORT=55432`: aislamiento, registro concurrente, refresh/replay, expiración, logout y rate limit atómico |
| Verificadores HTTP/observabilidad | API health/OpenAPI/Scalar/CORS/404 y Prometheus/Grafana pasan |
| Detector Impeccable | Sin hallazgos para los targets cambiados después de ajustar la escala de tipo |
| Auditoría de archivos sensibles y patrones | `pnpm audit:repository` aprobó 193 archivos elegibles después del archivo de OpenSpec |
| Migración real | 20261030040000 aplicada en `nexquiz_game`; Auth y otros volúmenes preservados |
| Docker | Auth `016f1a2b40ed`, Game `a64ccb154c41`, Web `820bca7dfc6a`; Auth/Game/Web/PostgreSQL healthy; Game recreado con la ruta persistente corregida |

Se corrigió una limitación del detector de archivos de Sharp que retenía temporales en Windows: desactivar el caché de archivos permitió liberar la entrada temporal; ahora Jest incluye regresión de JPEG, PNG y WebP. El cache desactivado no cambia la respuesta del usuario ni se presenta como optimización medida.

Pendientes verificables: el host local Docker vincula Web solo a loopback por seguridad. La accesibilidad física desde una segunda red/dispositivo no se probó; la guía documenta cómo preparar una dirección LAN segura o el host HTTPS de producción. No se publicaron imágenes ni se hizo push/despliegue VPS. No se implementaron salas.

## Revalidación y cierre — 31 de octubre de 2026

Se ejecutaron nuevamente validación de esquemas, arquitectura, lint, typecheck, pruebas del monorepo y build: todos aprobados. Resultados: Auth 23, Game 44, tooling 5, Scalar HTTP 12; integración PostgreSQL 6; regresión E2E 4, Scalar navegador 4 e identidad 10. HTTP y observabilidad también aprobados. La migración `20261030040000_quiz_authoring` figura terminada en `_prisma_migrations` de Game.

La primera aceptación de cuestionarios detectó cinco fallos: los uploads devolvían 500 por `EACCES`. Compose de desarrollo establece `NODE_ENV=development`, por lo que el adaptador elegía `/app/apps/game-api/images` y no el volumen montado en `/app/images`. Se añadió `IMAGE_STORAGE_PATH: /app/images` explícito en ambos Compose y se recreó únicamente Game, conservando volúmenes. La repetición completa pasó 11/11: API 7, escritorio 2 y móvil 2. La instancia diagnóstica temporal terminó al recrear Game.

`pnpm verify` no terminó como comando único: los servidores de desarrollo locales activos mantienen bloqueados los DLL de Prisma y su regeneración en la ruta habitual falla con `EPERM` en Windows. No se detuvieron esos servidores. Se generaron ambos clientes desde copias exactas de sus esquemas bajo `.cache/hito-3-generation` (ignorado por Git), y se ejecutaron por separado todas las etapas restantes del comando, con resultado aprobado. Esta alternativa verifica la generación sin sobrescribir los clientes en uso; no se registra el comando único como aprobado.

La revisión final comprobó filtros de propietario y tombstones, bloqueo transaccional del agregado, posiciones contiguas, asociación privada de imágenes y ruta del volumen. La validación estricta de OpenSpec se repitió antes del archivo. Los resultados históricos de Impeccable y del build Docker permanecen identificados arriba; no se repitió ese detector ni se reconstruyeron imágenes durante este cierre, ya que la corrección afecta a Compose.

OpenSpec archivó el cambio en `openspec/changes/archive/2026-10-31-hito-3-quizzes` y creó la especificación vigente `quiz-authoring`; se completó su propósito tras el archivo. La validación global detectó además una incidencia previa e independiente: el cambio activo `hito-1` carece de deltas. No se modificó ese hito ni se registra la validación global como aprobada.
