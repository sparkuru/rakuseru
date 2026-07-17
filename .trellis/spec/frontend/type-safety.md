# Type Safety

TypeScript strict mode is required. `SheetDocument`, `ColumnDef`, `RowData`, and `CellValue` in `src/model/document.ts` are the canonical contracts for sheet contents, storage payloads, imports, and export adapters. Document-library metadata wraps `SheetDocument` in `src/model/library.ts`; it must not replace or fork the canonical sheet model.

## Compiler Contract

`tsconfig.app.json` enables strict TypeScript with `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `isolatedModules`, and `allowJs: false`. New source should be TypeScript and should pass `./hako npm run typecheck`.

## Type Organization

Shared document types live in `src/model/document.ts`. Boundary modules import these types instead of redefining partial shapes.

Column type values are centralized in `COLUMN_TYPES` from `src/model/column.ts`. Use this list for UI selectors and validation instead of duplicating string arrays.

Document-library wrapper types live in `src/model/library.ts`: `LibraryDocumentRecord`, `LibraryDocumentSummary`, and `DocumentLibrarySnapshot`. Keep record ids, timestamps, and title metadata in this wrapper. Keep editable sheet contents in the nested `SheetDocument`.

## Validation

Runtime validation for JSON imports and IndexedDB reads lives in `src/model/validation.ts`. It accepts `unknown`, returns `ValidationResult<SheetDocument>`, and normalizes cells through shared model helpers.

Validation boundary:

```ts
validateSheetDocument(input: unknown): ValidationResult<SheetDocument>
```

Bad imports should return user-readable error strings. Valid imports should return a version-1 `SheetDocument` with row cells aligned to current column ids.

## Active Sheet Content Validation

Content validation for already-loaded editor documents lives in `src/model/contentValidation.ts`. Keep it separate from `validateSheetDocument`: import/storage validation protects the app from untrusted structure, while content validation reports user-facing quality issues on a trusted `SheetDocument`.

### 1. Scope / Trigger

- Trigger: export preview, validation markers, and validation summaries need the same issue contract without mutating document state.
- Scope: `src/model/contentValidation.ts`, table markers, toolbar validation summary, and export preview.

### 2. Signatures

```ts
type ValidationSeverity = 'warning' | 'error'

type ValidationIssue = {
  id: string
  severity: ValidationSeverity
  rowId?: string
  columnId?: string
  x?: number
  y?: number
  columnTitle?: string
  locationLabel: string
  message: string
}

validateDocumentContent(document: SheetDocument): ValidationIssue[]
```

### 3. Contracts

- `validateDocumentContent` accepts a canonical `SheetDocument`, not `unknown`.
- Issues should include stable row/column ids when the problem belongs to a cell.
- `x` and `y` are one-based data coordinates. The row-number/action column is not counted as `x`.
- `locationLabel` should be display-ready, for example `(x1,y2) 物品`.
- The helper reports issues only. It must not coerce, repair, select, save, or export data.

### 4. Validation & Error Matrix

- Required text/link/single-select with trimmed empty string -> error.
- Required number/money with non-finite or non-number value -> error; `0` is valid.
- Required multi-select with empty array -> error.
- Required image without a valid `ImageValue` -> error.
- Non-empty link that is not absolute `http:` or `https:` -> error.
- Single-select value not in configured options -> error.
- Multi-select values not in configured options -> error.
- Select value present when the column has no options -> warning.
- Non-empty image value that fails `isImageValue` -> error.

### 5. Good/Base/Bad Cases

- Good: export preview calls `validateDocumentContent(document)` and shows warnings while still allowing confirmed export.
- Base: empty optional fields produce no issues.
- Bad: reusing `validateSheetDocument` for active-sheet quality checks or casting untrusted imports to `SheetDocument`.

### 6. Tests Required

- Required validation across string, number, array, image, and empty cells.
- Link URL validation with coordinates and location labels.
- Single-select and multi-select option validation, including the no-options warning case when behavior changes.
- Unit tests should assert `0` remains valid for required numeric/money cells.

### 7. Wrong vs Correct

Wrong:

```ts
const document = parsedJson as SheetDocument
const issues = validateDocumentContent(document)
```

Correct:

```ts
const result = validateSheetDocument(parsedJson)
if (result.ok) {
  const issues = validateDocumentContent(result.value)
}
```

## JSON Import Error Contract

### 1. Scope / Trigger

- Trigger: JSON import crosses adapter, model validation, Zustand state, and toolbar UI boundaries.
- Scope: `src/adapters/importJson.ts`, `src/model/validation.ts`, `src/state/sheetStore.ts`, and `src/components/Toolbar.tsx`.

### 2. Signatures

```ts
validateSheetDocument(input: unknown): ValidationResult<SheetDocument>
importJson(content: string): SheetDocument
setDocument(document: SheetDocument, message?: string): void
importDocumentAsNew(document: SheetDocument, message?: string): void
replaceActiveDocument(document: SheetDocument, message?: string): void
setError(message: string): void
```

### 3. Contracts

- `importJson` parses raw file text and either returns a validated `SheetDocument` or throws `Error`.
- `validateSheetDocument` accepts `unknown`, validates `version`, `title`, `columns`, `rows`, and row `cells`, then normalizes cells through `coerceCellValue`.
- Valid imports create a new library document by default through `importDocumentAsNew`. Explicit current-sheet replacement, when exposed, should use `replaceActiveDocument`.
- Failed imports leave the current document unchanged and surface the message through `setError`.

### 4. Validation & Error Matrix

- Invalid JSON syntax -> `Invalid JSON: <parser message>`.
- Wrong document version -> `Document version must be 1.`.
- Empty or invalid title -> `Document title is required.`.
- Missing or empty columns -> `Document must include at least one column.`.
- Duplicate valid column ids -> `Column ids must be unique.`.
- Malformed columns with synthetic fallback ids -> report the structural column error, not a duplicate-id error caused by fallback ids.
- Non-array rows -> `Rows must be an array.`.
- Unsupported column type -> `Column <n> has an unsupported type.`.
- Valid document -> version-1 `SheetDocument` with row cells aligned to current column ids.

### 5. Good/Base/Bad Cases

- Good: importing a file produced by `exportJson(document)` creates a new active library sheet losslessly unless the user explicitly chose replacement.
- Base: importing malformed JSON keeps the current document and shows a parse error in the status line.
- Bad: casting parsed JSON as `SheetDocument` or letting an async import handler fail without `try/catch`.

### 6. Tests Required

- Unit tests should cover validation failures in `validateSheetDocument`.
- Adapter tests should assert `importJson` throws user-readable `Error` messages when parse or validation behavior changes.
- Adapter tests should cover duplicate-id errors and malformed-column errors separately so validation fallback ids do not create misleading duplicate-id regressions.
- UI/store tests are required if the status display or import event flow becomes more complex than the current toolbar handler.

### 7. Wrong vs Correct

Wrong:

```ts
importDocumentAsNew(importJson(content), `Imported ${file.name}`)
```

Correct:

```ts
try {
  importDocumentAsNew(importJson(content), `Imported ${file.name}`)
} catch (error) {
  setError(error instanceof Error ? error.message : `Could not import ${file.name}`)
}
```

## HTML Handoff Import and Export

### 1. Scope / Trigger

- Trigger: users need a standalone browser report that can later return to Rakuseru for editing.
- Scope: `src/adapters/exportHtml.ts`, `src/adapters/importHtml.ts`, `src/adapters/importJson.ts`, toolbar file selection, and HTML export preview.

### 2. Signatures

```ts
exportHtml(document: SheetDocument, exportedAt?: Date): string
importHtml(content: string): SheetDocument
importJson(content: string): SheetDocument
```

### 3. Contracts

- HTML is a derived, self-contained report, never a second canonical document format.
- `exportHtml` embeds the complete `SheetDocument` once in the inert selector `script#rakuseru-document[type="application/json"]` and escapes script terminators in its JSON text.
- `importHtml` accepts only that exact single payload, then delegates to `importJson`; only `importJson` crosses the `validateSheetDocument` boundary.
- UI code chooses the adapter from the accepted file extension and sends a successful result only to `importDocumentAsNew`.
- Report markup escapes every dynamic value; only absolute `http:` and `https:` link values are anchors.
- Report image zoom uses unique fragment ids and CSS `:target`, keeping the standalone file script-free; its table is centered at 85% desktop width and uses full width on narrow screens.
- Markdown embeds valid `data:image/...;base64,...` image values. CSV is text-only and exports an image name; do not claim that a CSV cell renders an image.

### 4. Validation & Error Matrix

- Missing payload marker -> `This HTML file does not contain a Rakuseru document payload.`
- Multiple payload markers -> `This HTML file contains multiple Rakuseru document payloads.`
- Malformed payload JSON -> propagate `Invalid JSON: ...` from `importJson`.
- Structurally invalid payload -> propagate the user-readable `validateSheetDocument` error from `importJson`.
- One valid payload -> return the validated version-1 `SheetDocument` without changing its title or cells.

### 5. Good/Base/Bad Cases

- Good: HTML preview and download use the same generated string, then re-import creates a new library document losslessly.
- Base: a report with empty cells still contains an importable canonical payload.
- Bad: scraping an arbitrary HTML table into a `SheetDocument`, accepting several payloads and guessing which one wins, or parsing the payload directly in `Toolbar`.

### 6. Tests Required

- Assert report structure, inline CSS, image/link rendering, presentation metadata, and dynamic-value escaping.
- Assert HTML image-lightbox ids and CSS plus Markdown image syntax; assert CSV retains an image filename.
- Assert exact `exportHtml`/`importHtml` round-trip, including a value containing `</script>`.
- Assert foreign HTML, duplicate markers, malformed JSON, and invalid canonical payloads produce the expected errors.
- Browser smoke the HTML option, sandboxed iframe preview, confirmation, and import-as-new flow.

### 7. Wrong vs Correct

Wrong:

```ts
const document = JSON.parse(payload.textContent ?? '') as SheetDocument
importDocumentAsNew(document)
```

Correct:

```ts
const document = importHtml(content)
importDocumentAsNew(document)
```

## Column Presentation Metadata

### 1. Scope / Trigger

- Trigger: column presentation settings are stored in `ColumnDef`, validated on JSON import, rendered in cells, and consumed by export adapters.
- Scope: `src/model/document.ts`, `src/model/column.ts`, `src/model/validation.ts`, cell rendering, column schema UI, and format adapters that can express the setting.

### 2. Signatures

```ts
type ColumnAlign = 'left' | 'center' | 'right'

type ColumnDef = {
  width?: number
  lockedWidth?: boolean
  wrap?: boolean
  align?: ColumnAlign
  required?: boolean
}

const COLUMN_ALIGNMENTS: ColumnAlign[]
getDefaultColumnAlign(column: ColumnDef): ColumnAlign
getColumnAlign(column: ColumnDef): ColumnAlign
```

### 3. Contracts

- `ColumnDef.align` is optional so existing version-1 documents remain valid.
- Missing alignment must be read through `getColumnAlign(column)`, not by directly checking `column.align`.
- Default alignment is `right` for `number` and `money`; all other current column types default to `left`.
- JSON validation accepts only `left`, `center`, and `right`; invalid alignment metadata is ignored instead of rejecting an otherwise valid existing document.
- `normalizeColumnForType` must preserve presentation metadata such as `width`, `lockedWidth`, `wrap`, `align`, and `required` when changing a non-select column's type.
- XLSX export should map `getColumnAlign(column)` to worksheet cell horizontal alignment and respect `wrap` when possible. Text formats such as CSV and Markdown should stay data-only unless their format gains a presentation layer.

### 4. Validation & Error Matrix

- `align` missing -> valid; use `getDefaultColumnAlign(column)`.
- `align` is `left`, `center`, or `right` -> valid; preserve it.
- `align` is another string or non-string value -> valid import, but normalized column omits `align`.
- Presentation metadata invalid or absent must not change cell coercion semantics.

### 5. Good/Base/Bad Cases

- Good: the cell renderer and XLSX adapter call `getColumnAlign(column)` so numeric defaults and user-selected overrides stay consistent.
- Base: importing a document exported before alignment existed keeps loading and displays default alignment.
- Bad: reading `column.align ?? 'left'` in a renderer, which silently breaks number and money defaults.

### 6. Tests Required

- Unit tests for `validateSheetDocument` accepting valid `align` values.
- Unit tests for invalid optional alignment being ignored without rejecting the document.
- Renderer/export tests or browser smoke when changing how `getColumnAlign` affects visible table cells or XLSX output.

### 7. Wrong vs Correct

Wrong:

```ts
const horizontal = column.align ?? 'left'
```

Correct:

```ts
const horizontal = getColumnAlign(column)
```

## XLSX Import Review Contract

### 1. Scope / Trigger

- Trigger: XLSX is an external, lossy source format that needs user-approved schema mapping before it can become a canonical `SheetDocument`.
- Scope: `src/adapters/importXlsx.ts`, `src/components/ImportXlsxDialog.tsx`, and the XLSX branch of `src/components/Toolbar.tsx`.

### 2. Signatures

```ts
parseXlsxWorkbook(content: ArrayBuffer): Promise<XlsxImportWorkbook>
createXlsxColumnMappings(sheet: XlsxImportSheet): XlsxColumnMapping[]
buildXlsxDocument(sheet: XlsxImportSheet, mappings: XlsxColumnMapping[], title?: string): XlsxImportBuildResult
```

### 3. Contracts

- `parseXlsxWorkbook` dynamically imports ExcelJS and returns normalized, dialog-local worksheet previews; it must not mutate Zustand state or persist data.
- `XlsxImportWorkbook.defaultSheetName` is the first non-empty sheet. A confirmation imports exactly one selected worksheet through `importDocumentAsNew`.
- The preview uses the first non-empty row for editable headers, removes wholly empty columns/data rows, and retains source row/column locations for errors.
- Mappings default to text. Image is not an XLSX-mappable destination type because embedded images are intentionally not extracted.
- `buildXlsxDocument` returns no `document` whenever it has an error issue. Only a successful build may reach `importDocumentAsNew`.
- Formula cells become plain text; dates use a stable display-oriented date string and cannot silently map to number/money. Merges and embedded images create warnings, not persistence side effects.
- Link mappings use the shared `isHttpUrl` predicate so active-document validation and import validation accept the same protocols.

### 4. Validation & Error Matrix

- Malformed XLSX or no non-empty worksheet -> throw a user-readable parser error; Toolbar calls `setError` and leaves the library unchanged.
- Empty selected worksheet, blank title/header, duplicate header, missing mapping -> error issue and no result document.
- Number/money source value cannot convert, or source is a date -> error issue and no result document.
- Link value is not `http:` or `https:` -> error issue and no result document.
- Embedded image or merged cells -> warning issue; import remains available when no errors exist.

### 5. Good/Base/Bad Cases

- Good: parse a file, edit titles/types in `ImportXlsxDialog`, call `buildXlsxDocument`, then send only its `document` to `importDocumentAsNew`.
- Base: all-text worksheet imports using the default mappings without any schema inference beyond the source headers.
- Bad: call `importDocumentAsNew` while parsing, parse ExcelJS objects in a component, or coerce an invalid numeric/link mapping to an empty value.

### 6. Tests Required

- Adapter tests cover first non-empty sheet selection, blank row/column removal, mapped number/money/select conversion, and zero-document errors.
- Adapter tests cover formula text, date-to-number blocking, merge warnings, and image warnings.
- Browser smoke covers cancel-without-library-change, a blocking mapping with disabled confirmation, and a warning-only import that creates one new active document.
- Keep the full lint, typecheck, test, and production-build checks green; ensure ExcelJS remains dynamically imported.

### 7. Wrong vs Correct

Wrong:

```ts
const workbook = await parseXlsxWorkbook(content)
importDocumentAsNew(buildXlsxDocument(workbook.sheets[0], mappings).document!)
```

Correct:

```ts
const result = buildXlsxDocument(sheet, mappings, title)
if (result.document) {
  importDocumentAsNew(result.document, 'Imported Excel sheet')
}
```

## Type Guards And Coercion

Use type guards for untrusted values, such as `isImageValue` in `src/model/cell.ts`. Keep coercion in `src/model/cell.ts` so UI edits, imports, and storage reads share behavior.

## Tests

Model tests in `src/model/document.test.ts` cover sample document creation, row/column operations, value coercion, and invalid import rejection. Add tests when changing model contracts, coercion behavior, or validation outcomes.

## Anti-Patterns

- Using `any` for document payloads.
- Casting imported JSON directly in components.
- Duplicating payload field extraction in multiple consumers.
- Creating a new column type without updating `ColumnType`, `COLUMN_TYPES`, `createEmptyCellValue`, `coerceCellValue`, validation, editors, export behavior, and tests.
