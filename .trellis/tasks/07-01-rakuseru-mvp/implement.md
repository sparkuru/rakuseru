# Rakuseru MVP Implementation Plan

## Preconditions

- User reviews `prd.md`, `design.md`, and this plan.
- User confirms the task can enter implementation.
- Run `python3 ./.trellis/scripts/task.py start 07-01-rakuseru-mvp` only after that review.

## Execution Slices

### 1. Scaffold frontend and dev wrapper

- Create Vite + React + TypeScript project files in the repository root.
- Add scripts for `dev`, `build`, `lint`, `typecheck`, and `test`.
- Add initial dependencies for React, TypeScript, table rendering, IndexedDB helper, local state, and XLSX export.
- Do not add `heyapi`, React Query, TanStack Router, or Elysia.js in this slice; those are deferred until backend/API/routing needs exist.
- Apply `dev-it-in-docker` after `package.json` exists:
  - detect the Node toolchain from the manifest and lockfile
  - generate `./hako`
  - publish Vite port `5173`
  - add `.devhome` to `.gitignore`
  - register `prefix_rule(pattern=["./hako"], decision="allow")` in `.codex/rules/default.rules`
  - verify with `./hako npm --version`
- Validate:
  - `./hako npm install`
  - `./hako npm run typecheck`
  - `./hako npm run build`

### 2. Model and fixtures

- Add `src/model/` document, column, row, cell, and validation helpers.
- Add a sample procurement sheet fixture covering all MVP column types.
- Add unit tests for:
  - document creation
  - column add/delete
  - row add/delete
  - type-aware cell updates
  - JSON import validation failures
- Validate:
  - `./hako npm test`
  - `./hako npm run typecheck`

### 3. Sheet editor UI

- Build the app shell, toolbar, and `SheetView`.
- Render rows and columns from the document model.
- Implement basic row/column add/delete interactions.
- Implement type-specific cell editors for text, number, money, single select, multi select, link, and image.
- Validate:
  - `./hako npm run lint`
  - `./hako npm run typecheck`
  - browser smoke test at `http://localhost:5173`

### 4. Header/schema editor

- Build a schema editor for column title, type, options, required, wrap, and width-lock metadata.
- Handle conservative value coercion when column type changes.
- Keep schema edits reflected immediately in table behavior.
- Validate with focused unit tests for coercion and browser smoke tests for editor flows.

### 5. Storage and JSON I/O

- Add IndexedDB autosave for the active document.
- Load the saved document on boot; fall back to the sample fixture.
- Add JSON export as a complete lossless document.
- Add JSON import with parse/validation error handling.
- Validate restart/reload behavior manually in the browser.

### 6. Markdown and XLSX export

- Add Markdown export from the current document.
- Add XLSX export from the current document.
- Keep JSON as the only lossless re-import format.
- Validate exported files with small sample data containing every MVP cell type.

### 7. Final quality pass

- Run full automated checks:
  - `./hako npm run lint`
  - `./hako npm run typecheck`
  - `./hako npm test`
  - `./hako npm run build`
- Run manual browser checks:
  - create/edit/delete columns
  - create/edit/delete rows
  - edit each supported cell type
  - paste or upload an image
  - reload and confirm autosave
  - export JSON and re-import it
  - export Markdown and XLSX
- Apply the Trellis Plus human review gate before committing because this is user-facing UI work.

## Validation Profile

Current repository state:

- No package manifest exists yet.
- No automated app checks exist yet.
- No Docker dev wrapper exists yet.
- Codex project config exists under `.codex/`.

Required after scaffold:

- Use `./hako` for install, lint, typecheck, tests, build, and dev server commands.
- Do not add broad allow rules for raw `docker`, package managers, `bash`, or `sh`.
- If any material check cannot run because Docker, network, or dependency install is unavailable, record that in the task result and request targeted human review.

## Risk Points

- XLSX export can expand in scope quickly; keep it one-way and human-readable for MVP.
- Image data URLs can make documents large; acceptable for MVP, but do not optimize around large image collections yet.
- Column type changes can corrupt data if coercion is too aggressive; prefer conservative clear/convert behavior with tests.
- Table interactions can become spreadsheet-like scope creep; keep MVP focused on structured procurement entries.

## Rollback Points

- Scaffold slice can be reverted independently if the chosen frontend stack changes.
- Export adapters should be isolated so a failing XLSX implementation can be postponed without removing model/UI progress.
- Storage should remain behind `storage/indexedDb.ts` so persistence can be disabled or replaced without touching cell editors.

## Planning Follow-Up

The stack decision is resolved:

- Vite + React + TypeScript.
- Local reducer or Zustand state.
- TanStack Table or comparable mature table foundation.
- IndexedDB autosave.
- XLSX export only in MVP; XLSX import later.
