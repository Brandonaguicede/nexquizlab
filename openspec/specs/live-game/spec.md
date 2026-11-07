# live-game Specification

## Purpose
Define live NexQuiz games: rooms opened from an owned quiz with a join code, an immutable snapshot, server-controlled questions and answer windows, single scored answers, reveal, persisted ranking and the authenticated Socket.IO channel with room isolation and state recovery.

## Requirements

### Requirement: Session creation and snapshot
Game SHALL expose Bearer-protected POST `/api/v1/sessions` with `{ quizId, questionSeconds? (5..120, default 20) }`. Only the quiz owner SHALL create a session; foreign or deleted quizzes SHALL return 404 and quizzes without active questions SHALL return 409. Creation SHALL copy ordered prompts, correct answers and images into immutable session questions and SHALL return `{ id, code, status: "LOBBY", title, questionCount, questionSeconds, maxParticipants }`. The join code SHALL be six characters without ambiguous symbols and unique among non-terminal sessions.
#### Scenario: Quiz edited after session creation
- GIVEN a session created from a quiz
- WHEN the owner edits, reorders, deletes questions or removes images in the quiz
- THEN the session SHALL keep its original prompts, answers, order and images.

### Requirement: Joining a room
Game SHALL expose POST `/api/v1/sessions/join` with `{ code }` (case-insensitive). An authenticated user SHALL become a participant with the display name from the access token. New participants SHALL only join sessions in LOBBY; unknown or terminal codes SHALL return 404 `ROOM_NOT_FOUND`, started sessions 409 `ROOM_STARTED`, full sessions 409 `ROOM_FULL`. A user already registered in the session SHALL receive the same participant in any non-terminal state. The host SHALL NOT join as participant.
#### Scenario: Rejoin does not duplicate
- GIVEN a participant already in a session
- WHEN they join again with the same code from another device
- THEN Game SHALL return the existing participant and the participant count SHALL not change.
#### Scenario: Participant limit
- GIVEN a session at its maxParticipants
- WHEN another user joins
- THEN Game SHALL return 409 ROOM_FULL.

### Requirement: Host control
Game SHALL expose POST `/api/v1/sessions/:id/start`, `/close`, `/next`, `/finish` and `/cancel`. Only the host SHALL execute them; other users SHALL receive 403 and no state change. Start SHALL be valid in LOBBY and open position 0. Close SHALL be valid in QUESTION_OPEN and SHALL be a no-op in QUESTION_CLOSED, so a host click racing the automatic close never fails. Next SHALL be valid in QUESTION_CLOSED and SHALL open the following question or finish the session after the last one. Invalid transitions SHALL return 409 `INVALID_STATE`.
#### Scenario: Participant tries to advance
- GIVEN a participant of a running session
- WHEN they call next or close
- THEN Game SHALL return 403 and broadcast nothing.

### Requirement: Server-controlled answer window
When a question opens, Game SHALL set a deadline of questionSeconds and close the question automatically at the deadline, including after a process restart. Participants SHALL submit POST `/api/v1/sessions/:id/answers` with `{ gameQuestionId, value: boolean }`. Game SHALL accept at most one answer per participant and question, SHALL reject answers received after the deadline, for a non-current question or outside QUESTION_OPEN with 409 `ANSWER_WINDOW_CLOSED`, SHALL return 404 for a question that does not belong to the session, and SHALL reject non-participants with 403. The answer response SHALL NOT reveal correctness, and a participant's score SHALL exclude the open question until it closes. A repeated submission SHALL return the original answer with `duplicate: true` and SHALL NOT change the score.
#### Scenario: Double submission
- GIVEN a participant answered the open question
- WHEN they submit again with any value, concurrently or later
- THEN only the first answer SHALL be stored and their score SHALL increase at most once.
#### Scenario: Late answer
- GIVEN the question deadline has passed
- WHEN an answer arrives
- THEN Game SHALL return 409 ANSWER_WINDOW_CLOSED and store nothing.

### Requirement: Reveal and scoring
Game SHALL never disclose `correctAnswer` of a question before it closes. On close it SHALL publish the correct answer and counts of true, false and missing answers, and each participant's own result. Each correct answer SHALL score 1 point; wrong or missing answers SHALL score 0. On finish Game SHALL persist each participant's score, correct count and rank (score descending, ties share rank) atomically with the FINISHED status.
#### Scenario: Ranking persisted
- GIVEN a finished session
- WHEN all containers restart
- THEN GET `/api/v1/sessions/:id/results` SHALL return the same ranking.

### Requirement: Session state and results
Game SHALL expose GET `/api/v1/sessions/:id` returning the caller's view of the current state (status, current question without answer while open, deadline, serverNow, participant count, own answer and score; the host additionally receives the participant list) and GET `/api/v1/sessions/:id/results` for host and participants of FINISHED sessions. Users unrelated to a session SHALL receive 404. Session question images SHALL be readable by the host and by participants once the question has been opened.
#### Scenario: Unrelated user
- GIVEN a user who is neither host nor participant of a session
- WHEN they request its state, results or a question image
- THEN Game SHALL return 404.
#### Scenario: Image before its question
- GIVEN a participant in a running session
- WHEN they request the image of a question that has not been opened
- THEN Game SHALL return 404.

### Requirement: Realtime channel
Game SHALL expose a Socket.IO namespace `/live` authenticated with the same RS256 access token in the handshake. Unauthenticated or expired connections SHALL be rejected. Clients SHALL subscribe with `session:subscribe { sessionId }`; Game SHALL accept only the host or participants of that session and reply with `session:state`. Game SHALL push `question:opened`, `question:closed`, `answer:result`, `answer:count`, `participant:joined`, presence events `participant:online`/`participant:offline`, `session:finished` and `session:cancelled` only to the rooms of that session, with an increasing `version`. Results SHALL reach only their owner and answer counts only the host. Clients SHALL renew authentication with `auth:renew` before token expiry. Events, payloads, authentication and recovery SHALL be documented in `docs/api/realtime.md`.
#### Scenario: Room isolation
- GIVEN two sessions running at the same time
- WHEN a question opens in one of them
- THEN only clients subscribed to that session SHALL receive it and a client SHALL NOT subscribe to a session where it is neither host nor participant.
#### Scenario: Reconnection
- GIVEN a participant loses connection during an open question
- WHEN the connection is restored
- THEN the client SHALL resubscribe, receive the current state including deadline and own answer, and its participation and score SHALL not be duplicated.

### Requirement: Web live experience
Web SHALL provide: a host page to choose an owned quiz, create a session and see the code and joined participants; host controls with countdown, answer counts, reveal and next; `/join` to enter a code; a responsive play screen showing prompt, image, countdown and two large Verdadero/Falso buttons usable on phones; reveal and personal result; and a final ranking. It SHALL show clear errors for invalid code, full or started room, lost connection (with automatic retry) and expired access.
#### Scenario: Two devices
- GIVEN a host and two participants on separate browser contexts
- WHEN the host starts and both answer
- THEN both SHALL see the same prompt and image, the reveal and the same final ranking without page reload.
