# Arquitectura de NexQuiz
## Dos decisiones diferentes
El sistema utiliza aplicaciones desplegables independientemente. Esto define procesos, contratos de red, propiedad de datos y entregas. Game API será un monolito modular: sus funcionalidades de juego compartirán un proceso y transacciones de su base privada.
N-Layers define dependencias dentro de cada API. No implica un proceso o servidor por capa. Domain no conoce NestJS, Prisma, HTTP ni sockets. Application importa Domain y declara puertos; Infrastructure implementa esos puertos; Presentation traduce transportes e invoca casos de uso. modules es la raíz de composición de proveedores NestJS y puede conocer todas las capas. config, app.module y main configuran arranque y aspectos transversales, fuera de las capas internas.
~~~mermaid
flowchart LR
  Web[nexquiz-web] -->|REST| Auth[nexquiz-auth-api]
  Web -->|REST + Socket.IO /live| Game[nexquiz-game-api]
  Client[results-client] -->|REST + JWT| Auth
  Client -->|REST + JWT| Game
  Auth --> AuthDB[(nexquiz_auth)]
  Game --> GameDB[(nexquiz_game)]
  Auth -. OTLP .-> Collector[OpenTelemetry Collector]
  Game -. OTLP .-> Collector
  Collector --> Prometheus
  Prometheus --> Grafana
~~~
~~~mermaid
flowchart TD
  Composition[modules: composición NestJS] --> Presentation
  Composition --> Infrastructure
  Presentation --> Application
  Infrastructure -->|implementa puertos| Application
  Application --> Domain
~~~
## Partida en vivo, resultados y operación (Hitos 4–6)

La especificación consolidada, con alcance, reglas, diagramas de arquitectura y de clases y el modelo de datos real, está en [docs/specification.md](../specification.md). Resumen de las decisiones:

- **Los comandos van por REST y los avisos por Socket.IO.** Cada cambio de estado es un endpoint documentado en OpenAPI con la misma autorización. El gateway `/live` solo suscribe, difunde eventos versionados y resincroniza ([protocolo](../api/realtime.md)).
- **El servidor es la autoridad.** Las reglas son funciones puras en `domain/game.ts`; los casos de uso bloquean la sesión (`FOR UPDATE` en los comandos, `FOR SHARE` en las respuestas); `UNIQUE(gameQuestionId, participantId)` garantiza una sola respuesta.
- **Copia inmutable** del cuestionario e imágenes al crear la sala; las imágenes de partida no las toca el recolector de autoría.
- **Temporizador en proceso**, recuperado al arrancar y respaldado por cierre perezoso en cada acceso. Límite conocido: una sola instancia de Game.
- **Consumo independiente:** `apps/results-client` usa solo las URL configuradas y los contratos públicos.

## Gestión de cuestionarios (Hito 3)

Game implementa autoría propia de cuestionarios, preguntas booleanas e imágenes protegidas. Todas las mutaciones del agregado bloquean la fila principal; la base impone posición única y las transacciones realizan un reordenamiento completo. El almacenamiento de imágenes está detrás del puerto ImageStorage y el adaptador usa el volumen persistente `nexquiz-images`. La planificación de snapshots inmutables para partidas futuras queda documentada en [quiz-authoring.md](quiz-authoring.md).

## Slice implementado
HealthController llama CheckHealth. El caso de uso depende de HealthPort, produce ServiceStatus y recibe PrismaService por inyección mediante un Symbol. Infrastructure ejecuta SELECT 1 y convierte la conectividad en un booleano. Presentation devuelve HTTP 503 cuando la base falla. Liveness no consulta PostgreSQL. Esta separación se prueba con un adaptador reemplazado en Nest TestingModule.

El chequeo scripts/check-architecture.cjs inspecciona imports estáticos, prohíbe frameworks en capas internas, detecta ciclos y bloquea dependencias de Presentation hacia Prisma. No reemplaza revisión de imports dinámicos ni análisis semántico completo de TypeScript. No se permiten imports entre aplicaciones. shared-types contiene exclusivamente contratos públicos sin dependencias; shared-config solo opciones TypeScript.

## Organización futura de Game API
| Funcionalidad | Dominio y casos de uso previstos |
| --- | --- |
| Quizzes | Propiedad, borrador/publicación, administración autorizada |
| Questions | Enunciados Verdadero/Falso, tiempo, referencia a imagen |
| Sessions | Sala, código de acceso, máquina de estados, reloj autoritativo |
| Participants | Identidad de sesión, alias, desconexión/reconexión |
| Answers | Recepción idempotente, validación de ventana y respuesta |
| Results | Puntuación del servidor, clasificación, resultados finales |

Cada funcionalidad podrá añadir carpetas bajo las cuatro capas y su módulo de composición. Los futuros gateways Socket.IO serán adaptadores Presentation que llaman Application, comparten autorización con REST y nunca contienen el motor. No se añaden gateways vacíos o eventos ficticios en Hito 1.

El servidor será la fuente de autoridad para tiempos, respuestas, permisos y puntajes. Un cliente nunca podrá declarar su resultado ni extender su reloj. La clave foránea lógica de usuario en Game será un subject externo, sin JOIN ni acceso a tablas de Auth.

## Decisiones y límites
- pnpm workspaces evita una capa adicional de orquestación sin necesidad demostrada.
- NestJS 11 con TypeScript CommonJS en APIs; Vite ESM en Web. Node 24 LTS en ambos.
- Prisma 6 tiene configuración datasource estable y clientes separados generados en cada aplicación. No hay cliente compartido.
- Una instancia PostgreSQL reduce operaciones en este hito; las bases y roles siguen siendo independientes y pueden separarse de host.
- Las APIs duplican una pequeña configuración de arranque deliberadamente: un paquete de framework compartido no debe impedir entregas independientes.
- No se instalan librerías JWT, hashing o Socket.IO hasta tener casos de uso que las justifiquen. Se documenta su integración sin activar capacidades incompletas.
- Los contenedores de API utilizan una etapa de build como runtime y conservan herramientas Prisma para el job de migración. Mejora futura: imagen de migración separada y runtime podado después de comprobar producción.
