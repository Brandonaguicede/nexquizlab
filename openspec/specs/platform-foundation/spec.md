# NexQuiz platform foundation
## Purpose
Establish independent deployment, explicit N-Layers boundaries and repeatable operations for Hito 1.

## Requirements

### Requirement: Independent applications
NexQuiz SHALL expose Web, Auth API and Game API as separately buildable applications.
#### Scenario: External REST consumer
- GIVEN an external application
- WHEN it requests an API OpenAPI document
- THEN that API SHALL publish its contract without requiring the Web application.

### Requirement: Layer isolation
Domain SHALL be framework independent; Application SHALL depend only on Domain and its own contracts.
#### Scenario: Architecture check
- GIVEN repository source imports
- WHEN architecture validation executes
- THEN forbidden layer imports and import cycles SHALL fail the check.

### Requirement: Database isolation
Each API SHALL own its PostgreSQL database, role, Prisma client and migrations.
#### Scenario: Cross-database connection
- GIVEN Game API database credentials
- WHEN a client connects to nexquiz_auth
- THEN PostgreSQL SHALL deny connection.

### Requirement: Operational readiness
APIs SHALL expose separate process liveness and database readiness endpoints.
#### Scenario: Database outage
- GIVEN an unavailable PostgreSQL database
- WHEN readiness is requested
- THEN the API SHALL return HTTP 503 while process liveness remains HTTP 200.

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
