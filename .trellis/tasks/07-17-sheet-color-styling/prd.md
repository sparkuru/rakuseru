# Sheet color styling

## Goal

Let users visually group and highlight procurement-sheet data with persistent background colors at column, row, and individual-cell scope.

## Confirmed Facts

- `mvp.md` explicitly calls for row, column, and individual-block coloring.
- The frontend-only document model has no current color metadata. JSON is the canonical format; HTML and XLSX already express presentation metadata, while CSV and Markdown are data-only.
- `SheetView` already distinguishes row, column, and cell selection. Column editing uses `ColumnSchemaPanel`; cell editing uses `EditorSidePanel`; selecting a row currently has no dedicated panel.

## Requirements

1. Store only optional background-color metadata for columns, rows, and individual cells. Do not add text colors, gradients, or conditional rules.
2. Resolve each displayed/exported data-cell background as cell > row > column > default. Column color applies to its header; row color applies to its row-number/action cell.
3. Expose color editing in the relevant column, row, and cell panels through a compact preset palette, a native color input, and a clear action. Clearing reveals the lower-precedence color.
4. Treat stored colors as strict CSS hex colors. Existing version-1 JSON documents without color metadata must remain valid; invalid optional color values must be ignored rather than reject an otherwise valid document.
5. Persist color metadata in JSON. Render the resolved background color in the editor and preserve it in HTML and XLSX exports. CSV and Markdown remain style-free.
6. Row/column deletion and schema changes must remove or preserve associated color metadata consistently with their existing data behavior; no orphaned cell-style records may remain.

## Acceptance Criteria

- [ ] Columns, rows, and individual cells can receive, change, and clear a persistent background color from their existing selection workflows.
- [ ] Editor display, including headers and row-action cells, follows cell > row > column > default precedence.
- [ ] Valid colors round-trip through JSON; missing or invalid optional color metadata does not break existing imports.
- [ ] HTML and XLSX exports use the resolved background color; CSV and Markdown output remains unchanged.
- [ ] Model and adapter tests cover precedence, metadata cleanup, JSON compatibility, and HTML/XLSX styling; lint, typecheck, test, build, and browser smoke checks pass.

## Out of Scope

- Text colors, gradients, conditional formatting, rule-based palettes, and theme management.
- Color preservation in CSV or Markdown.
- Importing colors from external XLSX files.
