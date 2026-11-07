# Especificación — NexQuiz, evaluaciones en vivo para ProfeLink

Las especificaciones normativas están en OpenSpec (`openspec/specs/*`), y cada hito tiene su cambio archivado en `openspec/changes/archive/`. Este documento las resume para la entrega.

## 1. Alcance

**Problema.** Hacer evaluaciones cortas de Verdadero o Falso durante una clase, con la participación simultánea de los estudiantes desde sus dispositivos, y guardar los resultados.

| Incluye | No incluye |
| --- | --- |
| Registro, login, perfil y nombre visible (Auth separado) | Recuperación de contraseña, verificación de correo, MFA |
| CRUD de cuestionarios y preguntas V/F con imagen (JPEG, PNG o WebP, ≤ 5 MiB, ≤ 16 MP) | Otros tipos de pregunta, puntaje por velocidad |
| Salas con código, lobby, partida en vivo, revelación y clasificación | Varias instancias de Game (escalado horizontal) |
| API REST de perfiles, cuestionarios, sesiones y resultados; OpenAPI/Scalar por API | Roles administrativos |
| Canal Socket.IO con autenticación, aislamiento por sala y recuperación de estado | |
| Cliente adicional independiente, seed de demostración, scripts de inicio, Docker y Compose, observabilidad | |

## 2. Reglas del juego

Son funciones puras en `apps/game-api/src/domain/game.ts`, con pruebas unitarias.

1. **Estados:** `LOBBY → QUESTION_OPEN → QUESTION_CLOSED → (QUESTION_OPEN …) → FINISHED`. Desde cualquier estado no terminal se puede pasar a `CANCELLED`. Cada transición incrementa `version`.
2. **Control:** solo el anfitrión (el `sub` del JWT debe ser igual a `hostId`) inicia, cierra, avanza, termina o cancela. Avanzar solo es posible con la pregunta cerrada, y después de la última pregunta se termina la partida.
3. **Ingreso:** el código tiene 6 caracteres sin símbolos ambiguos y es único entre las salas activas. Los participantes nuevos solo entran en `LOBBY`, mientras haya cupo (`GAME_MAX_PARTICIPANTS`, 50 por defecto). Un participante existente puede volver a entrar en cualquier estado activo (reconexión). El anfitrión no participa.
4. **Copia inmutable:** al crear la sala se copian las preguntas, respuestas, orden e imágenes. Editar el cuestionario después no afecta la partida.
5. **Tiempo:** el servidor fija `deadline = apertura + segundos` (entre 5 y 120). Se acepta una respuesta si `recibida ≤ deadline`, si la pregunta es la actual y si está abierta; si no, `409 ANSWER_WINDOW_CLOSED`. El temporizador cierra la pregunta y, si el proceso se reinicia, la recupera al arrancar o al primer acceso.
6. **Una respuesta:** `UNIQUE(gameQuestionId, participantId)` en la base de datos. Un reenvío devuelve la primera respuesta con `duplicate: true`.
7. **Revelación:** la respuesta correcta y el puntaje de la pregunta en curso no se envían mientras está abierta.
8. **Puntaje:** 1 punto por acierto y 0 por error o falta de respuesta. La clasificación usa ranking de competición: los empates comparten posición (1, 1, 3) y se ordenan por nombre. Se guarda al terminar, en la misma transacción.

## 3. Arquitectura

**Estilo:** servicios desplegables por separado. Auth y Game son APIs independientes, cada una con su base de datos. Game es un **monolito modular** con los módulos de cuestionarios, imágenes, salas y partida en vivo, que comparten proceso y transacciones. La web y el cliente adicional son aplicaciones estáticas que consumen las APIs por red.

**Organización interna:** cada API usa **N-Capas** (Domain → Application → Infrastructure/Presentation) y la composición se hace en `modules`. `scripts/check-architecture.cjs` falla si una capa interna importa frameworks, si hay ciclos o si una aplicación importa código de otra.

```mermaid
flowchart LR
  Browser[Navegador docente / participantes] -->|HTTPS| Proxy[nginx o Caddy]
  Client[results-client] -->|REST + JWT| Proxy
  Proxy -->|/| Web[web React]
  Proxy -->|/auth REST| Auth[auth-api]
  Proxy -->|/game REST + Socket.IO /live| Game[game-api]
  Auth --> AuthDB[(nexquiz_auth)]
  Game --> GameDB[(nexquiz_game)]
  Game --> Images[(volumen nexquiz-images)]
  Auth -. JWT RS256: Game verifica con la clave pública .-> Game
  Seed[seed job] -->|REST| Auth & Game
  Auth & Game -. OTLP .-> Collector[OTel Collector]
  Collector -->|métricas| Prometheus --> Grafana
  Collector -->|trazas| Tempo --> Grafana
  Collector -->|httpcheck| Web & Client
```

| Dónde está cada responsabilidad (Game) | Capa |
| --- | --- |
| Reglas: estados, ventana de respuesta, puntaje, clasificación, códigos | `domain/game.ts`, `domain/quiz.ts` |
| Casos de uso: crear sala, unirse, controlar la partida, responder, vistas, historial | `application/manage-sessions.ts`, `play-sessions.ts`, `live-events.ts`, `manage-quizzes.ts`, `manage-images.ts` |
| Entrada HTTP y en vivo | `presentation/*.controller.ts`, `live.gateway.ts` |
| Acceso a datos y recursos | `infrastructure/prisma-*.repository.ts`, `local-image.storage.ts`, `question-scheduler.ts`, `rsa-identity-verifier.ts` |

## 4. Diagrama de clases (Game y Auth)

```mermaid
classDiagram
  direction LR
  namespace Domain {
    class SessionState {
      status
      questionCount
      questionSeconds
      currentPosition
      openedAt
      deadline
      version
    }
    class GameRules {
      <<module game.ts>>
      start()
      close()
      next()
      finish()
      cancel()
      expire()
      assertAnswerWindow()
      assertCanJoin()
      score()
      rank()
    }
    class GameError {
      code
    }
  }
  namespace Application {
    class ManageSessions {
      create()
      start()
      close()
      next()
      finish()
      cancel()
      expire()
      recover()
    }
    class PlaySessions {
      join()
      answer()
      state()
      results()
      image()
      history()
      access()
    }
    class LiveEvents {
      announce(transition, now)
    }
    class ManageQuizzes
    class ManageImages
    class GameRepository {
      <<port>>
    }
    class QuizRepository {
      <<port>>
    }
    class ImageStorage {
      <<port>>
    }
    class LiveNotifier {
      <<port>>
      publish(event)
    }
    class QuestionTimer {
      <<port>>
      schedule()
      cancel()
    }
    class Clock {
      <<port>>
      now()
    }
    class IdentityVerifier {
      <<port>>
      verify(token)
    }
  }
  namespace Infrastructure {
    class PrismaGameRepository
    class PrismaQuizRepository
    class LocalImageStorage
    class InProcessQuestionTimer
    class SystemClock
    class RsaIdentityVerifier
    class SessionMetrics
  }
  namespace Presentation {
    class SessionController
    class QuizController
    class ImageController
    class LiveGateway {
      onSubscribe()
      onRenew()
    }
    class LiveBroadcaster
    class IdentityGuard
  }
  ManageSessions --> GameRepository
  ManageSessions --> ImageStorage
  ManageSessions --> LiveEvents
  PlaySessions --> GameRepository
  PlaySessions --> LiveNotifier
  LiveEvents --> LiveNotifier
  LiveEvents --> QuestionTimer
  ManageSessions ..> GameRules
  PrismaGameRepository ..> GameRules
  GameRules ..> SessionState
  GameRules ..> GameError
  PrismaGameRepository --|> GameRepository
  PrismaQuizRepository --|> QuizRepository
  LocalImageStorage --|> ImageStorage
  InProcessQuestionTimer --|> QuestionTimer
  SystemClock --|> Clock
  RsaIdentityVerifier ..|> IdentityVerifier
  LiveBroadcaster --|> LiveNotifier
  SessionController --> ManageSessions
  SessionController --> PlaySessions
  LiveGateway --> PlaySessions
  LiveGateway --> LiveBroadcaster
  QuizController --> ManageQuizzes
  ImageController --> ManageImages
```

```mermaid
classDiagram
  direction LR
  class Authentication {
    register()
    login()
    refresh()
    logout()
    profile()
  }
  class IdentityRepository {
    <<port>>
  }
  class PasswordHasher {
    <<port>>
  }
  class AccessTokens {
    <<port>>
    issue()
    verify()
    jwks()
  }
  class TrafficGate {
    <<port>>
    consume(key, limit)
  }
  class SessionSecrets {
    <<port>>
  }
  Authentication --> IdentityRepository
  Authentication --> PasswordHasher
  Authentication --> AccessTokens
  Authentication --> TrafficGate
  Authentication --> SessionSecrets
  PrismaIdentityRepository ..|> IdentityRepository
  ScryptPasswords ..|> PasswordHasher
  RsaAccessTokens ..|> AccessTokens
  PrismaTrafficGate ..|> TrafficGate
  RandomSessionSecrets ..|> SessionSecrets
  AuthController --> Authentication
  SessionMutationGuard --> TrafficGate
  AccessGuard --> AccessTokens
```

## 5. Modelo de datos implementado

Hay dos bases separadas. No existen claves foráneas entre ellas: `ownerId`, `hostId` y `userId` en Game son el `sub` del JWT de Auth.

```mermaid
erDiagram
  USER ||--o{ SESSION_AUTH : "abre"
  SESSION_AUTH ||--o{ REFRESH_TOKEN : "rota"
  USER {
    uuid id PK
    varchar email UK
    varchar displayName
    text passwordHash
  }
  SESSION_AUTH {
    uuid id PK
    uuid userId FK
    timestamp expiresAt
    timestamp revokedAt
  }
  REFRESH_TOKEN {
    varchar hash PK
    uuid sessionId FK
    timestamp usedAt
  }
  RATE_BUCKET {
    varchar key PK
    int count
    timestamp expiresAt
  }
```

```mermaid
erDiagram
  QUIZ ||--o{ QUESTION : contiene
  QUESTION |o--o| IMAGE_ASSET : ilustra
  QUIZ ||--o{ GAME_SESSION : "se juega en"
  GAME_SESSION ||--o{ GAME_QUESTION : "copia inmutable"
  GAME_QUESTION |o--o| GAME_IMAGE : ilustra
  GAME_SESSION ||--o{ GAME_IMAGE : retiene
  GAME_SESSION ||--o{ PARTICIPANT : admite
  PARTICIPANT ||--o{ ANSWER : responde
  GAME_QUESTION ||--o{ ANSWER : recibe
  GAME_SESSION ||--o{ GAME_RESULT : produce
  PARTICIPANT ||--o| GAME_RESULT : obtiene
  QUIZ {
    uuid id PK
    uuid ownerId
    varchar title
    timestamp deletedAt
  }
  QUESTION {
    uuid id PK
    uuid quizId FK
    varchar prompt
    bool correctAnswer
    int position
    uuid imageId FK
  }
  IMAGE_ASSET {
    uuid id PK
    uuid ownerId
    timestamp detachedAt
  }
  GAME_SESSION {
    uuid id PK
    varchar code "unico entre activas"
    uuid hostId
    enum status
    int questionSeconds
    int maxParticipants
    int currentPosition
    timestamp deadline
    int version
  }
  GAME_QUESTION {
    uuid id PK
    uuid sessionId FK
    int position "UNIQUE(sessionId, position)"
    varchar prompt
    bool correctAnswer
  }
  GAME_IMAGE {
    uuid id PK
    uuid sessionId FK
  }
  PARTICIPANT {
    uuid id PK
    uuid sessionId FK
    uuid userId "UNIQUE(sessionId, userId)"
    varchar displayName
  }
  ANSWER {
    uuid id PK
    uuid gameQuestionId FK
    uuid participantId FK "UNIQUE(gameQuestionId, participantId)"
    bool value
    bool correct
    timestamp receivedAt
  }
  GAME_RESULT {
    uuid sessionId PK
    uuid participantId PK
    int score
    int correctCount
    int rank
  }
```

Las migraciones son aditivas y se aplican automáticamente: `apps/auth-api/prisma/migrations` y `apps/game-api/prisma/migrations`. Las restricciones `CHECK` repiten las reglas del dominio: formato del código, rango de segundos, pregunta abierta con `deadline` y puntajes no negativos.

## 6. API y eventos en vivo

- **REST:** OpenAPI y Scalar de cada API (`/auth/docs`, `/game/docs`). Hay un resumen en [docs/api/README.md](api/README.md).
- **En vivo:** [docs/api/realtime.md](api/realtime.md) describe la conexión, la autenticación, los mensajes, cada evento con sus datos y destinatario, el orden por `version`, la recuperación y el reloj.
- **Consumo independiente:** [apps/results-client/README.md](../apps/results-client/README.md).
