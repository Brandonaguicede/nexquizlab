## Why
The game must be playable by the class from their own devices through a public URL, images must come from Docker Hub, every service must be observable in Grafana, and the team must deliver evidence of the mandatory checks and the specification document.

## What Changes
- Publish versioned images (`nexquiz-auth-api`, `nexquiz-game-api`, `nexquiz-web`, `nexquiz-results-client`) to Docker Hub with `scripts/release.cjs`.
- Deploy `docker-compose.prod.yml` on a VPS/Cloud host with HTTPS through Caddy, WebSocket support and persistent volumes; document the URL.
- Observability: Grafana Tempo for traces (collector traces pipeline → Tempo), game metrics (active sessions, connected sockets, answers accepted/rejected, question close latency) and a Grafana dashboard per service.
- Load test with simulated participants to set and document the maximum simultaneous participants.
- Final documentation: brief specification (scope, rules, architecture diagram, class diagram, real data model, REST and realtime docs), evidence of every mandatory check, known limitations and contributions per member.

## Capabilities
### New Capabilities
- `production-operations`: publication, deployment, observability and capacity evidence.

## Impact
No functional changes. Adds a Tempo service and datasource, OTel metrics instruments in Game, a load-test script, and documentation. Requires a Docker Hub namespace, a VPS and a domain or sslip.io/DuckDNS hostname.
