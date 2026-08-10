# Backend Development Guidelines

Rakuseru has an optional self-hosted foundation in `apps/api` beside the
browser-local editor. The hosted service owns identity, workspaces,
memberships, invitations, credentials, and audit events. It does not read,
migrate, upload, or delete `SheetDocument` records from browser IndexedDB.

## Scenario: Extend the hosted service foundation

### 1. Scope / Trigger

- Trigger: work adds an HTTP route, identity/workspace policy, MariaDB state,
  operator configuration, or a server consumer of the document contract.
- Local editor/import/export work remains frontend-only unless its task
  explicitly opts into hosted behavior.

### 2. Signatures

```text
package: @rakuseru/api
business namespace: /api/app/**
health: GET /health/live, GET /health/ready
contract: GET /openapi, GET /openapi/json
commands: npm run migrate | npm run bootstrap --workspace @rakuseru/api
portable document package: @rakuseru/document-contract
```

Do not register `/api/v1/**` until the hosted-resource task defines its bearer
contract.

### 3. Contracts

- Browser mutations use the opaque session cookie, exact `PUBLIC_ORIGIN`, the
  non-HttpOnly CSRF recovery cookie, and `X-Rakuseru-CSRF`.
- `AuthenticatedPrincipal` is either a session or a workspace-bound
  credential. Workspace policy is resolved from current user and membership
  rows; administrator access never implies resource access.
- Workspace administration, invitation, membership, and credential-management
  services require a session principal. Bearer principals may enter downstream
  resource services only after credential authentication and must remain bound
  to their credential workspace and required scope.
- Production config requires database fields, a canonical HTTPS origin, and a
  base64 32-byte credential key plus positive key version. Example and zero
  values are rejected.
- Compose publishes only the web reverse proxy. API and MariaDB stay on the
  internal service network.

### 4. Validation & Error Matrix

- Missing/placeholder production config -> startup `ConfigurationError`, no
  listener.
- Database unavailable or migration behind -> readiness `503`.
- Invalid request schema -> stable `400 bad_request` envelope.
- Missing/expired/revoked/disabled authentication -> `401 unauthenticated`.
- Active identity without required workspace capability -> `403 forbidden`.
- Cross-workspace or non-owned secret lookup -> non-enumerating `404`.
- Credential key/AAD/tag/version mismatch -> fail-closed `503`, never partial
  plaintext.

### 5. Good/Base/Bad Cases

- Good: route schema -> security service -> locked transaction -> allow-listed
  audit -> redacted response/log.
- Base: the Vite editor continues loading and saving IndexedDB documents with
  no server configured.
- Bad: a route issues SQL, a repository decides authorization, or an
  administrator is treated as an implicit sheet reader.

### 6. Tests Required

- Root lint, strict typecheck, tests, build, and production dependency audit.
- HTTP tests for route namespace, request IDs, error envelopes, cookies,
  Origin, and CSRF recovery.
- Fresh MariaDB tests for migrations, transaction rollback, session/invite
  state, workspace isolation, concurrent final-owner protection, credential
  crypto/scope, and secret-free audits.
- Production image and isolated Compose smoke, including dump/restore with the
  matching key and wrong-key fail-closed behavior.

### 7. Wrong vs Correct

Wrong:

```ts
app.get('/api/v1/sheets', async () => db.selectFrom('sheets').selectAll().execute())
```

Correct:

```ts
app.get('/api/app/workspaces', async ({ request }) => {
  const session = await requireSession(request)
  return security.listWorkspaces(session.principal)
})
```

## Guidelines Index

| Guide | Use |
| --- | --- |
| [Directory Structure](./directory-structure.md) | Package ownership and dependency direction |
| [Database Guidelines](./database-guidelines.md) | MariaDB schema, migrations, locks, and restore |
| [Error Handling](./error-handling.md) | Stable HTTP and crypto-integrity failures |
| [Logging Guidelines](./logging-guidelines.md) | Request correlation, audit, and redaction |
| [Quality Guidelines](./quality-guidelines.md) | Docker-first automated and human review gates |

## Pre-Development Checklist

- Read the active task and this index before changing `apps/api`, Compose, or
  `@rakuseru/document-contract`.
- Read the specialized guide for every layer touched.
- Keep existing `src/model/*` imports stable through contract re-exports.
- Add route/schema, service policy, transaction, audit, and integration tests
  in the same change.
