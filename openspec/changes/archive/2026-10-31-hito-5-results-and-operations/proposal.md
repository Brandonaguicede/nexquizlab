## Why
The assignment requires that another project consume the Game API over the network, that a fresh clone starts with one script, and that demo data (a test user and a ready quiz) exist automatically. Hito 5 proves service autonomy and reproducibility.

## What Changes
- Results history REST for hosts and participants.
- `apps/results-client`: a small static page, configured only by URLs, that logs in through Auth and reads a session and its results from Game.
- Idempotent demo seed executed as a Compose job that uses the public Auth and Game APIs (never their databases): demo user, demo quiz with several questions and at least one image.
- `scripts/start.sh`, `scripts/start.ps1`, `scripts/stop.sh`, `scripts/stop.ps1`: generate configuration and keys inside a Node container, then start Compose from local builds or from Docker Hub images.

## Capabilities
### New Capabilities
- `game-results`: results history and the independent consumer contract.
- `demo-operations`: seed data and one-command start/stop.

## Impact
No schema changes besides optional indexes for history. Compose gains `seed` and `results-client` services. CORS origins include the client origin. Demo credentials are configured in `.env` (`DEMO_EMAIL`, `DEMO_PASSWORD`) and documented in the README as test data only. Docker Hub publication, VPS and tracing are Hito 6.
