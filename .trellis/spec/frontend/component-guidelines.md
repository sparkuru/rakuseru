# Component Guidelines

Components are functional React components written in TypeScript. Keep them thin: components render controls and call store actions; document mutation and validation stay in `src/model/` and `src/state/`.

## Component Shape

Use named exports for app components. Put component-local event handlers inside the component when they only coordinate UI events.

Reference pattern: `src/components/CellEditor.tsx` accepts `RowData` and `ColumnDef`, then switches on `column.type` to render the correct controlled input and call `updateCell`.

## Props Conventions

Define explicit `type` aliases for props when a component accepts more than one primitive prop or receives domain objects. Import `ColumnDef`, `RowData`, and other contracts from `src/model/`; do not redefine shape fragments in components.

Examples:

- `ToolbarProps` in `src/components/Toolbar.tsx` keeps the toolbar API small by accepting `statusLabel`.
- `CellEditorProps` in `src/components/CellEditor.tsx` uses model types instead of local structural casts.

## Styling Patterns

The app uses plain global CSS in `src/app/styles.css`. Keep layout dimensions stable for table cells, toolbar buttons, and side panels so editing controls do not shift the grid.

Rakuseru opens directly into the working editor. Do not add landing-page or marketing hero UI for product work.

Toolbar actions should stay visually attached to the title editor when horizontal space tightens. Preserve the command group order document library -> structure -> import -> export, and wrap the action row below the title field instead of letting action groups form detached right-edge vertical stacks.

Use responsive command priority for the toolbar. Below the full-width layout, combine row and column creation into one 添加 selector and reduce import/validation to labeled icon actions; validation issues should retain a visible count badge. On narrow screens, keep document selection/new, 添加, export format, and 导出 visible, while moving duplicate, delete, import, and validation into a 更多 selector. Export format and its confirmation button remain visible primary actions at every width.

## Accessibility

- Icon-only buttons need `aria-label` and `title`; see row deletion in `src/components/SheetView.tsx` and image clearing in `src/components/CellEditor.tsx`.
- Inputs and selects should be wrapped in visible labels when space allows; see `src/components/HeaderEditor.tsx`.
- Interactive table headers should remain keyboard-clickable buttons for schema selection.

## Interaction Event Boundaries

When a table cell or row wrapper contains interactive child controls, update wrapper selection state on `click`, not `pointerdown`. A `pointerdown` handler can re-render the cell before the child button/select/input receives its own `click` or `change`, dropping actions such as multi-select chip toggles.

```tsx
// Good: child controls handle their event first, then the cell records selection.
<td onClick={() => selectCell(rowId, columnId)}>
  <button type="button" onClick={toggleChoice}>待确认</button>
</td>
```

```tsx
// Bad: this can re-render before the child control click is delivered.
<td onPointerDown={() => selectCell(rowId, columnId)}>
  <button type="button" onClick={toggleChoice}>待确认</button>
</td>
```

## Cell Editing Pattern

Use table cells as readable grid content first. Do not embed heavy text/link/image form controls directly inside every cell; it makes the table look like nested forms and reduces scanability. For text, link, number, money, and image cells, render a compact display state in the grid and put the larger editing controls in the right-side cell editor panel.

Keep direct in-cell controls only when they materially improve fast editing:

- `singleSelect`: native select is acceptable when the column has configured options.
- `multiSelect`: chip toggles are acceptable when the column has configured options.
- empty select options: show a setup affordance that opens column schema editing instead of rendering a blank dropdown.

When adding new cell types, choose between display-plus-panel and direct in-cell editing based on scanability, not implementation convenience.

## Column Schema Controls

Column schema controls should communicate the kind of value being edited:

- Boolean properties use switch-style toggles, not bare checkboxes.
- Enumerated properties use selects.
- Freeform text or numeric properties use inputs.

Keep switch rows centered within their property blocks so schema panels read as editable property groups, not mixed form fragments.

Use grouped sections for related column metadata. Width controls own the width unit input and `lockedWidth` switch; general 属性 controls own `wrap`, `required`, and alignment. Width is shown as logical units where `1` maps to the standard non-image column width (`160px`). The numeric input's native controls and header drag resizing are the only width-adjustment affordances; do not add duplicate custom `+/-` buttons.

## Table Selection And Resize

Header selection and cell selection are different modes. Clicking a table header should switch to column context, clear the active cell frame, and show column schema editing. Clicking a data cell should switch to cell context and may show the right-side cell editor.

Column width resizing belongs only in headers. Do not add body-cell resize handles. If `lockedWidth` is true, keep a visible disabled resize affordance in the header and ignore resize attempts.

The first visible table column is a row-number/action column, not document data. Coordinate badges use one-based data coordinates that exclude this action column: the first editable data cell is `(x1,y1)`. Render them as non-interactive hover/focus affordances just outside the cell's lower edge; they must not stay visible merely because a cell is selected.

Rows and columns should move through Typora-style drag handles, not arrow-button controls:

- row movement handles sit at the midpoint of the row-number column's left border;
- column movement handles sit at the midpoint of the header's top border;
- handles should use native drag/drop to move the row or column to the drop target's index;
- row drag-over feedback should be a vertical marker on the row-number column's left side, not a full-row horizontal line;
- movement must call model/store helpers instead of mutating arrays in components;
- movement should clear stale cell framing when the user has switched into row or column context.

## Export Preview Pattern

Export actions should open a review surface before download. The toolbar owns the selected format and file-download event, while the preview component owns display of validation issues and preview content.

Keep preview generation aligned with adapters:

- CSV preview should call `exportCsv(document)`.
- JSON preview should call `exportJson(document)`.
- Markdown preview should call `exportMarkdown(document)`.
- HTML preview should call `exportHtml(document)` and render that same string in a titled, script-restricted iframe; confirmation should download the already-previewed string. HTML is the initial selected export format.
- Excel preview should render an HTML table approximation from document rows and columns.
- `exportXlsxBlob(document)` should run only after the user confirms download, so ExcelJS remains lazy-loaded.

Validation issues in preview are warnings for export, not hard blocks. JSON export must stay available as the lossless backup format even when content validation reports issues.

Keep export content as the dialog's primary upper region. Render validation results below it as a compact, full-width summary/list so the report or source preview retains usable horizontal space; issue lists may scroll independently when long.

Issue rows should be keyboard-accessible buttons when they can select a target cell. Selecting an issue should call the store selection action from the parent boundary, not mutate selection inside the preview component.

## Anti-Patterns

- Parsing imported JSON in a component.
- Constructing export file formats in a component.
- Duplicating cell coercion or image type guards outside `src/model/`.
- Adding custom SVG icons when an existing `lucide-react` icon fits the action.
