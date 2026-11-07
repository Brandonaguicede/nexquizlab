# Persistencia y aislamiento
## Propiedad
PostgreSQL 17 contiene nexquiz_auth y nexquiz_game. Un administrador inicializa roles distintos sin SUPERUSER, CREATEDB ni CREATEROLE. Cada rol posee únicamente su base. Se revoca CONNECT de PUBLIC en ambas bases y privilegios PUBLIC del schema public. PostgreSQL 17 concede al dueño de la base el schema mediante pg_database_owner. Las APIs jamás reciben credenciales administrativas.
El volumen nexquiz-postgres-data persiste datos. El script init-databases.sh se ejecuta únicamente cuando PGDATA está vacío; editar .env no rota contraseñas de un volumen existente. Para rotarlas usar ALTER ROLE mediante un administrador y actualizar las conexiones de forma coordinada. Nunca borrar un volumen para corregir credenciales en producción.

## Modelos mínimos
Auth prepara User: UUID, email único, displayName, passwordHash nullable y fechas. No hay usuarios seed, credenciales compartidas, endpoint ni autorización asociada. La normalización del email y hashing se implementarán antes de habilitar registro. El hash nullable prepara identidades sin credenciales locales; el futuro login deberá rechazar ausencia de hash.
Game conserva ServiceMetadata y, desde Hito 3, migra Quiz, Question e ImageAsset a su propia base mediante una migración versionada y aditiva. Las preguntas y cuestionarios borrados se conservan como tombstones para la procedencia futura. El orden mantiene índice único `(quizId, position)`; los borrados guardan `position = NULL`. Imágenes se asocian por UUID y viven en el volumen persistente `nexquiz-images`; la tabla guarda propiedad y estado de la asociación, no rutas absolutas. El Hito 3 no agrega tablas de partidas.
Cada servicio tiene schema.prisma, migration_lock.toml, SQL inicial y su propio generated/client ignorado por Git. Los clientes se generan durante build.

## Comandos
~~~sh
pnpm generate
node --env-file=.env scripts/migrate.cjs
~~~
Las migraciones se despliegan con prisma migrate deploy. Nunca usar db push o migrate dev en producción. En desarrollo, una nueva migración requiere URL de shadow database con permisos exclusivos de desarrollo; los roles runtime no crean bases. Revisar y versionar el SQL antes de desplegar.

## Comprobación real de aislamiento
Con el stack iniciado ejecutar sh scripts/verify-isolation.sh. Verifica conexión propia y rechazo de conexión cruzada en ambos sentidos usando TCP/password. No basta comprobar que los nombres de base sean diferentes.
La disponibilidad se consulta mediante /api/v1/health/ready; el cliente tiene connect_timeout y pool_timeout. Para interrupciones de consultas en producción definir statement_timeout a nivel de rol conforme al presupuesto de latencia.

## Modelo implementado
El modelo real de las dos bases (Auth: User, Session, RefreshToken, RateBucket; Game: Quiz, Question, ImageAsset, GameSession, GameQuestion, GameImage, Participant, Answer, GameResult) está en [docs/specification.md §5](../specification.md#5-modelo-de-datos-implementado). La migración `20261031000000_live_game` agrega las tablas de partidas con un índice único parcial para el código activo y restricciones `CHECK`. El diagrama siguiente es la planificación original del Hito 1 y se conserva como historial.

### Planificación original
~~~mermaid
erDiagram
  QUIZ ||--o{ QUESTION : contains
  QUIZ ||--o{ SESSION : runs
  SESSION ||--o{ PARTICIPANT : joins
  PARTICIPANT ||--o{ ANSWER : submits
  QUESTION ||--o{ ANSWER : receives
  SESSION ||--o{ RESULT : produces
~~~
Planificación del Hito 1, reemplazada por el modelo implementado. Quiz tendrá ownerSubject externo; los servicios se relacionan mediante contratos, no claves foráneas entre bases.
Los backups separados y el procedimiento de restauración están en docs/deployment/README.md. El almacenamiento nexquiz-images está reservado exclusivamente a Game; no se expone subida de archivos en este hito.
