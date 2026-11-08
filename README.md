# NexQuiz — evaluaciones en vivo

NexQuiz es el área de actividades tipo trivia en vivo de ProfeLink (Proyecto Final Parte 2, EIF400). El docente crea cuestionarios de Verdadero o Falso con imágenes, abre una sala con código y la clase juega desde computadoras y celulares. Las preguntas llegan a todos al mismo tiempo, cada acierto vale un punto y al final queda guardada la clasificación.

La solución está formada por servicios independientes que se consumen por red:

| Aplicación | Responsabilidad | Datos |
| --- | --- | --- |
| `apps/web` (React 19) | Interfaz para docentes y participantes | Ninguno |
| `apps/auth-api` (NestJS) | Registro, login, perfil y JWT RS256 con audiencia `nexquiz-game-api` | `nexquiz_auth` |
| `apps/game-api` (NestJS) | Cuestionarios, imágenes, salas, partida en vivo (REST + Socket.IO) y resultados | `nexquiz_game` y volumen de imágenes |
| `apps/results-client` (HTML/JS) | Cliente adicional que consume la API documentada | Ninguno |

Componentes de infraestructura: PostgreSQL 17, nginx como proxy de la web, OpenTelemetry Collector, Prometheus y Grafana.

## URLs

| Servicio | Local | Pública |
| --- | --- | --- |
| Aplicación web | http://localhost:8080 | *Se completa al desplegar (Hito 6)* |
| Unirse a una sala | http://localhost:8080/join | |
| Cliente adicional | http://localhost:8081 | |
| Auth API · Scalar | http://localhost:8080/auth/docs · `/auth/openapi.json` | |
| Game API · Scalar | http://localhost:8080/game/docs · `/game/openapi.json` | |
| Grafana | http://localhost:3000 | |

## Requisitos previos

- **Git** y **Docker** con **Docker Compose v2**: Docker Desktop en Windows o macOS, o Docker Engine con el plugin compose en Linux. No hace falta instalar Node.js para ejecutar la solución.
- Unos 6 GB libres de disco. Puertos locales libres: 8080 (web), 8081 (cliente), 3001, 3002, 3000 y el de PostgreSQL (5432 por defecto).

**Descargas iniciales.** El primer inicio descarga las imágenes `node:24.13.0-bookworm-slim`, `postgres:17.7-bookworm`, `nginxinc/nginx-unprivileged:1.28.1-alpine`, `otel/opentelemetry-collector-contrib:0.145.0`, `prom/prometheus:v3.9.1` y `grafana/grafana:12.3.2`. Con `--build` también descarga las dependencias npm fijadas en `pnpm-lock.yaml`. Con `--hub` descarga las imágenes publicadas `<DOCKERHUB_USER>/nexquiz-{auth-api,game-api,web,results-client}`.

## Inicio y detención

```sh
git clone <url-del-repositorio> nexquiz && cd nexquiz
scripts/start.sh            # Linux, macOS o Git Bash: construye las imágenes desde el código
scripts/start.sh --hub      # usa las imágenes publicadas en Docker Hub
scripts/stop.sh             # detiene y conserva datos e imágenes
scripts/stop.sh --purge     # detiene y BORRA todos los datos
```

En Windows PowerShell: `.\scripts\start.ps1`, `.\scripts\start.ps1 -Hub`, `.\scripts\stop.ps1` y `.\scripts\stop.ps1 -Purge`. Si la política de ejecución lo impide: `powershell -ExecutionPolicy Bypass -File scripts\start.ps1`.

El script de inicio hace lo siguiente:

1. Crea `.env` desde `.env.example`, con contraseñas aleatorias y claves RS256 en `secrets/`. Usa un contenedor de Node. Si `.env` ya existe, nunca lo sobrescribe: solo agrega las claves nuevas que falten.
2. Construye o descarga las imágenes.
3. Levanta Compose. Las migraciones crean el esquema antes de iniciar las APIs, y el job `seed` carga los datos de demostración a través de las API, sin tocar la base de datos.
4. Espera a que la web esté lista e imprime las URL y las cuentas de prueba.

Los perfiles, cuestionarios, imágenes y resultados se guardan en volúmenes con nombre y sobreviven a `stop` y `start`.

### Configuración

Todo se configura con variables en `.env`. La plantilla está en `.env.example` y los secretos nunca se versionan.

| Variable | Uso |
| --- | --- |
| `POSTGRES_PORT`, `WEB_PORT`, `AUTH_PORT`, `GAME_PORT`, `RESULTS_CLIENT_PORT` | Puertos locales. Si alguno está ocupado, cámbialo aquí |
| `CORS_ORIGINS`, `RESULTS_CLIENT_ORIGIN`, `PUBLIC_WEB_URL` | Orígenes permitidos y URL pública que usa el cliente adicional |
| `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_KEY_ID` | Identidad emitida por Auth y verificada por Game |
| `GAME_MAX_PARTICIPANTS` | Máximo de participantes simultáneos por sala. Por defecto 50: probado sin errores con 50, 100 y 150 ([prueba de carga](docs/testing/hito-6.md#capacidad-participantes-simultáneos)) |
| `DEMO_SEED`, `DEMO_EMAIL_DOMAIN`, `DEMO_PASSWORD` | Datos de demostración. `setup` genera la contraseña |
| `DOCKERHUB_USER`, `IMAGE_TAG` | Imágenes para `--hub` y para publicar |
| `GRAFANA_USER`, `GRAFANA_PASSWORD`, contraseñas de la base de datos | Credenciales que genera `setup` |

> Si `5432` pertenece a otro proyecto, como pasa en la máquina de desarrollo del equipo, define `POSTGRES_PORT=55432` en `.env`. No detengas el otro servicio.

## Cuentas de prueba

El seed crea estas cuentas cada vez que el stack inicia (es idempotente). La contraseña es `DEMO_PASSWORD` en `.env`, y el script de inicio la muestra al terminar.

| Rol | Correo | Datos |
| --- | --- | --- |
| Docente | `docente@nexquiz.demo` | "Quiz de demostración": 6 preguntas de ciencias, una con imagen |
| Estudiantes | `estudiante1@nexquiz.demo`, `estudiante2@nexquiz.demo`, `estudiante3@nexquiz.demo` | — |

Cualquier persona puede crear su propia cuenta de **estudiante** en `/register`. El registro público rechaza el rol de profesor; las cuentas de profesor existentes conservan sus permisos.

Para crear un profesor, el operador ejecuta `node scripts/create-teacher.cjs` dentro del contenedor `auth-api`, con las variables `TEACHER_EMAIL`, `TEACHER_NAME` y `TEACHER_PASSWORD` (12–128 caracteres). El comando requiere acceso al servidor y no modifica cuentas existentes. Ejemplo en PowerShell:

```powershell
$env:TEACHER_EMAIL = 'nuevo.profesor@example.com'
$env:TEACHER_NAME = 'Profesor'
$env:TEACHER_PASSWORD = Read-Host 'Contraseña del profesor' -MaskInput
docker compose exec -e TEACHER_EMAIL -e TEACHER_NAME -e TEACHER_PASSWORD auth-api node scripts/create-teacher.cjs
Remove-Item Env:TEACHER_PASSWORD
```

Con `DEMO_SEED=true`, Auth prepara automáticamente el profesor de demostración antes de iniciar la API. Usa `DEMO_EMAIL_DOMAIN` y `DEMO_PASSWORD`, conserva las cuentas existentes y nunca convierte estudiantes en profesores. El seed inicia sesión con ese profesor e inscribe a los estudiantes y crea el cuestionario por las APIs públicas. Con `DEMO_SEED=false` se omiten ambos pasos de demostración; no se necesita crear manualmente el profesor para iniciar desde cero.

## Cómo demostrar el juego

1. **Docente:** inicia sesión como `docente@nexquiz.demo` y entra a **Mis cuestionarios → Quiz de demostración**. En **Jugar en vivo**, elige el tiempo por pregunta y pulsa **Abrir sala**. Aparecen el código y el enlace `/join?code=…`.
2. **Participantes**, desde celulares o computadoras: abren el enlace, o entran a `/join` y escriben el código. Inician sesión con una cuenta de estudiante o crean una, y vuelven automáticamente a la sala. El docente ve llegar sus nombres.
3. **Partida:** el docente pulsa **Iniciar partida**. Todos ven el enunciado, la imagen, la cuenta regresiva y los botones **Verdadero** y **Falso**; cada persona responde una sola vez. Al vencer el tiempo, o con **Cerrar pregunta**, se revela la respuesta correcta y cada participante ve su resultado. **Siguiente pregunta** avanza.
4. **Resultados:** después de la última pregunta se muestra la clasificación, que queda guardada. La pueden consultar el docente y los participantes en **Mis partidas**.
5. **Reconexión:** durante una pregunta, desactiva el Wi-Fi de un celular o recarga la página. Al volver, el participante regresa a la misma sala con su respuesta y su puntaje, sin duplicarse.
6. **Cliente adicional:** abre http://localhost:8081, inicia sesión con la cuenta del docente, pulsa **Partidas que organicé** y elige la partida para ver la clasificación que devuelve la API. El cliente solo conoce las URL configuradas (`AUTH_API_URL` y `GAME_API_URL`).

## Documentación

- **[Especificación](docs/specification.md)**: alcance, reglas, diagramas de arquitectura y de clases, modelo de datos · [guía de defensa](docs/defense.md) · [plan de cierre](docs/roadmap.md)
- Especificaciones OpenSpec vigentes en [`openspec/specs`](openspec/specs) y cambios archivados en [`openspec/changes/archive`](openspec/changes/archive)
- [Arquitectura y decisiones](docs/architecture/README.md) · [modelo de datos](docs/database/README.md)
- [Contratos REST](docs/api/README.md) · [canal en vivo: eventos, autenticación y recuperación](docs/api/realtime.md)
- [Seguridad de autenticación](docs/security/authentication.md) · [imágenes](docs/security/quiz-images.md)
- [Oracle Cloud Always Free](docs/deployment/oracle.md) ? [Despliegue](docs/deployment/README.md) · [Docker Hub y VPS](docs/deployment/production.md)
- [Pruebas y evidencia](docs/testing/README.md): [Hito 6](docs/testing/hito-6.md) (observabilidad, capacidad y producción), [Hito 5](docs/testing/hito-5.md) y [Hito 4](docs/testing/hito-4.md) · [versiones](docs/versions.md)

## Desarrollo

Requiere Node.js 24 y pnpm 10.28.2 (`corepack enable`).

```sh
pnpm install --frozen-lockfile
pnpm prepare:scalar
pnpm verify                     # generate, validate, lint, typecheck, test, build
pnpm dev                        # web en :5173 y APIs en :3001/:3002 (requiere PostgreSQL y node scripts/migrate.cjs)
```

| Comando | Qué prueba |
| --- | --- |
| `pnpm test` | Pruebas unitarias de Auth y Game, tooling, arquitectura y Scalar |
| `pnpm test:game:db` / `pnpm test:game:http` | Persistencia, partida HTTP completa y canal Socket.IO contra PostgreSQL. Requiere `NEXQUIZ_GAME_TEST_DATABASE_URL` hacia una base local desechable y migrada |
| `pnpm test:live` | Navegador: partida con anfitrión y participantes en escritorio y celular, salas aisladas, reconexión, permisos, cliente adicional e historial. Requiere el stack en marcha |
| `pnpm test:e2e`, `test:identity`, `test:quizzes`, `test:docs` | Regresión de base, identidad, cuestionarios y documentación |
| `pnpm architecture` | Límites de capas e imports entre servicios |

## Monitoreo

Grafana (http://localhost:3000) tiene el dashboard **NexQuiz — Services and live games**. Muestra la disponibilidad de cada servicio, la latencia y el tráfico HTTP, las salas por estado, las conexiones en vivo, las respuestas por resultado y los eventos. Las trazas de las dos APIs están en *Explore → NexQuiz Tempo*. `node scripts/verify-monitoring.cjs` lo comprueba de punta a punta. La prueba de carga es `node scripts/load-test.mjs 10 30 50`.

## Integrantes y aportes

| Integrante | Aportes principales | Pull requests |
| --- | --- | --- |
| *(completar)* | | |

Los aportes identificables de cada integrante se ven en el historial de Git y en los PR de cada hito, que incluyen su cambio de OpenSpec archivado (`openspec/changes/archive/`).
