## Context
Keep four layers. Controllers depend on application use cases and ports; modules compose Prisma/security adapters. Existing User rows and nullable passwordHash remain valid. Game never imports Auth code or its Prisma client.

## Decisions
- Use maintained JWT tooling with RS256 only, pinned key ID, issuer, audience, exp, iat, subject and session ID; 300-second access lifetime. Game checks signatures offline with its provisioned public key. Publish only a public RSA JWK at `/api/v1/.well-known/jwks.json`; key rotation is an explicit coordinated provisioning operation.
- Passwords: Node scrypt (N=32768,r=8,p=3,64-byte key,16-byte random salt,maxmem=64MiB), an OWASP-supported alternative avoiding native addon portability issues. Password length 12–128 characters; no trimming or forced composition; reject whitespace-only passwords. Email trimmed/lowercased; name trimmed, 1–100 chars.
- Access bearer stored only in React memory. Refresh is 32 random bytes, SHA-256-only in Auth DB; cookie HttpOnly, SameSite=Strict, Path=/, Secure and __Host- prefix in production. Local HTTP uses a distinct non-Secure development name. Exact-origin credentialed CORS; require X-NexQuiz-CSRF:1 for every mutating identity request and reject untrusted Origin. Never trust browser-supplied forwarding headers for rate identity.
- Session absolute lifetime seven days; refresh rotates atomically, retains used hashes, and revokes the family on reuse. Refresh does not extend absolute expiry. Auth profile checks live session state. Logout revokes the session and clears the cookie. Already issued Game tokens remain valid for at most 300 seconds: no fictitious immediate global JWT revocation. No automatic retry of refresh after uncertain network failure; browser serializes refresh calls; replay may require re-login.
- Rate limiting persisted in Auth DB, applied before password hashing: credential requests per IP and login per normalized email within fixed 15-minute buckets. Refresh also limited per source. Bound request body and concurrent password work. Never log credentials/tokens.
- Additive migrations only; no Game schema changes. Do not archive until acceptance tests pass; preserve Hito 1 operational limitations separately.

## Risks / Trade-offs
Public registration returns 409 for duplicate email (account enumeration trade-off required for clear duplicate handling); login returns one generic 401. Cross-site origins require a same-site deployment/proxy; no SameSite=None relaxation. XSS can act as the user while active despite HttpOnly. Offline Game verification trades immediate revocation for service independence. Email delivery, password reset and multi-factor auth are outside scope.

## Migration Plan
Apply Auth migration via migrate deploy, build APIs/Web, recreate only NexQuiz services, keep databases/volumes, run real security/browser tests, then archive with OpenSpec CLI. Backup/restore remains a separately tracked Hito 1 operational task.
