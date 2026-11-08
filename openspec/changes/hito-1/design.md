# Design
Independent deployment is a system boundary; N-Layers is the internal dependency policy. See docs/architecture/README.md for the dependency graph and composition rules.
Health is the implemented vertical slice, with an Application port and Prisma adapter. Game models are deferred; only service metadata is migrated. Auth prepares a minimal User persistence model.
A single PostgreSQL instance has distinct owners and databases with PUBLIC connectivity revoked. Development and production Compose files are standalone definitions.
See docs/testing/README.md for blocked runtime checks and acceptance evidence.

