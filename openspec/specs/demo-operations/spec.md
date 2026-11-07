# demo-operations Specification

## Purpose
Define reproducible operation of NexQuiz: one-command start and stop with only Git and Docker, safe configuration generation and upgrade, and idempotent demo data loaded through the public APIs.

## Requirements

### Requirement: Demo seed
With `DEMO_SEED=true`, Auth SHALL provision the demo teacher privately at startup before accepting HTTP requests, without changing existing passwords or promoting existing student accounts. Public registration SHALL create only students and SHALL reject teacher registration. Compose SHALL run a `seed` job after both APIs are healthy. It SHALL log in the demo teacher through Auth, register demo students through the public API and create, only if absent, a quiz titled "Quiz de demostración" with at least five questions and at least one image through the Game REST API. Running it repeatedly SHALL NOT duplicate the user or the quiz. Both teacher provisioning and the seed SHALL be disabled when `DEMO_SEED=false`.
#### Scenario: Repeated start
- GIVEN a stack already seeded
- WHEN the stack is restarted
- THEN exactly one demo user and one demo quiz SHALL exist.

### Requirement: One-command start
`scripts/start.sh` (Linux/macOS/Git Bash) and `scripts/start.ps1` (Windows) SHALL require only Git, Docker and Compose. They SHALL create `.env` and JWT keys when missing by running `scripts/setup.cjs` in a pinned Node container, then run Compose with `--build` (default) or `--hub` using the Docker Hub images, wait for health and print the URLs and demo credentials. `scripts/stop.*` SHALL stop the stack keeping volumes; `--purge` SHALL be required to remove them.
#### Scenario: Clean machine
- GIVEN a fresh clone on a machine with only Git and Docker
- WHEN the user runs the start script
- THEN Web, both APIs, Grafana and the results client SHALL be reachable and the demo user SHALL log in.

### Requirement: Configuration upgrade
`scripts/setup.cjs` SHALL append keys introduced in `.env.example` to an existing `.env` with generated secrets, SHALL never modify existing values, and SHALL use one generated value per placeholder.
#### Scenario: Existing environment
- GIVEN an `.env` created by an earlier milestone
- WHEN setup runs
- THEN existing values SHALL be unchanged and DEMO_PASSWORD and other new keys SHALL be added.
