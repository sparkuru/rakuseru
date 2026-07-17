# Technical Design: XLSX import and mapping validation

## Boundaries

- `src/adapters/importXlsx.ts` owns lazy ExcelJS loading, workbook inspection, normalized worksheet previews, mapping validation, and final `SheetDocument` construction. It depends only on model contracts and utilities, not React or Zustand.
- `src/components/ImportXlsxDialog.tsx` owns the transient review UI: worksheet selection, editable titles/types, warnings/errors, cancellation, and explicit confirmation.
- `src/components/Toolbar.tsx` remains the file-picker and import-flow coordinator. JSON, ZIP, and HTML imports retain their current immediate behavior; XLSX opens the dialog.
- The existing `importDocumentAsNew` store action remains the sole document-library mutation point.

## Data Flow

```text
XLSX File
  -> parseXlsxWorkbook(file.arrayBuffer())
  -> XlsxImportWorkbook (normalized selectable worksheet previews + source warnings)
  -> ImportXlsxDialog (worksheet + editable column mappings)
  -> buildXlsxDocument(preview, mapping)
  -> { document } | { blocking issues }
  -> importDocumentAsNew(document)
```

ExcelJS is dynamically imported inside the parser so the initial application bundle remains unchanged. A parsed preview stores display-oriented source cells, source-cell traits needed for validation (date/formula), merge coverage, and warning metadata; it never mutates application state.

## Parsing and Conversion Rules

- Load the workbook via `workbook.xlsx.load(arrayBuffer)`. Inspect every worksheet to determine whether it contains a non-empty grid; select the first such worksheet by default.
- Derive the usable rectangular grid from cell display values. The first non-empty row supplies headers. Remove wholly empty columns and later wholly empty data rows.
- Treat a merged range's master cell as its sole source value. Covered cells normalize to empty strings; add one non-blocking merge warning for the selected sheet.
- Preserve formula expressions as plain text (prefixed with `=` when necessary). Dates use the worksheet's display text. Do not retain formula or date metadata in the resulting document.
- Detect embedded images and emit one non-blocking warning without reading their binary data.
- Mapping starts as text. Build destination columns with fresh IDs and correct defaults. Single/multi-select options derive from normalized source values. Multi-select uses ASCII comma delimiters.
- Use the same `http:`/`https:` rule as `validateDocumentContent` for link mappings. Invalid numeric, monetary, link, date-to-numeric, blank-title, and duplicate-title cases are blocking build issues keyed to source rows/columns.
- Only a zero-blocking-issue build produces a `SheetDocument`; source warnings remain visible but do not block confirmation.

## UI and Interaction

- Reuse the established dialog styling and accessible modal conventions from `ExportPreviewDialog`.
- The dialog shows worksheet selection, document-title input (defaulted from the selected worksheet), one mapping row per kept source column, a concise sample/row count, non-blocking warnings, and blocking issues.
- Changing the worksheet resets its mapping to editable source headers and text types. Changing a title or type re-validates the preview immediately.
- The confirm action is disabled while parsing or while blocking issues exist. Cancel and close discard only dialog-local state. Toolbar routes parser errors to `setError`.

## Compatibility and Rollback

- No existing document, storage, JSON, or export contract changes. Existing import paths remain untouched.
- A failed or canceled XLSX import never calls `importDocumentAsNew`.
- The change can be rolled back by removing the XLSX adapter/dialog routing; no migration or persisted data cleanup is required.

## Verification Shape

- Unit-test the adapter with in-memory ExcelJS workbooks for worksheet selection, headers, empty rows/columns, mappings, dates, formulas, merge behavior, images, and failure output.
- Run the project validation suite and a browser smoke path: select XLSX, inspect mapping, verify error/warning behavior, confirm import, and verify cancellation preserves the existing library.
