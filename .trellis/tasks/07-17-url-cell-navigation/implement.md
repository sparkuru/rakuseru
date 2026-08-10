# Implementation plan

## Task map

This parent task should be split into three child tasks before implementation.
Each is independently testable; dependencies are explicit rather than inferred
from the tree.

| Child task | Deliverable | Depends on |
|---|---|---|
| `hosted-service-foundation` | API package, shared document contract, MariaDB migrations, local auth, workspace membership/ACL resolver, credentials, audits, Compose, and self-host docs. | None |
| `hosted-sheet-resource-api` | Hosted sheets, attachment conversion/storage, publish/edit/restore service operations, browser session routes, public read-only `/api/v1` routes, API contract tests. | `hosted-service-foundation` |
| `dual-mode-hosted-editor` | `/local` and `/app` route boundary, hosted persistence adapter/store, local publish UX, cloud status, conflicts, and durable hosted cell navigation. | Both previous children |

The parent owns product consistency and the final integration review. Do not
start a child until its dependency has passed its own quality gate and its
interface contracts are committed.

The parent `implement.jsonl` and `check.jsonl` curate shared integration
context only. Every child must create its own PRD/design/implementation plan and
its own real spec/research manifests before `task.py start`. Copy only context
that applies to that child's owned boundary; record the dependencies below in
the child artifacts instead of relying on parent order or tree position.

## Child 1: hosted-service-foundation

1. Convert the repository to a minimal workspace layout without regressing the
   existing frontend scripts.
2. Extract/re-export browser-neutral document types and validation for both
   packages; add compatibility tests for existing JSON imports and image cells.
3. Add the Elysia TypeScript package with its Node adapter, route schemas and
   OpenAPI output, configuration validation, health check, typed error
   envelope, migration runner, Kysely/MariaDB connection, and API-specific
   lint/typecheck/test/build scripts.
4. Add migrations and repository/service boundaries for users, sessions,
   workspaces, memberships, invitations, API credentials, and audit events.
5. Implement bootstrap owner, password/session login, copied invitation flow,
   credentials with encrypted re-display, and the ACL resolver. Include tests
   for disabled users, expired/revoked credentials, workspace isolation, grant
   precedence, and administrator non-access.
6. Add Dockerfiles, Compose topology, environment template, and backup/restore
   documentation.

**Checks:** API unit/integration tests against MariaDB, package lint,
typecheck, build, migration smoke test, root frontend checks, and Compose boot
smoke test.

**Rollback:** retain a database backup before migrations; remove the new stack
without changing IndexedDB or existing browser data.

## Child 2: hosted-sheet-resource-api

1. Add sheet, grant, attachment, and soft-delete migrations and repositories.
2. Define remote document/image adapters and test lossless portable
export/import conversion. Enforce 10 MiB attachment validation before writes.
3. Implement publish, session-only hosted sheet save with version precondition,
delete/restore, attachment upload/read, and auditable service operations.
4. Add session-only browser routes for hosted sheet lifecycle and ensure Bearer
credentials cannot call them.
5. Implement the five public read routes, cursor pagination, attachment access
inheritance, consistent hidden-resource errors, and safe credential-use audit.
6. Add contract tests for all effective ACL levels, pagination, stale writes,
image access, delete window, and untrusted request payloads.

**Checks:** migration + database integration suite, public API contract suite,
attachment boundary tests, API package checks, root frontend checks, and manual
authenticated curl/browser smoke against Compose.

**Rollback:** new data tables are additive; preserve old document rows and use
a documented restore from the pre-upgrade MariaDB backup when reversing a
production migration.

## Child 3: dual-mode-hosted-editor

1. Add `/local` and `/app` React route selection while preserving current root
editor behavior as local mode.
2. Extract persistence behind local and hosted adapters/stores; keep mutations
in model helpers and avoid server/state decisions in components.
3. Build hosted sign-in/workspace/sheet selection and permission-aware editing;
show explicit local/cloud persistence and save state in the toolbar.
4. Add publish-to-cloud from a local document, remote attachment upload flow,
and hosted JSON export that materializes portable images.
5. Implement versioned saves with conflict UI for reload and save-as-copy.
6. Implement hosted deep-link restore after sign-in, select/scroll/focus,
missing-cell message, unavailable-resource screen, and local-only selection
URL behavior.
7. Add component/store tests plus focused Playwright coverage for local
editing, publish, hosted editing, conflicts, ACL denial, and deep links.

**Checks:** existing frontend lint/typecheck/test/build, API checks, browser
smoke in Compose, accessibility review of status/error states, and regression
import/export tests.

**Rollback:** route selection defaults to `/local`; local libraries remain
unchanged. Hosted UI can be disabled at the reverse proxy while preserving the
database for later recovery.

## Parent integration gate

1. Verify the PRD acceptance criteria end to end with a fresh Compose instance.
2. Confirm `/local` never uploads automatically, `/app` never masks save
failure as local success, and public API credentials cannot write.
3. Restore a MariaDB backup containing a hosted image and verify sheet,
ACL, deep-link, attachment, and audit behavior after restore.
4. Run complete root and API lint/typecheck/test/build suites and record exact
commands in the self-hosting documentation.
5. Update Trellis backend/frontend specs with the new durable conventions
before final commit and archive.
