# Design: Rakuseru Editor Interaction Framework

## Objective

Add a small interaction framework to the existing editor so table, toolbar, cell editors, and schema panel share a clearer concept of what the user is working on. This is the foundation for later UI polish and richer editing workflows.

## Boundaries

In scope:

- Active cell and active row state.
- Existing selected column state refinements.
- Visual and structural affordances that make active row/cell/column obvious.
- Safer row/column destructive actions.
- First-pass toolbar/action grouping that follows the active editor context.
- Better functional interactions for multi-select and image cells.

Out of scope:

- Changing `SheetDocument` storage shape.
- Backend, routing, multi-file management, or collaboration.
- Full keyboard navigation matrix.
- Virtualized table rendering.
- Final visual theme polish.

## Architecture

### State

Extend `src/state/sheetStore.ts` with transient editor selection state:

```ts
type ActiveCell = {
  rowId: string
  columnId: string
}
```

Add store fields/actions:

- `activeCell?: ActiveCell`
- `activeRowId?: string`
- `selectCell(rowId: string, columnId: string): void`
- `selectRow(rowId: string): void`
- `selectColumn(columnId: string): void` should keep driving the schema panel.

`SheetDocument` must not change. Selection is UI/editor state only.

### Data Flow

- `SheetView` renders row/cell wrappers and sends selection events to the store.
- `CellEditor` remains responsible for type-specific controls and commits values through `updateCell`.
- `HeaderEditor` continues reading `selectedColumnId` and editing the selected column schema.
- `Toolbar` remains document-level, but groups commands by document, structure, and export actions.

### Selection Rules

- Clicking a cell sets `activeCell`, `activeRowId`, and `selectedColumnId`.
- Clicking a row action area sets `activeRowId`.
- Clicking a header sets `selectedColumnId` and leaves cell selection intact unless the clicked column does not exist.
- Removing a selected row or column clears or moves selection to a valid remaining target.
- Adding a row should select the new row if implementation can do so without awkward model changes; otherwise preserve current selection.
- Adding a column should select the new column, matching existing behavior.

### Component Changes

`SheetView.tsx`:

- Add row and cell classes for active row, active cell, and selected column.
- Make row delete visually contextual and less dominant.
- Keep TanStack Table as the table engine.

`CellEditor.tsx`:

- Convert multi-select from raw checkbox cluster to chip/toggle controls backed by the same `string[]` cell value.
- Improve image cell states: empty upload prompt, preview, filename, and clear action.
- Preserve native inputs for text, number, money, single select, and link.

`HeaderEditor.tsx`:

- Group controls by identity/type, options, layout, behavior, and danger zone.
- Move destructive column deletion into a distinct danger-zone area and add a confirmation step.
- Keep options stored as `string[]`; option editing can remain textarea if a chip editor would expand scope too much.

`Toolbar.tsx`:

- Group commands into document title/status, structure actions, import, export, and primary XLSX export.
- Keep icon-only actions labeled with `aria-label` and `title`.

`styles.css`:

- Add stable classes for active row/cell/column.
- Improve functional affordances without heavy re-theme work.
- Preserve responsive fallback at `max-width: 900px`.

## Compatibility

- Existing saved documents remain compatible because `SheetDocument` is unchanged.
- Import/export adapters continue reading the same model.
- IndexedDB autosave continues saving only the document, not transient editor state.

## Validation

Automated:

```bash
./hako npm run lint
./hako npm run typecheck
./hako npm test
./hako npm run build
```

Manual/browser smoke:

- Start app.
- Edit title.
- Click cells across columns and verify active row/cell/column affordances.
- Add/delete row.
- Add/delete column with confirmation.
- Edit text, number, money, single select, multi-select chips, image, and link cells.
- Import JSON and export JSON, Markdown/CSV, and XLSX.
- Refresh and verify autosaved document still loads.

## Risks

- CSS-only visual selection can drift from store selection if handlers are incomplete.
- Row/column deletion must not leave stale selected ids pointing to removed entities.
- Improving controls without changing the model requires careful coercion reuse through existing store/model actions.
