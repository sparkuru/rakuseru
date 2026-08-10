# Database Guidelines

Browser documents still persist through `src/storage/indexedDb.ts`. The hosted
foundation uses MariaDB only for instance security and workspace metadata.

## Scenario: Change hosted MariaDB state

### 1. Scope / Trigger

Follow this contract for migrations, Kysely types, security mutations,
tenant/workspace lookup, backup, or restore behavior.

### 2. Signatures

```ts
createDatabase(config: ApiConfig): DatabaseHandle
runMigrations(db: Kysely<DatabaseSchema>): Promise<void>
databaseReady(db: Kysely<DatabaseSchema>): Promise<boolean>
```

```text
tables: users, sessions, workspaces, workspace_members, instance_state,
        invitations, api_credentials, audit_events
runtime: MariaDB 11.8.8-noble, InnoDB, utf8mb4, UTC DATETIME(3)
ids: opaque UUID strings in CHAR(36)
```

### 3. Contracts

- Migrations are ordered, forward, repeatable, and run before the listener.
- Every foreign key, unique/index/check constraint, and delete behavior is
  explicit. Stable roles/statuses use checked strings, not database enums.
- Security-sensitive writes and their audit event share one transaction.
- Session authentication locks the session and user, rechecks enabled/expiry/
  revoke state, then updates `last_seen_at` before commit. Credential
  authentication locks the credential, user, and membership, rechecks scope
  and state, then updates last-use and appends the success audit before commit.
- Bootstrap locks singleton `instance_state`; invitation acceptance locks the
  workspace before invitation rows; membership mutation locks all active
  members before enforcing at least one owner; credential rotate/revoke locks
  the owned row. Keep this lock order consistent across sibling operations.
- MariaDB `JSON` may arrive from mysql2 as a JSON string or an already parsed
  value. Parse through a strict `unknown` boundary and allow-list every value.
- `audit_events` has no update/delete API and database triggers reject either.

### 4. Validation & Error Matrix

- Migration error -> startup fails; readiness remains false.
- Bootstrap repeated with identical identity -> `already_initialized` without
  a second audit; conflicting identity -> `409` with no mutation.
- Expired/revoked/accepted invitation -> non-enumerating `404`.
- Concurrent changes that would remove all owners -> one transaction may
  commit; the other must fail and one active owner must remain.
- Audit insert failure during a protected mutation -> transaction rolls back.
- Unknown/malformed stored credential scopes -> bearer authentication denied.

### 5. Good/Base/Bad Cases

- Good: select/lock current state, enforce invariant, mutate, append audit, and
  commit once.
- Base: a repeated migration is a no-op and readiness sees the expected head.
- Bad: count owners outside the mutation transaction, trust JSON as `string`,
  or write audit after commit.

### 6. Tests Required

- Fresh disposable MariaDB: zero-to-head and repeated migration.
- Bootstrap idempotency/conflict with exactly one audit event.
- Session disabled/expiry/revoke; invitation expiry/revoke/single-use/existing
  user; cross-workspace and role matrix.
- Concurrent final-owner race and forced-audit-failure rollback.
- Credential tamper, AAD/key version, rotation, expiry, revocation, workspace,
  membership, scope, and both MariaDB JSON return shapes.
- Dump into a fresh project volume; matching key reveals the same credential,
  wrong key fails closed.

### 7. Wrong vs Correct

Wrong:

```ts
const scopes = normalizeScopes(JSON.parse(row.scopes) as string[])
```

Correct:

```ts
const scopes = parseCredentialScopes(row.scopes) // input is unknown
```

## IndexedDB Boundary

- Keep `SheetDocument` persistence and validation in the existing browser
  storage layer.
- A hosted migration must never inspect or mutate browser IndexedDB.
- Remote sheet tables belong to the later hosted-resource task and must carry
  an explicit document version and workspace authorization contract.
