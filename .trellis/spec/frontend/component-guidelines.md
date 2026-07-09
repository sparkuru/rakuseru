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

## Table Selection And Resize

Header selection and cell selection are different modes. Clicking a table header should switch to column context, clear the active cell frame, and show column schema editing. Clicking a data cell should switch to cell context and may show the right-side cell editor.

Column width resizing belongs only in headers. Do not add body-cell resize handles. If `lockedWidth` is true, keep a visible disabled resize affordance in the header and ignore resize attempts.

The first visible table column is a row-number/action column, not document data. Coordinate badges for active cells should use one-based data coordinates that exclude this action column: the first editable data cell is `(x1,y1)`.

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
- Excel preview should render an HTML table approximation from document rows and columns.
- `exportXlsxBlob(document)` should run only after the user confirms download, so ExcelJS remains lazy-loaded.

Validation issues in preview are warnings for export, not hard blocks. JSON export must stay available as the lossless backup format even when content validation reports issues.

Issue rows should be keyboard-accessible buttons when they can select a target cell. Selecting an issue should call the store selection action from the parent boundary, not mutate selection inside the preview component.

## Anti-Patterns

- Parsing imported JSON in a component.
- Constructing export file formats in a component.
- Duplicating cell coercion or image type guards outside `src/model/`.
- Adding custom SVG icons when an existing `lucide-react` icon fits the action.
