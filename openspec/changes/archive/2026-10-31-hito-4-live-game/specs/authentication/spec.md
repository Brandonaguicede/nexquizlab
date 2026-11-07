## ADDED Requirements

### Requirement: Display name claim
Auth access tokens SHALL include a `name` claim equal to the user's displayName (at most 100 characters). Game SHALL accept tokens without `name` and SHALL treat the claim only as a display value, never for authorization. A displayName change SHALL appear in Game after the next token is issued.
#### Scenario: Participant name
- GIVEN a user with displayName "Ana"
- WHEN they join a game session
- THEN the host and the ranking SHALL show "Ana" without Game querying Auth.
