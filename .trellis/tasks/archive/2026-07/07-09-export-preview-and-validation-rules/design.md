# Design: Export Preview And Validation Rules

## Objective

Add a content-validation layer and an export preview/review flow without changing Rakuseru's canonical document model or import/export adapter contracts.

## Boundaries

In scope:

- Active-sheet content validation for existing column types.
- Validation markers in the sheet.
- Validation summary UI.
- Export preview dialog/panel.
- Confirm-download flow from the preview.
- Focus/select affected cell from an issue list.

Out of scope:

- Structural import validation changes beyond tests required by new helpers.
- New document version.
- Full Excel binary preview.
- Backend/API validation.
- User-defined custom validation formulas.

## Validation Model

Add a model helper, likely `src/model/contentValidation.ts`:

```ts
export type ValidationSeverity = 'warning' | 'error'

export type ValidationIssue = {
  id: string
  severity: ValidationSeverity
  rowId?: string
  columnId?: string
  x?: number
  y?: number
  columnTitle?: string
  message: string
}

export function validateDocumentContent(document: SheetDocument): ValidationIssue[]
```

Rules:

- Required:
  - string is missing when trimmed value is empty;
  - number/money is missing only when the raw cell value is not a finite number, because `0` can be a legitimate value;
  - multi-select is missing when the array is empty;
  - image is missing when value is not an image value;
  - single-select/link/text are missing when trimmed string is empty.
- Link:
  - non-empty link cells must parse as `http:`, `https:`, or a valid relative/path-like URL if product scope chooses to allow relative links.
  - Recommended MVP: accept only `http:` and `https:` for clear procurement-share semantics.
- Select:
  - single-select value must be empty or included in `column.options`;
  - multi-select values must all be included in `column.options`;
  - columns with no options should produce a warning if rows contain selected values.
- Image:
  - image cells are valid if empty and not required;
  - image cells with object values rely on `isImageValue`.

The existing `validateSheetDocument(input: unknown)` remains the untrusted import/storage boundary. Content validation accepts trusted `SheetDocument` values and reports user-facing quality issues.

## UI Integration

Add validation state as derived data from the current document, not persisted data:

- compute issues in `App` or via memoized selectors;
- pass issue data to toolbar/preview and sheet as props, or add selectors if store ownership becomes cleaner;
- keep the store's document mutation path unchanged.

Sheet markers:

- mark cells with validation issues using a subtle corner/outline indicator;
- do not resize cells;
- use existing one-based `(xN,yM)` coordinate logic for labels.

Issue selection:

- if an issue has `rowId` and `columnId`, selecting it should call `selectCell(rowId, columnId)`;
- when issue belongs to document-level validation, keep focus in the validation summary.

## Export Preview Flow

Refactor toolbar export:

- selected format remains a native select;
- `导出` opens a preview dialog instead of downloading immediately;
- preview dialog includes:
  - selected format label;
  - validation summary;
  - preview content;
  - `取消`;
  - `确认导出`;
  - optional format switch if it stays simple.

Preview generation:

- CSV: call `exportCsv(document)` and show text plus an optional table approximation.
- Markdown: call `exportMarkdown(document)` and show source text; optionally render a simple table preview from document rows.
- JSON: call `exportJson(document)` and show formatted JSON source.
- Excel: render a table approximation from `document.columns` and `document.rows`; call `exportXlsxBlob(document)` only after confirmation.

Do not import ExcelJS for preview.

## Validation And Export Policy

MVP policy:

- validation issues are always visible in preview;
- export remains possible after explicit confirmation, including non-JSON formats;
- JSON export is never blocked because it is the lossless recovery/backup format;
- if later stricter behavior is needed, add a small policy switch in the preview flow instead of baking hard blocks into adapters.

## Tests

Model tests:

- required validation by column type;
- link validation;
- select-option validation;
- issue coordinate and labels.

Adapter tests:

- unchanged unless preview helpers add shared formatting utilities.

Browser smoke:

- create at least one required violation;
- open validation summary;
- select issue and verify cell selection/marker;
- open CSV preview and confirm export;
- switch to JSON/Markdown preview;
- verify Excel preview renders table without eagerly loading ExcelJS if practical.

## Rollback

- If dialog UX becomes brittle, implement preview as the existing right-side panel mode before returning to a dialog.
- If cell markers clutter the grid, keep markers only for active validation summary state while retaining model validation.
- If Excel preview is confusing, label it clearly as "Excel table preview" and keep binary generation only on confirm.
