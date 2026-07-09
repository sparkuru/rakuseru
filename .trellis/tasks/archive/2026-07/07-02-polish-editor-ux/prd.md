# Build Rakuseru Editor Interaction Framework

## Goal

Build the interaction and UI structure needed for Rakuseru to behave like a usable structured procurement-sheet editor, then leave detailed visual polish as a follow-up layer. Preserve the current frontend-only MVP scope and document model unless a small interaction helper state is needed.

## User Value

Users should be able to scan rows, edit cells, manage column schema, and import/export files through clearer editor workflows. The first viewport must remain the working editor, not a landing page or marketing surface.

## Confirmed Facts

- Rakuseru is a Vite + React + TypeScript single-page app.
- Current UI is implemented in `src/components/Toolbar.tsx`, `src/components/SheetView.tsx`, `src/components/HeaderEditor.tsx`, `src/components/CellEditor.tsx`, and `src/app/styles.css`.
- App state and document changes go through `src/state/sheetStore.ts` and `src/model/`; this task should not move mutation rules into components.
- Current document model already supports text, number, money, singleSelect, multiSelect, image, and link columns.
- MVP direction in `mvp.md` is frontend-only; no backend, routing, or multi-file management is required for this task.
- Existing frontend specs require stable layout dimensions, icon-only buttons with labels/titles, browser smoke testing for UI-visible changes, and `./hako` validation commands.
- Current roughness visible from the screenshot:
  - toolbar actions are dense and visually under-grouped;
  - table rows and cells have weak focus/hover affordances;
  - multi-select cells render as raw checkbox clusters;
  - image cells look improvised, especially filename/clear affordance;
  - row deletion is always visible and visually detached;
  - schema panel is functional but not well grouped;
  - lower workspace appears empty and unfinished after the initial rows.

## Requirements

- Improve the editor as a working app, not a landing page.
- Prioritize interaction framework and functional editor affordances before fine-grained visual polish.
- Keep product scope focused on UI/UX polish; do not change `SheetDocument` shape unless implementation reveals a blocking UI issue.
- Preserve current core workflows:
  - edit title;
  - add row;
  - add column by type;
  - edit cells for every existing column type;
  - select and edit column schema;
  - delete rows and columns;
  - import JSON;
  - export JSON, Markdown, CSV, and XLSX;
  - autosave to IndexedDB.
- Refine the toolbar into clearer action groups, with import/export actions easier to understand.
- Refine the table surface for scanability:
  - clearer header hierarchy;
  - stable row/cell sizing;
  - row hover and selected-column affordances;
  - less noisy row deletion;
  - better empty workspace treatment below existing rows.
- Refine cell editors:
  - multi-select should look like selectable tags/chips rather than raw checkbox rows;
  - image cells should have a cleaner upload/preview/filename/clear layout;
  - link cells should remain compact and readable.
- Refine the right schema panel:
  - group identity/type, layout, behavior, and destructive action controls;
  - make select options easier to edit than an unstructured textarea if feasible within scope;
  - reduce accidental column deletion risk.
- Keep accessibility basics:
  - icon-only actions need `aria-label` and `title`;
  - inputs and selects need visible labels where practical;
  - keyboard interaction should remain native and predictable.
- Avoid introducing a new UI framework or heavy dependency for this polish pass.
- Establish a small editor interaction framework if needed:
  - explicit selected column state already exists and should remain the schema-panel driver;
  - add selected row/cell or active action menu state only if it materially improves editing workflow;
  - keep transient UI state local or in `sheetStore` according to the existing frontend specs.
- Separate "functional framework" from "final look":
  - this task may improve layout, grouping, and state visibility enough to be usable;
  - detailed color/theme polish, animation, and full responsive refinement can follow later.

## Acceptance Criteria

- [x] The first viewport still opens directly into the editor.
- [x] Toolbar actions are organized into clear editor command groups.
- [x] Table rows/cells expose enough active, hover, and selected-column state to make editing orientation clear.
- [x] Multi-select cells provide a compact structured interaction, not a raw checkbox cluster.
- [x] Image cells have clear upload, preview, filename, and clear interactions.
- [x] Schema panel controls are grouped by editing purpose, and destructive column deletion is less prone to accidental click.
- [x] Layout remains usable at narrow viewport widths using the existing responsive single-column fallback.
- [x] Current document model, import/export adapters, and storage contracts continue to work.
- [x] `./hako npm run lint`, `./hako npm run typecheck`, `./hako npm test`, and `./hako npm run build` pass.
- [x] A browser smoke test covers title edit, row add/delete, column add/edit/delete, text/number/select/image/link cell editing, JSON import/export, and at least one presentation export.

## Out Of Scope

- Backend, auth, cloud sync, collaboration, or permissions.
- Multi-file management.
- URL-addressable cell views.
- New import formats.
- Virtualized table rendering.
- Full spreadsheet feature parity.
- A marketing landing page.

## Risks And Constraints

- UI changes are user-visible and require human/browser review even if automated checks pass.
- There are currently unrelated uncommitted dev-wrapper changes: `hako` and `dev.sh`. They must not be mixed into this task's UI commit unless explicitly folded in later.
- The current test suite is model-heavy; UI behavior is mostly protected by manual smoke testing unless a focused browser test is added.

## Planning Decision

- User chose interaction improvements: build the function/interaction framework first, then consider frontend ease-of-use polish.
- Implementation direction: start with an editor selection/action framework so the app has a clear concept of the active row, active cell, and selected column before deeper control polish.

## Open Question

- None blocking. Design and implementation plan should define the first pass.

## Review Note

- Desktop and narrow-viewport render smoke screenshots passed with headless Chrome.
- Full interactive browser smoke passed with headless Chrome via the host Playwright CLI. The smoke covered title autosave/refresh, row add/delete, column add/edit/delete, text/number/money/single-select/multi-select/image/link cell editing, JSON import, JSON/Markdown/CSV/XLSX export, and captured `/tmp/rakuseru-smoke/smoke.png`.
- The smoke caught a multi-select chip regression caused by selecting cells on `pointerdown` before the chip `click`; switching cell selection to `click` preserves child-control clicks.
