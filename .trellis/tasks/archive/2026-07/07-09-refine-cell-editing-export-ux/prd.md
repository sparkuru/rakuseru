# Refine Rakuseru Cell Editing And Export UX

## Goal

Refine Rakuseru's editor so table cells feel like cells instead of embedded form widgets, while keeping schema editing, cell editing, import/export, and local persistence inside the current frontend-only app.

## User Value

Users should be able to scan the sheet without visual clutter, edit the current cell from a clear context panel, configure select options without raw textarea editing, and export the working sheet through a default CSV path with secondary formats still available.

## Confirmed Facts

- Rakuseru is a Vite + React + TypeScript single-page app.
- The previous task added active row/cell/column state, grouped toolbar controls, chip multi-select cells, image preview/upload states, and grouped schema controls.
- Current cell rendering still embeds text/link inputs, numeric inputs, select controls, and image upload controls directly inside table cells.
- Current right panel is always a `Column schema` panel driven by `selectedColumnId`.
- Current select option editing uses a newline textarea in `HeaderEditor`.
- Current toolbar exposes import/export as several adjacent icon buttons plus an `XLSX` button.
- Current model supports `text`, `number`, `money`, `singleSelect`, `multiSelect`, `image`, and `link` column types.
- Current `ImageCellValue` stores `kind`, `name`, `mime`, and `dataUrl`; it has no presentation or crop metadata.
- User video feedback in `/tmp/tmp/simplescreenrecorder-2026-07-09_14.32.13.mkv` identified:
  - select options should be edited with an input-and-confirm flow instead of a textarea;
  - switching a column to single/multi-select should not leave a confusing empty options state;
  - text/link cells should not look like small embedded form inputs inside a cell;
  - only clicking table headers should open column schema editing;
  - clicking cells should open a cell editor in the right panel when a separate editor is needed;
  - configured select fields can still edit directly inside the cell;
  - image cells should open a right-panel upload/settings editor and support presentation choices;
  - toolbar export icons are unclear and should be replaced with a clearer default export plus secondary choices.

## Requirements

- Preserve the first viewport as the working editor.
- Keep frontend-only MVP scope: no backend, routing, auth, cloud sync, or multi-file management.
- Keep import/export adapters and IndexedDB autosave working.
- Keep existing `SheetDocument` version compatible with saved/imported documents.
- Introduce a right-panel mode:
  - header click opens column schema editing;
  - cell click opens cell editing for types that need a larger editor;
  - plain blank workspace click can clear active editing where practical.
- Change table cell rendering:
  - text/link cells display content as readable cell content, not embedded input widgets;
  - number/money cells should avoid heavy nested input styling where practical;
  - single-select and multi-select cells can keep direct in-cell controls when options exist because they support fast selection;
  - empty select-option states should be visibly guided rather than confusing blank controls;
  - image cells display image/empty preview only; detailed upload/settings live in the right panel.
- Add a cell editor panel:
  - text/link: full-width input/textarea, confirm, clear, and commit-on-blur or commit-on-click-outside where reliable;
  - link: optional open-link action when a URL exists;
  - image: upload, clear, confirm, display mode controls such as fit/contain, fill/cover, stretch, and center;
  - image: lightweight crop/rotate dialog if feasible without adding a heavy dependency.
- Improve schema panel:
  - only shown after header/column selection;
  - does not include a separate current-column selector; switching columns is done through table headers only;
  - select options use add/edit/delete controls, not a textarea;
  - type labels are user-facing Chinese labels while internal column type values remain unchanged;
  - changing to single/multi-select should present an option editor immediately and provide sensible guidance/defaults.
- Improve toolbar:
  - export format dropdown defaults to CSV;
  - export button exports the currently selected format;
  - secondary export choices include JSON, Markdown, and Excel;
  - export format dropdown appears before the export button;
  - import JSON is text-labeled, not only an icon.
- Refine table navigation and layout:
  - switching from a cell to a header should clear the active-cell frame and switch to whole-column context;
  - toolbar, table header, and right panel should remain usable when many rows are present and the table is scrolled;
  - right editor panel should be collapsible and expandable;
  - column width resizing should be available only from table headers;
  - locked-width columns should show a disabled resize affordance and ignore resize attempts;
  - the first column should be a fixed row-number/action column with row number and delete button;
  - selected cells should show a coordinate badge in the form `(xN,yM)`, starting from 1 for the first data column and first row.
- Keep accessibility basics:
  - icon-only controls need `aria-label` and `title`;
  - buttons/menus need clear labels;
  - right panel controls need visible labels;
  - keyboard behavior should remain native and predictable.
- Avoid a new UI framework. Add dependencies only if the image crop/rotate scope cannot be implemented responsibly without one.

## Acceptance Criteria

- [x] Clicking a column header opens the right-side column schema panel for that column.
- [x] Clicking a text or link cell opens a right-side cell editor instead of relying on an embedded table input.
- [x] Text/link cell content in the table reads as cell content with selected/active affordance, not a nested form control.
- [x] Text/link edits can be confirmed, cleared, and saved without losing existing autosave behavior.
- [x] Single-select and multi-select cells remain quick to edit in-cell when options are configured.
- [x] Single/multi-select columns with no options provide a clear option setup path instead of a confusing empty dropdown.
- [x] Select options in the schema panel can be added, edited, deleted, and deduplicated without raw textarea editing.
- [x] Column type pickers show Chinese labels while preserving existing internal column type values and import/export contracts.
- [x] Image cells open a right-side image editor with upload, clear, confirm, and display-mode controls.
- [x] Existing image values continue to import/export/load after image presentation metadata is introduced.
- [x] Default toolbar export downloads CSV.
- [x] Secondary export choices include JSON, Markdown, and Excel.
- [x] Import JSON is a labeled action.
- [x] Export format dropdown defaults to CSV, appears before the export button, and the export button downloads the selected format.
- [x] Clicking a header after selecting a cell clears the active-cell frame and switches to column context.
- [x] Column schema panel does not include a second column-switching dropdown.
- [x] Toolbar, table headers, and right panel remain visible/usable when the table scrolls down through many rows.
- [x] Right editor panel can collapse and expand.
- [x] Column width resizing is only exposed from headers, and locked-width columns show a disabled resize affordance.
- [x] The first table column shows row number plus delete action.
- [x] The selected cell shows a coordinate badge such as `(x1,y1)` in the lower-right corner.
- [x] Column schema property controls match their data kind: switches for booleans, selects for enumerations, and inputs for freeform values.
- [x] Image empty placeholders use the same compact table-cell height as other display cells instead of expanding every row like an upload panel.
- [x] The row-number/action column places the row number above row actions, and the delete action shows a red destructive hover state.
- [x] Rows and columns can be reordered by dragging Typora-style border midpoint handles.
- [x] `./hako npm run lint`, `./hako npm run typecheck`, `./hako npm test`, and `./hako npm run build` pass.
- [x] Browser smoke covers header schema mode, cell editor mode, select option editing, text/link editing, image upload/settings, CSV default export, secondary exports, JSON import, and refresh persistence.

## Out Of Scope

- Backend, auth, collaboration, permissions, cloud sync, or audit logs.
- Multi-file management.
- New import formats.
- Virtualized table rendering.
- Full spreadsheet keyboard navigation.
- Full-featured professional image editor. Crop/rotate should stay lightweight unless explicitly split into a larger task.

## Risks And Constraints

- Right-panel mode changes a core interaction path and must be smoke-tested in a browser.
- Commit-on-click-outside must not lose typed content or conflict with native controls.
- Image presentation metadata may require model validation and export compatibility updates.
- In-cell direct select controls must still coexist with cell selection events; previous work found that `pointerdown` selection can swallow child button clicks.
- Build currently warns about ExcelJS eval/large chunk through the existing lazy Excel export dependency.

## Planning Decision

- Image editing depth for this task is upload, clear, and display mode controls. Add a lightweight rotate/crop entry only if it stays contained without a heavy dependency; otherwise defer advanced crop/rotate to a follow-up while preserving a clear future entry point.

## Review Note

- Full browser smoke passed with headless Chrome. The smoke covered header schema mode, text/link/number cell side-panel editing, structured select option editing, in-cell select and multi-select controls, image upload/display mode, default CSV export, secondary JSON/Markdown/Excel exports, JSON import, and refresh persistence. Screenshot: `/tmp/rakuseru-refine-smoke/smoke.png`.
- Follow-up browser smoke passed with headless Chrome. The smoke covered export dropdown/button behavior, clearing active cell on header click, sticky toolbar/header/right panel under table scroll, right panel collapse/expand, header-only column resizing, locked-width disabled resize affordance, first-column row number/delete action, and selected-cell coordinate badges. Screenshot: `/tmp/rakuseru-refine-smoke/feedback-smoke.png`.
- Latest feedback smoke passed with headless Chrome. The smoke covered switch-style column property controls, compact image empty placeholders, row-number/action vertical layout, row adjacent swapping, and column adjacent swapping. Screenshot: `/tmp/rakuseru-refine-smoke/latest-feedback-smoke.png`.
- Typora-style drag smoke passed with headless Chrome. The smoke covered dragging the row handle from the row-number left border midpoint and dragging the column handle from the header top border midpoint. Screenshot: `/tmp/rakuseru-refine-smoke/typora-drag-smoke.png`.
- Row drag feedback smoke passed with headless Chrome. The smoke covered the larger row drag handle, row reordering, and the row target marker rendered as a vertical line on the row-number column's left side. Screenshot: `/tmp/rakuseru-refine-smoke/row-drag-left-indicator.png`.
- Image crop/rotate was deferred as planned. This pass implemented upload, clear, confirm, and display mode (`contain`, `cover`, `fill`, `center`) metadata.
- Production build still reports the existing ExcelJS eval/large chunk warnings from the lazy Excel export dependency.
