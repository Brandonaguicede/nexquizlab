## 1. Publication and deployment
- [ ] 1.1 Docker Hub namespace, `release:build` for linux/amd64 (or VPS arch), push tagged images
- [ ] 1.2 Provision VPS, firewall (80/443 only), Docker, `.env` with production values, HTTPS hostname
- [ ] 1.3 Deploy with `start.sh --hub`, verify WebSocket through Caddy, backups with `infra/deployment/backup.sh`

## 2. Observability
- [x] 2.1 Tempo service, collector traces exporter, Grafana datasource
- [x] 2.2 Game OTel metrics and dashboard panels; web/proxy availability
- [x] 2.3 Extend `scripts/verify-monitoring.cjs`

## 3. Capacity
- [x] 3.1 Load script (Node + socket.io-client) simulating N participants joining and answering
- [x] 3.2 Run 10/30/50/N, record results and set `GAME_MAX_PARTICIPANTS`

## 4. Documentation and evidence
- [x] 4.1 `docs/specification.md`: scope, rules, architecture diagram, class diagram (Mermaid classDiagram), real ER, REST and realtime references
- [x] 4.2 Evidence in `docs/testing/hito-4.md`, `hito-5.md`, `hito-6.md` (consolidated per milestone instead of a single evidence.md): each mandatory check with steps, screenshots/videos, devices and participants used, results, known limitations
- [ ] 4.3 README final: public URL, prerequisites, demo walkthrough, contributions per member
- [ ] 4.4 Rehearse the class demo and defense questions (guide ready in `docs/defense.md`; rehearsal is a team activity)
- [ ] 4.5 Validate and archive this change

Evidence (2026-10-31): `docs/testing/hito-6.md`. Done: Tempo traces + httpcheck availability + game metrics + dashboard (verify-monitoring passes; screenshots), load test 10/30/50/100/150 with zero errors and exact scores (limit kept at 50), specification with validated diagrams (`docs/specification.md`), evidence, defense guide; production Compose/Caddy/release prepared and validated. Fixed during this milestone: nginx stale upstream IPs, shared per-proxy Auth rate limit (TRUST_PROXY + split allowances), CSP selection after rewrite, abandoned-room cancellation.
BLOCKED (needs team credentials/infrastructure): 1.1 Docker Hub push, 1.2–1.3 VPS + DNS + HTTPS deployment, 4.3 public URL and contributions in README, 4.5 archive — keep this change open until those are done and re-run `scripts/load-test.mjs` and `verify-monitoring.cjs` on the VPS.
