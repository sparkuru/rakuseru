# Document Library Workspace Implementation Plan

## Preparation

- Read before coding:
  - `.trellis/spec/frontend/index.md`
  - `.trellis/spec/frontend/state-management.md`
  - `.trellis/spec/frontend/component-guidelines.md`
  - `.trellis/spec/frontend/type-safety.md`
  - `.trellis/spec/frontend/quality-guidelines.md`
  - `.trellis/spec/guides/cross-layer-thinking-guide.md`
- Work in inline Codex mode. Do not dispatch implementation/check sub-agents.
- Use `./hako` for validation commands.

## Implementation Checklist

1. Define library contracts and pure helpers.
   - Add a model/storage-adjacent module for `LibraryDocumentRecord`, `LibraryDocumentSummary`, and `DocumentLibrarySnapshot`.
   - Add helper functions for creating a default record, creating summaries, duplicating records, selecting a fallback active id, and normalizing invalid snapshots.
   - Keep `SheetDocument` unchanged.

2. Upgrade IndexedDB storage boundary.
   - Replace or extend `loadActiveDocument` / `saveActiveDocument` with library-oriented functions.
   - Read namespaced keys from the existing `documents` object store:
     - `library:index`
     - `library:document:<id>`
     - legacy `active`
   - Implement legacy migration from the current `active` key.
   - Persist library index and active records without deleting legacy `active`.

3. Extend Zustand store.
   - Add `documents` summaries and `activeDocumentId`.
   - Update `load()` and `save()` to use library storage.
   - Update `setTitle()` to synchronize active metadata and `document.title`.
   - Add actions for create, duplicate, switch, delete, import-as-new, and explicit replace-current.
   - Reset stale selected cell/column/panel state when switching document contexts.

4. Update toolbar document controls.
   - Add a compact document selector near the brand/title area.
   - Add toolbar actions for new sheet, duplicate sheet, import JSON as new sheet, and delete current sheet.
   - Keep export preview and validation bound to the active `document`.
   - Add accessible labels/titles for icon or compact controls.
   - Keep layout stable across desktop and narrow widths.

5. Update JSON import flow.
   - Make the default import action create a new library sheet from validated JSON.
   - If replace-current is included, make it an explicit separate action.
   - Preserve current document/library state on import failure and surface `setError`.

6. Add tests.
   - Unit-test pure library helper behavior:
     - default record creation;
     - duplicate uses a new id and independent document copy;
     - fallback active id selection;
     - invalid snapshot recovery;
     - legacy `active` migration helper if extracted.
   - Add store/storage-level tests only if the current jsdom/Vitest environment supports the required browser APIs without adding a dependency.
   - Keep existing model/adapter tests passing.

7. Browser smoke test.
   - Start the app with `./hako npm run dev` or use the existing project smoke pattern if present.
   - Cover:
     - fresh load creates one sheet;
     - create second sheet;
     - switch between sheets;
     - rename current sheet and reload;
     - duplicate and edit duplicate independently;
     - delete guarded by confirmation/fallback;
     - import JSON as new sheet;
     - export preview still uses active sheet;
     - validation markers still use active sheet.

## Validation Commands

Run serially:

```bash
./hako npm run lint
./hako npm run typecheck
./hako npm test
./hako npm run build
```

No `npm audit` is required unless runtime dependencies are added.

## Risk Areas

- IndexedDB migration: avoid deleting legacy `active`; validate every loaded `SheetDocument`.
- Autosave and switching: save current active document before switching where practical so edits are not lost.
- Metadata synchronization: `record.title` and `record.document.title` must not drift.
- Delete behavior: never leave the app with no valid active document.
- Toolbar density: new controls must not make import/export/editing actions hard to scan.
- Browser storage tests: jsdom may not provide full IndexedDB; prefer pure helper tests rather than adding a dependency solely for storage tests.

## Rollback Points

- After storage helper implementation, verify legacy `loadActiveDocument` behavior can still be reconstructed from the new migration code.
- After store changes, verify the editor still renders and current editing actions mutate only active `document`.
- After toolbar changes, verify import/export preview still compiles before deeper styling adjustments.

## Review Gate Before Start

- `prd.md`, `design.md`, and `implement.md` must be reviewed.
- User must approve starting implementation.
- Then run:

```bash
python3 ./.trellis/scripts/task.py start .trellis/tasks/07-10-document-library-workspace
```
