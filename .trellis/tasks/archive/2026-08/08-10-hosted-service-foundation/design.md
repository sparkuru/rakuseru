# Technical design

## Architecture and package boundaries

```text
Browser
  │ same-origin cookie + CSRF
  ▼
web/reverse proxy ──────────────► existing frontend build
  │ /api/*
  ▼
apps/api (Elysia + Node adapter)
  ├─ transport: schemas, cookies, error mapping, OpenAPI
  ├─ application: auth, invitation, membership, credential services
  ├─ policy: authenticated principal + workspace capability resolution
  ├─ infrastructure: Kysely repositories, crypto, audit/log adapters
  └─ MariaDB

packages/document-contract
  └─ portable schemas, types, parse/validation helpers
       ▲                         ▲
       └─ existing React app     └─ future hosted sheet service
```

Use npm workspaces with the existing root frontend as one workspace consumer,
`apps/api` as the server package, and `packages/document-contract` as a strict
browser-neutral package. Root `dev`, `lint`, `typecheck`, `test`, and `build`
remain valid; aggregate checks add explicit API/contract steps without hiding
package failures. Do not introduce Turborepo or another build orchestrator.

Server modules depend inward: transport -> application/policy -> domain ports;
Kysely, Node crypto, cookies, and logging implement ports at the infrastructure
edge. Route handlers do not issue SQL. Repositories do not decide authorization.
The API exports a testable application factory; the listen entrypoint only
loads validated config and starts the process.

## Proposed layout

```text
apps/api/
  src/
    app.ts                 application factory and plugins
    server.ts              config, migration gate, listen, shutdown
    config/                environment parsing and redacted diagnostics
    http/                  error/request/session/CSRF plugins
    modules/
      auth/                password, session, bootstrap
      workspaces/          membership, invitations, policy
      credentials/         create/auth/reveal/rotate/revoke
      audit/               immutable audit port and service
    db/
      database.ts          Kysely types and lifecycle
      migrations/          ordered forward migrations
      repositories/        infrastructure implementations
    observability/         structured logger and redaction
  test/
    unit/
    integration/
  Dockerfile
  package.json
  tsconfig.json
packages/document-contract/
  src/                     schema, types, parse helpers
  test/                    current-format compatibility fixtures
  package.json
compose.yaml
Dockerfile.web
docker/web.conf
.env.example
docs/self-hosting.md
```

## Configuration and lifecycle

Parse environment once before opening a listener. Production requires database
connection fields, a canonical public origin, cookie security settings, a
base64-encoded 32-byte credential encryption key, its positive integer key
version, and bootstrap inputs only when the explicit bootstrap command runs.
Reject missing, malformed, default-example, or contradictory production values.
Expose only redacted config summaries.

Startup order is: validate config -> connect MariaDB -> acquire migration lock
and run pending migrations -> verify migration state -> start listener. Liveness
means the process event loop responds. Readiness means configuration is valid,
MariaDB answers a bounded probe, and migrations equal the application target.
Handle SIGTERM/SIGINT by refusing new work, closing the HTTP listener, draining
the Kysely pool, and exiting within the container grace period.

## Database model

Use InnoDB, `utf8mb4`, opaque UUID strings in `CHAR(36)` columns, and
`DATETIME(3)` UTC values created through one clock abstraction. Avoid database
enum coupling; constrain stable role/status strings in migrations and mirror
them in TypeScript. All unique constraints and foreign-key delete behavior are
explicit.

| Table | Key fields and constraints |
| --- | --- |
| `users` | `id`; normalized `email` unique; `password_hash`; `enabled`; timestamps. |
| `sessions` | `id`; unique `token_digest BINARY(32)`; `csrf_digest BINARY(32)`; `user_id`; issued/last-seen/expires/revoked timestamps; optional safe client metadata. |
| `workspaces` | `id`; `name`; created/updated timestamps. Ownership is represented by membership, not a second drifting owner column. |
| `workspace_members` | composite unique `(workspace_id,user_id)`; role `owner|administrator|member`; active state; creator and timestamps. At least one active owner is enforced in the transactional service because cross-row final-owner constraints are not portable DDL. |
| `invitations` | `id`; workspace and normalized email; requested role; unique token digest; creator; expiry/accepted/revoked timestamps. Invite creation locks the workspace, revokes an older usable invite for the same email, then creates one replacement. |
| `api_credentials` | `id`; user/workspace; name; scope encoding; secret digest; ciphertext/IV/tag; key and secret versions; expiry/revoked/last-used timestamps; unique digest. |
| `audit_events` | monotonic event ID plus opaque public ID; workspace nullable only for instance-level authentication/initialization events before a workspace is resolved; actor/action/target/request fields; UTC timestamp; validated small JSON details. No update/delete repository method. |

MariaDB's JSON alias is used for `audit_events.details` and a small canonical
`api_credentials.scopes` array; IDs and searchable attributes remain
relational. Scope values are sorted, unique, allow-listed, and parsed through a
strict schema whenever loaded. Migrations never import application services.

## Transactions and invariants

- Bootstrap transaction: lock bootstrap state, require zero users/workspaces,
  create the hashed user, workspace, owner membership, and audit event. If the
  same completed identity is requested again, report already initialized; any
  conflicting request fails without mutation.
- Invitation acceptance: lock invitation and membership lookup, verify token,
  expiry/revocation/email/session rules, create or reuse the user, create or
  reactivate membership, mark accepted, and audit atomically.
- Role/remove operation: lock target membership plus active owner set; reject
  any transition that would leave zero active owners; update and audit together.
- Credential create/rotate/revoke: write credential state and audit event in one
  transaction. Rotation increments `secret_version`; after commit only the new
  secret authenticates.
- Audit failure aborts its security-sensitive mutation. Sign-in failures and
  rejected bearer authentication use a bounded best-effort event path because
  there is no successful domain transaction to roll back.

## Authentication and CSRF

Passwords use the pinned Argon2id package and store its PHC string. Keep hashing
parameters behind a password-hasher adapter so upgrades can use `needsRehash`
without changing routes. Enforce length bounds before invoking native hashing.

Generate session and CSRF tokens from cryptographically strong random bytes.
Persist only SHA-256 digests and compare fixed-length buffers in constant time.
The browser receives an opaque session cookie and the CSRF token in the
successful sign-in/session response. `GET /api/app/session` is safe and lets a
reloaded same-origin client recover the CSRF value. Every cookie-authenticated
non-safe method must pass both canonical-origin validation and
`X-Rakuseru-CSRF`; bearer requests do not use cookie CSRF.

Session cookies use `Path=/`, `HttpOnly`, `SameSite=Lax`, and production
`Secure`. Sign-out revokes the row before clearing the cookie. Authentication
always rechecks user enabled state and relevant active membership rather than
trusting claims embedded in the opaque token.

## Invitation flow

The API does not send email. Owner/administrator creation returns a copyable
link containing the raw invitation token exactly once. The database retains
only its digest. An unauthenticated preview returns minimal workspace name and
masked invited email. Acceptance rules are:

1. new email: token plus a new password creates the local account;
2. existing email: caller must first sign in as that email, then accept;
3. any email mismatch, expired/revoked/used token, or existing active membership
   fails without revealing unrelated account state.

Administrator-created invitations are limited to `member`. Only an owner may
invite/promote an administrator or owner. No operation can remove/demote the
last active owner.

## Policy contract

Authentication produces a discriminated principal:

```ts
type AuthenticatedPrincipal =
  | { kind: 'session'; userId: string; sessionId: string }
  | {
      kind: 'credential'
      userId: string
      credentialId: string
      workspaceId: string
      scopes: readonly CredentialScope[]
    }
```

`resolveWorkspaceAccess(principal, workspaceId)` returns active role and
capabilities such as `workspace:read`, `members:read`, `members:manage`,
`credentials:self`, never a generic allow-all flag. A bearer principal first
passes credential state/scope and then the same active-user/membership policy.
The downstream resource authorization input includes workspace role but defines
`implicitResourcePermission: 'none'` for administrators and members. Child 2
must combine that context with explicit sheet grants; it cannot infer access
from administrator status.

## Credential envelope

Use a token format with a non-secret credential identifier plus a high-entropy
secret so lookup does not scan every row. Persist SHA-256 of the full canonical
token for verification. Encrypt the full token with AES-256-GCM using:

- a deployment-provided 32-byte key selected by `key_version`;
- a fresh 12-byte random IV for every encryption;
- a 16-byte authentication tag;
- stable AAD containing credential ID, user ID, workspace ID, and secret version.

Reveal decrypts only after cookie session, CSRF, enabled-user, owner-of-
credential, active-membership, and non-revoked checks. Any tag/AAD/key mismatch
is an internal integrity failure, not partial plaintext. Rotation replaces the
digest and envelope and increments the version. The initial release accepts one
active instance key for new writes and can read explicitly configured older
versions only if implemented and documented; it does not pretend database-only
key rotation is possible.

Initial credential scopes are registered centrally and default-deny. This child
can prove extraction and policy with a harmless foundation scope such as
`workspace:metadata:read`; child 2 adds resource-read scopes through the same
registry. Unknown stored/requested scopes fail closed.

## HTTP surface

The OpenAPI contract owns these routes:

```text
GET  /health/live
GET  /health/ready
GET  /openapi
POST /api/app/auth/sign-in
POST /api/app/auth/sign-out
GET  /api/app/session
GET  /api/app/workspaces
GET  /api/app/workspaces/:workspaceId/members
PATCH /api/app/workspaces/:workspaceId/members/:userId
DELETE /api/app/workspaces/:workspaceId/members/:userId
GET  /api/app/workspaces/:workspaceId/invitations
POST /api/app/workspaces/:workspaceId/invitations
DELETE /api/app/workspaces/:workspaceId/invitations/:invitationId
POST /api/app/invitations/preview
POST /api/app/invitations/accept
GET  /api/app/workspaces/:workspaceId/credentials
POST /api/app/workspaces/:workspaceId/credentials
POST /api/app/workspaces/:workspaceId/credentials/:credentialId/reveal
POST /api/app/workspaces/:workspaceId/credentials/:credentialId/rotate
POST /api/app/workspaces/:workspaceId/credentials/:credentialId/revoke
```

Every route declares request and response schemas. Domain errors map through
one registry to stable HTTP status/code/message values. Unexpected errors log
the request ID and return a generic `internal_error`. The OpenAPI route is
available through the reverse proxy; production UI exposure may be configurable
but the machine-readable spec remains testable.

## Audit and logging

Audit actions are allow-listed constants. A detail schema per action accepts
IDs, roles, scope names, safe reason codes, and state transitions only. It never
accepts arbitrary request bodies or headers. Credential reveal records who,
which credential, workspace, time, and request ID—not the secret.

The structured logger redacts known header/cookie/token/password/crypto fields
recursively and logs request start/completion, status, duration, request ID,
route template, and authenticated actor IDs when known. Integration tests send
sentinel secrets and assert they do not occur in captured log or audit output.

## Compose and operator boundary

`Dockerfile.web` builds the current frontend and serves it through a small
reverse proxy that forwards `/api/`, `/health/`, and `/openapi` to `api`. The API
Dockerfile builds/runs Node 22 with production dependencies, including a tested
Argon2 native binding. MariaDB uses an exact image tag and a named volume. Only
the web port binds the host; API and database use `expose`/the internal network.

Compose health dependencies do not replace application readiness. A one-shot
migration/bootstrap command is explicit and repeatable. Secrets are supplied by
environment/secret files, never committed defaults. `.env.example` contains
names and generation instructions only.

`docs/self-hosting.md` includes setup, proxy/TLS trust boundary, bootstrap,
upgrade, dump, restore, verification, encryption-key custody, migration
rollback limits, and clean shutdown. Restore verification signs in, lists the
workspace, authenticates/reveals a credential with the restored key, and checks
audit continuity.

## Test strategy

- Contract unit tests: portable JSON fixtures, route schemas, error registry,
  policy matrix, config validation, crypto tamper/AAD/version cases, redaction.
- API tests against the app factory: cookie attributes, CSRF/origin, request IDs,
  invitation state machine, stable errors/OpenAPI.
- MariaDB integration tests: zero migration, idempotent rerun, bootstrap,
  transaction rollback, uniqueness, final-owner race, workspace isolation,
  session/credential lifecycle, immutable audit repository.
- Container smoke: root and API checks in Docker, production image boot,
  Compose health/readiness, only one published port, migration failure gate.
- Backup/restore rehearsal: restore dump plus instance key into a fresh named
  environment and run the documented verification path.

## Rollback

The changes are additive to the repository and never touch IndexedDB. Before a
production migration, stop writes and create/verify a MariaDB dump plus separate
instance-key backup. For a reversible development migration, use its documented
down path; otherwise restore the pre-upgrade database with the matching key and
run the previous images. Removing the hosted containers leaves local browser
libraries untouched.

## Design risks

- Native Argon2 packaging may differ by architecture: build and smoke in the
  exact image rather than relying on host installs.
- Concurrent last-owner mutations require locks and transaction tests; a simple
  pre-read check is insufficient.
- Re-displayable credentials turn key custody into a critical operator duty.
- Login rate limiting is deferred. The route/service boundary must permit a
  future limiter, and deployment guidance requires a trusted TLS proxy and
  network controls for untrusted exposure.
