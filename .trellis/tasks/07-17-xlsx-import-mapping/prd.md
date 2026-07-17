# XLSX import and mapping validation

## Goal

Let users import one standard XLSX worksheet into a new Rakuseru document through an explicit mapping-and-validation step, without losing or silently corrupting representable data.

## Confirmed Facts

- Rakuseru is a frontend-only Vite + React + TypeScript application. Imports create a new local document and never overwrite the active document.
- `Toolbar` currently imports JSON, JSON ZIP, and Rakuseru HTML. The installed `exceljs` dependency is already lazy-loaded by XLSX export.
- JSON is the lossless canonical format. XLSX export contains displayed headers and values but not the complete Rakuseru schema.
- The document model supports text, number, money, single-select, multi-select, image, and link columns. Import validation belongs in adapters/model code; UI failures use the existing store error state.

## Requirements

1. The import file picker accepts XLSX files. A valid file opens an import-confirmation interface; a new local document is created only after the user confirms a valid mapping.
2. The interface lists available worksheets, defaults to the first non-empty one, and imports exactly one selected worksheet per confirmation.
3. For the selected worksheet, the first non-empty row is the editable column-title row. Later non-empty rows are data. Entirely blank columns and data rows are skipped.
4. Imported columns default to text. The user can change each column title and map it to a supported Rakuseru type before confirming. Empty or duplicate titles are blocking issues.
5. For number and money mappings, every non-empty value must be convertible; otherwise the relevant cells are blocking issues. For link mappings, values are preserved as text but every non-empty value must be an `http` or `https` URL. These invalid mappings block confirmation.
6. Single-select mappings infer unique non-empty values as options. Multi-select mappings split non-empty values on ASCII commas and infer unique resulting options.
7. Formula cells become plain text. The feature must not preserve formulas, calculate formulas, or expose future-formula UI.
8. Date cells become the displayed Excel text and default to text. Mapping date cells to number or money is a blocking incompatibility so Excel serial dates are never silently imported.
9. Embedded worksheet images are not imported; their presence is a non-blocking warning. For merged cells, only the upper-left value is imported, all other cells in the merge are empty, and the lost layout is a non-blocking warning.
10. Unrepresentable formatting, merged layout, and images must never block an otherwise valid table import. Parse failures, empty worksheets, and blocking mapping errors must be clear and must not create or persist a partial document.

## Acceptance Criteria

- [ ] Selecting a valid `.xlsx` file opens a review UI before creating a document; cancel leaves the library unchanged.
- [ ] The review UI chooses a worksheet, defaults to the first non-empty one, and each successful confirmation creates one newly active document.
- [ ] The first non-empty row becomes editable column titles; empty rows and columns are excluded, and blank/duplicate titles prevent confirmation.
- [ ] Every imported column starts as text and supports the agreed mapping rules, including inferred select options and visible blocking conversion errors.
- [ ] Formula and date cells follow the agreed plain-text/display-text rules; numeric mapping of a date is blocked.
- [ ] Embedded images and merged cells yield non-blocking warnings and follow the agreed omission/upper-left-value behavior.
- [ ] Invalid files, empty worksheets, and conversion errors are shown in the existing user-visible error/review UI without creating a document.
- [ ] Focused importer tests cover worksheet selection, header/data cleanup, conversions, blocking issues, dates, formulas, merges, and image warnings; the full lint, typecheck, test, build, and browser import smoke checks pass.

## Out of Scope

- Formula calculation, formula preservation, and cross-cell or cross-worksheet references.
- Extracting embedded XLSX images, retaining workbook styling, or retaining merged layout.
- Lossless XLSX round trips for Rakuseru-only schema fields.
- Bulk importing multiple worksheets, overwriting an existing document, or changing JSON as the canonical format.
