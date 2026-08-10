# Technical design

## Architecture

```text
Browser /local ───────────────► React + IndexedDB

Browser /app ── session cookie ► React hosted client ──► private app API
                                                        │
External Agent ─ Bearer token ────────────────────────► public read API
                                                        │
                                                Elysia API service
                                                        │
                                                     MariaDB
```

The two browser modes reuse the editor components and pure document helpers but
have separate persistence adapters. `/local` never sends its library to the
server. `/app` loads a remote-sheet envelope and uses the private session API
for edits. The public API is a separate read-only surface; a Bearer credential
cannot invoke browser editing routes.

The first hosted implementation adds a TypeScript `apps/api` package using
Elysia with its Node.js adapter for HTTP routes and Kysely with MariaDB for
typed database access. This preserves the repository's existing npm/Node-based
tooling rather than introducing Bun as a required runtime. Elysia schemas
validate route inputs/responses and generate OpenAPI documentation; Kysely
provides the MySQL/MariaDB dialect. Password hashes use Argon2id. Dependency
versions are pinned at implementation time, not guessed here.

Move portable document types and validation into a browser-neutral
`packages/document-contract` package (or an equivalent source-owned package),
then re-export them from the existing frontend model boundary. Server code must
not import React, Zustand, IndexedDB, download utilities, or components.

## Repository boundaries

```text
apps/api/                 Elysia app, MariaDB migrations, API tests
packages/document-contract/ portable document contract + validation
src/                      React editor and local persistence
compose.yaml              web, api, mariadb service topology
Dockerfile.web
apps/api/Dockerfile
docs/self-hosting.md
```

The root package remains responsible for the browser build. The API package has
its own build, typecheck, lint, test, and migration commands. Root scripts run
both package checks in CI/development. Docker exposes only the web/proxy port;
MariaDB stays on the Compose network.

## Data model and migrations

All IDs below are opaque UUIDs. Timestamps are UTC. Every query with a hosted
resource includes its workspace boundary.

| Table | Purpose |
|---|---|
| `users` | Email, Argon2id hash, enabled state, bootstrap-instance-owner flag. |
| `sessions` | Opaque, hashed browser-session tokens, expiry and revocation. |
| `workspaces` | Isolated tenant boundary and owner user. |
| `workspace_members` | `owner`, `administrator`, or `member` membership and active state. |
| `invitations` | Hashed, expiring, single-use invite token and requested role. |
| `sheets` | Remote ID, workspace, sheet owner, remote document JSON, version, timestamps, and soft-delete timestamps. |
| `sheet_grants` | `user`, `workspace_administrators`, or `workspace_members` principal plus `manage`, `edit`, or `view`. |
| `attachments` | Sheet-owned image metadata and MariaDB binary data, limited to 10 MiB. |
| `api_credentials` | User/workspace binding, scope, expiry, revocation, secret lookup digest, and encrypted raw secret. |
| `audit_events` | Workspace-scoped event metadata with actor, subject IDs, timestamp, and safe details. |

`api_credentials` stores both a one-way digest for lookup/constant-time
verification and AES-256-GCM encrypted secret material for the approved
re-display capability. The encryption key comes only from a required deployment
environment secret. Encryption nonce/tag are stored beside the ciphertext;
neither the secret nor the plaintext is logged.

Remote document JSON uses the portable document structure except image cells
hold an attachment reference instead of inline data. The contract package adds
a source union that accepts legacy inline `dataUrl` images and hosted attachment
references. Store this as a `LONGTEXT` JSON value with a `JSON_VALID` check;
portable export always materializes attachment references back to inline data.
API envelopes add signed-in-user effective permission and attachment URLs
without changing the exported JSON format. Attachments use `LONGBLOB` data.

Publishing a local sheet runs a transaction: validate the portable document,
decode/check image size, insert attachments, replace image sources with their
attachment IDs, create the remote sheet at version 1, add the owner grant, and
write an audit event. A failed image conversion rolls back all of those writes.

## Authorization

Authorization resolves in this order:

1. authenticate a session or a Bearer credential;
2. confirm the user is enabled and actively belongs to the requested workspace;
3. for a credential, confirm workspace binding, expiry, revocation, and scope;
4. allow a workspace owner all sheet access; otherwise calculate the highest
   sheet grant from the user, administrator group (only if administrator), and
   all-members group;
5. compare the effective level with the requested `view`, `edit`, or `manage`
   action.

Workspace administrators can perform membership/invitation actions but have no
implicit sheet level. Sheet owners have `manage`. Unauthorized and missing
sheet/attachment reads return the same not-found-shaped error. Each successful
or denied credential use updates safe usage metadata and emits a non-secret
audit event.

## HTTP contracts

All errors use one envelope:

```json
{ "error": { "code": "resource_unavailable", "message": "Resource is unavailable.", "requestId": "..." } }
```

Validation errors contain safe field messages. Browser write conflicts return
`409 document_version_conflict` with the current version but never overwrite.
Authentication failures return `401`; inaccessible resource reads use `404`.

Public integrations use `Authorization: Bearer <credential>` and only these
read routes:

```text
GET /api/v1/workspaces/:workspaceId/sheets?cursor=&limit=
GET /api/v1/workspaces/:workspaceId/sheets/:sheetId
GET /api/v1/workspaces/:workspaceId/sheets/:sheetId/rows/:rowId
GET /api/v1/workspaces/:workspaceId/sheets/:sheetId/rows/:rowId/cells/:columnId
GET /api/v1/workspaces/:workspaceId/attachments/:attachmentId
```

The list is cursor-paginated and returns only ID, title, timestamps, current
version, and effective permission. Complete sheet/row/cell responses use an
envelope with hosted IDs and document metadata. Attachment URLs point to the
same protected attachment route; they are not public URLs.

Cookie-authenticated browser routes live under `/api/app` and cover sign-in,
sign-out, invitation acceptance, current user/workspaces, credential lifecycle,
hosted-sheet CRUD/publish/restore, attachment upload, grants, and versioned
saves. Session cookies are `HttpOnly`, `Secure` in production, and `SameSite`
restricted; state-changing browser requests enforce origin/CSRF protections.

## UI and navigation

Introduce an application route boundary before existing `App` persistence
effects run. `LocalApp` retains the current Zustand library/IndexedDB adapter.
`HostedApp` owns a remote-sheet adapter and a separate store state for remote
ID, workspace ID, document version, effective permission, save state, and
conflict state. Reuse document mutation helpers and editor components; do not
let components choose a persistence backend directly.

The hosted toolbar/status region displays workspace and cloud save state. It
offers publish from a chosen local document, copyable hosted cell links, and
conflict recovery. On a hosted deep link, route loading completes after sign-in
then validates IDs and calls `selectCell`; a missing target leaves the sheet
open and reports the agreed message.

### Approved UI direction

The hosted experience extends the existing dense editor rather than replacing
it with a landing page or generic administration dashboard. Preserve the light
neutral surfaces, teal emphasis, compact controls, short state transitions,
plain global CSS, and Lucide icon language already established by the local
editor. Do not add a new display font, dark-violet reskin, marketing hero,
decorative animation framework, or color-only status language. Raw UUPM output
and the selection rationale live in `research/ui-ux-pro-max.md`.

The application shell exposes mode and persistence truth continuously:

- `/local` shows a text label equivalent to **仅此浏览器** and never implies
  cloud backup, sharing, or cross-device availability.
- `/app` shows the active workspace, effective sheet permission, and one cloud
  state: loading, saving, saved, save failed/offline, or conflict.
- Status uses text plus an icon or semantic state; color may reinforce it but
  cannot carry the meaning alone. Dynamic status is announced through a polite
  live region without repeatedly stealing focus.
- View-only access keeps the sheet readable and navigation usable while editing
  controls are semantically disabled or absent with an explicit permission
  explanation. Read-only and disabled styling remain distinguishable.

Hosted UI states and recovery behavior are explicit:

| State | Required presentation and next action |
| --- | --- |
| Session/workspace/sheet loading | Keep the shell stable, identify what is loading, and show progress when the wait exceeds roughly 300 ms. |
| Sign-in required | Show a labeled email/password form, submission progress, inline errors, and focus the first invalid field. After success, resume the original hosted URL. |
| Saving / saved | Announce the transition without moving toolbar controls or blocking continued editing. |
| Save failed or offline | Keep unsaved edits intact, show the cause when safe, and provide an explicit retry path. Never display a failed hosted save as local success. |
| Version conflict | Present reload and save-as-copy as distinct actions, explain the data-loss trade-off, and move focus to the conflict heading when the recovery surface opens. |
| Permission denied / unavailable sheet | Use the same resource-unavailable product surface for missing and unauthorized sheets; do not reveal which condition occurred. Provide a safe route back to the accessible sheet list. |
| Missing row or column in a permitted deep link | Open the sheet with no selected cell, announce that the target no longer exists, and keep normal sheet navigation available. |
| Publish to cloud | Identify the local source and destination workspace, show progress, leave the local document untouched on failure, and navigate to the new hosted sheet only after the transaction succeeds. |

### Navigation, focus, and responsive behavior

Resolve hosted deep links in this order: retain the requested URL, complete
sign-in, load the authorized sheet, validate row and column IDs, then select,
scroll, and focus the target. A valid target calls the shared `selectCell`
action, scrolls the cell into view with the smallest necessary movement, and
moves programmatic focus to a stable cell or editor focus target. Route changes
place screen-reader focus on the destination's primary heading or editor target;
they must not create keyboard traps or reset unrelated editor state.

At desktop widths, workspace/mode identity and cloud status remain adjacent to
the title/document context while existing command order stays intact. At narrow
widths, retain mode identity, active workspace or sheet, cloud/error/conflict
status, and the existing primary add/export actions; secondary hosted management
actions may move into the established **更多** pattern. Errors, conflicts, and
permission explanations must not disappear into an overflow menu.

Use the existing responsive CSS breakpoints as the implementation baseline and
verify at 375 px plus the supported desktop widths. Interactive controls keep
visible focus, semantic accessible names, logical tab order, and at least the
project's existing compact desktop hit area; touch-oriented narrow layouts must
expand critical actions to an appropriate touch target. Motion stays functional
and subtle (normally 120-200 ms), never blocks navigation or input, and is
removed or reduced under `prefers-reduced-motion`.

Hosted-only routes and heavy management surfaces may be lazy-loaded. The local
editor's initial path must not load server-only code, require authentication, or
wait for a hosted service. UI verification must combine focused component/store
tests with the project Playwright profile for sign-in restoration, mode/status
truth, publish, save failure, version conflict, permission denial, missing-cell
deep links, keyboard focus, and relevant narrow-width behavior.

## Operations, compatibility, and rollback

- Compose validates required bootstrap owner and encryption environment values
  before API startup. Bootstrap creation is idempotent.
- MariaDB is the persistence and attachment backup boundary. Document
  `mariadb-dump`/restore steps and migration upgrade/downgrade behavior in
  self-hosting documentation.
- Soft-delete cleanup runs as an explicit API maintenance command/container
  task, never as an uncontrolled client timer. It only purges expired sheets'
  attachments after the restore window.
- Migration rollback is limited to migrations explicitly designed as reversible;
  production upgrades require a database backup first.
- Local IndexedDB data is untouched by hosted rollout. A failed publish leaves
  the local source document intact.

## Key trade-offs

- Separate public and browser APIs keep third-party writes impossible in the
  initial contract, at the cost of two route groups sharing one service layer.
- MariaDB attachment storage simplifies transactions and backup now; object
  storage remains a later scale option.
- Re-displayable API secrets meet the approved UX but require instance-key
  management and impose a higher session-compromise risk. Step-up verification
  is deliberately deferred.
- Optimistic concurrency prevents silent loss but requires a manual conflict
  decision instead of live collaboration or automatic merge.
