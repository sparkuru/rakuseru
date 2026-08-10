# Backend Directory Structure

## Scenario: Add or extend a hosted backend capability

### 1. Scope / Trigger

Use this layout whenever code runs in Node, talks to MariaDB, authenticates a
principal, or exposes an HTTP contract. Browser editing remains under `src/`.

### 2. Signatures

```text
apps/api/src/app.ts                 HTTP composition and schemas
apps/api/src/server.ts              validated startup, migration gate, shutdown
apps/api/src/contracts.ts           principals, policies, registered scopes
apps/api/src/config/                environment parsing/redacted summary
apps/api/src/http/                  request, error, session, Origin/CSRF helpers
apps/api/src/modules/               application/security/audit services
apps/api/src/db/                    Kysely lifecycle, types, migrations
apps/api/src/security/              password, digest, AES-GCM primitives
apps/api/src/observability/         structured logger and redaction
packages/document-contract/src/     browser-neutral SheetDocument contract
```

### 3. Contracts

- Dependency direction is transport -> application/policy -> domain contract;
  database, Node crypto, cookies, and logging stay at infrastructure edges.
- Route handlers declare schemas and call services. They do not issue SQL.
- Repositories/database helpers do not make authorization decisions.
- `server.ts` is the only listener entrypoint; tests import `createApp` without
  opening a port.
- Server code may import `@rakuseru/document-contract`, never React, DOM,
  IndexedDB, downloads, or frontend state.

### 4. Validation & Error Matrix

- Browser-only import from `apps/api` -> dependency-boundary failure in review.
- SQL inside `app.ts` -> reject; move it behind a service transaction.
- Listener opened during tests/import -> reject; keep it in `server.ts`.
- New shared document type outside `@rakuseru/document-contract` -> reject as a
  forked canonical contract.

### 5. Good/Base/Bad Cases

- Good: `app.ts` validates a request and delegates to `SecurityService`.
- Base: frontend modules continue importing stable `src/model/*` re-exports.
- Bad: a component imports `apps/api/src/contracts.ts`, or the API imports
  `src/storage/indexedDb.ts`.

### 6. Tests Required

- Strict source and test TypeScript projects for each workspace.
- Contract-package compatibility fixtures and a browser-neutral import check.
- HTTP tests through `createApp`; process startup is covered by image/Compose
  smoke.
- Search changed imports for cross-boundary dependencies during review.

### 7. Wrong vs Correct

Wrong:

```ts
// apps/api/src/app.ts
await db.updateTable('workspace_members').set({ role }).execute()
```

Correct:

```ts
await security.changeMemberRole(principal, workspaceId, userId, role, context)
```

## Ownership Rules

- Root scripts aggregate web, `@rakuseru/document-contract`, and
  `@rakuseru/api`; keep `build:web`, `test:web`, and `typecheck:web` available
  for frontend-only container and regression paths.
- Production commands run compiled `dist/commands/*.js`. `tsx` commands are
  development-only and must not be required by the runtime image.
- Generated `.tsbuildinfo` and `dist` artifacts are never trusted as Docker
  build inputs; production builds force fresh TypeScript emit.
