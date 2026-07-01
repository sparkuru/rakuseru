# Rakuseru MVP

## Goal

Implement Rakuseru, a pure frontend structured procurement sheet tool defined in `mvp.md`.

The first implementation should create a maintainable Vite + React + TypeScript app with typed document editing, local autosave, JSON round-trip, and Markdown/XLSX export.

## Source Material

- `mvp.md` defines the product concept, naming rationale, initial data model, MVP scope, and later-version scope.
- `readme.md` names the project "楽セル" and positions it as a small cell editor / renderer, less than Excel.
- The repository currently contains no app source, package manifest, lockfile, tests, CI, or dev-command wrapper.
- `.codex/` exists, so future dev-command auto-allow should target Codex project config.

## Confirmed Decisions

- Use Vite + React + TypeScript for the first implementation.
- Use a small local state layer, either reducer-based state or Zustand, for the active `SheetDocument` and editor state.
- Use TanStack Table or a comparable mature table foundation instead of building full table mechanics from scratch.
- Use IndexedDB for local autosave.
- Include XLSX export in MVP, but defer XLSX import until after the first working editor/export flow.
- Treat `heyapi`, React Query, TanStack Router, Elysia.js, and backend API work as future options, not MVP dependencies.

## Requirements

### Product Requirements

- Build Rakuseru as a pure frontend app for maintaining structured procurement sheets.
- Treat JSON as the mother format so app state can round-trip without losing column schema, row data, images, or layout metadata.
- Support custom column schema:
  - `text`
  - `number`
  - `money`
  - `singleSelect`
  - `multiSelect`
  - `image`
  - `link`
- Support row and column add/delete flows.
- Support cell editing that respects each column type.
- Support image upload and paste into image cells, stored as data URLs for MVP simplicity.
- Persist the current document locally with IndexedDB autosave.
- Import and export complete JSON documents.
- Export human-facing Markdown and XLSX files from the internal document model.
- Keep the app backend-free for the first version.
- Use a maintainable modular frontend structure instead of a single-file HTML implementation.

### Implementation Requirements

- Produce `prd.md`, `design.md`, and `implement.md` before implementation starts.
- Implement the initial app in independently verifiable slices.
- Create the frontend toolchain and apply `dev-it-in-docker` to generate `./hako`.
- Keep later-version ideas visible but out of the first implementation scope.

### Constraints

- Do not introduce a backend for this MVP.
- Do not use Markdown as the canonical data source.
- Do not hand-roll a full spreadsheet engine when a focused table/editor composition is enough.
- Do not use host Node/npm for project validation; use `./hako`.

## Out Of Scope For MVP

- Multi-file sheet management.
- HTML preview/export UI beyond any exporter plumbing needed later.
- URL-addressable cell query routes.
- Advanced validation rules beyond type-aware editing basics.
- Batch column transforms.
- Collaboration, auth, permissions, audit logs, cloud sync, or centralized attachment storage.
- Full Excel replacement behavior such as formulas, pivot tables, macros, virtualized million-row grids, or complete Excel import fidelity.

## Acceptance Criteria

- [ ] Vite + React + TypeScript project scaffold exists with npm scripts for dev, lint, typecheck, test, and build.
- [ ] `./hako` exists, is executable, uses Docker with repo-local `.devhome`, publishes Vite port 5173, and is registered in Codex rules.
- [ ] Core `SheetDocument` model, typed cell coercion, row/column helpers, and import validation exist with unit tests.
- [ ] Main UI opens directly into the editor with toolbar, sheet table, typed cell editors, row/column add/delete, and schema editor.
- [ ] IndexedDB autosave loads/saves the active document locally.
- [ ] JSON import/export round-trips the canonical document.
- [ ] Markdown, CSV, and XLSX export produce human-facing files from the active document.
- [ ] `./hako npm run lint`, `./hako npm run typecheck`, `./hako npm test`, `./hako npm run build`, and `./hako npm audit --omit=dev` pass or have documented exceptions.

## Implementation Slice Map

1. Project scaffold and Docker dev wrapper.
2. Core document model, validation helpers, and fixture data.
3. Sheet editor UI with typed cell editors.
4. Header/schema editor.
5. IndexedDB autosave and JSON import/export.
6. Markdown and XLSX export.
7. MVP quality pass, browser smoke testing, and packaging.

## Open Questions

- None blocking implementation activation.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
