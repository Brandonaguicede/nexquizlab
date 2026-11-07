# Cliente de resultados (consumidor independiente)

Una página estática en HTML y JavaScript, sin framework, que demuestra cómo otro proyecto consume NexQuiz **solo por red**. No importa código de las otras aplicaciones, no comparte base de datos y no conoce detalles internos.

| Paso | Contrato usado |
| --- | --- |
| Autenticarse | `POST {AUTH_API_URL}/api/v1/auth/login`, con la cabecera `X-NexQuiz-CSRF: 1`. Devuelve `accessToken` (JWT RS256, 300 s) |
| Partidas terminadas | `GET {GAME_API_URL}/api/v1/sessions?role=host\|participant` |
| Estado de una sesión | `GET {GAME_API_URL}/api/v1/sessions/:id` |
| Resultados guardados | `GET {GAME_API_URL}/api/v1/sessions/:id/results` |

Todas las llamadas a Game usan `Authorization: Bearer <accessToken>`. El token vive solo en memoria.

## Configuración

| Variable | Por defecto |
| --- | --- |
| `AUTH_API_URL` | `http://localhost:8080/auth` |
| `GAME_API_URL` | `http://localhost:8080/game` |

Al iniciar el contenedor, nginx genera `config.js` a partir de esas variables. Si el cliente se sirve desde otro origen, ese origen debe estar en `CORS_ORIGINS` de las dos APIs; Compose agrega `RESULTS_CLIENT_ORIGIN` automáticamente.

```sh
docker build -f apps/results-client/Dockerfile -t nexquiz-results-client .
docker run --rm -p 8081:8080 -e AUTH_API_URL=https://mi-dominio/auth -e GAME_API_URL=https://mi-dominio/game nexquiz-results-client
```
