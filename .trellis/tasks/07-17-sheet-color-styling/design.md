# Technical Design: Sheet color styling

## Model and Ownership

- Add optional `backgroundColor` fields to `ColumnDef` and `RowData`.
- Add an optional `cellBackgroundColors: Record<string, string>` to `RowData`, keyed by column id. Keeping cell presentation separate from `CellValue` avoids changing every value variant and lets row helpers remove stale keys with columns.
- `src/model/color.ts` owns strict hex-color validation, shared presets, and `getCellBackgroundColor(row, column)`. Every UI and export consumer uses that resolver rather than reproducing precedence.
- `src/model/column.ts` and `src/model/row.ts` own cleanup/preservation during column and row edits. Validation normalizes optional colors from JSON.

## UI Flow

```text
Header click -> ColumnSchemaPanel -> column background color
Row action click -> RowStylePanel -> row background color
Cell click -> CellValuePanel -> cell background color
```

Extend `RightPanelMode` with a row state so `selectRow` opens a dedicated `RowStylePanel`. Reuse one compact `BackgroundColorControl` component in all three panels; its props are a current color plus `onChange(color | undefined)`. It renders preset buttons, a native `<input type="color">`, and clear.

`SheetView` applies the shared resolver to header, row-action, and data-cell inline background styles. Selection, validation, and drag/drop classes remain additive so colored cells still show their existing interaction feedback.

## Export Behavior

- HTML adds the resolved color to each `th` and `td` style, including its existing alignment, width, wrapping, and row-height styles.
- XLSX maps the resolved `#RRGGBB` color to an opaque Excel fill (`FFRRGGBB`) for header and data cells.
- JSON persists raw metadata through the canonical document object. CSV and Markdown adapters are untouched.

## Compatibility and Safety

- Missing optional color fields preserve existing appearance and valid version-1 documents.
- Only `#RGB` and `#RRGGBB` values are accepted internally; persisted values normalize to `#RRGGBB`. Invalid imported color values are dropped.
- Removing a column also removes its entry from every row's `cellBackgroundColors`; row creation initializes no unnecessary color data.
- Deleting a row deletes its cell-color map with the row. Changing a column type preserves its presentation color.

## Verification

- Unit tests cover color validation/normalization, precedence, column cleanup, and JSON normalization.
- Adapter tests assert HTML styles and XLSX fill values use the resolver.
- Browser smoke applies each scope, confirms precedence and clear fallback, then checks HTML/XLSX export preview or output path as applicable.
