## Why
The platform has no usable identity endpoints. Hito 2 adds independently consumable authentication and cryptographic identity verification without coupling Game to Auth persistence.

## What Changes
- Register, login, profile, rotating refresh, real session revocation and JWKS.
- RS256 access tokens and an independently verified Game identity endpoint.
- Accessible registration/login/profile screens using the existing visual system.
- Additive Auth migrations, rate limiting, integration and browser security tests.

## Capabilities
### New Capabilities
- `authentication`: identity lifecycle, session transport and independent verification.
### Modified Capabilities
- `platform-foundation`: extend the milestone boundary to real identity while preserving service isolation and excluding gameplay.

## Impact
Auth owns users/sessions/refresh-token hashes/rate buckets. Game receives only a public key. Web holds access tokens in memory and a refresh cookie inaccessible to JavaScript. No quizzes, rooms, roles, password reset, email verification, scoring, publishing or deployment are included.
