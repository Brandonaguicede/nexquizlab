# NexQuiz — Hito 2: autenticación independiente

## Alcance y validación previa

Trabajo sobre el monorepo existente, conservando N-Layers. El mensaje de solicitud recibido terminó en «## 9. Pr»; se pidió la continuación y se implementó el alcance explícito de las secciones 1–8. El usuario confirmó nombre/correo y la identidad visual recomendada, sin campos adicionales.

Git: rama main sin primer commit ni remoto; todo el proyecto estaba sin versionar al iniciar. No es posible comparar contra una revisión Git aprobada. Se inspeccionaron los contratos e interfaces existentes: solo existían salud y puertos preparatorios, no funcionalidades parciales de autenticación. No se borraron ni reimplementaron los slices de salud, Scalar ni las pruebas aprobadas.

Antes de introducir identidad, se inspeccionaron las imágenes corregidas del Hito 1 y se recrearon exclusivamente auth-api y game-api. Ambas quedaron healthy. Nginx conservaba IPs antiguas y respondía 502: se recreó únicamente web para renovar su resolución. Los verificadores HTTP y de monitoreo pasaron después del intervalo de recolección. Se aprobó renderizado real de Scalar vía proxy en escritorio/móvil (4/4), además de las cuatro pruebas aisladas originales. Se conservaron PostgreSQL, imágenes/archivos, métricas y todos los volúmenes. No se modificaron proyectos externos.

Pendientes independientes de Hito 1: primer commit/staging del propietario; simulacro de restauración aislado y publicación/TLS públicos cuando exista autorización/destino. No se consideran cumplidos por implementar Hito 2. La construcción y el renderizado local de Scalar sí quedaron desbloqueados.

## Implementación

- Domain: Email, reglas de contraseña/nombre, identidad pública y errores.
- Application: Authentication y puertos de repositorio, hashing, tokens, secretos y límite de tráfico; GetIdentity independiente en Game.
- Infrastructure: Prisma, rotación con bloqueo transaccional de sesión, hashing scrypt y JWT RS256.
- Presentation: DTOs con whitelist, guards de Bearer/CSRF, errores sanitizados, cookies y OpenAPI.
- Web: registro, login, perfil, ruta protegida, sesión en memoria, renovación, estados de carga/error y cierre real. No se almacenan contraseñas ni JWT en localStorage/sessionStorage.

Contratos definidos antes del código en `openspec/changes/hito-2-authentication` y validados con `openspec validate hito-2-authentication --strict`. La especificación incluye registro/login, duplicados concurrentes, sesiones, CSRF, refresh/replay, perfil, logout, Game independiente y navegador. `openspec archive hito-2-authentication --yes` archivó oficialmente el cambio en `openspec/changes/archive/2026-10-29-hito-2-authentication`, creó la spec authentication y actualizó dos requisitos de platform-foundation, conservando los escenarios históricos. La tarea del propio archivo se marcó completada después de ejecutar la CLI. Referencias actuales: `openspec/specs/authentication/spec.md` y `openspec/specs/platform-foundation/spec.md`.

Decisiones completas, endpoints y riesgos: [autenticación y seguridad](../security/authentication.md). RS256 con acceso de 300 segundos; refresh HttpOnly/Strict con expiración absoluta de siete días. Logout/replay revocan perfil y renovación inmediatamente en Auth. **Game verifica offline: un JWT ya emitido puede durar hasta cinco minutos tras logout.** No se promete revocación inmediata global.

## Migración y conservación

Se confirmó el PostgreSQL de NexQuiz en el puerto host **55432**, distinto del 5432 de otros proyectos. Las URLs del `.env` local aún apuntaban a 5432; las comprobaciones con conexión de host sobreescribieron únicamente el puerto en memoria y exigieron la base `nexquiz_auth`. No se migró mediante esas URLs ambiguas.

El inventario previo confirmó **un usuario existente**, ID `00000000-0000-4000-8000-00000000a001`; el snapshot de IDs quedó en `.cache/hito2-db-baseline.json`, ignorado. La migración `20261030020000_auth_sessions` se aplicó con exit 0 dentro de la red de Compose:

```powershell
docker --context desktop-linux compose run --rm --no-deps auth-api ./node_modules/.bin/prisma migrate deploy
```

Añade Session, RefreshToken, RateBucket y el índice único lower(email), sin borrar ni actualizar User y sin migrar Game. La ausencia de default UUID en SQL coincide con la generación de UUID por Prisma Client. No hubo reset, db push, down -v ni restauración sobre datos existentes.

Las pruebas crean cuentas sintéticas `identity-test-…@example.invalid` y las conservan. Las pruebas directas de persistencia usan hashes sintéticos no válidos para login y credenciales aleatorias de refresh guardadas únicamente como digest. Ninguna prueba elimina usuarios, sesiones o volúmenes.

## Evidencias

| Comprobación | Resultado |
| --- | --- |
| OpenSpec antes de implementar | Validación estricta aprobada |
| Regresión inicial `pnpm verify` | Exit 0, herramientas 5/5, Auth 19/19, Game 21/21, Scalar HTTP 12/12, lint/tipos/arquitectura/Prisma y tres builds |
| E2E originales `pnpm test:e2e` | 4/4; Vite requirió sesión autorizada por permisos del sandbox |
| Scalar aislado `pnpm test:docs` | 4/4 |
| PostgreSQL real `NEXQUIZ_TEST_DB_PORT=55432 pnpm test:identity:db` | 6/6: aislamiento, duplicados concurrentes, replay concurrente con revocación persistida, expiración, logout/expiración absoluta y rate limit atómico |
| Stack real `pnpm test:identity` | 10/10 iniciales, escritorio y móvil: API, CSRF, rate limit, claves, registro/login/perfil/reload/logout, identidad Game y Scalar vía proxy |
| Verificadores HTTP y monitoreo | Exit 0 tras actualizar servicios |
| Auditoría de repositorio | Exit 0; secretos y recursos generados excluidos |
| Revisión visual | Capturas login/profile de escritorio/móvil revisadas; sin desbordamiento, campos etiquetados, estilos existentes conservados |

Se detectaron y corrigieron durante validación: dependencia indirecta de Express usada como directa (se reemplazó por useBodyParser del adaptador Nest); tipos del acceso al adaptador HTTP (se usa su instancia Express); respuesta 500 del parser al exceder 16 KB (se devuelve 413 explícito). También se corrigió la indentación del entorno JWT en Compose antes de construir. No se ocultó ningún fallo ni se desactivaron pruebas. La comprobación 413 y las pruebas de cookie Secure de producción se añadieron a la aceptación final.

### Aceptación final comprobada

| Comando final | Resultado |
| --- | --- |
| `pnpm verify` | Exit 0: Auth **23/23**, Game **21/21**, herramientas **5/5**, Scalar HTTP **12/12**, Prisma generate/validate, arquitectura, lint, tipos y tres builds |
| `pnpm test:docs` | **4/4**, 9.6 s |
| `pnpm test:e2e` | **4/4**, 6.3 s |
| `pnpm test:identity` | **10/10**, 30.1 s; incluye 413, CSRF, rate limit y navegador real |
| `pnpm test:identity:db` con puerto 55432 | **6/6**, 16.3 s |
| Verificadores HTTP y monitoreo | Exit 0, ambas APIs y muestras reales |
| Auditoría final de repositorio | Exit 0, **157** archivos elegibles después del archivo OpenSpec |
| OpenSpec final | Validación estricta: **2 specs aprobadas**, **1 archivo aprobado**, cero tareas pendientes en el cambio archivado |
| Conservación y migraciones | Usuario original **1/1** conservado; **20** usuarios totales tras pruebas, incluidos 19 sintéticos; migraciones inicial y de sesiones completadas, checksum SHA-256 coincidente, sin rollback |

Una repetición de las pruebas reales agotó el bucket persistente de 100 mutaciones por fuente y devolvió 429 en móvil. Se respetó el cambio natural de ventana y se repitió la suite completa con 10/10; no se borraron contadores ni se aumentó/desactivó el límite. El reinicio de Auth no elimina este control persistido.

Las capturas revisadas se generan en `test-results/identity/auth-browser-registration--51096-renewal-identity-and-logout-{desktop,mobile}/{login,profile}.png`. Los resultados son locales e ignorados por Git. No compartir artifacts de fallos sin revisar: incluso sin trace, los contextos de error de Playwright pueden mostrar credenciales sintéticas de los formularios.

### Imágenes y ejecución finales

| Imagen local | ID observado |
| --- | --- |
| `nexquiz-auth-api:latest` | `sha256:016f1a2b40edd16c581e6b17a12de4935c1dd90f67479f6e28cf15394910b0ee` |
| `nexquiz-game-api:latest` | `sha256:1c589b99536232bf46edcdb0a294680682b3ee17aecbb2505012ce9e8fce631d` |
| `nexquiz-web:latest` | `sha256:55e7d7fcfe215ce77847c4d86707ce327e08edab06a8c05544fd0adbada85780` |

Builds con lockfile congelado y Scalar oficial aprobado; Auth, Game y Web fueron recreados y quedaron **healthy**, igual que PostgreSQL. Game monta `/run/secrets/jwt_public` y `/app/images`; no monta clave privada. Se excluyen clientes Prisma generados del contexto Docker para regenerarlos con el motor Linux de cada API.

La inspección final de cada contenedor confirmó que `.Image` coincide exactamente con el ID de su imagen local listado arriba; no se está acreditando una imagen recién construida mientras se ejecuta otra antigua.

Estado funcional: **alcance recibido de Hito 2 implementado y validado localmente**. No se afirma cierre de requisitos que no llegaron después del encabezado truncado ni de los pendientes independientes de Hito 1. CI localmente actualizado para construir un stack y ejecutar la aceptación real; no se ejecutó GitHub Actions ni se hizo push/publicación/despliegue.

## Reproducción local

Desde la raíz y con Node/pnpm fijados, registry y Docker Desktop accesibles; detenerse ante fallos. Conservar `.env` y claves existentes.

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd prepare:scalar
pnpm.cmd verify
pnpm.cmd test:docs
pnpm.cmd test:e2e
docker --context desktop-linux compose config --quiet
docker --context desktop-linux compose build auth-api game-api web
docker --context desktop-linux compose run --rm --no-deps auth-api ./node_modules/.bin/prisma migrate deploy
docker --context desktop-linux compose up -d --no-deps --no-build --wait auth-api game-api
docker --context desktop-linux compose up -d --no-deps --no-build --force-recreate --wait web
$env:NEXQUIZ_TEST_DB_PORT = '55432'
pnpm.cmd test:identity:db
pnpm.cmd test:identity
node scripts/verify-http.cjs
node scripts/verify-monitoring.cjs
pnpm.cmd audit:repository
```

Las pruebas DB exigen un puerto explícito y rechazan 5432 para evitar el PostgreSQL ajeno de este equipo. Ajustarlo solo después de verificar el destino local. No cambiar las bases ni claves para hacer pasar pruebas. Los límites de intentos persisten 15 minutos: ejecuciones repetidas pueden recibir 429 legítimo; respetar Retry-After en lugar de borrar buckets o desactivar la protección.

## Exposición

1. Abrir `http://localhost:8080/register`, registrar una cuenta propia, mostrar perfil y comprobar identidad en Game.
2. Recargar el perfil para demostrar renovación mediante cookie HttpOnly y ausencia de tokens en browser storage.
3. Mostrar OpenAPI/Scalar en `/auth/docs` y `/game/docs`, y JWKS público en `/auth/api/v1/.well-known/jwks.json`.
4. Mostrar logout y el bloqueo de `/profile`; explicar la ventana máxima de cinco minutos en Game offline.
5. Presentar pruebas de firmas/audiencias incorrectas, CSRF y replay, los modelos independientes y la migración aditiva.
6. Aclarar que no hay salas, cuestionarios, puntuación, publicación Docker Hub ni despliegue VPS en este alcance.
