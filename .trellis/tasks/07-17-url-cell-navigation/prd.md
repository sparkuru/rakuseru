# Hosted workspaces, resource API, and cell navigation

## Goal

Evolve Rakuseru from a browser-local editor into a dual-mode product: a
local-first editor for private browser data and a self-hosted, access-controlled
workspace service. Authorized users edit hosted sheets in the web app, while
external Agents use a stable read-only API to discover and retrieve resources.

## Confirmed Facts

- Rakuseru is currently a Vite + React + TypeScript SPA with Zustand and
  IndexedDB. It has no server runtime, database, router, API framework, auth,
  deployment configuration, or backend test runner.
- `SheetDocument` version 1 is the portable JSON document contract. Row and
  column IDs are stable within a document; local library-record IDs are browser
  only and must never become public remote IDs.
- Image cells currently embed a Base64 data URL. JSON export/import validation
  already centers on the portable `SheetDocument` contract.
- `selectCell(rowId, columnId)` already owns editor selection. The MVP sketches
  cell query URLs and a future `GET /api/sheets/:sheetId/rows/:rowId/cells/:columnId`.
- Backend guidelines require the first remote-persistence change to define
  migrations, ownership/versioning, attachment storage, transactions, API
  compatibility, typed errors, package scripts, tests, and deployment guidance.

## Product Model

- `/local` is the browser-local editor backed by IndexedDB. It remains usable
  without a hosted instance after its assets are available, but it makes no
  cross-device or shareable-link promise.
- `/app` is the authenticated hosted editor. It persists sheets to the remote
  workspace and must continuously state whether the active sheet is saved only
  in this browser or saved to the cloud workspace, including save/error state.
- A user explicitly chooses **Publish to cloud** to copy a local document into
  a new hosted sheet with a durable remote ID. Local and hosted copies are
  independent; initial scope has no automatic two-way synchronization.
- A hosted cell link is `/app/sheets/<sheetId>?rowId=<rowId>&columnId=<columnId>`.
  It survives sign-in, then selects, scrolls to, and focuses an authorized cell.
  A deleted row/column opens the permitted sheet with no selection and a clear
  notice. An unknown and an unauthorized sheet are indistinguishable.
- The hosted release is self-hosted Docker Compose with web, API, and MariaDB
  services. One instance supports multiple isolated workspaces;
  only the instance owner creates a workspace. Deployment operators control
  data residency, upgrades, API base URL, backup, and audit retention.

## Identity and ACL

- Public registration and anonymous/public share links are not supported.
  Accounts use local email/password login. Deployment configuration bootstraps
  the first instance owner; OIDC is a future replaceable adapter.
- Workspace administrators create expiring, one-time invitation links for
  members to receive through their own channel and set a password. SMTP is
  optional future configuration.
- Workspace roles are `owner`, `administrator`, and `member`. Administrators
  may invite, disable, and change member roles, but cannot transfer ownership,
  delete the workspace, bypass sheet ACLs, or modify an ungranted sheet.
- Sheet access is least-privilege. Members see only sheets they create or are
  granted. A sheet owner or `manage` grantee can grant `manage`, `edit`, or
  `view` to an individual, workspace administrators, or all workspace members.
  Administrators receive no sheet access automatically.
- User-owned API credentials are bound to exactly one workspace and never
  exceed the issuing user's current effective permissions. They are named,
  scoped, expirable, revocable, rotatable, and immediately invalid after expiry,
  user disablement, or lost access.
- Credential secrets are reversibly encrypted with an instance-provided master
  key because their signed-in owner may re-display the full raw key. Raw keys
  must never appear in logs, errors, or audit payloads. Initial scope does not
  require a fresh password prompt before a reveal; every reveal is audited.

## Hosted Data and Editing

- Remote sheets use an opaque durable ID and optimistic concurrency version.
  A stale save is rejected without overwrite; the UI offers reload or
  save-as-copy recovery. Automatic merge is out of scope.
- Exported JSON remains a self-contained `SheetDocument`. The remote API uses
  a separate versioned envelope with hosted metadata, version, timestamps,
  effective permission, and attachment URLs. Explicit conversion keeps the two
  representations compatible.
- Publishing converts embedded image data to protected MariaDB attachments.
  The API returns attachment metadata and an authenticated URL instead of
  inlining Base64 data. Initial attachments are limited to 10 MiB each;
  S3-compatible storage is a future replacement boundary.
- Hosted sheets use a 30-day soft-delete window. A manager may restore during
  that window; later cleanup removes attachments while preserving audit records
  according to the configured retention policy.

## API Contract

- External integrations authenticate with a workspace-bound Bearer credential.
  Browser `/app` uses its signed-in session; both paths enforce the same server
  ACL. API versioning is independent of product-mode routes.
- The initial read-only namespace is `/api/v1/workspaces/:workspaceId` and
  exposes:
  - paginated accessible sheet summaries;
  - a complete hosted sheet envelope;
  - a single row;
  - a single cell;
  - a protected image attachment.
- The sheet list is ACL-filtered and exposes only summaries. Inaccessible
  resources are never listed and resource lookups must not reveal their
  existence. Attachments inherit access from their owning sheet.
- Rakuseru does not host an LLM, store LLM credentials, run Agent jobs, or
  apply Agent output in this release. External Agents process resources after
  reading them. Third-party write endpoints are not exposed initially.

## Audit

- Record workspace-scoped audits for sign-in, invitations and user state,
  workspace roles and sheet grants, credential lifecycle/reveal/use, publish,
  sheet save, deletion, and restoration.
- Do not write full sheet content, attachment bytes, API response bodies, or
  raw secrets to the audit log. Retention is configured by the deployment
  operator.

## Acceptance Criteria

- [ ] Docker Compose starts web, API, and MariaDB and bootstraps a configured
  instance owner without public registration.
- [ ] `/local` visibly remains browser-local; `/app` requires authentication,
  visibly reports hosted save state through text and semantics, and only
  permits authorized editing.
- [ ] Publishing creates a distinct remote sheet, migrates image data to
  protected MariaDB attachments, and enforces the 10 MiB attachment limit.
- [ ] Hosted saves reject stale document versions and provide reload or
  save-as-copy recovery without silent data loss.
- [ ] Workspace and sheet ACLs enforce the stated roles and grants for browser
  sessions and Bearer credentials; admins have no implicit sheet access.
- [ ] `/api/v1/workspaces/:workspaceId` provides only authorized paginated
  lists, sheets, rows, cells, and images, with no external write endpoint.
- [ ] Hosted deep links select the intended authorized cell after sign-in, and
  scroll and move keyboard focus to it, while meeting the stated missing-target
  and unavailable-resource behavior.
- [ ] Hosted UI preserves the existing editor-first shell and command priority,
  exposes loading, saving, saved, error/offline, conflict, permission, and
  missing-target states with accessible recovery actions, and keeps critical
  mode/status/navigation behavior usable at 375 px without color-only meaning.
- [ ] Credential lifecycle, reveal/use, authorization changes, data lifecycle,
  and user lifecycle are audited without exposing raw secrets or data bodies.
- [ ] Deleted hosted sheets restore within 30 days, and deployment documentation
  covers backing up and restoring the MariaDB persistence boundary.

## Out of Scope

- Built-in LLM providers, Agent job queues, Agent data retention, or applying
  Agent-generated changes.
- External API writes, automatic local/cloud sync, real-time collaboration, and
  automatic conflict merging.
- Public links, public registration, required SMTP, OIDC, separate service
  accounts, permanent API tokens, mandatory step-up authentication for secret
  reveal, and S3/object storage.

## Planning Scope

This is a complex cross-layer change. `design.md` defines architecture and
contracts; `implement.md` splits the work into independently verifiable child
deliverables before implementation begins.
