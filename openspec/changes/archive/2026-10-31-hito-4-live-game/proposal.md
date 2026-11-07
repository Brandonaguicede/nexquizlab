## Why
Teachers can author quizzes but nobody can play them. Hito 4 delivers the core of Proyecto 2: a host opens a room from an owned quiz, participants join with a code, every participant receives the same question and image in real time, answers once within a server-controlled window, sees the revealed answer and the final ranking, and results survive restarts.

## What Changes
- Game sessions with a six-character join code, lobby, host-only controls and a configurable participant limit.
- Immutable snapshot of the quiz (text, answers, order and copied images) taken when the session is created.
- Server-authoritative state machine and timer: LOBBY → QUESTION_OPEN → QUESTION_CLOSED → … → FINISHED (or CANCELLED).
- Idempotent answers enforced by a database unique constraint; late answers rejected; 1 point per correct answer.
- Persisted final results and ranking.
- Socket.IO gateway for room subscription, state broadcast, authentication renewal and reconnection with full state sync.
- Auth adds a `name` claim (displayName) to access tokens so Game shows trusted participant names.
- Web screens: host lobby/control, join by code, mobile play screen with two large buttons, results.
- Nginx/Caddy WebSocket proxying for `/game/socket.io`.

## Capabilities
### New Capabilities
- `live-game`: sessions, participants, snapshots, live play, answers, scoring, results and the realtime contract.
### Modified Capabilities
- `authentication`: access tokens carry an optional `name` claim; Game accepts it as display name.

## Impact
New Game tables (GameSession, GameQuestion, GameImage, Participant, Answer, GameResult) in `nexquiz_game` only; Auth schema unchanged. New dependencies `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io` (Game) and `socket.io-client` (Web), pinned. Single Game instance is supported; horizontal scaling (Redis adapter) is out of scope and documented as a limitation. Results history listing, the external client, seed data, start scripts, Docker Hub publication, VPS deployment and trace storage belong to Hitos 5 and 6.
