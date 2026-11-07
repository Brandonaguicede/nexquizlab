# NexQuiz — preparación para producción

Para una VM gratuita Ampere A1, usar la [gu?a de Oracle Cloud](oracle.md): incluye un complemento ARM64 y construcci?n en el servidor sin publicaci?n obligatoria en Docker Hub.

## Pasos para publicar y desplegar (Hito 6)

Todo lo necesario está en el repositorio. Solo faltan las credenciales y el servidor del equipo. Las secciones posteriores conservan el historial y los detalles de los hitos anteriores.

1. **Docker Hub.** Crear la cuenta u organización y los repositorios `nexquiz-auth-api`, `nexquiz-game-api`, `nexquiz-web` y `nexquiz-results-client`. Ejecutar `docker login` en la terminal del propietario, sin escribir la contraseña en el comando.
2. **Release.** Definir `DOCKERHUB_USER`, un `IMAGE_TAG` versionado (por ejemplo `1.0.0`, nunca `latest`) y `DOCKER_PLATFORM` (la del VPS: `linux/amd64` o `linux/arm64`). Luego:
   - ejecutar `node scripts/release.cjs`, que construye las cuatro imágenes e imprime los `docker push`;
   - ejecutar esos `docker push`;
   - anotar los digests.
3. **Comprobar desde Docker Hub en local.** Con esos valores en `.env`, ejecutar `scripts/start.sh --hub`. Debe levantar todo sin construir nada.
4. **VPS.** Necesita Linux con Docker y Compose v2, solo los puertos 22, 80 y 443 abiertos, y un nombre DNS que apunte al servidor (un dominio propio, o `sslip.io` / DuckDNS si no hay dominio). Clonar el repositorio y crear `.env` con `node scripts/setup.cjs` o con el script de inicio. Ajustar:
   - `SITE_ADDRESS=<dominio>`, `CORS_ORIGINS=https://<dominio>` y `JWT_ISSUER=https://<dominio>/auth`;
   - `DOCKERHUB_USER`, `IMAGE_TAG` y `DOCKER_PLATFORM`.

   El Compose de producción ya fija `NODE_ENV=production` y deriva del dominio las URL del cliente adicional.

   Verificar con `node scripts/check-production.cjs`.
5. **Arranque:**
   ```sh
   docker compose -f docker-compose.prod.yml pull
   docker compose -f docker-compose.prod.yml up -d
   ```
   Caddy obtiene el certificado TLS. Las migraciones y el seed corren como jobs. La aplicación queda en `https://<dominio>/`, el cliente adicional en `https://<dominio>/client/` y Grafana por túnel SSH (`ssh -L 3000:localhost:3000`).
6. **Comprobar en el destino:**
   - `BASE_URL=https://<dominio> node scripts/load-test.mjs 10 30 50`. Ajustar `GAME_MAX_PARTICIPANTS` al máximo que pase con latencias aceptables en ese servidor.
   - Ejecutar `node scripts/verify-monitoring.cjs` por el túnel.
   - Jugar una partida desde varios celulares.
   - Registrar la URL en el README y la evidencia en `docs/testing/hito-6.md`.

## Historial

> Actualización Hito 2: la preparación de Scalar, sus pruebas y las imágenes locales ya se validaron con acceso autorizado al Engine. Las restricciones de sandbox y fallos de adquisición que se narran abajo pertenecen al historial de Hito 1.6. Para autenticación, aplicar la migración aditiva de Auth antes de recrear servicios; consultar la [política de sesiones y claves](../security/authentication.md) y las [evidencias actuales](../testing/hito-2.md). No se publicó ni desplegó externamente.

Actualizada en Hito 1.6. Esta guía prepara una publicación; no acredita una cuenta Docker Hub, VPS, dominio, HTTPS real ni despliegue realizados. La validación local del Hito 1.3 y el diagnóstico actual se conservan en [el informe](../testing/hito-1.md). No contiene funcionalidades del Hito 2.

## Git y archivos de entrega

Repositorio local inicializado en main. Versionar fuentes, configuración, migraciones SQL, documentación y el pnpm-lock.yaml real. No versionar .env, archivos .env de producción, secrets/, claves, node_modules, generated/, dist/, logs, dumps, caches ni resultados Playwright. Ejecutar `pnpm audit:repository` antes de preparar cambios y revisar `git diff --cached --stat` y los archivos seleccionados. El auditor muestra rutas/categorías, nunca los valores de secretos.

No hay remoto ni commit creado por este hito. No se modificó configuración global de Git. Autor, remoto y primer commit requieren los datos reales del propietario. Si un secreto estuvo en un commit o se compartió fuera del equipo, retirarlo del historial no basta: revocarlo o rotarlo. Esta auditoría no detectó valores locales secretos en los archivos elegibles; no prueba ausencia de exposiciones fuera del repositorio.

La sesión permitió git init, pero denegó crear .git/index.lock: **los 121 archivos auditados aún no están en staging**. Completar desde una terminal local autorizada, sin forzar permisos ni usar git add -f:

```sh
pnpm audit:repository
git add .
git diff --cached --stat
git diff --cached --check
```

No continuar si falla la auditoría. Revisar el índice antes de crear el commit con la identidad real del propietario; no se prescribe ni sobrescribe una identidad global.

En Hito 1.5 se comprobó que no existe index.lock ni una operación Git activa. Hay reglas Deny explícitas en .git y git add devuelve 128. No borrar locks inexistentes ni cambiar ACLs indiscriminadamente: realizar el staging con la identidad Windows autorizada, fuera de la sesión CodexSandboxOffline. No crear un commit sin autorización.

## Scalar local, sin CDN durante ejecución

Hito 1.6 conserva la integración NestJS 1.0.27 y el browser bundle 1.44.23. Las páginas ahora solicitan /docs/scalar-1.44.23.js a la propia API; los proxies mantienen /auth/docs y /game/docs. La opción cdn de la integración se usa con una URL local. No hay fallback externo. Fuentes remotas y telemetría de Scalar están desactivadas; CSP ya no permite los dominios jsDelivr/fonts.scalar.com.

Antes de ejecutar APIs directamente, preparar los recursos desde una terminal autorizada con Node 24, npm, tar y acceso al registry oficial:

~~~powershell
pnpm.cmd prepare:scalar
pnpm.cmd verify
pnpm.cmd test:docs
~~~

El preparador obtiene metadata y npm pack de @scalar/api-reference@1.44.23 mediante registry.npmjs.org, sin ejecutar scripts de ese paquete. Compara SHA-512 del archivo real con dist.integrity y el resultado de npm pack; valida nombre, versión y licencia MIT. Lee el browser entry declarado por el propio paquete y solo extrae mediante stdout ese bundle y su licencia, sin descomprimir rutas arbitrarias en el workspace. Conserva procedencia y SHA-256 del browser file en manifest.json. No inventa hashes ni contenido.

Los recursos se generan bajo apps/auth-api/public/scalar y apps/game-api/public/scalar, ignorados por Git. Cada API verifica el manifest y SHA-256 antes de servir bytes, con tipo JavaScript y caché inmutable versionada. Si faltan o son inválidos, el endpoint de asset devuelve HTTP 503 y un diagnóstico para ejecutar prepare:scalar. **Compilar TypeScript no demuestra que el artefacto esté instalado.**

Docker excluye los assets del host y ejecuta el mismo preparador por API durante build, conservando licencia y manifest dentro de la imagen. El build necesita registry; el contenedor en ejecución no necesita CDN. CI también prepara el artefacto antes de probarlo. No se añade una dependencia al árbol pnpm ni se modifica/fabrica el lockfile.

En esta sesión prepare:scalar falló con EACCES al conectar al registry. No hay bundle oficial local disponible, así que la integración está implementada pero **el renderizado no está aprobado**: las cuatro pruebas de navegador reciben 503 para el asset. No se copiaron cachés desconocidas ni se simuló JavaScript. Tras obtener el artefacto real, las pruebas de navegador bloquean peticiones externas y exigen renderizar la documentación y operaciones health.

Los resultados se separan bajo test-results/docs y test-results/e2e para no sobrescribir evidencias entre suites. Las pruebas HTTP comprueban rutas y prefijos; dos casos adicionales comprueban bytes verificados cuando existen o la respuesta explícita 503 cuando falta preparación. Esos casos no acreditan renderizado ni descarga exitosa.

## Imágenes y arquitectura

| Aplicación | Imagen publicada prevista | Puerto interno |
| --- | --- | --- |
| Web | ${DOCKERHUB_USER}/nexquiz-web:${IMAGE_TAG} | 8080 |
| Auth API | ${DOCKERHUB_USER}/nexquiz-auth-api:${IMAGE_TAG} | 3001 |
| Game API | ${DOCKERHUB_USER}/nexquiz-game-api:${IMAGE_TAG} | 3002 |

DOCKERHUB_USER debe ser el namespace real del propietario; no se presupone ninguno. IMAGE_TAG debe ser un identificador de release, sin sobrescribir un tag publicado ni usar latest. Por defecto DOCKER_PLATFORM es linux/amd64; configurar linux/arm64 si corresponde al VPS. Verificar la arquitectura del destino antes de construir. El script y los cinco servicios que usan imágenes propias en Compose productivo seleccionan el mismo target. No se certifica ejecución ARM64 mediante un build AMD64.

Los builds usan Node 24.13.0, pnpm 10.28.2 y --frozen-lockfile; las APIs conservan Prisma para los jobs de migración y corren como usuario node. Web usa Nginx unprivileged 1.28.1 y URLs relativas /auth y /game. El build de Vite usa configLoader native, soportado por el Node 24 declarado, sin explorar los directorios padre para empaquetar vite.config.ts. No se añaden secretos como build args.

Las etiquetas de imágenes base están fijadas por versión, no por digest: para una release registrar los digests resultantes y la revisión Git, analizar vulnerabilidades y conservar esos artefactos. Las imágenes API aún contienen herramientas de build; separar imagen de migración y podar runtime es una mejora futura, no una garantía ya implementada.

## Variables y configuración privada

Usar .env.example solo como inventario, nunca como credenciales productivas. En un VPS nuevo generar secretos propios con setup y configurarlos allí; no reutilizar contraseñas o claves de desarrollo. Proteger archivos con permisos/ACL del host. Docker Compose local monta secretos desde archivos: no equivale a un gestor de secretos cifrado.

Configurar en un archivo ignorado como .env.production:

- DOCKERHUB_USER e IMAGE_TAG reales y DOCKER_PLATFORM acorde al VPS.
- SITE_ADDRESS: DNS público del sitio, sin esquema; no una IP o dominio inventados.
- CORS_ORIGINS: origen HTTPS exacto; JWT_ISSUER: identificador HTTPS definitivo y JWT_AUDIENCE=nexquiz-game-api.
- Roles PostgreSQL distintos y contraseñas independientes, aleatorias y URL-safe, de al menos 32 caracteres. Mantener las URLs de conexión coherentes cuando se ejecuten herramientas locales.
- GRAFANA_USER y contraseña fuerte exclusiva. Evitar que el usuario administrador se llame admin en entornos compartidos.
- Claves RSA reales del entorno, con la privada disponible solo para Auth API.

Validar sin mostrar valores:

```sh
node scripts/check-production.cjs --env-file .env.production
docker compose --env-file .env.production -f docker-compose.prod.yml config --quiet
```

El gate verifica forma y presencia, no propiedad de DNS, permisos de Docker Hub, correspondencia criptográfica de claves ni conectividad real. Las pruebas con nexquiz.invalid/nexquiz-validation son fixtures sintéticos, no destinos disponibles.

## Construcción y publicación autorizada

Antes de publicar, verificar fuentes y lockfile en un entorno habilitado:

```sh
pnpm install --frozen-lockfile
pnpm verify
pnpm test:e2e
pnpm prepare:scalar
pnpm test:docs
pnpm audit:repository
node scripts/release.cjs --env-file .env.production
```

release.cjs construye las cuatro imágenes (web, auth-api, game-api, results-client) localmente con plataforma y etiquetas OCI de nombre/versión. **No ejecuta push.** Es posible construir antes de tener DNS; no antes de definir un namespace/tag reales. En esta sesión no se reconstruyeron imágenes de release: no hay namespace configurado y el acceso al daemon está denegado.

Después de confirmar cuenta y autorización, iniciar sesión con `docker login` en la terminal del propietario, sin poner contraseñas en comandos. Exportar DOCKERHUB_USER e IMAGE_TAG con los valores reales del archivo privado (Compose y el script leen el archivo; el shell no lo exporta automáticamente). Entonces los comandos de publicación serían:

```sh
docker push "${DOCKERHUB_USER}/nexquiz-web:${IMAGE_TAG}"
docker push "${DOCKERHUB_USER}/nexquiz-auth-api:${IMAGE_TAG}"
docker push "${DOCKERHUB_USER}/nexquiz-game-api:${IMAGE_TAG}"
docker push "${DOCKERHUB_USER}/nexquiz-results-client:${IMAGE_TAG}"
```

No se ejecutaron estos comandos. Registrar los tres digests y realizar una prueba de pull en el destino autorizado antes de dar por terminada la publicación.

## Secuencia en VPS

Prerequisitos: host Linux con Docker/Compose, arquitectura conocida, DNS configurado, puertos 80/443 disponibles y SSH restringido. No detener otros proyectos para liberar puertos sin revisar el host. Copiar los archivos versionados de Compose/infra y provisionar aparte .env.production y las claves; no copiar .git, node_modules o caches al servidor.

Usar solo docker-compose.prod.yml, no combinar con desarrollo. PostgreSQL, APIs, Collector y Prometheus no publican puertos. Grafana solo está en loopback; acceder por túnel SSH. Caddy administra TLS y sus volúmenes guardan los certificados. reverse_proxy hace el upgrade de WebSocket para el canal en vivo (/game/socket.io); verificar WSS después del despliegue con scripts/load-test.mjs. Revisar HTTPS y las rutas /auth/api/v1/health/ready, /game/api/v1/health/ready y ambas documentaciones después del despliegue.

Con backup previo y credenciales revisadas:

```sh
docker compose --env-file .env.production -f docker-compose.prod.yml pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --wait postgres
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm auth-migrate
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm game-migrate
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --wait
```

Detener la secuencia ante cualquier código distinto de cero. run --rm elimina únicamente el contenedor efímero, no volúmenes. Los jobs definidos como dependencia pueden ejecutar de nuevo migrate deploy al levantar APIs: es idempotente. Antes de migraciones incompatibles, planificar una ventana con APIs detenidas o una estrategia expand/contract; no aplicar cambios de schema a ciegas sobre tráfico activo.

## Persistencia, observabilidad y rollback

Conservar nexquiz-postgres-data, nexquiz-images, nexquiz-prometheus-data, nexquiz-grafana-data y nexquiz-tempo-data. El script de inicialización PostgreSQL solo corre en un volumen nuevo: cambiar .env no rota credenciales en una base existente. No usar down -v.

Seguir [backup y restauración](README.md) y ensayar restore fuera de producción. Definir retención/cifrado y copias fuera del VPS para dumps, imágenes, claves y configuración. El volumen de imágenes está reservado: no existe subida de archivos en Hito 1.

Ejecutar verificadores HTTP y de monitoreo con URLs y credenciales autorizadas del entorno; verificar además el dashboard renderizado y muestras de ambas APIs. El Collector exporta trazas a Tempo (retención 72 h) y métricas a Prometheus (15 días); también sondea la disponibilidad de web, cliente y APIs (httpcheck). Readiness representa el último probe, no un SLA ni una alerta de disponibilidad continua.

Para rollback registrar release anterior y digests antes de actualizar. Volver a imágenes anteriores solo si el schema es compatible. Prisma no revierte automáticamente migraciones ni datos: usar una migración correctiva revisada o recuperación planificada desde backup. No sobrescribir tags ni restaurar sobre la única copia de los datos.

## Bloqueos restantes

Faltan namespace y autorización de publicación, VPS/arquitectura, DNS y credenciales propias, gate productivo con datos reales, build/push/pull de la release, HTTPS real y ensayo operativo en destino. La sesión de Hito 1.6 no tiene acceso al daemon y bloquea la adquisición del paquete oficial Scalar en build/preparación. El código ya no utiliza CDN en ejecución, pero el asset aún no está instalado. No confundir los tests aprobados con una publicación o un despliegue realizado.

## Cierre local previo al Hito 2

El usuario sandbox no puede leer los contextos privados del usuario Windows. Default con configuración aislada y el endpoint explícito dockerDesktopLinuxEngine deniegan acceso: no basta cambiar de endpoint. En Hito 1.3 se usó desktop-linux desde otra sesión. No se obtuvo una prueba nueva desde PowerShell normal ni se afirma que Windows/Docker estén averiados.

Desde una PowerShell local autorizada, verificar primero identidad y contextos; usar desktop-linux solo si existe y apunta al Engine local esperado:

```powershell
whoami
docker context ls
docker context inspect desktop-linux --format '{{ .Endpoints.docker.Host }}'
docker --context desktop-linux version
```

Con acceso confirmado, desde la raíz y sin tocar otros proyectos, reconstruir únicamente el stack NexQuiz. El puerto 55432 corresponde a la validación local registrada; revisar antes su disponibilidad:

```powershell
$env:POSTGRES_PORT = '55432'
docker --context desktop-linux compose --env-file .env -f docker-compose.yml config --quiet
docker --context desktop-linux compose --env-file .env -f docker-compose.yml build
docker --context desktop-linux compose --env-file .env -f docker-compose.yml up -d --wait
node scripts/verify-http.cjs
node scripts/verify-monitoring.cjs
pnpm.cmd prepare:scalar
pnpm.cmd test:docs
```

Detenerse ante un fallo, no cambiar contextos globales ni borrar volúmenes para forzar el resultado. El acceso a PostgreSQL y las migraciones ya se revalidó con SELECT mediante 55432 en Hito 1.5; no se reiniciaron ni modificaron datos.

Antes de comenzar Hito 2, conservar una base versionada con autorización, validar Scalar y confirmar las imágenes actuales reconstruidas. Docker Hub y VPS siguen siendo pasos externos separados; no son necesarios para empezar el desarrollo local del siguiente hito.
