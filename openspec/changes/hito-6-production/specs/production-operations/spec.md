## ADDED Requirements

### Requirement: Published images
Team images SHALL be published to Docker Hub with an immutable version tag for the VPS platform. `docker-compose.prod.yml` SHALL start the full stack from those images without local builds.
#### Scenario: Start from Docker Hub
- GIVEN a host with Docker and the repository configuration
- WHEN the start script runs with `--hub`
- THEN all team services SHALL be pulled from Docker Hub and become healthy.

### Requirement: Public deployment
The solution SHALL run on a VPS or Cloud host behind HTTPS with WebSocket support at a documented URL. Data and images SHALL use persistent volumes and secrets SHALL stay out of the repository.
#### Scenario: Restart on server
- GIVEN a finished game on the public deployment
- WHEN the containers are restarted
- THEN profiles, quizzes, images and results SHALL remain available.

### Requirement: Observability
Auth, Game and Web SHALL be monitored through OpenTelemetry and Grafana: HTTP metrics and traces for both APIs (traces stored in Tempo), game metrics for active sessions, connected sockets and accepted/rejected answers, and web proxy availability. Dashboards SHALL be provisioned automatically.
#### Scenario: Trace a request
- GIVEN an answer submitted during a game
- WHEN an operator opens Grafana
- THEN the request SHALL appear as a trace and in the answers metric.

### Requirement: Capacity evidence
The team SHALL run a load test with simulated participants over the realtime channel, record latency and errors, and set `GAME_MAX_PARTICIPANTS` to the tested value. The tested maximum and the real classroom participant count SHALL be documented.
#### Scenario: Limit enforced
- GIVEN GAME_MAX_PARTICIPANTS set to the tested value
- WHEN one more simulated participant joins a full room
- THEN Game SHALL reject it with ROOM_FULL and the existing participants SHALL keep playing.
