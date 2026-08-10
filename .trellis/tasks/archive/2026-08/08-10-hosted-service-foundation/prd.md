# Hosted service foundation

## Goal

Create the independently testable service foundation for Rakuseru's approved
self-hosted mode without changing the current browser-local product behavior.
After this task, the repository can boot a secured Node API and MariaDB stack,
authenticate invited users, enforce workspace membership policy, manage
workspace-bound API credentials, record safe audit events, and expose stable
contracts for the sheet-resource and hosted-editor children.

The value of this task is a trustworthy tenant, identity, and operations
boundary. It deliberately does not claim that hosted sheets already exist.

## Confirmed baseline

- The repository is currently a single Vite/React/TypeScript frontend with
  IndexedDB persistence and no backend, database, Dockerfile, or Compose stack.
- The existing `hako` development wrapper uses `node:22-alpine`; the new API
  must remain runnable with the project's Docker-first development workflow.
- The approved parent plan selects Elysia with the Node adapter, Kysely with
  MariaDB, Argon2id password hashes, opaque UUIDs, UTC timestamps, and a
  browser-neutral shared document contract.
- The active branch recorded by Trellis is `makuro-haado` because no default
  remote branch could be resolved. This is planning metadata, not permission to
  create or switch branches.

## Scope

### In scope

1. Convert the root package into a minimal npm workspace while keeping the
   existing frontend commands and local editor behavior working.
2. Extract the portable `SheetDocument` types and validation into
   `packages/document-contract`; the frontend re-exports or imports that
   package without changing the serialized local JSON contract.
3. Add `apps/api`, running Elysia through its official Node adapter, with strict
   TypeScript, runtime request/response validation, OpenAPI generation, health
   endpoints, request IDs, configuration validation, and a shared typed error
   envelope.
4. Add Kysely/MariaDB connection and migration infrastructure for `users`,
   `sessions`, `workspaces`, `workspace_members`, `invitations`,
   `api_credentials`, and `audit_events`.
5. Implement an idempotent first-owner bootstrap, local email/password sign-in
   and sign-out, session inspection, invitation creation/acceptance/revocation,
   membership listing and role management, and explicit workspace policy
   resolution for `owner`, `administrator`, and `member`.
6. Implement named, workspace-bound API credentials with declared scopes,
   optional expiry, revocation, rotation, and audited re-display. A credential
   can never authorize more than its active user and workspace membership.
7. Record append-only safe audit events for security-sensitive mutations and
   emit structured redacted service logs.
8. Add production Dockerfiles, a `web`/`api`/`mariadb` Compose topology,
   environment examples, migration/bootstrap commands, and self-hosting,
   backup, restore, upgrade, and rollback documentation.
9. Add API unit and MariaDB integration tests plus root commands that run
   frontend and API lint, typecheck, test, and build checks.

### Out of scope

- Sheet, sheet-grant, attachment, or soft-delete tables.
- Hosted sheet CRUD, publish/save/restore operations, attachment transfer, or
  the public read-only `/api/v1` resource routes.
- `/local` and `/app` routing, hosted editor state, cloud-save UI, conflicts,
  deep links, or any other hosted frontend surface.
- Public registration, password-reset email, social login, SSO, MFA, outbound
  invitation email, live collaboration, or administrator impersonation.
- Object storage, background job infrastructure, rate-limit infrastructure, or
  automatic instance encryption-key rotation.

## Functional requirements

### Shared document contract

- The shared package is browser-neutral and imports no React, Zustand,
  IndexedDB, DOM download helpers, or API/database modules.
- It preserves the current version-1 JSON shape and accepts the existing inline
  image representation. Compatibility tests cover representative current JSON
  imports, all cell kinds, and invalid documents.
- The package exposes schemas/types and pure parse/validation helpers. It does
  not gain hosted attachment behavior in this task; child 2 extends that
  contract through an explicit compatible boundary.

### Service and HTTP contract

- The API runs on Node 22+ and provides liveness, readiness, and OpenAPI output.
  Readiness fails when required configuration, migrations, or MariaDB are not
  ready.
- Every request receives a correlation ID. Errors use
  `{ "error": { "code", "message", "requestId" } }`; validation messages are
  safe for clients and internal stack traces never cross the HTTP boundary.
- Route inputs and declared responses are runtime validated. Authentication
  failures return `401`; authenticated authorization failures return `403` for
  workspace-administration endpoints. The later resource API may intentionally
  map inaccessible resources to `404` without changing this foundation.
- Cookie-authenticated mutations require both an allowed same-origin `Origin`
  and a per-session CSRF token. The session cookie is `HttpOnly`, `SameSite`
  restricted, and `Secure` in production.

### Identity, invitations, and sessions

- On an empty database, an explicit operator command creates exactly one first
  enabled user, workspace, and `owner` membership. Re-running it is idempotent
  and cannot silently replace credentials or ownership.
- Emails are normalized for lookup and unique. Passwords are stored only as
  Argon2id PHC hashes; plaintext passwords and invitation/session tokens never
  enter logs, audits, or database columns.
- Sessions use high-entropy opaque tokens; only a digest is persisted. Sessions
  have explicit issue/expiry/revocation timestamps and are rejected when the
  user is disabled.
- There is no public registration. An owner or administrator creates a copied
  invite for one normalized email and role. The raw token is shown only at
  creation, stored only as a digest, expires, and is single-use/revocable.
- A new invited email sets its local password during acceptance. An existing
  user must be signed in as the invited email before accepting. Acceptance is
  transactional and cannot create duplicate active membership.
- Owners may manage all workspace roles. Administrators may invite and manage
  members but cannot grant/revoke owner, promote anyone to administrator,
  remove the final owner, or gain implicit access to future sheets. Members
  cannot administer membership.

### API credentials

- A signed-in user creates credentials only for a workspace where they are an
  active member. Each credential has an opaque ID, display name, explicit
  allow-listed scopes, optional expiry, created/last-used/revoked timestamps,
  and a secret version.
- A raw credential is cryptographically random. Store a lookup/verification
  digest plus AES-256-GCM ciphertext, unique random IV, authentication tag, and
  instance-key version. The required 32-byte instance key comes from deployment
  secret configuration, never the database or repository.
- Reveal, rotate, and revoke require an active cookie session and CSRF check;
  only the owning user may perform them. Reveal and rotation are audited.
- Bearer authentication rejects disabled users, inactive membership, workspace
  mismatch, expired/revoked credentials, or missing scope. Credential scope is
  an additional restriction and never elevates the user's effective rights.
- Raw credentials, ciphertext plaintext, passwords, cookies, invite tokens,
  authorization headers, and CSRF values are redacted from logs and audit
  details.

### Auditing and observability

- Security-relevant success events are append-only and include UTC time,
  workspace, actor type/user, action, target type/ID, request ID, and a small
  validated non-secret detail object. Required events include bootstrap,
  sign-in/sign-out, invite lifecycle, membership/role changes, credential
  create/reveal/rotate/revoke, and rejected credential use.
- Logs are structured, have stable event names and request IDs, and distinguish
  expected client failures from unexpected service failures without leaking
  secrets or full request bodies.

### Operations

- Compose contains `web`, `api`, and `mariadb`; only the web/reverse-proxy port
  is published. The API and MariaDB remain internal, use health checks, and do
  not report ready before migrations succeed.
- Dependency and image versions are exact/pinned in implementation artifacts.
  The Node version must satisfy both the existing Docker workflow and the
  selected Argon2 package's supported range.
- Operators receive a checked environment template and commands for initial
  bootstrap, migrations, health verification, backup with `mariadb-dump`,
  restore into a fresh stack, upgrade, and safe rollback. Production upgrade
  instructions require a verified backup first.
- Starting, stopping, or rolling back the hosted stack never reads, migrates,
  uploads, or deletes browser IndexedDB data.

## Downstream contracts

- Child 2 may depend on the API app factory, database/migration runner,
  transaction/repository conventions, authenticated principal, workspace policy
  result, credential scope gate, error factory, request context, and audit writer.
- Child 3 may depend on the session/CSRF contract and future child-2 browser API,
  but this task does not add hosted frontend code.
- Interfaces exported for downstream use must be documented and covered by
  contract tests so later children do not reach into private repository code.

## Acceptance criteria

- [ ] Existing frontend local JSON import/export and editor tests pass after the
  document-contract extraction; `/local` behavior and IndexedDB data are not
  modified by this task.
- [ ] Root workspace commands run frontend and API lint, strict typecheck, unit
  tests, and production builds; the existing root command names remain valid.
- [ ] A fresh MariaDB instance migrates from zero, reports readiness, and a
  second migration run is a no-op. Migration failure prevents readiness.
- [ ] Bootstrap creates one owner/workspace/membership transactionally, is
  idempotent, and refuses ambiguous or unsafe reconfiguration.
- [ ] Integration tests prove sign-in/sign-out, session expiry/revocation,
  disabled-user rejection, CSRF/origin rejection, invitation expiry/single use,
  existing-user acceptance, and last-owner protection.
- [ ] Policy tests prove owner/admin/member administration boundaries,
  cross-workspace isolation, and that administrator status grants no implicit
  future resource permission.
- [ ] Credential tests prove scope restriction, user/workspace binding,
  expiry/revocation, rotation invalidating the prior secret, audited reveal,
  authenticated decryption failure on tampering, and secret redaction.
- [ ] Audit and logging tests prove required event metadata is present and
  passwords/tokens/cookies/authorization headers/CSRF values are absent.
- [ ] Only the reverse-proxy port is exposed by Compose; healthy containers
  serve the frontend, `/health/live`, `/health/ready`, and OpenAPI through that
  port while MariaDB remains unreachable from the host network.
- [ ] Documented backup and restore reproduce users, workspace membership,
  credentials, and audit rows in a fresh stack; credential reveal works only
  when the matching instance encryption key is restored.
- [ ] API package tests run against the pinned Node/MariaDB environment in
  Docker, and `git diff --check` plus all documented quality commands pass.

## Constraints and risks

- Redisplayable API credentials intentionally increase the sensitivity of the
  instance encryption key. Losing it makes existing secrets unrecoverable;
  exposing it compromises every encrypted credential. Backup/restore docs must
  treat it separately from the database and explain both cases.
- MariaDB DDL rollback is not assumed transactional. Each migration documents
  reversibility; production rollback normally restores the pre-upgrade backup.
- `node-argon2` includes native code. The pinned API image must prove install,
  build, and runtime behavior on every supported architecture instead of
  assuming a prebuilt binary exists.
- Rate limiting is not part of this child. Login and credential-auth service
  boundaries must make a later limiter possible, and self-hosting docs must not
  describe the initial service as internet-hardened without a trusted proxy.

## Notes

- Parent task: `.trellis/tasks/07-17-url-cell-navigation`.
- This child has no task dependency. Its downstream interfaces gate both later
  children and must pass a separate implementation quality review before either
  child starts.
