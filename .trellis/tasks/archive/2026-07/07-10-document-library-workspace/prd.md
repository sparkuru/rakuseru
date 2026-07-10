# Document library workspace

## Goal

Add a local document library workspace so Rakuseru can manage multiple structured procurement sheets in the browser instead of treating the whole app as one implicit active document.

This is the next mainline after the first MVP editor/export/validation pass. It should preserve the working-editor first screen while making document identity, switching, creation, duplication, deletion, JSON import, autosave, and future URL-addressable sheet work explicit.

The first implementation will expose document-library controls from the existing toolbar, using compact selectors/menus and dialogs for multi-step or destructive actions. It will not add a dashboard, route structure, or persistent sidebar.

## User Value

Users can keep separate purchase lists for different projects, vendors, events, or sourcing rounds without exporting/importing JSON just to switch context. Importing a JSON file should become an intentional document-library action rather than an unconditional replacement of the only active sheet.

## Confirmed Facts

- `mvp.md` lists the first-version scope as frontend-only table editing, schema editing, row/column editing, image upload/paste, IndexedDB autosave, JSON import/export, and Markdown/XLSX export. It lists "多文件管理" as second-version scope (`mvp.md:238`, `mvp.md:253`).
- `mvp.md` also frames future URL access around a `sheetId` path shape: `GET /api/sheets/:sheetId/rows/:rowId/cells/:columnId` (`mvp.md:232`).
- Current IndexedDB persistence uses database `rakuseru`, object store `documents`, and a single key `active` (`src/storage/indexedDb.ts:6`).
- Current `loadActiveDocument()` and `saveActiveDocument()` read/write only that single active key (`src/storage/indexedDb.ts:10`, `src/storage/indexedDb.ts:18`).
- Current Zustand store owns one `document` plus editor selection state, and exposes single-document `load()` / `save()` actions (`src/state/sheetStore.ts:27`, `src/state/sheetStore.ts:67`).
- Current `App` loads once on mount and debounces `save()` when `document` changes (`src/app/App.tsx:18`, `src/app/App.tsx:24`).
- Current toolbar title input mutates `document.title`; JSON import calls `setDocument(importJson(content), ...)`, replacing the active sheet (`src/components/Toolbar.tsx:84`, `src/components/Toolbar.tsx:37`).
- Frontend state guidelines currently describe the store as owning the active `SheetDocument`, browser persistence through IndexedDB, no server state, and URL state only when URL-addressable or multi-file flows are implemented (`.trellis/spec/frontend/state-management.md:3`, `.trellis/spec/frontend/state-management.md:17`).
- User confirmed the recommended UI direction: keep the editor as the first screen and put document-library controls in the toolbar rather than adding a dashboard or persistent sidebar.

## Requirements

### Product Requirements

- Keep Rakuseru frontend-only and local-first. Do not add a backend, auth, cloud sync, collaboration, or routing for this task.
- Introduce explicit local document identity for sheets:
  - stable document id;
  - title;
  - created timestamp;
  - updated timestamp;
  - canonical `SheetDocument` payload.
- Support a document library flow:
  - create a new sheet from the default sample/template;
  - switch between local sheets;
  - rename the current sheet through the existing title editing path;
  - duplicate the current sheet as a separate local sheet;
  - delete a sheet with an explicit confirmation or guard;
  - ensure at least one usable sheet remains after delete.
- Preserve current editor workflows for whichever sheet is active:
  - cell editing;
  - schema editing;
  - row/column add/delete/reorder;
  - validation markers and summary;
  - export preview;
  - CSV/JSON/Markdown/XLSX export.
- Update JSON import behavior so importing a valid JSON document can create a separate library item instead of silently replacing the only active sheet. Replacement of the current sheet may remain available only through an explicit choice.
- Autosave the active sheet into its own library item without overwriting other sheets.
- Remember the last active sheet and reopen it on reload when it still exists.
- Migrate existing single-key `active` IndexedDB data into the new library shape without data loss.
- Invalid or obsolete stored documents should not crash the app; recovery should fall back to a valid default document and surface a user-readable status.
- Keep the first viewport as the working editor, not a landing page or document dashboard.
- Expose document-library controls through the existing toolbar:
  - a current-sheet selector;
  - create and duplicate actions;
  - JSON import as a library action;
  - delete guarded by explicit confirmation;
  - compact labels and accessible names for controls.

### Implementation Requirements

- Keep canonical sheet contents in the existing `SheetDocument` model unless a small wrapper metadata type is needed for library records.
- Keep document mutation rules in `src/state/` and `src/model/`; components should call store actions.
- Keep IndexedDB details inside `src/storage/`.
- Validate stored/imported `SheetDocument` payloads through `validateSheetDocument` before they enter app state.
- Add focused tests for storage migration, document-library state actions, and import replacement/create-new behavior where practical.
- Run required checks through `./hako`: lint, typecheck, test, and build.
- Run a browser smoke test because this changes persistence, import, and visible workflow behavior.

### Constraints

- Do not introduce multi-page routing in this task.
- Do not introduce a persistent left sidebar or dashboard-first document home in this task.
- Do not add remote state, backend API, auth, cloud sync, or collaboration.
- Do not add new runtime dependencies unless implementation exposes a strong need.
- Do not change export adapter file formats except where filenames naturally follow the active sheet title.
- Do not implement XLSX import, HTML preview, URL-addressable cell query, or batch column transforms in this task.

## Acceptance Criteria

- [x] Existing single-key `active` IndexedDB data migrates into a valid first library document.
- [x] Fresh installs create one usable default sheet and mark it active.
- [x] Users can create a new sheet and switch back to previous sheets without losing edits.
- [x] Users can duplicate the active sheet; the duplicate has a separate id and can be edited independently.
- [x] Users can delete a sheet through an explicit guard, and the app never ends in a no-active-document broken state.
- [x] Editing the title updates the current sheet's displayed title and persisted metadata.
- [x] Autosave writes only the active sheet's document payload and updated timestamp.
- [x] Reloading the app restores the last active sheet when it still exists.
- [x] JSON import can create a new library sheet without replacing the current one.
- [x] If current-sheet replacement remains available, it is explicit and preserves the current document when import fails.
- [x] Document-library controls live in the toolbar and preserve the editor-first first viewport.
- [x] CSV, JSON, Markdown, and XLSX export still operate on the active sheet.
- [x] Validation markers, validation summary, and export preview still operate on the active sheet.
- [x] Unit tests cover library storage migration and state-level document switching behavior.
- [x] `./hako npm run lint`, `./hako npm run typecheck`, `./hako npm test`, and `./hako npm run build` pass.
- [x] Browser smoke covers migration/fresh load, create, switch, rename, duplicate, delete, JSON import as new sheet, export preview, and reload persistence.

## Out Of Scope

- Backend, auth, permissions, cloud sync, collaboration, or audit logs.
- XLSX import.
- HTML preview/export UI.
- URL-addressable sheet/cell routing.
- Batch column transforms.
- Multi-window conflict resolution or cross-tab synchronization.
- Full document templates or template marketplace.

## Open Questions

- None blocking planning.

## Notes

- Toolbar document-library controls were chosen over a persistent sidebar because this task should establish the data lifecycle without squeezing the current table workspace.

## Review Notes

- Implemented local document library wrappers around `SheetDocument`, preserving the canonical sheet model.
- IndexedDB now stores `library:index` and `library:document:<id>` records while keeping legacy `active` as a migration source.
- Toolbar controls cover current sheet selection, new sheet, duplicate, delete, and JSON import as a new sheet.
- Browser smoke passed through headless Chrome/CDP for fresh load, create, rename, duplicate, switch, delete, JSON import as new sheet, export preview, and reload persistence. Screenshot: `/tmp/rakuseru-document-library-smoke.png`.
- Build still reports the existing ExcelJS direct-eval and large chunk warnings from the lazy Excel export dependency.
