## 1. Baseline and contracts
- [x] 1.1 Validate Hito 1 images, docs, HTTP and monitoring; record independent pending items
- [x] 1.2 Define identity contracts and explicit session/CSRF/revocation policy
## 2. Backend
- [x] 2.1 Implement domain and application use cases/ports
- [x] 2.2 Add non-destructive Prisma migration and persistence adapters
- [x] 2.3 Implement password, JWT, rate limits, cookies and JWKS
- [x] 2.4 Implement independent Game verification and OpenAPI contracts
## 3. Web
- [x] 3.1 Implement register/login/profile and session-aware routing
- [x] 3.2 Preserve visual system and verify desktop/mobile accessibility/states
## 4. Acceptance
- [x] 4.1 Execute unit/integration security tests and existing regression suites
- [x] 4.2 Apply migration, build images and test real browser auth lifecycle
- [x] 4.3 Record evidence and archive using OpenSpec validation and archive workflow

Evidence: docs/testing/hito-2.md. Final verify: Auth 23, Game 21, tooling 5, Scalar HTTP 12; docs 4, existing E2E 4, real identity acceptance 10, PostgreSQL integration 6. Docker services healthy and original user preserved. Strict change validation and official archive completed; current specs and archived task completion validated separately after archive. Hito 1 operational pending items remain explicitly separate.
