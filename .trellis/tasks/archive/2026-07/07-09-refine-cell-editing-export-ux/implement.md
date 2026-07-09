# Implementation Plan

## Pre-Work

- Load frontend specs with `trellis-before-dev` before code edits.
- Re-read `src/state/sheetStore.ts`, `src/components/SheetView.tsx`, `src/components/CellEditor.tsx`, `src/components/HeaderEditor.tsx`, `src/components/Toolbar.tsx`, `src/model/cell.ts`, `src/model/document.ts`, `src/model/validation.ts`, and export adapter tests before patching.
- Treat any unrelated dirty files as out of scope.

## Steps

- [x] Add user-facing column type labels and use them in add-column, headers, and schema controls.
- [x] Extend store transient state with right-panel mode and actions for column vs cell editing.
- [x] Replace always-schema side panel with an `EditorSidePanel` router.
- [x] Move column schema UI into `ColumnSchemaPanel`.
- [x] Replace raw options textarea with structured add/edit/delete option editor.
- [x] Ensure switching to `singleSelect`/`multiSelect` gives a clear option setup path and does not leave a confusing blank dropdown.
- [x] Refactor table cell rendering so text/link/numeric/image cells display content rather than embedded form inputs.
- [x] Keep direct in-cell single-select and multi-select controls when options exist.
- [x] Add `CellValuePanel` for text/link/number/money/image editing with save, clear, and reliable commit behavior.
- [x] Add compatible optional image presentation fields and validation support if image display settings are implemented.
- [x] Add image panel upload/clear/display-mode controls; defer crop/rotate to keep this task contained.
- [x] Refactor toolbar import/export actions: `导入 JSON`, primary `导出 CSV`, secondary JSON/Markdown/Excel choices.
- [x] Refine toolbar export to a format dropdown defaulting to CSV followed by a `导出` button.
- [x] Clear active cell framing when switching from a cell to a column header.
- [x] Remove the duplicate current-column selector from the column schema panel.
- [x] Add sticky toolbar/header/right-panel behavior for many-row scrolling.
- [x] Add right-panel collapse/expand behavior.
- [x] Add header-only column resizing and disabled resize feedback for locked-width columns.
- [x] Replace row action-only first column with row number plus delete action.
- [x] Add one-based active-cell coordinate badge in the lower-right corner.
- [x] Render column schema booleans as switch-style toggles, enumerations as selects, and freeform properties as inputs.
- [x] Keep image empty cell placeholders compact so they do not inflate row height like upload panels.
- [x] Stack row number above compact row actions and add destructive hover styling for row deletion.
- [x] Add Typora-style row and column reordering through border-midpoint drag handles, model helpers, and store actions.
- [x] Refine row drag feedback so the target row is marked by a left-side vertical line, matching the row movement axis.
- [x] Update styles for cell display mode, side panel modes, option editor, image panel, and toolbar menu.
- [x] Update or add focused tests for image validation metadata and any model coercion behavior changes.
- [x] Update focused tests for row and column movement helpers.
- [x] Run automated checks.
- [x] Run browser smoke for the changed workflows.

## Validation Commands

```bash
./hako npm run lint
./hako npm run typecheck
./hako npm test
./hako npm run build
```

## Browser Smoke Checklist

- [x] First viewport remains the editor.
- [x] Header click opens column schema panel.
- [x] Text cell click opens right-side cell editor; save/clear persist.
- [x] Link cell click opens right-side editor; save/clear persist.
- [x] Number/money cell edits remain possible.
- [x] Select option add/edit/delete updates in-cell single-select and multi-select controls.
- [x] Empty select-option state gives clear setup guidance.
- [x] Image cell click opens image panel; upload/clear/display-mode persist.
- [x] Default export downloads CSV.
- [x] Secondary export choices download JSON, Markdown, and Excel.
- [x] Export dropdown defaults to CSV; clicking `导出` downloads the selected format.
- [x] Header click after cell selection clears the active-cell frame.
- [x] Toolbar, table headers, and right panel stay visible while scrolling many rows.
- [x] Right panel collapses and expands.
- [x] Header resize changes width; locked-width header shows disabled resize state.
- [x] First column shows row number and delete action.
- [x] Active data cell shows `(xN,yM)` coordinate badge.
- [x] Column schema controls match property kind: switches, selects, and inputs.
- [x] Image empty placeholders stay compact.
- [x] Dragging row and column border-midpoint handles changes visible order.
- [x] Row drag-over target appears as a vertical marker on the row-number column's left side.
- [x] Import JSON still works.
- [x] Refresh reloads saved edits.

## Rollback Points

- Store right-panel mode can be rolled back independently if table display refactor works but panel routing fails.
- Structured options editor can be kept even if cell panel work needs to be simplified.
- Image crop/rotate can be deferred while retaining upload/clear/display-mode controls.
- Toolbar export menu can fall back to a native select if a custom menu is brittle.
