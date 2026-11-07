# Contratos de API e identidad

## Contrato vigente — Hito 2

Registro, login, perfil, refresh, logout, JWKS y verificación independiente de Game están implementados. Consulta las [rutas, errores y política de sesiones](../security/authentication.md) y la referencia OpenAPI/Scalar de cada API. El acceso dura **300 segundos** y el refresh tiene vencimiento absoluto de siete días. Auth usa CORS con credenciales y exige X-NexQuiz-CSRF:1 en mutaciones. Los apartados siguientes describen la base histórica del Hito 1 y sus propuestas, sustituidas por ese contrato.

## Autoría de cuestionarios — Hito 3

Game ofrece autoría real de recursos propios bajo `Authorization: Bearer <JWT>` y el prefijo `/api/v1`. El `ownerId` se obtiene exclusivamente del subject del JWT. OpenAPI y Scalar enumeran DTOs, estados, autenticación, límites, contratos paginados y errores. El listado está acotado a pageSize 1–50, 10 por defecto. Título hasta 160, descripción y enunciado hasta 2000 caracteres, máximo 200 preguntas, imagen multipart hasta 5 MiB.

`GET/POST /quizzes`, `GET/PATCH/DELETE /quizzes/:id`; `POST /quizzes/:id/questions`; `PATCH/DELETE /quizzes/:id/questions/:questionId`; `PATCH /quizzes/:id/questions/reorder` con una permutación completa `questionIds`; `POST/DELETE /quizzes/:id/questions/:questionId/image`; `GET /images/:imageId`. Recursos ajenos, tombstones y ausentes se responden como 404. Entradas inválidas 400, upload mayor a 5 MiB 413 y colisión/orden obsoleto 409. Las eliminaciones son lógicas. Las posiciones comienzan en cero, son únicas y se mantienen contiguas al borrar.

Auth conserva su base y API existentes; Game no conecta ni consulta `nexquiz_auth`. Vea la [política de imágenes privadas](../security/quiz-images.md), [modelo de dominio y snapshots futuros](../architecture/quiz-authoring.md) y el [informe de aceptación](../testing/hito-3.md).

## Historial — Hito 1
## HTTP disponible
| Método | Ruta directa | Resultado |
| --- | --- | --- |
| GET | /api/v1/health/live | 200: proceso activo |
| GET | /api/v1/health/ready | 200: SELECT 1 correcto; 503: base no disponible |
| GET | /openapi.json | Contrato OpenAPI generado por NestJS |
| GET | /docs | Referencia Scalar |

Salud responde {status, service}. Las excepciones HTTP preservan su código; los errores inesperados devuelven 500 sin detalles internos. Las futuras solicitudes usarán DTOs class-validator/class-transformer con whitelist, forbidNonWhitelisted y transform. CORS admite orígenes exactos de CORS_ORIGINS y no activa credenciales. CORS no sustituye autenticación.

En proxy: /auth/api/v1/health/live y /game/api/v1/health/live. El proxy elimina /auth o /game; el contrato OpenAPI usa rutas internas. Scalar carga OpenAPI con una URL absoluta compatible con /docs y /docs/. Los proxies agregan X-Forwarded-Prefix; el documento anuncia /auth o /game cuando se consulta a través del proxy y / cuando se consulta directamente. Solo se aceptan esos prefijos fijos. No se documentan operaciones futuras como si existieran.
Scalar referencia el asset local /docs/scalar-1.44.23.js (con prefijo /auth o /game en proxy), sin CDN ni fuentes remotas durante ejecución. Es necesario ejecutar pnpm prepare:scalar desde un entorno autorizado antes de usar documentación local; Docker prepara el paquete oficial durante build. Si falta el asset verificado, su endpoint devuelve 503; no hay fallback externo. Ver la [preparación de Hito 1.6](../deployment/production.md).

## JWT asimétrico previsto
1. Auth guardará una clave privada RSA de al menos 3072 bits; solo su contenedor la recibe. El script setup genera un par para desarrollo, sin sobrescribir claves existentes.
2. Auth emitirá JWT RS256 con kid, sub UUID, iss HTTPS configurado, aud incluyendo nexquiz-game-api, iat, exp y opcional jti. Propuesta de duración: 15 minutos, por confirmar en el hito de identidad.
3. Game implementará IdentityVerifier con una lista explícita de algoritmos permitidos [RS256]. Validará firma, issuer, audience, exp y nbf si existe, tolerancia de reloj acotada y sub no vacío. Rechazará none, HS256, claves desconocidas y tokens sin claims requeridos.
4. Hito 1 prepara distribución de clave pública por archivo montado. Publicación futura alternativa: JWKS por HTTPS en /.well-known/jwks.json, cache con TTL, refresco limitado por kid desconocido, rotación con superposición y protección contra URLs de claves suministradas por tokens.
5. No compartir clave privada, secretos HMAC ni tablas de usuarios con Game. La verificación criptográfica no sustituye autorización de cada caso de uso. Revocación, refresh, hashing, rate limits y login se decidirán antes de exponer endpoints de identidad.

TokenIssuer y IdentityVerifier son puertos sin implementación en Hito 1. No existe una ruta protegida, emisión de tokens ni validación JWT ejecutable; el esquema bearer de OpenAPI solo prepara la documentación.

## Tiempo real
Implementado en Hito 4: ver [protocolo del canal en vivo](realtime.md). El texto siguiente es la planificación original de Hito 1.

### Planificación original
Socket.IO sobre NestJS; handshake autenticado y DTOs/eventos versionados. Servidor autoritativo. Se definirán antes de implementar: joining, reconexión, orden de eventos, idempotencia, reloj, límites, estados y códigos de error. No se habilitan sockets ni eventos en este hito.


Hito 1.6: pnpm prepare:scalar es un requisito de preparación para la documentación local. El endpoint de asset falla de forma explícita si no dispone del artefacto oficial verificado. HTTP de rutas y renderizado de navegador son comprobaciones diferentes.
