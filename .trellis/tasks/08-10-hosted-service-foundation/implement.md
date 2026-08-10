# Implementation plan

## Preconditions

- Do not run this plan until the child planning review is explicitly approved
  and `task.py start` is separately authorized.
- Preserve unrelated Trellis 0.6.14 and user worktree changes. Do not switch or
  create a branch from the recorded `makuro-haado` base without user direction.
- Resolve and pin exact npm and container versions before writing runtime code;
  confirm Node 22/Alpine compatibility for the selected Argon2 release.

## Phase 1: workspace and portable contract

1. Snapshot the current root lint/typecheck/test/build results through `./hako`.
2. Add the minimal npm workspace layout and package scripts while preserving
   the existing root command names and Vite development behavior.
3. Move browser-neutral document types, schemas, and pure validation/parsing
   helpers into `packages/document-contract`; keep frontend import boundaries
   stable through re-exports where useful.
4. Add representative version-1 JSON fixtures and compatibility tests for all
   current cell kinds, inline images, malformed documents, and round trips.
5. Run the frontend quality gate before introducing API code so extraction
   regressions are isolated.

**Gate:** existing local editor checks pass; contract package has no DOM,
React, persistence, download, API, or database imports.

## Phase 2: API skeleton and database lifecycle

1. Create `apps/api` with pinned Elysia/Node adapter, TypeScript, test, lint,
   build, and production start commands.
2. Implement the app factory, request IDs, typed error mapping, runtime schemas,
   OpenAPI, liveness/readiness, validated config, and graceful shutdown.
3. Add pinned Kysely/mysql2 dependencies, MariaDB pool lifecycle, migration
   runner/lock, and typed database tables.
4. Add the initial forward migration for users, sessions, workspaces,
   memberships, invitations, credentials, and immutable audits with every
   index, unique constraint, foreign key, check, and UTC field explicit.
5. Add zero-to-head, repeated-run, readiness-failure, and transaction rollback
   integration tests against the exact MariaDB image.

**Gate:** API starts only after a successful migration, OpenAPI and error
envelopes are stable, and migration tests pass twice on a fresh database.

## Phase 3: authentication and workspace policy

1. Implement Argon2id hashing behind a port and high-entropy digest-only session
   tokens with expiry/revocation and enabled-user checks.
2. Implement the explicit idempotent bootstrap command and transaction.
3. Add sign-in, sign-out, session/CSRF recovery, cookie configuration, canonical
   origin validation, and CSRF enforcement for all cookie mutations.
4. Implement invitation creation/preview/accept/revoke, including new-user and
   signed-in existing-user paths.
5. Implement membership list/role/remove services, transactional last-owner
   protection, and owner/admin/member capability resolution.
6. Export/document the authenticated principal and workspace policy contracts
   for child 2, including administrator `implicitResourcePermission: none`.

**Gate:** policy matrix, cross-workspace, disabled/expired/revoked session,
CSRF/origin, invitation state-machine, and concurrent final-owner tests pass.

## Phase 4: credentials, audit, and redaction

1. Implement the central credential scope registry and default-deny evaluator.
2. Implement credential token generation, SHA-256 digest verification, and the
   versioned AES-256-GCM envelope with random IV, authentication tag, and AAD.
3. Add create/list/reveal/rotate/revoke services and session-only routes. Ensure
   rotation invalidates the previous secret and membership/scope can only
   reduce effective access.
4. Implement append-only audit writing and structured request/domain logging
   with recursive secret redaction.
5. Add tamper, wrong-key/version/AAD, workspace binding, expiry/revocation,
   rotation, audited reveal, rejected bearer, and sentinel-redaction tests.
6. Export/document credential authentication, scope gating, audit, error, and
   request-context contracts for child 2.

**Gate:** no raw secret appears in captured logs/audits/database diagnostic
snapshots; credential and audit integration suites pass.

## Phase 5: containers and operations

1. Add production frontend/reverse-proxy and API Dockerfiles using exact base
   image tags; prove Argon2 install/build/runtime in the API image.
2. Add `compose.yaml` for web/API/MariaDB with an internal service network,
   health checks, named storage, explicit migration/bootstrap commands, and
   only one published web port.
3. Add `.env.example` with validation/generation guidance and no usable secrets.
4. Write `docs/self-hosting.md` for initial setup, TLS/proxy assumptions,
   bootstrap, migration, upgrade, dump, restore, rollback, key custody, and
   verification.
5. Rehearse fresh boot and backup/restore into an isolated Compose project;
   verify sign-in, membership, credential authentication/reveal, and audit rows.
6. Update `hako`/development documentation only as needed to keep Docker-first
   root and API commands reproducible.

**Gate:** Compose reports healthy, only the proxy port is published, restoration
with the database plus matching key passes, and missing/wrong key fails safely.

## Phase 6: final quality and handoff

1. Run root and package lint, strict typecheck, tests, builds, migration smoke,
   production image build, Compose smoke, and `git diff --check`.
2. Review cross-layer flows end to end: HTTP schema -> service policy ->
   transaction/repository -> audit -> safe response/log.
3. Verify local IndexedDB behavior is unchanged and no server module enters the
   frontend bundle.
4. Update `.trellis/spec/backend/` and cross-layer specs with only durable
   conventions proven by implementation.
5. Record exact commands/evidence, downstream exported contracts, known risks,
   and rollback result before requesting human review and finish-work.

## Expected change ownership

- Root/workspace: `package.json`, lockfile, tsconfig/project references, root
  scripts, existing frontend model imports/tests.
- Portable contract: `packages/document-contract/**`.
- Service: `apps/api/**`.
- Operations: `Dockerfile.web`, `docker/**`, `compose.yaml`, `.env.example`,
  `docs/self-hosting.md`, and narrow `hako`/README updates if required.
- Trellis: this child context, implementation evidence, and proven specs only.

## Verification commands

Exact script names may be added in Phase 1/2, but the final gate must provide
one documented Docker-first path equivalent to:

```text
./hako npm run lint
./hako npm run typecheck
./hako npm test
./hako npm run build
docker compose config
docker compose build
docker compose up --wait
curl reverse-proxy liveness/readiness/OpenAPI endpoints
run migration smoke and MariaDB integration suite
perform documented dump/restore verification
git diff --check
```

Do not claim the gate passes until the exact implemented commands and their
outputs are recorded. Any command that needs credentials uses generated test
values and must not print them.

## Rollback plan

Stop the hosted stack, preserve the named database volume, and restore the
verified pre-upgrade dump plus matching instance key when schema rollback is not
explicitly proven reversible. Revert additive workspace/API/container changes
without altering existing IndexedDB code or browser storage. Never delete a
production volume as part of an automated rollback.
