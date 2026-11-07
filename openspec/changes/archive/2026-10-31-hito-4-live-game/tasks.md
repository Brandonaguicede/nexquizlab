## 1. Contracts
- [x] 1.1 Agree REST DTOs, error codes and realtime events from design.md; write `docs/api/realtime.md`
- [x] 1.2 Add `name` claim in Auth token issuer and optional parsing in Game verifier, with tests

## 2. Domain and persistence (Game)
- [x] 2.1 `domain/game.ts`: state machine, join code, answer window, scoring and ranking as pure functions with unit tests
- [x] 2.2 Migration `live_game`: GameSession, GameQuestion, GameImage, Participant, Answer, GameResult, unique and partial indexes
- [x] 2.3 `GameRepository` port and Prisma adapter with row locks; `ImageStorage.copy`

## 3. Use cases and REST
- [x] 3.1 Create session with snapshot and image copy
- [x] 3.2 Join and rejoin, participant limit
- [x] 3.3 Start, close, next, finish, cancel with host authorization
- [x] 3.4 Idempotent answers with deadline enforcement
- [x] 3.5 Session state, results and session image endpoints; OpenAPI/Scalar annotations
- [x] 3.6 Timer scheduler adapter with lazy close and boot recovery

## 4. Realtime
- [x] 4.1 Socket.IO gateway `/live`: handshake auth, `auth:renew`, expiry disconnect, `session:subscribe`
- [x] 4.2 `LiveNotifier` adapter publishing versioned events per room
- [x] 4.3 WebSocket upgrade headers for `/game/socket.io` in nginx and Caddy

## 5. Web
- [x] 5.1 Socket client hook with reconnection, token renewal and version-based resync
- [x] 5.2 Host: choose quiz, lobby with code and participants, controls, counts, reveal
- [x] 5.3 Join by code and mobile play screen with Verdadero/Falso buttons and countdown
- [x] 5.4 Results/ranking page and error states (code, full, started, connection, access)

## 6. Acceptance
- [x] 6.1 Unit tests: domain rules and use cases with fake ports
- [x] 6.2 Integration (PostgreSQL): concurrent double answer, late answer, host race with timer, restart recovery
- [x] 6.3 Playwright: host + 2 participants (desktop and mobile contexts), two simultaneous rooms isolated, reconnection mid-question, foreign user forbidden
- [x] 6.4 Regression suites, architecture check, Docker rebuild; record evidence in `docs/testing/hito-4.md`
- [x] 6.5 Validate and archive this change

Evidence (2026-10-31): 2.1 — `test/game-domain.spec.ts` 34 tests; Game suite 78/78, typecheck, lint and architecture check pass. 2.2 — `20261031000000_live_game` applied after the existing migrations on a disposable PostgreSQL 17.7; verified active-code partial unique index (code reusable after FINISHED), code/seconds/open-deadline checks, duplicate participant rejection and `ON CONFLICT DO NOTHING` keeping only the first answer. Not yet applied to the local Compose database (runs on next `docker compose up` via `game-migrate`).

Evidence (2026-10-31): 2.3 — `PrismaGameRepository` locks GameSession FOR UPDATE for joins and transitions and FOR SHARE for answers; snapshot holds the Quiz FOR SHARE while copying images, and join codes are allocated under a transaction advisory lock. `LocalImageStorage.copy` never overwrites (atomic `link`). `pnpm test:game:db` (8 tests, disposable PostgreSQL) covers immutable snapshot with retained image, owner/empty checks, distinct concurrent codes, exact participant limit under 6 concurrent joins, idempotent rejoin, host exclusion, 10 concurrent submissions storing one answer, late/foreign/non-host rejection, timer vs host close race producing one transition, and persisted shared-rank results — this covers part of 6.2; boot recovery of timers remains for 3.6. Game unit suite 80/80.

Evidence (2026-10-31): 1.2 — Auth issues optional `name` claim (displayName); Game accepts it as display-only and rejects non-string or >100 chars (Auth 24, Game identity tests). 3.x — `ManageSessions` (host commands, snapshot with image-copy compensation, timer expiry, boot recovery) and `PlaySessions` (join, answer, caller views, results, session images); `LiveEvents` maps transitions to events and timer changes; REST `SessionController` with OpenAPI DTOs; `GameError` mapped to 400/403/404/409. Realtime transport is a `NullLiveNotifier` placeholder until 4.2. Tests: `test/game-use-cases.spec.ts` (16, fake ports) — Game suite 99/99; `pnpm test:game:http` (3, full Nest app + real PostgreSQL + RS256 tokens) plays a whole game: ROOM_FULL with GAME_MAX_PARTICIPANTS=3, rejoin, host/foreign 403/404, duplicate answer, hidden answer and score while open, reveal counts, idempotent close, automatic close at the 5 s deadline, late answer 409, tie ranking, results access and OpenAPI paths. Spec updated: close is a no-op when already closed; foreign question id returns 404.

Evidence (2026-10-31): 1.1 — protocol in `docs/api/realtime.md` (connection, handshake auth, renewal/expiry, acks, events with audience, version ordering, recovery, clock offset, limits); REST contracts in OpenAPI. 4.x — Socket.IO 4.8.3 pinned with @nestjs/websockets and @nestjs/platform-socket.io 11.1.12. `LiveGateway` (namespace `/live`) rejects unauthenticated handshakes, renews same-user tokens, disconnects on expiry or identity change, authorizes `session:subscribe` with the REST access rule and returns the authoritative state; `LiveBroadcaster` routes events to session, host or session-scoped user rooms. Presence uses `participant:online/offline` (registration stays `participant:joined`). nginx `/game/socket.io/` upgrade location validated with `nginx -t`; Caddy reverse_proxy upgrades natively. `test/live-gateway.db.spec.ts` (4, real sockets + PostgreSQL): handshake rejection (missing, malformed, expired), two concurrent rooms isolated, outsider subscribe denied, opened question without answer and 30 s deadline, host-only counts, per-owner results, reconnection restoring answer and score without duplicates, presence, renewal, expiry and identity-switch disconnect. All DB suites 106/106 + persistence 8/8. Not yet verified through the Compose proxy (requires rebuilding the local stack).

Evidence (2026-10-31): 5.x — Web live pages (host, join, play, results), editor panel, Socket.IO hook with version ordering, resync, token renewal and offline detection; login returns to the requested page. 6.x — `docs/testing/hito-4.md`: Playwright live 3/3 (desktop host, desktop + iPhone 13 participants, isolated rooms, offline/online and reload reconnection, foreign access), regression 29/29, Game 99 unit + 7 PostgreSQL + 8 persistence, Auth 24, real `docker compose restart game-api` check, Compose rebuild with migration applied.
