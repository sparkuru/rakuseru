# Design: Cell Editing Panel And Export UX

## Objective

Move heavy cell editing out of the grid and into a contextual right panel, while keeping fast in-cell selection for configured select fields. Make exports understandable by promoting CSV to the primary action and moving other formats into a labeled secondary menu.

## Boundaries

In scope:

- Right-panel mode for column schema vs cell editing.
- Table cell display/read affordances for text, link, numeric, image, and select values.
- Structured select option editor in the schema panel.
- Chinese labels for column type display in UI.
- CSV primary export and secondary JSON/Markdown/Excel export choices.
- Image upload/settings panel and compatible image presentation metadata.
- Sticky toolbar/header/right-panel behavior for larger row counts.
- Header-only column width resizing with locked-width feedback.
- Row-number/action first column and active-cell coordinate badges.

Out of scope:

- Backend or routing.
- New import formats.
- Full spreadsheet keyboard matrix.
- Full professional image editor.

## State Model

Extend transient editor state in `src/state/sheetStore.ts`:

```ts
type RightPanelMode =
  | { kind: 'column'; columnId: string }
  | { kind: 'cell'; rowId: string; columnId: string }
  | { kind: 'empty' }
```

Expected actions:

- `selectColumn(columnId)` sets active panel to column mode.
- `selectColumn(columnId)` clears `activeCell` and `activeRowId` so the visual state switches from a single cell to whole-column context.
- `selectCell(rowId, columnId)` sets active row/cell and active panel to cell mode for text/link/image/number/money, while select columns may still use cell mode only for empty-option guidance.
- `clearActivePanel()` returns the panel to empty guidance or the last selected column if that feels better during implementation.
- `sidePanelCollapsed` stores whether the right panel is collapsed so the workspace grid can shrink the side column.

`SheetDocument` should remain version 1 unless image metadata requires an additive optional field. Additive optional fields are allowed if validation and export behavior stay backward compatible.

## Column Type Labels

Centralize type labels near `src/model/column.ts` or a small UI helper:

```ts
const COLUMN_TYPE_LABELS: Record<ColumnType, string> = {
  text: '文本',
  number: '数字',
  money: '金额',
  singleSelect: '单选',
  multiSelect: '多选',
  image: '图片',
  link: '链接',
}
```

Use labels in toolbar add-column controls, table headers, and schema type picker. Keep stored `ColumnType` values unchanged.

## Cell Rendering Rules

`CellEditor` should be split or simplified into display-oriented cell components plus direct select controls:

- Text: render text preview or muted placeholder.
- Link: render URL/title preview, with URL-like styling but no nested input.
- Number/money: render value as text or a low-friction numeric display; detailed editing can happen in panel.
- Single-select: render native select in-cell when options exist. If no options exist, show a setup prompt and open schema/panel guidance.
- Multi-select: keep chips in-cell when options exist. If no options exist, show setup prompt.
- Image: render preview or empty placeholder; upload/settings happen in the right panel.

Keep table selection on `click`, not `pointerdown`, so child controls receive their own events.

## Right Panel Components

Replace the always-schema `HeaderEditor` with a panel router:

- `EditorSidePanel`
  - `ColumnSchemaPanel`
  - `CellValuePanel`

`ColumnSchemaPanel` owns column identity/type/options/layout/behavior/danger controls.
It must not include a current-column switcher; table headers are the only column-switching control.
Property controls should match the represented data kind:

- Boolean column properties such as locked width, wrapping, and required render as switch-style toggle handles with centered content.
- Enumerated properties such as column type and image display mode render as selects.
- Freeform properties such as title, width, and option labels render as inputs.

`CellValuePanel` switches by selected cell column type:

- Text/link: local draft value, Save, Clear. Commit on Save and on reliable blur/click-outside. Link panel may include "Open link".
- Number/money: local draft number input, Save, Clear.
- Image: local draft image value plus display mode settings. Upload reads file with existing `readImageFile`.
- Select empty-options state: route user to configure options in schema panel or show a compact option editor shortcut.

## Select Option Editor

Replace textarea with structured controls:

- Existing options render as rows/chips with inline input and delete button.
- Add option input accepts Enter or Add button.
- Trim values.
- Ignore empty values.
- Deduplicate values.
- When options are removed, model coercion already removes invalid selected values through `updateColumn`; preserve this behavior.

When switching a column to single/multi-select:

- If `options` is missing, seed with `['待确认', '已采购', '不采购']` or present an empty add-option input. Recommended implementation: seed default options for new select columns and preserve existing options when switching between select types.

## Image Metadata

Current image value:

```ts
type ImageCellValue = {
  kind: 'image'
  name: string
  mime: string
  dataUrl: string
}
```

Add optional presentation metadata:

```ts
type ImageCellValue = {
  kind: 'image'
  name: string
  mime: string
  dataUrl: string
  fit?: 'contain' | 'cover' | 'fill' | 'center'
  rotation?: 0 | 90 | 180 | 270
  crop?: {
    x: number
    y: number
    width: number
    height: number
  }
}
```

Compatibility:

- Existing images without metadata remain valid.
- Validation should accept optional metadata only when structurally valid.
- Export adapters can continue stringifying image cells as filenames.
- Browser rendering applies `fit` and rotation. Crop can be applied through CSS/object-position if simple, or by generating a new data URL through a canvas in the crop dialog.

## Toolbar Export UX

Replace export icon cluster:

- Format dropdown appears before the button and defaults to `CSV`.
- Button label is `导出`.
- Clicking `导出` downloads the currently selected format: CSV, JSON, Markdown, or Excel.
- Import action: `导入 JSON` text button with upload icon.

Implementation can use a native select or a lightweight button-menu; avoid adding a menu dependency.

## Table Navigation And Layout

- The first visible table column is not document data. It is a fixed row-number/action column with row number and a delete button.
- The row-number/action column stacks the row number above compact row actions. Row actions include deletion; deletion uses a destructive hover state.
- Data-cell coordinates are one-based and exclude the row-number/action column: first data column/first row is `(x1,y1)`.
- The active data cell shows its coordinate badge in the lower-right corner.
- Column resizing is only exposed in table headers. Body cells must not show resize affordances.
- If a column has `lockedWidth`, the header resize handle shows a disabled/not-allowed state and does not resize.
- Data columns can be reordered by dragging the handle at the midpoint of the header's top border. Column movement uses model/store helpers and keeps the right panel in column context.
- Rows can be reordered by dragging the handle at the midpoint of the row-number column's left border. Row drag-over feedback uses a vertical marker on the row-number column's left side, not a horizontal full-row line. Row movement uses model/store helpers and clears active cell framing.
- The app shell should keep the toolbar visible; the table body scrolls inside the workspace; table headers stay sticky at the top of the table; the right panel remains visible and scrolls independently.
- The right panel can collapse to a narrow rail and expand again without losing the current editor mode.

## Validation

Automated:

```bash
./hako npm run lint
./hako npm run typecheck
./hako npm test
./hako npm run build
```

Browser smoke:

- Header click opens column schema.
- Header click clears active cell framing and switches to whole-column context.
- Cell click opens cell editor for text/link/image.
- Select option add/edit/delete changes in-cell select/chips.
- Text/link edit saves and persists after refresh.
- Image upload/settings save and persist after refresh.
- Primary export downloads CSV.
- Secondary exports download JSON, Markdown, and Excel.
- Export dropdown/button flow downloads the selected format.
- Row number/delete column, active-cell coordinate badge, header resize, locked resize feedback, sticky layout, and right-panel collapse/expand behave correctly.
- Column property controls show inputs/selects/switches according to value kind.
- Image empty placeholders stay compact and do not inflate table rows.
- Dragging row and column border-midpoint handles changes visible row/column order.
- Row drag-over feedback appears as a left-side vertical marker on the target row.
- JSON import still replaces the document.

## Rollback

- If right-panel routing destabilizes editing, keep schema panel and add only explicit cell editor sections as an intermediate fallback.
- If image crop/rotate grows too large, keep upload/clear/display fit this task and preserve a disabled/follow-up crop action.
- If secondary menu causes accessibility or state complexity, use a native select plus action button.
