## MODIFIED Requirements
### Requirement: Milestone boundary
The foundation SHALL preserve independent applications and N-Layers. Hito 2 SHALL expose real identity lifecycle while quizzes, rooms, scoring and real-time gameplay SHALL remain unavailable.
#### Scenario: Future functionality
- GIVEN Hito 1
- WHEN a visitor views the Web application
- THEN future gameplay SHALL be identified as unavailable or conceptual.
#### Scenario: Current functionality
- GIVEN Hito 2
- WHEN a visitor opens registration, login or profile
- THEN those screens SHALL use real Auth endpoints while conceptual gameplay remains identified as future.

### Requirement: Asymmetric identity design
The private JWT key SHALL belong only to Auth API. Game API SHALL independently validate RS256 with a provisioned public key, issuer, audience and expiration.
#### Scenario: Deployment secrets
- GIVEN the deployment definition
- WHEN Game API mounts secrets
- THEN the private signing key SHALL NOT be mounted and Auth persistence SHALL NOT be consulted.
