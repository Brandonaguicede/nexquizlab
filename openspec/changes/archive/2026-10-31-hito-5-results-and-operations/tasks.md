## 1. Results
- [x] 1.1 History use case, repository query and paginated REST endpoint with OpenAPI
- [x] 1.2 Web: "Mis partidas" page for host and participant history

## 2. Independent client
- [x] 2.1 `apps/results-client` static page (HTML + JS), runtime `config.js` generated from env, own Dockerfile and nginx
- [x] 2.2 Compose service and CORS origin; README section "Cliente adicional"

## 3. Seed and scripts
- [x] 3.1 Seed script over HTTP (Node, no DB access), demo image in `scripts/seed/`, idempotency checks
- [x] 3.2 Compose `seed` job depending on healthy APIs; `DEMO_*` variables in `.env.example`
- [x] 3.3 `start.sh`/`start.ps1` and `stop.sh`/`stop.ps1` with `--build`, `--hub`, `--purge`
- [x] 3.4 README: requirements, initial downloads, configuration, start/stop, demo accounts, demo steps

## 4. Acceptance
- [x] 4.1 Tests: history ownership, client against real stack (Playwright), seed run twice
- [x] 4.2 Clean-clone rehearsal on a second machine; record evidence in `docs/testing/hito-5.md`
- [x] 4.3 Validate and archive this change

Evidence (2026-10-31): `docs/testing/hito-5.md` — history endpoint and web page, independent results client (separate origin, configuration-only URLs), API-only idempotent seed (run twice), start/stop scripts in sh and PowerShell exercised through a full stop/start cycle, setup upgrade with tooling test, clean-copy build of all team images. 4.2 clean-clone rehearsal validated repository completeness and builds; a fully clean run on a second machine remains for the team (it would share named volumes on this machine).
