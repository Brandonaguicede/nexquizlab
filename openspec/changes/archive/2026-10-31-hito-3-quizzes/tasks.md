## 1. Contracts and persistence
- [x] 1.1 Validate contracts before implementation
- [x] 1.2 Add Game migration and repository with owner checks and atomic ordering
## 2. API and images
- [x] 2.1 Implement domain, application and authenticated REST controllers
- [x] 2.2 Implement bounded image decoding/storage and recoverable cleanup
## 3. Web
- [x] 3.1 Implement paginated quiz list and accessible editors
## 4. Acceptance
- [x] 4.1 Test ownership, concurrency, images and browser lifecycle
- [x] 4.2 Run regression, Docker and final code audit; record evidence
- [x] 4.3 Archive validated specification

Evidence: docs/testing/hito-3.md, revalidated 2026-10-31. Auth 23, Game 44, tooling 5, Scalar HTTP 12; PostgreSQL 6; quizzes API 7 + desktop 2 + mobile 2; regression E2E 4, docs 4, identity 10. Compose storage path fixed and Game recreated healthy. Prisma generation validated in isolated ignored directories because active local development servers lock the normal DLLs; remaining verify stages passed separately. LAN and external deployment remain outside this closure.

