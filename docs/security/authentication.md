# Identidad y sesiones — Hito 2

## Límites de responsabilidad

Auth owns User, Session, RefreshToken and RateBucket in `nexquiz_auth`. Game only uses its public RSA key, issuer, audience and key ID. Game has no Auth repository, Prisma client, database connection or private key. Existing health slices and four-layer import rules remain intact.

- Domain: Email, identity validation, profile types and IdentityError.
- Application: Authentication register/login/profile/refresh/logout use cases and persistence, password, token, random-secret and traffic contracts. No framework imports.
- Infrastructure: Prisma adapters, atomic session rotation, scrypt, RS256 and local key providers.
- Presentation: validated DTOs, guards, HTTP transport, cookies, OpenAPI and sanitized errors. Controllers never query Prisma.

## Contrato público

All paths below follow `/api/v1`; the proxy adds `/auth` or `/game`. Direct API consumers do not need Web. Read `/auth/openapi.json`, `/game/openapi.json` and local Scalar at `/auth/docs`, `/game/docs`.

| Service | Method/path | Success | Requirement |
| --- | --- | --- | --- |
| Auth | POST `/auth/register` | 201 session + user | JSON email, password, displayName; X-NexQuiz-CSRF:1 |
| Auth | POST `/auth/login` | 200 session + user | JSON email/password; X-NexQuiz-CSRF:1 |
| Auth | GET `/auth/profile` | 200 public profile | Bearer access token and active persisted session |
| Auth | POST `/auth/refresh` | 200 rotated session + user | Refresh cookie and X-NexQuiz-CSRF:1 |
| Auth | POST `/auth/logout` | 204 | Current refresh cookie and X-NexQuiz-CSRF:1; missing cookie is idempotent |
| Auth | GET `/.well-known/jwks.json` | 200 public key set | Public |
| Game | GET `/identity` | 200 userId/sessionId | Bearer access token |

Session JSON is `{user:{id,email,displayName,createdAt},accessToken,tokenType:"Bearer",expiresIn:300}`. Refresh secrets and password hashes never appear in JSON. Clients outside the browser must retain the Set-Cookie value in a secure cookie jar and send it on refresh/logout; bearer-only logout does not revoke a cookie session. Mutations require the documented custom header even when Origin is absent. Error responses have statusCode and sanitized details; authentication domain errors use stable code/message fields. Codes: 400 invalid input, 401 unauthorized, 403 CSRF/Origin, 409 duplicate email, 429 throttled with Retry-After, 503 password capacity exhausted, 500 generic failure.

## Passwords and identity

Email is trimmed/lowercased. PostgreSQL enforces both the existing unique constraint and a case-insensitive unique expression index, including concurrent registration. Existing conflicting legacy rows cause migration to fail safely rather than merge or delete records. Existing passwordHash-null users remain untouched and cannot use password login until a separately authorized enrollment/reset flow exists.

Passwords have 12–128 characters, allow Unicode and spaces, are never trimmed or truncated, and cannot be whitespace-only. scrypt uses Node crypto/OpenSSL, N=32768,r=8,p=3, random 16-byte salts and 64-byte derived keys. Its work factors follow an [OWASP scrypt minimum configuration](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt). This alternative avoids native Argon2 addon installation differences between Windows and Linux. Hash comparisons use timingSafeEqual. Missing/unsupported hashes still perform dummy derivation and return the same 401 as a wrong password. At most four derivations run per Auth process; additional work returns 503. Bodies are limited to 16 KB through Nest's Express adapter.

## Access, refresh, expiry and revocation

Access uses jsonwebtoken **9.0.3** (types **9.0.10**), pinned in manifests and pnpm lockfile. RS256 only; no symmetric fallback. Both APIs require configured issuer/audience, known kid, `typ=at+jwt`, signature, UUID subject/session, jti and integer iat/exp. Lifetime is at most **300 seconds**; future issuance and missing expiry are rejected. Tokens contain no email/password.

Refresh secrets contain 256 random bits; only SHA-256 digests are persisted. A session expires absolutely after seven days. Refresh does not extend that expiry. Rotation locks the Session row and consumes the previous digest inside one PostgreSQL transaction. Reuse revokes that family; the transaction commits the revocation before reporting 401. Logout revokes the family, including historical credentials, and clears the cookie. Auth profile consults persisted session state and rejects a revoked/expired session immediately.

**Game verifies access offline. Logout/replay do not instantly invalidate an already issued Game JWT. Its remaining lifetime is bounded by 300 seconds.** Immediate revocation across independent services would require a separate revocation/introspection contract and is not claimed here. Each device login has its own session; this logout affects the current family, not all devices.

The client rotates around 30 seconds before access expiry and restores a session on reload. Refresh has one in-flight promise per page and uses Web Locks across same-origin tabs where available. Logout is broadcast to other tabs; late refresh responses cannot resurrect the local profile after logout. A lost refresh response can require re-login; the client never blindly retries rotation. Browsers without Web Locks may conservatively revoke a family after concurrent rotation, requiring login again.

## Browser security

Access tokens exist only in React memory. No localStorage/sessionStorage password or token persistence. Refresh cookies are HttpOnly, SameSite=Strict, Path=/; production additionally sets Secure and the `__Host-nexquiz_refresh` name without Domain. Local HTTP uses `nexquiz_refresh`. The APIs remain usable with cookie-aware external REST clients.

All mutating session endpoints require X-NexQuiz-CSRF:1 and reject non-allowlisted Origin before persistence or hashing. Exact credentialed CORS and SameSite are additional defenses; [OWASP describes custom-header protection for AJAX APIs](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#employing-custom-request-headers-for-ajaxapi). Same-site Web/API or the supplied proxy is required. No wildcard credentialed CORS or SameSite=None relaxation.

HttpOnly reduces refresh-token extraction but XSS can still act as an authenticated user. React escapes user names; no innerHTML is used. Web retains its self-only script CSP. Scalar's local, versioned renderer keeps its existing separate CSP. Identity responses and errors are no-store. No tokens, passwords or key material are intentionally logged. Playwright authentication traces are disabled because traces can retain credentials; screenshot evidence contains synthetic test profiles only.

## Throttling, deployment and operations

PostgreSQL fixed 15-minute buckets enforce per-source allowances (originally 100 session mutations; since Hito 6, 300 credential attempts and 3000 renewals, see below) and 8 logins per normalized email, including successful logins. Buckets are shared across Auth replicas and stored under SHA-256 keys. Success does not reset a bucket. Retry-After reports time to the next window. Known-email lockout and duplicate-registration enumeration are explicit trade-offs. The socket IP is used unless `TRUST_PROXY` explicitly lists proxy networks; arbitrary X-Forwarded-For is never trusted. **Hito 6 update:** behind the supplied proxy every user shared the proxy address, so a class of 50 refreshing every 270 s (about 170 renewals per 15 min) would exhaust the shared 100-request allowance mid-game. Compose now sets `TRUST_PROXY=uniquelocal` (only nginx/Caddy on the private Compose network; the API port is not public in production) and nginx forwards X-Forwarded-For. Allowances are split per source: credential attempts (register/login) 300 per window (`AUTH_SOURCE_LIMIT`) and session renewal/logout 3000 per window (`AUTH_RENEWAL_SOURCE_LIMIT`), because renewal requires a 32-byte secret and a classroom usually shares one NAT address. The 8-attempt per-email login limit is unchanged.

Use the provisioned public key file for Game and private key exclusively for Auth. JWKS publishes n/e/kid/use/alg only. Rotation is explicit: provision a new matching key pair/kid to both services, restart, and require re-login; multi-key overlap/hot JWKS discovery is outside this milestone. Never overwrite keys casually or log their contents. HTTPS production requires real deployment settings; this local validation does not claim public TLS deployment.

Apply the additive Auth migration with migrate deploy before recreating APIs. Do not reset databases. No Game migration is needed. Keep used refresh digests until their session has expired so replay remains detectable. Rate buckets are inactive after expiresAt; they and expired session families need a separately scheduled retention policy at production scale. No automatic deletion was introduced or executed in this work.

Sources: [JWT best practices, RFC 8725](https://www.rfc-editor.org/rfc/rfc8725.html), [jsonwebtoken verification options](https://github.com/auth0/node-jsonwebtoken#jwtverifytoken-secretorpublickey-options-callback).
