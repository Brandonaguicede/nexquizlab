# authentication Specification

## Purpose
Define the real identity lifecycle, secure session transport and independent RS256 verification for NexQuiz Hito 2, preserving private persistence and four-layer boundaries.

## Requirements

### Requirement: Registration and login
Auth SHALL expose POST `/api/v1/auth/register` (201) and POST `/api/v1/auth/login` (200) with validated JSON email/password; registration also requires displayName. Responses SHALL contain user {id,email,displayName,createdAt}, accessToken, tokenType=Bearer and expiresIn=300. Passwords SHALL be securely hashed and never returned; normalized duplicate email SHALL return 409. Invalid input SHALL return 400, invalid credentials 401, exhausted rate buckets 429 with Retry-After, and unexpected failures a generic 500.
#### Scenario: Duplicate race
- GIVEN two registrations with the same normalized email
- WHEN they execute concurrently
- THEN exactly one user SHALL be stored and the other request SHALL receive 409.
#### Scenario: Invalid credentials
- GIVEN an unknown email or incorrect password
- WHEN login executes
- THEN the response SHALL be the same generic 401 and password work SHALL be bounded.

### Requirement: Session transport and renewal
Auth SHALL set an HttpOnly Strict refresh cookie on register/login, require X-NexQuiz-CSRF:1 on mutating auth requests and reject untrusted Origin. POST `/api/v1/auth/refresh` SHALL rotate a valid refresh credential and return the same token/user response. Refresh SHALL expire absolutely after seven days and reuse SHALL revoke its session. Responses containing identity SHALL use Cache-Control:no-store.
#### Scenario: CSRF
- GIVEN a missing custom header or an untrusted Origin
- WHEN registration, login, refresh or logout is submitted
- THEN the request SHALL fail with 403 before session mutation.
#### Scenario: Refresh replay
- GIVEN an already consumed refresh credential
- WHEN it is presented again
- THEN its session SHALL be revoked and subsequent refresh/profile SHALL fail with 401.

### Requirement: Profile and logout
GET `/api/v1/auth/profile` SHALL require a valid access token and active persisted session. POST `/api/v1/auth/logout` SHALL revoke the refresh session and clear the cookie, returning 204 idempotently. A revoked session SHALL not renew. Already issued Game access tokens SHALL expire within 300 seconds; logout SHALL explicitly document that bound.
#### Scenario: Revoked profile
- GIVEN a logged-out session and its previously issued JWT
- WHEN Auth profile is requested
- THEN Auth SHALL return 401.

### Requirement: Independent verification
Game SHALL expose protected GET `/api/v1/identity` returning {userId,sessionId}. It SHALL validate only RS256, known key ID, issuer, audience, signature, exp, iat and required subject/session claims using a provisioned public key. Auth SHALL publish public-only JWKS at GET `/api/v1/.well-known/jwks.json`. Neither Game nor Web SHALL receive a private signing key or Auth DB access.
#### Scenario: Rejected tokens
- GIVEN a tampered, expired, wrong-audience, wrong-issuer, unknown-key or unsigned JWT
- WHEN a protected endpoint is requested
- THEN the request SHALL receive 401.

### Requirement: Web authentication
Web SHALL provide `/register`, `/login`, `/profile`, public navigation, protected route redirects, responsive labeled forms, pending and error states and real logout. It SHALL never persist passwords or access tokens in browser storage. A valid refresh cookie SHALL restore profile after reload. Failed renewal SHALL return the visitor to login without displaying protected data.
#### Scenario: Browser lifecycle
- GIVEN a new visitor
- WHEN they register, reload the profile and log out
- THEN profile SHALL persist through safe refresh and protected routes SHALL require login after logout.

### Requirement: Display name claim
Auth access tokens SHALL include a `name` claim equal to the user's displayName (at most 100 characters). Game SHALL accept tokens without `name` and SHALL treat the claim only as a display value, never for authorization. A displayName change SHALL appear in Game after the next token is issued.
#### Scenario: Participant name
- GIVEN a user with displayName "Ana"
- WHEN they join a game session
- THEN the host and the ranking SHALL show "Ana" without Game querying Auth.
