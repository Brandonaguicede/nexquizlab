# NexQuiz — Hito 1: validación integral

## Revalidación previa a Hito 2 — 2026-10-29

Se inspeccionaron las imágenes corregidas de Scalar y se recrearon exclusivamente Auth y Game con ellas. Ambas quedaron healthy. Web requería recreación para que Nginx resolviera las IPs nuevas; tras hacerlo dejaron de responder 502 sus rutas de documentación. Los verificadores HTTP y de monitoreo pasaron. Scalar se renderizó a través del proxy real en escritorio/móvil (4/4), además de las cuatro pruebas originales aisladas. Se mantuvieron PostgreSQL y todos los volúmenes. No hubo publicación ni despliegue externo.

La implementación de identidad y su migración posterior se documentan separadamente en [Hito 2](hito-2.md). Los reportes históricos siguientes conservan su fecha y sus limitaciones originales; ya no representan el bloqueo actual de Scalar/Docker. El simulacro de restauración y los requisitos de publicación externa siguen pendientes por separado.

## Corrección de Scalar — 2026-10-29

Esta sección sustituye el diagnóstico de bloqueo de Scalar del Hito 1.6 inferior; el resto se conserva como historial.

### Causa raíz y solución

El preparador consultaba únicamente `jsdelivr/unpkg`. El paquete oficial `@scalar/api-reference@1.44.23` no declara esos campos: declara `browser=./dist/browser/standalone.js` y la entrada pública `exports["./browser/standalone.js"]` con el mismo destino. `main` y `module` apuntan a `./dist/index.js` (módulo, no script standalone). El tarball contiene realmente `dist/browser/standalone.js`. Se inspeccionaron los archivos instalados de `@scalar/nestjs-api-reference@1.0.27` y `@scalar/core@0.3.41`: la integración NestJS tiene `main=dist/index.cjs`, `module=dist/index.js`, exports import/require y ningún browser; no contiene el renderizador.

`scripts/prepare-scalar.cjs` ahora selecciona la entrada pública standalone y exige coincidencia con browser y con el inventario del tarball. Extrae el bundle oficial sin modificarlo ni compilarlo de nuevo. Conserva la verificación de identidad, licencia MIT e integridad contra npm; además fija el SHA-512 esperado en código. `npm pack` sigue usando `--ignore-scripts`. No se modificaron dependencias ni el lockfile.

Segundo defecto confirmado: ese tarball omite LICENSE como archivo independiente, aunque lo enlaza en README y en el banner del bundle. `scripts/vendor/scalar-LICENSE` conserva el texto MIT oficial de Scalar, idéntico al distribuido con la integración NestJS fijada; `scripts/vendor/README.md` documenta su procedencia. Los dos Dockerfiles copian ese aviso antes de preparar los assets. Los recursos generados siguen fuera de Git y del contexto Docker: cada build los obtiene y verifica nuevamente.

Se conservan N-Layers, funcionalidades, rutas `/auth/docs` y `/game/docs` y CSP. No se agregó CDN, origen permitido, fuentes remotas ni telemetría. No se modificaron ni desactivaron pruebas.

### Evidencia incremental

| Comando | Resultado observado |
| --- | --- |
| `pnpm prepare:scalar` | Exit 0; preparado para auth y game |
| `pnpm test:docs` | Exit 0; 4 passed (9.9s): `/auth/docs`, `/auth/docs/`, `/game/docs`, `/game/docs/` |
| `pnpm verify` | Exit 0; Prisma generate/validate, arquitectura, lint, tipos, herramientas 5/5, Jest Auth 7/7 + Game 7/7, Scalar HTTP 12/12 y tres builds |
| `docker --context desktop-linux version` | Engine 29.7.2, Docker Desktop 4.89.0; motor iniciado tras comprobar pipe inexistente |
| `docker --context desktop-linux compose --env-file .env -f docker-compose.yml config --quiet` | Exit 0 |
| `pnpm audit:repository` | Exit 0; 123 archivos elegibles, secretos y assets generados excluidos |
| `node --check scripts/prepare-scalar.cjs` | Exit 0 |

Las cuatro pruebas Playwright usan los handlers de producción en un servidor aislado con OpenAPI sintético. Comprueban bundle HTTP 200, título y operación visibles, cero errores JavaScript y cero solicitudes externas. No sustituyen una prueba del proxy/stack actualizado.

Artefacto idéntico generado en ambas APIs: **3 552 168 bytes**. SHA-256: `20edb9a7da8eb57c9d8e2836084fac77a8bda3201daf67bfef5c0bc6f64f3d4e`.

Tarball oficial: `https://registry.npmjs.org/@scalar/api-reference/-/api-reference-1.44.23.tgz`. SHA-512 fijado: `sha512-3ZBSMUT5SEr/YUfw/pu/dn12Qo0kpqUtwzM5QXo+t7KJ/wWJW5AVB9Lhdg5+0DXRd33OV78SraC15leNP3FFeg==`. Se puede verificar contra `apps/{auth,game}-api/public/scalar/manifest.json` y recalcular con `Get-FileHash -Algorithm SHA256`.

Versiones conservadas: Scalar browser **1.44.23**, integración NestJS **1.0.27**, pnpm **10.28.2**, Node Docker **24.13.0-bookworm-slim**, Prisma **6.19.0**. Licencia upstream: https://github.com/scalar/scalar/blob/main/LICENSE.

### Resultado final Docker

`docker --context desktop-linux compose --env-file .env -f docker-compose.yml build auth-api game-api` terminó con **exit 0** y `Built` para ambas imágenes. En ambos builds se ejecutó realmente `prepare-scalar.cjs --app auth|game` (sin caché para ese paso), con verificación SHA-512/SHA-256 y conservación de licencia; Prisma generate y TypeScript también terminaron correctamente.

| Imagen local actualizada | ID verificado mediante image inspect |
| --- | --- |
| `nexquiz-auth-api:latest` | `sha256:94db9ec90022a48a17965770fac36721e88558cecb9a39e927e7a857976f849f` |
| `nexquiz-game-api:latest` | `sha256:106f74a24b0ac7f9b69e4ed7daddbd8bba18b3f70b9bdcf1411f18e13e5a1ae7` |

Creación UTC: Auth `2026-10-30T01:43:24.51978876Z`, Game `2026-10-30T01:43:23.663358525Z` (29 de octubre por la noche en Costa Rica).

Además se ejecutaron contenedores efímeros de cada imagen con `--rm -i --network none --read-only --cap-drop ALL --security-opt no-new-privileges --entrypoint node`, sin puertos ni volúmenes montados. Se leyó el manifest, se recalculó SHA-256, se verificó LICENSE y se invocó `dist/presentation/scalar.js` con una respuesta capturada que exige bytes exactos y estado 200. Ambos terminaron con exit 0, usuario UID 1000, 3 552 168 bytes, el SHA-256 anterior y `handlerStatus: 200`. El script temporal de comprobación está en `.cache/check-scalar-image.cjs` (ignorado); sus comprobaciones corresponden al artefacto real, sin iniciar NestJS ni conectar bases de datos.

**Bloqueo de preparación/build de Scalar resuelto**, con cuatro pruebas de renderizado aprobadas e imágenes nuevas verificadas. Esto no declara completados otros pendientes del Hito 1. No se recrearon contenedores del stack existente; pueden seguir ejecutando las imágenes anteriores. La prueba de documentación es aislada y no acredita un despliegue actualizado del proxy.

Para reproducir desde la raíz, con registry npm y Docker Desktop accesibles, detenerse ante cualquier fallo:

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd prepare:scalar
pnpm.cmd test:docs
pnpm.cmd verify
docker --context desktop-linux compose --env-file .env -f docker-compose.yml build auth-api game-api
Get-FileHash apps/auth-api/public/scalar/scalar-1.44.23.js -Algorithm SHA256
Get-FileHash apps/game-api/public/scalar/scalar-1.44.23.js -Algorithm SHA256
```

No se ejecutó `compose down`, borrado de volúmenes, migración ni publicación. Un build actualiza las imágenes locales, pero por sí solo no reemplaza los contenedores que ya estén ejecutándose.

---

## Validación vigente — Hito 1.6

Ejecución: 2026-10-28. Sin commits, remotos, publicaciones, despliegues ni eliminación de datos. Se conserva N-Layers y la independencia de las APIs. **Hito 1.6 no cerrado**: la integración local de Scalar está implementada, pero la adquisición de su artefacto oficial y la reconstrucción Docker están bloqueadas por el entorno.

### Entorno: hechos comprobados

Directorio correcto del proyecto. Usuario efectivo CodexSandboxOffline y CODEX_SANDBOX_NETWORK_DISABLED=1. No hay DOCKER_HOST, DOCKER_CONTEXT, DOCKER_CONFIG, GIT_DIR, GIT_INDEX_FILE ni proxies configurados en la sesión. El registry responde EACCES al intento de npm ping, sin desactivar TLS ni intentar otra vía de red.

.git contiene reglas Deny explícitas para escritura. main existe como rama sin primer commit; git fsck --full no detecta corrupción y su aviso de ausencia de referencias es normal para este estado. No existe index.lock ni índice preparado. Los secretos y artefactos permanecen ignorados. No se cambian ACLs, usuarios, configuración global ni índices alternativos para eludir la restricción. pnpm-lock.yaml real permanece elegible, todavía sin versionar por falta de staging.

Docker Desktop tiene procesos activos, pero la sesión no puede leer los contextos privados del usuario Windows y recibe acceso denegado al endpoint dockerDesktopLinuxEngine. Esto es compatible con los permisos del sandbox; no prueba avería del daemon ni comportamiento actual de una terminal normal. El Hito 1.3 se ejecutó desde otra sesión autorizada con desktop-linux. No se cambió el contexto personal ni se ejecutó build/up/down sin permiso de acceso al motor.

### Cambio principal: Scalar local

Se conserva @scalar/nestjs-api-reference 1.0.27 y la versión oficial de browser 1.44.23. Se añadió scripts/prepare-scalar.cjs y pnpm prepare:scalar. El preparador solicita metadata y npm pack al registry oficial HTTPS, con scripts del paquete desactivados, y comprueba identidad/versión/licencia y SHA-512 del tarball contra dist.integrity y npm pack. El browser entry se obtiene de la declaración jsdelivr/unpkg del propio paquete y se valida contra el inventario; solo se leen entradas concretas mediante tar stdout. Se conserva LICENSE y manifest de procedencia/SHA-256 del bundle real.

Los assets generados se guardan en public/scalar de cada API, fuera de Git. Docker los excluye del contexto del host y los prepara en su build con el mismo comando --app auth/game. CI también ejecuta la preparación. No se añadió una dependencia pnpm ni se fabricó un lockfile. tar está disponible en Windows y se declara en la imagen de build.

Presentation sirve /docs/scalar-1.44.23.js bajo cada servicio; el HTML añade /auth o /game según el proxy. Se mantienen OpenAPI y /docs con o sin barra final. Se verifica manifest/versión/SHA-256 antes de servir, y se devuelve 503 explícito si el asset falta o no es válido. No hay fallback CDN. Se desactivan fuentes remotas/telemetría de Scalar y se retiran los orígenes CDN de CSP; no se amplían políticas.

**La adquisición oficial no pudo completarse:** node scripts/prepare-scalar.cjs terminó con exit 1 por EACCES en npm. No se creó un bundle, manifest ni hash sustituto. El camino de descarga/extracción exitoso y el renderizado del recurso oficial NO están validados en esta sesión.

Las cuatro pruebas de navegador usan ahora el endpoint local real y bloquean peticiones externas. Fallan al exigir HTTP 200 al recurso, que devuelve 503 por ausencia del artefacto. No se oculta el fallo ni se simula JavaScript. Esta distinción es importante: ya no se intenta cargar un CDN en ejecución, pero todavía falta preparar el paquete oficial para que la documentación nueva funcione. El stack existente no fue reconstruido y puede seguir usando la implementación anterior.

### Evidencias ejecutadas

| Comprobación | Resultado |
| --- | --- |
| pnpm verify | Exit 0: generate/validate, N-Layers, lint, tipos, pruebas y tres builds |
| Jest | Auth 7/7 y Game 7/7 |
| Herramientas Node | 5/5 |
| Pruebas HTTP Scalar | 12/12; diez rutas/prefijos y dos casos de asset verificado o 503 explícito. Aquí se probó ausencia, no bytes oficiales servidos |
| Playwright existente | 4/4 escritorio/móvil |
| Playwright Scalar | 4 fallidas: asset local HTTP 503, esperado 200. Reejecutadas tras separar las carpetas de evidencias |
| prepare:scalar | Exit 1, adquisición oficial bloqueada con EACCES |
| Compose config --quiet | Exit 0 desarrollo y producción; namespace sintético solo para interpolación |
| Verificador HTTP | Exit 0 contra ambas APIs del stack existente, no acredita imágenes nuevas |
| Verificador de métricas | Exit 0, muestras reales de ambas APIs mediante Grafana; no inspección visual nueva |
| PostgreSQL 55432 | Ambas bases correctas, inicial aplicada/completada/no revertida, checksum SHA-256 coincidente con SQL local |
| Aislamiento | Ambas conexiones cruzadas explícitamente rechazadas por privilegio CONNECT |
| Auditoría de seguridad | Exit 0, 121 archivos elegibles; .env, claves, builds y assets generados ignorados |
| Docker rebuild/up | No ejecutados: acceso al Engine denegado |
| Git staging | Bloqueado por reglas de escritura; cero staged, sin commits ni remotos |

Las consultas a PostgreSQL fueron SELECT y usaron en memoria las credenciales propias de cada servicio con el puerto host 55432. No se aplicaron migraciones ni cambiaron datos. Se conservó la evidencia de persistencia tras reinicio del Hito 1.3, sin inventar una repetición.

Se separaron test-results/docs y test-results/e2e para evitar que una suite borre las trazas de la otra. Los resultados y assets generados no se versionan. Los cambios funcionales se limitaron a transporte de documentación, preparación/build de sus recursos y CSP; Domain/Application no se modificaron.

### Comandos exactos fuera del sandbox

Desde PowerShell con identidad Windows autorizada, acceso al registry y al Engine. No basta que Docker Desktop esté abierto. No borrar locks o cambiar ACLs indiscriminadamente:

```powershell
cd "C:\Users\aguir\Documents\Paradigmas\proyectofinal"
whoami
npm.cmd ping --registry=https://registry.npmjs.org/
tar --version
pnpm.cmd install --frozen-lockfile
pnpm.cmd prepare:scalar
pnpm.cmd verify
pnpm.cmd test:e2e
pnpm.cmd test:docs
pnpm.cmd audit:repository
git status
git add .
git diff --cached --stat
git diff --cached --check
```

Detenerse al primer fallo; no se incluye commit ni remoto. Comprobar que desktop-linux existe y apunta al motor local esperado antes de usarlo. Preservar los otros proyectos en 5432 y 5173:

```powershell
docker context ls
docker context inspect desktop-linux --format '{{ .Endpoints.docker.Host }}'
docker --context desktop-linux version
$env:POSTGRES_PORT = '55432'
docker --context desktop-linux compose --env-file .env -f docker-compose.yml config --quiet
docker --context desktop-linux compose --env-file .env -f docker-compose.yml build
docker --context desktop-linux compose --env-file .env -f docker-compose.yml up -d --wait
docker --context desktop-linux compose --env-file .env -f docker-compose.yml ps -a
node scripts/verify-http.cjs
node scripts/verify-monitoring.cjs
$env:AUTH_HTTP_URL = 'http://localhost:8080/auth'
$env:GAME_HTTP_URL = 'http://localhost:8080/game'
node scripts/verify-http.cjs
Remove-Item Env:AUTH_HTTP_URL,Env:GAME_HTTP_URL -ErrorAction SilentlyContinue
```

El build descarga el artefacto oficial durante preparación, nunca desde el navegador. Validar en el navegador /auth/docs y /game/docs del stack recién reconstruido, comprobar asset 200, CSP y ausencia de solicitudes externas. El puerto 55432 corresponde a NexQuiz según las consultas actuales; no liberar puertos deteniendo otros proyectos. Para pruebas Vite no reutilizar servidores ajenos: comprobar que 127.0.0.1:5173 corresponde a NexQuiz o elegir otro puerto/configuración de pruebas.

### Estado de cierre

- **Validado:** código, N-Layers, builds, Jest/herramientas, HTTP de rutas Scalar, cuatro E2E existentes, PostgreSQL/migraciones/aislamiento, Compose estático, HTTP y métricas del stack existente.
- **Pendiente:** adquirir y verificar el bundle oficial, aprobar las cuatro pruebas de renderizado local y el navegador sobre proxies reales, reconstruir/verificar imágenes actuales.
- **Bloqueado por permisos:** registry en preparación, staging Git y acceso al daemon desde esta identidad. No se intentó eludir controles.
- **Pendiente de despliegue externo:** fuera de alcance y no realizado. Sin GitHub, Docker Hub, VPS, commits o remotos.

No avanzar automáticamente al Hito 2. Primero completar la preparación oficial y validación de la documentación y cerrar el checkpoint local autorizado. Tener un VPS no es requisito para desarrollar el siguiente hito; no debe confundirse con estabilización local.

---

## Histórico — Hito 1.5

Ejecución: 2026-10-28. Se diagnosticaron los bloqueos y se repitieron las validaciones finales solicitadas. No se reconstruyó el proyecto ni se modificaron APIs, dependencias, reglas de negocio o configuración global. No se crearon commits, no se publicaron imágenes y no se eliminaron datos o volúmenes.

### Git: causa comprobada, no bloqueo residual

`git status` muestra archivos sin seguimiento; main es la rama actual. No existe .git/index ni .git/index.lock y no se observaron procesos Git activos. Get-Acl de .git muestra reglas Deny explícitas que incluyen Write/Delete, además de permisos heredados. `git add .`, ejecutado después de pasar la auditoría, falla con exit 128 al intentar crear index.lock: Permission denied.

No hay archivo residual que retirar. Eliminar locks, recrear .git o forzar un índice alternativo no corrige el permiso y podría eludir la protección de la sesión. No se aplicó ninguna de esas operaciones. No se modificaron ACLs ni identidad Git.

La auditoría mantiene 120 archivos elegibles sin secretos detectados, incluido pnpm-lock.yaml real. .env, claves, node_modules, builds y resultados siguen ignorados. El lockfile **todavía no está versionado**: cero archivos staged y cero commits. La ausencia de secretos detectados no prueba que nunca se hayan compartido fuera de Git.

### Docker: diferencia entre la sesión y Hito 1.3

La identidad efectiva es CodexSandboxOffline, distinta de la sesión externa con la que se registró Hito 1.3. Se observaron nueve procesos Docker/Desktop. La sesión no puede leer el config.json ni el inventario de contextos privados del usuario Windows. El contexto visible con configuración aislada es default; el informe aprobado de Hito 1.3 registra desktop-linux.

Se probaron los endpoints locales docker_engine y dockerDesktopLinuxEngine: ambos terminan con acceso denegado y sin información del servidor. Por tanto, no se trata únicamente de seleccionar otro endpoint. Esto prueba una limitación de acceso de esta sesión; no demuestra que el Engine esté detenido o averiado ni cómo respondería hoy una PowerShell normal.

No se cambiaron contextos personales, permisos o grupos del sistema. No se ejecutaron build/up/restart/down sin acceso al daemon, ni se detuvieron proyectos ajenos. Los contenedores existentes responden a los verificadores HTTP y de monitoreo, pero no se afirma que incorporen las fuentes de Hito 1.4 sin reconstruirlos.

### PostgreSQL y migraciones: comprobación actual sin daemon

Se usó el puerto host 55432 documentado en Hito 1.3, las credenciales propias de cada servicio en memoria y consultas exclusivamente SELECT. Se comprobó current_database() en nexquiz_auth y nexquiz_game. En ambas, 20261028000000_initial tiene finished_at, no está revertida y su checksum coincide con SHA-256 del SQL versionado local.

También se intentó SELECT 1 contra la base opuesta con cada rol: ambas conexiones fueron rechazadas explícitamente por falta de privilegio CONNECT. El primer script diagnóstico clasificó esas excepciones como inconclusas al buscar solo error.code; la inspección dirigida confirmó PrismaClientInitializationError con denegación explícita. No se inventa un código P1010 ni se modifica el esquema para acomodar el diagnóstico.

No se aplicaron migraciones, insertaron marcadores, cambiaron contraseñas o reiniciaron bases. La persistencia tras reinicio conserva su evidencia del Hito 1.3; no se declara reejecutada aquí.

### Resultados finales de Hito 1.5

| Comprobación | Resultado actual |
| --- | --- |
| pnpm verify | Exit 0: Prisma generate/validate, arquitectura, lint, tipos, pruebas y tres builds |
| Jest | Auth 7/7, Game 7/7 |
| Pruebas Node de herramientas | 5/5 |
| HTTP de handlers Scalar | 10/10 |
| pnpm test:e2e | 4/4: escritorio y móvil |
| pnpm test:docs | 4 fallidos: net::ERR_NETWORK_ACCESS_DENIED al descargar el bundle fijado |
| Compose config --quiet | Exit 0 en desarrollo y producción; namespace sintético solo para validar interpolación |
| verify-http.cjs | Exit 0, ambas APIs del stack existente |
| verify-monitoring.cjs | Exit 0, muestras reales de ambas APIs mediante Grafana; no sustituye inspección visual |
| Conexión y migraciones PostgreSQL | Ambas bases correctas; migración inicial completada y checksum coincidente |
| Aislamiento de bases | Denegación explícita CONNECT en ambos sentidos |
| audit-repository.cjs | Exit 0, 120 candidatos; secretos y artefactos excluidos |
| Instalación offline congelada lockfile-only | Exit 0; lockfile real consistente sin recrear node_modules |
| npm ping con caché dentro del workspace | EACCES al conectar al registry; no se desactiva SSL |
| Gate productivo con .env actual | Rechazo esperado: namespace, dominio, CORS HTTPS e issuer definitivos ausentes |
| Git staging | Exit 128 por permiso para crear index.lock; no residual que eliminar |
| Docker default y Linux Engine | Acceso denegado; sin reconstrucción de imágenes |

### Scalar: alternativa evaluada

La versión permanece fijada a 1.44.23 y los handlers HTTP conservan sus rutas. No se simuló el JavaScript para aprobar el navegador. Se comprobó que node_modules no contiene @scalar/api-reference ni un bundle standalone instalado: la integración actual solo incluye el renderizador HTML y sus dependencias de tipos/helpers.

La alternativa recomendada para un entorno sin CDN es servir localmente el standalone exacto del paquete oficial 1.44.23, junto con su licencia, procedencia y checksum verificados. Se limitaría a assets de documentación/Presentation y al empaquetado Docker, sin cambios en Domain/Application. Debe obtenerse en un entorno autorizado, verificar el artefacto real y su integridad, resolver/versionar cualquier cambio de dependencias y repetir HTTP/navegador/proxies. No debe copiarse un bundle de caché sin versión conocida ni inventarse el archivo o su hash.

No se implementó esa alternativa sin disponer del artefacto verificable y conectividad. El CDN sigue siendo un bloqueo de renderizado pendiente, no un resultado aprobado.

### Corrección segura y pasos de cierre

No se cambió código funcional porque los fallos restantes son de acceso. Desde PowerShell local con la identidad Windows autorizada, no dentro del usuario sandbox:

```powershell
cd "C:\Users\aguir\Documents\Paradigmas\proyectofinal"
whoami
git status
Get-Process -Name git -ErrorAction SilentlyContinue
Test-Path .git/index.lock
pnpm.cmd audit:repository
git add .
git diff --cached --stat
git diff --cached --check
docker context ls
docker version
docker info
```

Detenerse si falla la auditoría. No retirar locks existentes sin identificar su origen y descartar una operación activa. No aplicar permisos amplios sobre .git ni cambiar contextos remotos a ciegas. No se incluye git commit porque no está autorizado.

Una vez comprobado acceso al Engine local y el puerto host 55432 para NexQuiz, ejecutar las instrucciones de build/up/verificadores de [producción](../deployment/production.md) y las del entorno local, sin borrar volúmenes ni detener otros proyectos. La publicación Docker Hub/VPS sigue separada y no autorizada.

### Recomendación para Hito 2

La arquitectura y el código base continúan aprobados. Recomiendo cerrar primero staging y respaldo versionado con autorización del propietario, aprobar el renderizado del bundle fijado o la alternativa local y reconstruir/verificar las imágenes actuales desde una sesión autorizada. No iniciar todavía implementación de autenticación o juego en este workspace sin esa base estabilizada. Publicar en un VPS no es un requisito para empezar desarrollo del Hito 2; sí debe mantenerse como pendiente externo explícito.

**Hito 1.5 no cerrado:** Git sin staging, nuevas imágenes sin reconstruir y renderizado Scalar bloqueado. La causa de acceso está identificada; no es una nueva falla estructural del proyecto.

---

## Histórico — Hito 1.4

Ejecución: 2026-10-28. Se conserva la validación local aprobada del Hito 1.3. Este hito prepara control de versiones y release; **no publica imágenes ni despliega a un VPS**. No implementa Hito 2, no elimina volúmenes y no detiene otros proyectos.

### Git y auditoría

- No había repositorio: `git init -b main` terminó correctamente. Rama main, sin remoto ni commit creados; no se modificó identidad o configuración global.
- Se reforzó .gitignore para claves y contenedores de claves, dumps, logs, archivos temporales, caches y artefactos compilados. .env.example permanece con placeholders; pnpm-lock.yaml real es elegible y se prepara para versionar.
- El auditor inventaría exclusivamente archivos versionables y busca coincidencias exactas con secretos locales, claves privadas, tokens comunes, credenciales literales y URLs con credenciales. Solo muestra ruta/categoría. La auditoría no detectó exposición entre los candidatos; los secretos locales existentes se preservan ignorados.
- No se afirma ausencia de exposiciones fuera de este repositorio. Si una credencial se compartió anteriormente, debe rotarse. Un patrón de búsqueda no reemplaza revisión manual.
- Fuentes, manifests, lockfile, migraciones, infraestructura, pruebas y documentación: 120 archivos auditados elegibles. El intento de staging falló al crear .git/index.lock (Permission denied). No hay archivos staged ni primer commit. No se forzaron permisos ni se utilizó un índice alternativo para eludir la restricción.

### Scalar y compatibilidad

Se mantiene la integración instalada 1.0.27. Presentation fija explícitamente el bundle a `https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.44.23`; no se cambia el árbol de dependencias. La opción cdn está soportada por el código instalado y la documentación oficial. Se conserva OpenAPI directo y con los prefijos fijos /auth y /game, con y sin barra final.

Se eligió un CDN con versión exacta para evitar una dependencia nueva o copiar un bundle sin procedencia. **No equivale a self-hosting ni funcionamiento offline.** El navegador todavía necesita acceso a jsDelivr.

El primer intento de probar Scalar dentro de Jest falló porque su VM CommonJS no cargaba el core ESM. Se trasladó la comprobación HTTP a Node 24/ts-node con el handler real: diez escenarios aprobados. No se modificó ni simuló el código de la librería. Las 14 pruebas Jest existentes permanecen aprobadas.

Se añadieron cuatro Playwright específicos que usan handlers reales y un contrato sintético en un servidor aislado. Los cuatro intentos iniciales fallaron por no renderizarse el bundle. Un reintento con diagnóstico de descarga confirmó `net::ERR_NETWORK_ACCESS_DENIED`. No se sustituyó el JavaScript por un mock y **no se aprueba el renderizado de la versión fijada**. Las trazas quedan en test-results/, ignorado por Git. Estos tests no prueban el proxy Caddy/Nginx desplegado.

### Evidencia actual

| Comprobación | Resultado |
| --- | --- |
| pnpm --version | 10.28.2 disponible desde Corepack normal |
| pnpm install --offline --frozen-lockfile --lockfile-only | Exit 0; manifests/lockfile consistentes, sin sustituir dependencias |
| Instalación offline completa | Abortó al solicitar recrear node_modules sin TTY. No se forzó eliminación ni se cambió el store existente |
| pnpm verify final | Exit 0: generate, validate, lint, typecheck, test y los tres builds |
| Herramientas Node | 5/5; incluye gate productivo con fixture aislado y rechazo de plataforma/namespace/tag inválidos |
| Jest | Auth 7/7 y Game 7/7 |
| pnpm test:scalar | 10/10 HTTP: rutas directas/proxy, barra final y prefijo arbitrario |
| pnpm test:e2e | 4/4, escritorio y móvil |
| pnpm test:docs | 4 fallidos; descarga CDN bloqueada. Reintento dirigido confirma ERR_NETWORK_ACCESS_DENIED |
| node scripts/verify-http.cjs | Exit 0, ambas APIs del stack existente |
| node scripts/verify-monitoring.cjs | Exit 0, muestras reales del stack existente mediante Grafana |
| Compose desarrollo y producción config --quiet | Exit 0; namespace sintético solo para interpolación |
| Modelo Compose productivo | Plataformas linux/amd64 y linux/arm64 correctas en los cinco servicios propios; APIs/DB/Collector/Prometheus sin puertos públicos; Game sin clave privada |
| Gate productivo con fixtures | Acepta estructura válida y rechaza targets inválidos; no valida DNS, cuenta ni despliegue reales |
| Gate productivo con .env actual | Rechazo esperado: faltan namespace, dominio, CORS HTTPS e issuer definitivos |
| Release preflight | Rechazo esperado por namespace ausente; no ejecuta build ni push |
| Acceso Docker desde esta sesión | Cliente 29.7.2; permission denied al daemon |
| Auditoría final de candidatos Git | Exit 0, 120 archivos elegibles, sin secretos detectados |
| git add de inventario auditado | Fallido: .git/index.lock Permission denied; staging pendiente |

Los verificadores del stack existente no acreditan que los contenedores estén ejecutando las fuentes nuevas: no se reconstruyeron imágenes aquí. El Hito 1.3 conserva su evidencia de build/arranque/persistencia; no se inventa una repetición de esos pasos.

### Problemas corregidos durante Hito 1.4

- El README y el inventario de versiones aún describían el bloqueo anterior y Scalar 1.0.25: se sincronizaron con Hito 1.3 y el estado actual.
- El shim Playwright no resolvía mediante pnpm exec en esta sesión. Los scripts ahora invocan la CLI Node instalada, sin cambiar versión ni reinstalar paquetes; cuatro E2E pasan.
- El build web inicial falló porque esbuild intentaba leer directorios padre denegados. Vite compiló con configLoader native y se adoptó ese cargador, compatible con el Node 24 obligatorio. pnpm verify final pasa sin ampliar permisos.
- Release leía solo variables exportadas y no fijaba arquitectura: ahora admite archivo de entorno separado, selecciona linux/amd64 o linux/arm64 y añade etiquetas OCI. No incluye push.

### Release y VPS pendientes

Ver [production.md](../deployment/production.md) para configuración, build/push autorizados, migraciones síncronas, DNS/TLS, persistencia, observabilidad y rollback. DOCKER_PLATFORM usa linux/amd64 por defecto; debe corresponder al VPS real. Ninguna plataforma se declara probada mediante contenedores reconstruidos en esta sesión.

Faltan staging/commit desde una terminal autorizada, cuenta/namespace y autorización de publicación, VPS/CPU, DNS e issuer/CORS definitivos, credenciales del entorno, build/push/pull de las imágenes actuales, TLS real y verificación operativa del destino. También falta aprobar el renderizado del bundle fijado en un navegador con acceso al CDN. No se declara Hito 1.4 cerrado, preparación productiva integral ni despliegue externo completados.

---

## Histórico — Hito 1.3

Ejecución: 2026-10-28, desde Claude Code con acceso al registry y a Docker Desktop. **Validación técnica local del Hito 1 completada.** Publicación externa (Docker Hub, VPS, HTTPS real) sigue pendiente y no se realizó. No se eliminaron volúmenes ni datos. No se implementó Hito 2.

### Entorno

- Node 24.19.0, npm 11.17.0, pnpm 10.28.2 vía Corepack (versión declarada, sin cambios).
- `npm ping`: PONG. Docker Desktop 4.89.0, Engine 29.7.2, contexto `desktop-linux`, Compose v5.5.0.
- Puerto 5432 ocupado por `saic-postgres` (otro proyecto) y 5173 por un Vite ajeno en `::1`. No se detuvieron. Compose se ejecutó con `POSTGRES_PORT=55432` como variable de shell (sin editar `.env`) y Playwright reutilizó un Vite de NexQuiz arrancado con `--host 127.0.0.1 --port 5173 --strictPort`.

### Correcciones necesarias para validar

| Hallazgo | Corrección |
| --- | --- |
| `@scalar/nestjs-api-reference@1.0.25` no existe en el registry (1.0.25 y 1.0.26 no publicadas); `pnpm install` fallaba | Fijado a 1.0.27, siguiente patch del mismo minor, en Auth y Game |
| En 1.0.27 `apiReference()` devuelve un handler `(req, res)`; TS2554 al pasar `next` | Llamada con dos argumentos; eliminado `NextFunction` sin uso |
| `apps/web/src/services/http.ts`: `//$/` se interpretaba como comentario (TS1135) | Regex corregida a `/\/$/` |
| E2E: `getByRole('link', { name: 'Arquitectura' })` coincidía con el nav y con "Conocer la arquitectura" | Selector con `exact: true` |
| Proxy nginx añadía su CSP estricta a `/auth/*` y `/game/*`; sumada a la de helmet, Scalar quedaba en blanco en :8080 | `map` en `infra/proxy/web.conf`: sin CSP de nginx en rutas de API (rige la de cada API) |
| CSP de la web bloqueaba un subset woff2 inline (`data:`) que genera Vite | `font-src 'self' data:` |

Producción usa Caddy, que no añade CSP en `/auth` y `/game`; el problema de Scalar solo afectaba al proxy de desarrollo. La corrección de `font-src` aplica a ambos.

### Evidencia

| Comprobación | Resultado |
| --- | --- |
| `pnpm install` | Exit 0, 711 paquetes; `pnpm-lock.yaml` real generado |
| `pnpm install --frozen-lockfile` | Exit 0, lockfile consistente |
| `pnpm verify` (generate, db:validate, lint, typecheck, test, build) | Exit 0 |
| Pruebas locales de herramientas | 4/4 |
| Jest/Supertest | Auth 7/7, Game 7/7 |
| Playwright (desktop + mobile) | 4/4 |
| `docker compose build` | 5 imágenes con `--frozen-lockfile` |
| `docker compose up -d` | postgres, auth-api, game-api y web healthy; migraciones exit 0 |
| `prisma migrate deploy` | `20261028000000_initial` aplicada en nexquiz_auth y nexquiz_game; en el segundo arranque, "No pending migrations" |
| `sh scripts/verify-isolation.sh` | Exit 0. Rechazo cruzado por `User does not have CONNECT privilege` en ambas direcciones |
| Tablas por base | nexquiz_auth: `_prisma_migrations, User`; nexquiz_game: `_prisma_migrations, ServiceMetadata` |
| Persistencia | Filas marcadoras insertadas, `docker compose down` (sin `-v`) y `up`; las filas siguen con su timestamp original y los 4 volúmenes se conservan |
| `node scripts/verify-http.cjs` directo y vía :8080 | Exit 0, ambas APIs |
| `node scripts/verify-monitoring.cjs` | Exit 0: muestras HTTP y readiness reales de ambas APIs |
| Navegador headless: React `/system` | Auth y Game "Disponible", sin errores de consola |
| Navegador: `/auth/docs` y `/game/docs` vía :8080 | Scalar renderizado: servidor `/auth` o `/game`, operaciones health, sin errores de consola |
| Navegador: dashboard Grafana `nexquiz-overview` | Scrape = 1, readiness = 1 por API, p95 y req/s con series reales de ambas APIs |
| `node scripts/check-production.cjs` | Rechazo esperado: faltan DOCKERHUB_USER, SITE_ADDRESS, CORS_ORIGINS y JWT_ISSUER definitivos (el lockfile ya no falta) |

Filas marcadoras conservadas como evidencia: en nexquiz_auth, `User` con email `hito1-persistencia@nexquiz.invalid`; en nexquiz_game, `ServiceMetadata` con clave `hito1-persistence-check`.

### Pendiente (fuera de la validación local)

- Versionar `pnpm-lock.yaml` (el proyecto aún no es un repositorio git).
- Datos productivos reales y `check-production.cjs` aprobado; publicación Docker Hub; despliegue VPS; TLS/HTTPS real con dominio.
- Scalar carga su bundle desde cdn.jsdelivr.net sin versión fijada; la documentación depende de la conectividad del navegador.
- Tras recrear contenedores, el panel de readiness de Grafana muestra también la serie del contenedor anterior dentro de la ventana de tiempo; es lo esperado para un gauge de "última medición".

---

## Histórico — Hito 1.2

Reejecución: 2026-10-28. **Hito 1 NO técnicamente validado. Publicación externa: pendiente, no realizada.** Esta sección sustituye los estados actuales del informe histórico del Hito 1.1 conservado más abajo.

No se modificó código de aplicaciones, dependencias, versiones ni lógica de negocio durante Hito 1.2. No se generó un lockfile ficticio, no se publicaron imágenes y no se eliminaron volúmenes.

### Entorno y cambios observados

- Node v24.19.0 y npm 11.17.0 disponibles. El proyecto sigue declarando pnpm 10.28.2.
- DNS resuelve el registry. HTTPS a registry.npmjs.org volvió a fallar con EACCES antes de negociar TLS.
- `pnpm.cmd install --fetch-retries=0 --network-timeout=10000`, con COREPACK_HOME dentro del workspace, terminó con código 1 al descargar pnpm 10.28.2. No llegó a resolver dependencias.
- pnpm-lock.yaml y node_modules/.modules.yaml continúan ausentes. No puede verificarse el árbol resuelto ni su reproducibilidad.
- **Docker Desktop ahora tiene procesos activos**, incluidos com.docker.backend y Docker Desktop. El diagnóstico anterior de Desktop detenido ya no describe esta ejecución.
- `docker --config .cache/docker version` muestra cliente 29.7.2 y termina con código 1: permission denied al acceder a npipe:////./pipe/docker_engine. No se obtuvo versión del servidor ni acceso autorizado al daemon. No se alteraron permisos o contextos para eludir la restricción.
- Compose independiente v5.5.0 permite validar configuración estática sin daemon.

### Evidencia de ejecución

| Comando / comprobación | Resultado real |
| --- | --- |
| npm.cmd run lint | Exit 1: descarga de pnpm denegada; lint no ejecutado |
| npm.cmd run typecheck | Exit 1: descarga de pnpm denegada; TypeScript no ejecutado |
| npm.cmd run build | Exit 1: descarga de pnpm denegada; aplicaciones no compiladas |
| npm.cmd run test | Exit 1 global: cuatro pruebas locales aprobadas, cero fallidas; después falla la descarga de pnpm. Jest no ejecutado |
| node scripts/check-architecture.cjs | Exit 0: límites N-Layers e imports estáticos sin ciclos |
| node scripts/prisma.cjs auth generate | Exit 1: Prisma no instalado |
| node scripts/prisma.cjs auth validate | Exit 1: Prisma no instalado |
| node scripts/prisma.cjs game generate | Exit 1: Prisma no instalado |
| node scripts/prisma.cjs game validate | Exit 1: Prisma no instalado |
| node scripts/verify-http.cjs | Exit 1: ambas APIs rechazaron conexión (ECONNREFUSED) |
| node scripts/verify-monitoring.cjs | Exit 1: Grafana rechazó conexión (ECONNREFUSED) |
| node scripts/check-production.cjs | Exit 1 esperado: faltan DOCKERHUB_USER, SITE_ADDRESS, CORS_ORIGINS productivo, JWT_ISSUER definitivo y pnpm-lock.yaml |
| Compose desarrollo, config --quiet | Exit 0 |
| Compose producción, config --quiet | Exit 0 con namespace nexquiz-validation solo para interpolación; no publicación |

Los scripts npm invocan las mismas tareas pnpm declaradas en package.json. Se lanzaron mediante la CLI Node de npm, capturando códigos y causa del fallo. Su fallo de arranque no demuestra un error de compilación del código.

Se analizó en memoria el JSON efectivo de ambos Compose sin imprimir secretos. Pasaron aserciones de nombres de los cuatro volúmenes y de nexquiz-network, clave privada montada únicamente en Auth, dependencia de cada API respecto a su propio job terminado correctamente y comando prisma migrate deploy. En producción se comprobó ausencia de puertos publicados para PostgreSQL, APIs, Collector y Prometheus. Los schemas apuntan a variables distintas, generan clientes propios y tienen migración SQL inicial presente. Esto no acredita ejecución de migraciones, conectividad ni datos persistidos.

### Matriz de cierre solicitada

“Fallido” indica un intento con resultado negativo; “pendiente” indica una comprobación que no pudo ejecutarse. Un bloqueo del entorno no equivale a un defecto demostrado en el código.

| Actividad | Estado | Evidencia o condición pendiente |
| --- | --- | --- |
| 1. Instalación pnpm | Fallido | EACCES al descargar el gestor requerido |
| 2. Lockfile real y consistencia | Pendiente | Ausente; requiere instalación resuelta |
| 3. Lint, typecheck, build y unitarias | Pendiente integral | Scripts fallan antes de herramientas; cuatro pruebas locales aprobadas, Jest pendiente |
| 4. Prisma y migraciones de ambas APIs | Pendiente integral | Generate/validate fallan por CLI ausente; migrate deploy no ejecutado |
| 5. Construcción de imágenes | Pendiente | Falta lockfile y acceso al daemon; build no lanzado |
| 6. Docker Compose operativo | Pendiente | Config estática aprobada; up no ejecutado por falta de acceso al daemon |
| 7. React y APIs funcionando | Pendiente | Sin build/arranque verificado |
| 8. Endpoints de salud | Fallido | Verificador no pudo conectar a las APIs |
| 9. OpenAPI y Scalar | Pendiente | Verificador se detuvo en salud; contratos y renderizado sin comprobar |
| 10. Persistencia PostgreSQL | Pendiente | Sin migraciones, consultas ni reinicios de prueba |
| 11. Exportación OTLP real | Pendiente | Sin SDK/Collector operativos accesibles |
| 12. Prometheus y Grafana visibles | Pendiente | Grafana inaccesible; ninguna serie real ni dashboard renderizado observado |
| 13. Verificadores existentes | Fallido | Ambos ejecutados con exit 1 |
| 14. Preparación VPS | Pendiente | Config estática aprobada, gate productivo rechazado; faltan datos y validaciones de ejecución |
| Arquitectura e independencia estática | Aprobado | N-Layers, schemas separados y aislamiento de secretos |
| Configuración Compose | Aprobado estático | Ambos config --quiet y aserciones del modelo efectivo |
| Pruebas locales de herramientas | Aprobado | 4 aprobadas, 0 fallidas; no sustituyen pruebas de aplicaciones |
| Publicación externa | Pendiente, no realizada | Sin publicación Docker Hub ni despliegue VPS efectuados |

### Cómo desbloquear y continuar

Docker Desktop ya está iniciado: ejecutar las comprobaciones desde una terminal local con acceso autorizado al daemon y salida HTTPS al registry. No basta volver a iniciar Desktop. No se necesita borrar datos ni desactivar TLS.

Desde la raíz, comprobar primero npm y Docker. Si fallan, resolver permisos/red antes de continuar:

```powershell
npm.cmd ping --registry=https://registry.npmjs.org/
docker version
docker info
```

Después, ejecutar los comandos de instalación, validación, build, Compose y verificadores de la sección 10 del informe histórico. Conservar pnpm 10.28.2, generar el lockfile mediante instalación real y versionarlo antes de utilizar --frozen-lockfile. Abrir React, Scalar, la fuente Prometheus y el dashboard Grafana; no sustituir esa observación por la existencia de configuración.

Persistencia, aislamiento de bases, métricas reales, renderizado y validación productiva permanecen obligatorios. **No procede el cierre técnico con los resultados presentes.**

---

## Informe histórico — Hito 1.1

Fecha: 2026-10-28. Windows PowerShell, workspace restringido.

**Hito 1 NO completado.** Se ejecutaron diagnóstico, correcciones y comprobaciones sin dependencias. Instalación, compilación y arranque integral continúan bloqueados. No se implementó Hito 2, no se publicaron imágenes, no se desplegó externamente y no se borraron bases ni volúmenes.

## 1. Diagnóstico real

| Elemento | Resultado |
| --- | --- |
| Node / npm | v24.19.0 / 11.17.0 |
| pnpm declarado | 10.28.2, sin cambios |
| pnpm global disponible | 12.3.4; rechaza el proyecto con ERR_PNPM_BAD_PM_VERSION |
| Registry efectivo | https://registry.npmjs.org/ |
| DNS | Resuelve registry.npmjs.org |
| HTTPS al registry | EACCES al conectar a 443, antes de negociar TLS |
| TLS | strict-ssl=true; sin certificado remoto verificable porque no se establece conexión |
| Proxy | Variables HTTP_PROXY, HTTPS_PROXY, ALL_PROXY y configuración proxy/https-proxy de npm ausentes |
| CA adicional | NODE_EXTRA_CA_CERTS y cafile sin configurar |
| .npmrc | Ausente en raíz y perfil de usuario |
| Workspaces | Tres aplicaciones y dos paquetes; nombres únicos y rutas coherentes |
| pnpm-lock.yaml | Ausente; no se inventó |
| Dependencias instaladas | Sin instalación del workspace ni node_modules/.modules.yaml |
| Docker CLI | Disponible; instalación 29.7.2 |
| Compose independiente | v5.5.0; valida ambos archivos sin daemon |
| Docker Desktop | Ejecutable instalado en AppData/Local/Programs/DockerDesktop; sin procesos Docker observados |
| Docker Engine | Pipe docker_engine inexistente; daemon no disponible |
| .env | Existe; bases distintas, contraseñas distintas y coherentes con las URLs; claves pública/privada presentes |

La descarga de pnpm 10.28.2 mediante Corepack se reintentó con COREPACK_HOME dentro del workspace: falló con EACCES. La evidencia indica una restricción de conexión del entorno, no un error de certificado demostrado. No se desactivó SSL, cambió registry ni sustituyó la versión del gestor.

La CLI Docker también informa acceso denegado al config.json del perfil. Para validar Compose se utilizó DOCKER_CONFIG dentro de .cache/docker, sin modificar credenciales ni contextos personales. El intento de conexión al daemon comprobó el pipe predeterminado, no un contexto remoto autenticado.

## 2. Estado de aplicaciones y dependencias

| Aplicación | Dependencias | Lint/typecheck/build | Tests | Arranque |
| --- | --- | --- | --- | --- |
| nexquiz-web | No instaladas | Bloqueados | Playwright no ejecutado | No verificado |
| nexquiz-auth-api | No instaladas | Bloqueados | 7 Jest/Supertest preparados, no ejecutados | No verificado |
| nexquiz-game-api | No instaladas | Bloqueados | 7 Jest/Supertest preparados, no ejecutados | No verificado |

Se intentaron lint, typecheck, build y test recursivos con la CLI disponible: rechazados por ERR_PNPM_BAD_PM_VERSION antes de ejecutarse. No constituyen fallos de compilación del código ni pruebas aprobadas. No puede descartarse un error TypeScript o incompatibilidad hasta instalar dependencias.

No se agregaron dependencias ni cambiaron versiones. Lint usa TypeScript con noUnusedLocals/noUnusedParameters y el chequeo N-Layers de raíz; no se presenta como ESLint. Web mantiene sus pruebas en Playwright a nivel raíz.

## 3. Pruebas ejecutadas

| Comando / comprobación | Resultado |
| --- | --- |
| node --test tests/tooling.test.cjs tests/prisma-runner.test.cjs | 4 aprobadas, 0 fallidas |
| node scripts/check-architecture.cjs | Aprobado: límites entre capas e imports estáticos sin ciclos |
| node --check de todos los scripts .cjs | Aprobado |
| Manifests y nombres de workspaces | Cinco nombres únicos y JSON legible |
| Claves locales existentes | Par RSA coherente, módulo de 3072 bits; sin imprimir claves |
| Scripts shell y enlaces de documentación | LF correcto y enlaces locales existentes |
| docker-compose --env-file .env -f docker-compose.yml config --quiet | Exit 0 |
| Producción con DOCKERHUB_USER=nexquiz-validation solo para interpolación | config --quiet exit 0; no publicación |
| node scripts/check-production.cjs | Rechazo esperado de configuración incompleta |
| node scripts/verify-http.cjs | Exit 1: Auth no pasa salud, Game rechaza conexión |
| node scripts/verify-monitoring.cjs | Exit 1: Grafana rechaza conexión |

Las pruebas locales verifican credenciales independientes, par RSA, idempotencia y rechazo productivo sin secretos; además, resolución de .env por Prisma desde otro directorio, precedencia del entorno, propagación de fallos y rechazo de operaciones no permitidas/dependencias ausentes. El runner se prueba con una CLI sintética en fixtures temporales: **no demuestra Prisma instalado ni conectado**.

## 4. PostgreSQL y Prisma

Se conservaron schemas, clientes independientes y SQL inicial versionado. Auth define User; Game define ServiceMetadata. No existen imports entre aplicaciones ni acceso directo a modelos privados del otro servicio.

Se intentaron generate y validate para ambas APIs mediante scripts/prisma.cjs: los cuatro terminaron con exit 1, Prisma no instalado. No se ejecutaron migraciones, SELECT 1 real, aislamiento, persistencia o restauración. No hay evidencia de conexión a nexquiz_auth/nexquiz_game.

El runner nuevo carga .env raíz mediante ruta absoluta, respeta variables explícitas y ejecuta Node sin shell. Solo admite generate, validate y migrate deploy; no incluye reset ni db push. Las migraciones Docker siguen usando jobs con migrate deploy.

## 5. Docker, proxy y persistencia

Compose valida sintaxis e interpolación. No se construyeron imágenes ni iniciaron contenedores por falta de daemon y lockfile. No hay logs, health checks Docker ni persistencia comprobada tras reinicio.

Se inspeccionaron Dockerfiles, jobs, red nexquiz-network y los cuatro volúmenes definidos. Los builds de API ahora incluyen el runner Prisma requerido por sus scripts. Se mantiene frozen-lockfile.

Producción sigue siendo una definición independiente: APIs y PostgreSQL sin puertos publicados; Caddy expone 80/443 y Grafana loopback. Solo Auth recibe la clave privada. Nginx recupera la herencia de CSP en assets al eliminar un add_header local.

Caddy prepara TLS automático, pero HTTPS real necesita dominio, DNS y puertos disponibles: no se verificó emisión de certificados. No existe gateway WebSocket en este hito; WSS no puede probarse funcionalmente. Ningún volumen se eliminó.

## 6. APIs, OpenAPI, Scalar, CORS y errores

Rutas previstas: /api/v1/health/live, /api/v1/health/ready, /openapi.json y /docs. El proxy añade /auth o /game. No se añadieron aliases /health sin versión ni rutas de identidad/juego.

localhost:3001 respondió 404 en salud, OpenAPI y docs. Esto no identifica a NexQuiz ni confirma Auth API activa; puede ser un proceso ajeno. No se detuvo ningún proceso. Game en 3002 rechazó conexión. Revisar disponibilidad de puertos antes de iniciar Docker.

Scalar ahora usa una URL absoluta de OpenAPI con prefijos fijos, incluso desde /docs/. Se desactivaron sus fuentes remotas. El bundle JavaScript todavía usa su CDN predeterminado; requiere conectividad del navegador y no tiene versión CDN fijada. Revisarlo antes de declarar reproducibilidad completa de documentación.

verify-http comprueba identidad/salud, paths OpenAPI, HTML Scalar en /docs y /docs/, CORS permitido/denegado y 404 sin stack. **No pasó aquí.** HTML no equivale a renderizar Scalar. CORS, errores y contratos siguen pendientes con APIs reales.

## 7. Observabilidad

Se conserva la carga del SDK antes de NestJS y el flujo OTLP → Collector → Prometheus → Grafana. El cierre ahora espera app.close y el flush del SDK, también ante fallo de arranque.

El tablero anterior dependía de nombres implícitos de auto-instrumentation. Ahora hay instrumentos explícitos: nexquiz_http_requests (exportado como nexquiz_http_requests_total), nexquiz_http_duration_seconds y nexquiz_service_ready. El histograma declara buckets en segundos. Las etiquetas están acotadas; rutas arbitrarias se agrupan en other sin IDs/parámetros.

El tablero incluye solicitudes, p95 y último readiness por API. La gauge representa la última medición y no demuestra disponibilidad continua; no observa un valor antes del primer probe. Dos pruebas Jest por API cubren etiquetas y transición fallo/recuperación, todavía sin ejecutar.

verify-monitoring consulta salud de Grafana, dashboard provisionado, datasource proxy y muestras positivas de ambas APIs. Rechaza enviar credenciales por HTTP remoto. Falló por conexión rechazada.

**Observabilidad NO validada:** no se observaron métricas reales en Grafana ni recepción OTLP. Las trazas siguen usando debug, sin almacenamiento histórico. El tablero debe inspeccionarse visualmente incluso si el verificador API pasa.

## 8. Errores encontrados y correcciones

| Hallazgo | Corrección |
| --- | --- |
| Prisma no cargaba consistentemente .env raíz | Runner limitado por operación/servicio, sin shell y con entorno explícito |
| Sin prisma validate | db:validate por API y raíz, incluido en verify |
| Sin lint | Chequeo de símbolos sin usar integrado con arquitectura |
| Scalar relativo podía fallar desde /docs/ | URL absoluta compatible con proxy y acceso directo |
| Fuentes Scalar con dependencia remota adicional | withDefaultFonts=false |
| Flush de telemetría sin espera | Cierre ordenado y limpieza ante fallo de arranque |
| Dashboard sin métricas propias de solicitudes/readiness | Instrumentación explícita y PromQL alineado, emisión pendiente |
| Assets Nginx anulaban herencia de cabeceras | Eliminado add_header local; caché conservada con expires |
| Sin verificadores repetibles HTTP/monitorización | verify-http.cjs y verify-monitoring.cjs, con fallo ante ausencia de evidencia |

## 9. Activar Docker Desktop en Windows

Abrir Docker Desktop desde Inicio y esperar Engine running. Si usa WSL 2, comprobar prerrequisitos e integración. No reinicializar ni borrar volúmenes como solución al arranque.

```powershell
Start-Process -FilePath "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe" -WindowStyle Hidden
docker version
docker info
docker-compose version
```

Si el daemon sigue sin responder, inspeccionar docker context ls sin cambiar a ciegas contextos remotos. Usar docker compose si está disponible; en este equipo existe también docker-compose.exe.

## 10. Comandos exactos para continuar localmente

Desde la raíz en una terminal local con conectividad:

```powershell
node --version
npm.cmd ping --registry=https://registry.npmjs.org/
npm.cmd config get strict-ssl
Remove-Item Env:COREPACK_ENABLE_PROJECT_SPEC -ErrorAction SilentlyContinue
$env:COREPACK_HOME = Join-Path (Get-Location) '.cache/corepack'
pnpm.cmd --version
pnpm.cmd install
```

El primer install debe resolver dependencias y generar el lockfile real. Revisar errores/peers y versionarlo; no continuar si falla. Si existe proxy institucional, usar la configuración y CA reales del administrador manteniendo SSL habilitado.

```powershell
node scripts/setup.cjs
pnpm.cmd install --frozen-lockfile
pnpm.cmd generate
pnpm.cmd db:validate
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd build
pnpm.cmd test
pnpm.cmd exec playwright install chromium
pnpm.cmd test:e2e
```

setup preserva .env y claves existentes. Si 3001 pertenece a otro servicio, elegir AUTH_PORT host libre y ajustar VITE_AUTH_API_URL para desarrollo. Los puertos internos permanecen 3001/3002.

```powershell
docker-compose --env-file .env -f docker-compose.yml config --quiet
docker-compose --env-file .env -f docker-compose.yml build
docker-compose --env-file .env -f docker-compose.yml up -d
docker-compose ps -a
docker-compose logs --tail 100 auth-migrate game-migrate auth-api game-api otel-collector prometheus grafana
node scripts/verify-http.cjs
$env:AUTH_HTTP_URL = 'http://localhost:8080/auth'
$env:GAME_HTTP_URL = 'http://localhost:8080/game'
node scripts/verify-http.cjs
Remove-Item Env:AUTH_HTTP_URL,Env:GAME_HTTP_URL -ErrorAction SilentlyContinue
Start-Sleep -Seconds 45
node scripts/verify-monitoring.cjs
```

No compartir logs sin revisar secretos. Abrir localhost:8080, sus rutas /auth/docs y /game/docs, y localhost:3000; comprobar los dos servicios y métricas visibles. Si cambia WEB_PORT, ajustar las URLs del proxy anteriores.

Para aislamiento ejecutar sh scripts/verify-isolation.sh desde Git Bash/WSL con docker compose disponible. Reiniciar sin borrar volúmenes y verificar persistencia con consultas no destructivas. Ensayar restauración únicamente en un entorno aislado.

## 11. Preparación de producción

Configurar namespace real Docker Hub, tag versionado, dominio DNS, CORS HTTPS e issuer definitivo. Ejecutar node scripts/check-production.cjs y validar docker-compose.prod.yml. Un namespace de validación no autoriza publicar.

Después de backup y pull, iniciar PostgreSQL y esperar health. Ejecutar los jobs con docker compose -f docker-compose.prod.yml run --rm auth-migrate y luego run --rm game-migrate, comprobando código cero antes de recrear APIs. --rm elimina únicamente el contenedor efímero, nunca volúmenes. Cambios de schema incompatibles requieren ventana controlada o estrategia expand/contract revisada.

No publicar ni desplegar sin destino, datos y permisos. HTTPS/WSS real y recuperación productiva permanecen pendientes.

## 12. Condiciones para cerrar Hito 1

Faltan lockfile, instalación resuelta, lint/typecheck/build/Jest/Playwright aprobados, Prisma generado/validado, migraciones y conexiones reales, aislamiento, imágenes construidas, stack saludable, persistencia, contratos/CORS reales, Scalar renderizado y métricas visibles en Grafana. Corregir configuración no prueba la ejecución de esos componentes.

Fuentes primarias: [API OpenTelemetry 1.9](https://raw.githubusercontent.com/open-telemetry/opentelemetry-js/api/v1.9.0/api/src/metrics/Metric.ts), [configuración Scalar](https://scalar.com/products/api-references/configuration), [opciones TypeScript](https://www.typescriptlang.org/tsconfig/). La ejecución con dependencias resueltas prevalece sobre inspección estática.
