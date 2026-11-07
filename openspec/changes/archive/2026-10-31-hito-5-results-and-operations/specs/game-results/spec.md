## ADDED Requirements

### Requirement: Results history
Game SHALL expose Bearer-protected GET `/api/v1/sessions?role=host|participant&page&pageSize` (role defaults to participant) returning paginated finished sessions the caller hosted or played, with title, code, finishedAt, participant count and, for participants, their own score and rank. Sessions unrelated to the caller SHALL never appear.
#### Scenario: Participant history
- GIVEN a user who played two finished sessions
- WHEN they list role=participant
- THEN both sessions SHALL appear with their own score and rank.

### Requirement: Independent consumer
A separate application `apps/results-client` SHALL authenticate through POST `/auth/api/v1/auth/login` and read GET `/game/api/v1/sessions/:id` and `/results` using only URLs from runtime configuration. It SHALL not import source code from other apps nor access any database. It SHALL show a clear message for invalid credentials, unknown session or unreachable API.
#### Scenario: Consume a finished game
- GIVEN the demo user hosted a finished session
- WHEN the client logs in with the demo user and enters the session id
- THEN it SHALL display the ranking returned by the Game API.
