## ADDED Requirements
### Requirement: Owned quiz administration
Game SHALL expose Bearer-protected `/api/v1/quizzes` GET/POST and `/:id` GET/PATCH/DELETE. JWT subject SHALL be the owner; client owner fields SHALL be rejected. Title SHALL be trimmed, nonempty and at most 160 characters; optional description SHALL be at most 2000 characters. List SHALL accept page >=1 and pageSize 1..50 (default 10), return items,total,page,pageSize and questionCount, sorted by updatedAt descending then id. Responses SHALL include UUID identifiers and timestamps. Missing/foreign/deleted resources SHALL return the same 404. Delete SHALL be idempotent for an owned tombstone and soft-delete quiz and its questions, preserving future historical references.
#### Scenario: Two owners
- GIVEN two authenticated users
- WHEN one lists or accesses the other's quiz or questions
- THEN the list SHALL exclude foreign quizzes and individual operations SHALL return 404 without mutation.
### Requirement: Question invariants
Game SHALL expose POST `/:id/questions`, PATCH/DELETE `/:id/questions/:questionId` and PATCH `/:id/questions/reorder`. Questions SHALL have nonempty trimmed prompt <=2000, boolean correctAnswer, contiguous zero-based positions and timestamps. Reorder SHALL accept questionIds containing every current question exactly once, <=200 entries. Mutations SHALL lock the parent and enforce database uniqueness (quizId,position). Each quiz SHALL support at most 200 active questions. Invalid or stale order SHALL return 409; invalid values SHALL return 400. Deleted questions SHALL be tombstoned with null positions.
#### Scenario: Concurrent append and reorder
- GIVEN simultaneous mutations on one quiz
- WHEN the transactions commit
- THEN active questions SHALL retain unique contiguous positions and reorder SHALL never lose questions.
### Requirement: Safe persistent images
Game SHALL expose POST/DELETE `/:id/questions/:questionId/image` and authenticated GET `/api/v1/images/:id`. Multipart field SHALL be `file`, one JPEG/PNG/WebP <=5242880 bytes. Decoder SHALL validate actual content, reject animation and images exceeding 16 megapixels, and re-encode to WebP stripping metadata. IDs SHALL be server-generated UUIDs; paths SHALL never derive from client names. Reads SHALL stream only active owned images with private no-store headers. Relative URLs SHALL work through the proxy or independent API without localhost/Windows paths. Durable asset records SHALL precede file writes; failed uploads, replaced and detached assets SHALL be recoverably cleaned without removing active files. Storage SHALL implement an application port, with persistent Docker volume and bounded disk upload buffers.
#### Scenario: Invalid image
- GIVEN a spoofed MIME, malformed bytes or oversized file
- WHEN uploaded
- THEN Game SHALL return 400 or 413, leave the existing question image intact and remove temporary files.
#### Scenario: Storage failure
- GIVEN an interrupted upload or cleanup failure
- WHEN recovery executes
- THEN unreferenced assets SHALL be retried and referenced assets SHALL remain readable.
### Requirement: Authoring interface and future snapshots
Web SHALL implement `/quizzes` and `/quizzes/:id`, real paginated lists, quiz CRUD, question CRUD/reorder and authenticated image upload/preview/replacement/removal, with labeled responsive forms, confirmation before deletion, loading/error/empty/success states and no production mocks. Future games SHALL use immutable question snapshots, never mutable authoring rows; this hito SHALL document the snapshot schema and preserve deleted source rows, without implementing rooms or games.
#### Scenario: Browser authoring lifecycle
- GIVEN an authenticated teacher on desktop or mobile
- WHEN they create and edit a quiz, order questions and manage images
- THEN reload SHALL preserve data and images and foreign users SHALL not access the resources.
