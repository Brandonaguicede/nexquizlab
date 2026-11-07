# NexQuiz — Hito 5: resultados, cliente independiente y operación reproducible

Fecha: 31 de octubre de 2026. Las pruebas se hicieron sobre el stack Compose local; en este equipo, PostgreSQL usa el puerto de host 55432.

## Qué se entrega

- **Historial:** `GET /api/v1/sessions?role=host|participant&page&pageSize` devuelve las partidas terminadas del usuario. Con `role=participant` incluye su puntaje y su puesto. En la web, la página **Mis partidas** (`/sessions`) enlaza a los resultados guardados (`/results/:id`).
- **Cliente adicional** (`apps/results-client`): HTML y JavaScript servidos por su propio contenedor nginx, en otro origen (`:8081`). Inicia sesión en Auth y consulta el historial, el estado y los resultados en Game usando solo las URL de su configuración (`AUTH_API_URL`, `GAME_API_URL`). Ver [su README](../../apps/results-client/README.md).
- **Seed de demostración:** el job `seed` de Compose (`scripts/seed/seed.mjs`) crea un docente, tres estudiantes y el "Quiz de demostración" (6 preguntas, una con imagen). Lo hace **a través de las API públicas**, sin acceso a la base de datos. Es idempotente y se desactiva con `DEMO_SEED=false`.
- **Scripts de inicio:** `scripts/start.sh` / `start.ps1` (con `--build` o `--hub`) y `scripts/stop.sh` / `stop.ps1` (con `--purge`). Solo requieren Git y Docker: `setup.cjs` corre dentro de un contenedor de Node.
- **`setup.cjs`:** si ya existe un `.env`, agrega las claves nuevas sin modificar las existentes.
- **README** reescrito con URL, requisitos, descargas iniciales, configuración, inicio y detención, cuentas de prueba y los pasos para demostrar el juego y el cliente adicional.

## Evidencia

| Comprobación | Resultado |
| --- | --- |
| Historial con PostgreSQL (`pnpm test:game:http`) | El anfitrión ve solo sus partidas; el participante ve su puntaje y puesto (por ejemplo, puesto 3 con 0 puntos); un usuario ajeno recibe `total: 0`; un `role` inválido recibe 400. Game: 106/106 pruebas con base de datos |
| Cliente adicional (`pnpm test:live`, `results-client.spec.ts`) | Muestra las URL configuradas. Una contraseña incorrecta da un error claro. El login real en Auth, la lista "Partidas que organicé" y la clasificación (2 filas) funcionan. Un ID inexistente da "no existe o tu usuario no participó" |
| Historial web | Con redirección al login, muestra "Puesto 1 · 1 punto", el enlace a los resultados guardados y el estado vacío para el anfitrión |
| Seed idempotente | La primera ejecución crea 4 cuentas y el quiz con 6 preguntas e imagen. La segunda (`docker compose run --rm seed`) responde "Found…; nothing to create" |
| Ciclo `stop.sh` → `start.sh` | Se eliminan todos los contenedores (0 activos). Al reiniciar, la web queda saludable, el seed encuentra los datos existentes y el script imprime URL y cuentas. `start.ps1` en PowerShell da el mismo resultado |
| Ensayo de clonado | Una copia solo con los archivos versionables (258, sin `.env`, `secrets` ni `node_modules`) ejecuta `setup` en contenedor y construye las 4 imágenes del equipo |
| Tooling (`tests/tooling.test.cjs`) | 4/4. Incluye la nueva prueba de `setup` que conserva valores y agrega claves faltantes |
| Navegador completo (`pnpm test:live`) | 5/5: partida, salas aisladas y reconexión, permisos, cliente adicional e historial |

## Hallazgos corregidos

- La primera versión del nuevo `setup` generaba un valor distinto para cada aparición de un mismo marcador. Eso rompía la coincidencia entre `AUTH_DB_PASSWORD` y la contraseña dentro de `AUTH_DATABASE_URL`. La prueba de tooling existente lo detectó, y ahora el valor se guarda por clave.
- `docker compose wait` ignora contenedores que ya terminaron, así que el script de inicio mostraba un aviso falso sobre el seed. Ahora lee el código de salida con `docker inspect`.

## Límites

- `--hub` solo funcionará cuando las imágenes estén publicadas (Hito 6). Hasta entonces, la ruta `--no-build` se probó con las imágenes locales.
- El ensayo de clonado validó que el repositorio está completo y que construye. Un inicio totalmente limpio en una segunda máquina queda como tarea del equipo, porque en esta máquina compartiría los volúmenes con nombre del stack en uso.
