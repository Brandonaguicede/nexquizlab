# Desarrollo, Cloud/VPS y producción
Para el despliegue gratuito en Oracle Ampere A1, seguir [la gu?a Oracle](oracle.md). Ese flujo construye en la VM y no requiere publicar en Docker Hub. Las secciones siguientes conservan el procedimiento general y notas hist?ricas; la configuraci?n ejecutable vigente est? en los archivos Compose.

## Estado y prerrequisitos
Se entrega preparación, no un despliegue externo existente. Se necesitan VPS con Docker/Compose, DNS público apuntando al host, puertos 80/443 abiertos y namespace Docker Hub configurado por el propietario. No se supone una cuenta real. Usar imágenes y herramientas declaradas en docs/versions.md y resolver primero pnpm-lock.yaml en una máquina con acceso a npm.

## Flujo de release
1. Ejecutar node scripts/setup.cjs. Proteger .env y secrets con permisos del host; en Windows revisar ACLs. Los permisos mode de Node no sustituyen ACLs de Windows.
2. Resolver dependencias con pnpm install, versionar pnpm-lock.yaml y ejecutar pnpm verify y pnpm test:e2e. Repetir instalaciones posteriores con --frozen-lockfile.
3. Configurar DOCKERHUB_USER e IMAGE_TAG versionado en .env. El script no utiliza latest.
4. Ejecutar node --env-file=.env scripts/release.cjs para construir las tres imágenes localmente. Validar en staging. La imagen Web usa /auth y /game por defecto, por lo que no necesita secretos ni URLs de host en build.
5. Autenticarse con docker login desde un entorno seguro y publicar explícitamente las imágenes calificadas de web, auth-api y game-api. Usar el mismo tag de release. Registrar sus digests; no sobrescribir tags publicados.
6. En VPS colocar .env, secrets/, docker-compose.prod.yml e infra/. Sustituir SITE_ADDRESS por el nombre DNS sin esquema; CORS_ORIGINS por el origen HTTPS exacto; JWT_ISSUER por el identificador HTTPS definitivo. Ejecutar node scripts/check-production.cjs antes del despliegue. No imprimir docker compose config sin --quiet porque expone variables.
7. Ejecutar docker compose -f docker-compose.prod.yml config --quiet, luego pull y up -d. Los jobs de migración usan migrate deploy y las APIs esperan su éxito. Para cada release posterior forzar recreación de los jobs si cambian migraciones; no confiar en un job terminado de otra versión. Desplegar con docker compose -f docker-compose.prod.yml up -d --force-recreate auth-migrate game-migrate, esperar código cero, y después up -d.
8. Verificar HTTPS, /auth/api/v1/health/ready y /game/api/v1/health/ready, documentación, volumen persistente y aislamiento. Registrar release, digests y fecha.

El archivo de producción es **independiente**: usar solo -f docker-compose.prod.yml; no combinarlo con el de desarrollo porque se reintroducirían puertos y builds. Únicamente Caddy publica 80/443 y Grafana publica loopback 3000. PostgreSQL, APIs, Collector y Prometheus no publican puertos. Caddy gestiona certificados TLS y sus volúmenes adicionales persisten estado ACME.
Los servicios corren en nexquiz-network. Las APIs y Web corren sin root; las APIs usan init y cap_drop ALL. PostgreSQL y Caddy conservan capacidades necesarias para su arranque. La persistencia de imágenes está reservada y aún no admite uploads.

## Operación y observabilidad
APIs envían trazas y métricas vía OTLP HTTP a Collector:4318. Collector exporta métricas Prometheus:8889; Prometheus las retiene 15 días y Grafana provisiona datasource y dashboard. El panel up mide disponibilidad del scrape, no readiness individual de APIs. Duración HTTP p95 depende de los histogramas emitidos por auto-instrumentation; verificar nombres con la versión instalada antes de declarar ese panel funcional.
Las trazas usan exporter debug: **no se almacenan históricamente**. Un backend Tempo u otro almacén de trazas es una decisión posterior. No enviar tokens, credenciales o payloads de estudiantes como atributos. Nest escribe logs a stdout; producción limita archivos Docker a 3 × 10 MB por servicio con runtime común. No se implementa centralización de logs ni alertas completas.
Para acceder a Grafana desde otro equipo usar túnel SSH: ssh -L 3000:127.0.0.1:3000 usuario@vps. No publicar su puerto sin autenticación y política de red.

## Backup y restore
Ejecutar sh infra/deployment/backup.sh en el host de producción. Genera dos dumps custom en backups/ con permisos restrictivos. Cifrar, copiar fuera del VPS y definir retención según política institucional. Respaldar también imágenes, configuración y material de claves mediante un gestor seguro; no subir secretos a Git. Un volumen Docker no es un backup.
Para restaurar: crear un entorno de recuperación aislado con la misma versión mayor de PostgreSQL, inicializar roles/bases mediante el script, detener las APIs de ese entorno e importar cada dump a su base usando pg_restore --clean --if-exists --no-owner --role con el propietario correspondiente. Ejecutar migrate deploy si procede, comprobar contadores y salud, probar aislamiento y registrar resultado. Nunca ensayar restauraciones sobre la única base productiva.

## Rollback
Antes de migrar, obtener backup verificado. Revertir a tags/digests anteriores únicamente cuando el schema siga siendo compatible. Prisma no proporciona rollback automático de datos; una migración irreversible requiere restauración planificada o una nueva migración correctiva. No ejecutar down -v en producción.

## Límites pendientes de validación
No hay evidencia de build Docker, arranque, TLS real, métricas emitidas, persistencia tras reinicio ni restauración ejecutada en este entorno. La reproducibilidad de dependencias transitivas requiere el lockfile real todavía pendiente; las versiones directas están fijadas. No se certifica seguridad de producción sin esas comprobaciones y revisión del deployment objetivo.

