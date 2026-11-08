# Hito 3: owned quiz authoring

## Why
Authenticated teachers need persistent, private true/false question authoring through REST and Web.

## What Changes
- Add Game-owned quiz/question aggregates, atomic ordering and authenticated image storage.
- Extend Web with paginated authoring and accessible question forms.
- Preserve identity, health, observability and database isolation.

## Impact
Game-only additive migration, persistent image volume, OpenAPI and regression/acceptance tests. No rooms or games.
