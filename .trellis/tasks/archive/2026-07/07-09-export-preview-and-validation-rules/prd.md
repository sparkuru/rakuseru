# Export Preview And Validation Rules

## Goal

Add a pre-export review flow and usable validation rules so Rakuseru can show users what will be exported and where the current sheet violates column schema constraints before the file leaves the app.

## User Value

Users should be able to catch missing required values, malformed links, invalid selections, and display/export formatting problems before sharing a procurement sheet. Export preview should make CSV, Markdown, JSON, and Excel output less blind without turning Rakuseru into a full spreadsheet or document renderer.

## Confirmed Facts

- Rakuseru is currently a frontend-only Vite + React + TypeScript app.
- The toolbar already supports JSON import and CSV/JSON/Markdown/Excel export from `src/components/Toolbar.tsx`.
- Existing export adapters are pure functions for CSV, JSON, and Markdown. Excel export is async and lazy-loads ExcelJS in `src/adapters/exportXlsx.ts`.
- Runtime document validation in `src/model/validation.ts` validates imported/stored document structure, version, columns, rows, and cell coercion.
- There is no separate content validation layer for active sheets.
- `ColumnDef.required` exists in `src/model/document.ts`, but it currently has no visible validation behavior.
- `ColumnDef.type` supports `text`, `number`, `money`, `singleSelect`, `multiSelect`, `image`, and `link`.
- `coerceCellValue` already normalizes invalid select values and non-numeric numeric/money inputs during model updates, so validation should focus on user-facing sheet quality rather than re-parsing untrusted imports.
- Recent UX work added a right-side editor panel and a sticky workspace; new preview UI should preserve the working-editor first screen.

## Requirements

- Keep MVP frontend-only:
  - no backend;
  - no routing requirement;
  - no cloud storage;
  - no new UI framework.
- Add a validation layer for the active `SheetDocument`:
  - returns structured validation issues with row id, column id, severity, message, and location label;
  - validates required values for all column types;
  - validates link values as plausible URLs when non-empty;
  - validates single-select and multi-select values against configured options;
  - validates image cells only when required or structurally invalid image values appear;
  - treats document structure/import validation as a separate existing boundary.
- Show validation results in the UI:
  - users can open a validation summary without exporting;
  - validation issues identify row/column coordinates using the same one-based data coordinate convention as cell badges;
  - clicking or otherwise selecting an issue should move the editor context to the affected cell when practical;
  - affected cells should have a visible but non-disruptive marker.
- Add export preview:
  - export actions should open a preview/review flow before downloading;
  - preview should use the currently selected export format;
  - CSV preview shows text/table content that matches CSV adapter output;
  - Markdown preview shows Markdown text and/or a rendered table view derived from the same output;
  - JSON preview shows formatted JSON text;
  - Excel preview shows an HTML/table approximation of exported workbook rows and columns, not a binary workbook renderer;
  - users can still confirm and download from the preview.
- Integrate validation with preview:
  - preview shows current validation issues before export;
  - validation issues should not silently disappear during export;
  - validation issues warn but do not hard-block export after explicit confirmation;
  - JSON export remains available as the lossless backup format.
- Preserve existing import/export contracts:
  - JSON import/export round-trips the canonical document;
  - CSV/Markdown/Excel export content remains compatible with current adapter tests unless intentionally changed and tested;
  - ExcelJS remains lazy-loaded only when actually generating the Excel file.
- Keep browser accessibility basics:
  - modal/dialog or panel controls need visible names;
  - issue list and preview controls need keyboard-accessible buttons;
  - icon-only buttons need `aria-label` and `title`.

## Acceptance Criteria

- [x] A model-level content validation helper returns structured issues for required fields, invalid links, and invalid select values.
- [x] Unit tests cover required validation across string, number, array, image, and empty cells.
- [x] Unit tests cover link validation and select-option validation.
- [x] The toolbar exposes a way to open validation results without downloading.
- [x] Clicking export opens a preview/review UI instead of immediately downloading.
- [x] Preview can render CSV, JSON, Markdown, and Excel-as-table output from the selected export format.
- [x] Preview shows validation issues alongside the export output.
- [x] Users can confirm export from the preview and download the selected format.
- [x] Validation issues do not hard-block export after explicit confirmation.
- [x] JSON export remains possible even when validation issues exist.
- [x] Affected cells show a visible validation marker in the sheet.
- [x] Selecting a validation issue focuses or selects the affected cell when the issue has a row/column location.
- [x] Existing JSON import, JSON export, CSV export, Markdown export, and Excel export tests continue to pass.
- [x] `./hako npm run lint`, `./hako npm run typecheck`, `./hako npm test`, and `./hako npm run build` pass.
- [x] Browser smoke covers validation summary, validation markers, preview for at least CSV/Markdown/JSON, Excel preview table, and confirm-download.

## Out Of Scope

- Backend validation.
- User-defined custom validation formulas.
- Full Excel workbook rendering in the browser.
- XLSX import.
- PDF export.
- Multi-file management.
- Cloud sync or collaboration.
- Complex per-column validation options such as min/max, regex, or URL allowlists unless needed as a small internal helper for existing column types.

## Review Notes

- Validation and export preview were implemented frontend-only with the existing document model and export adapters.
- Browser smoke screenshot: `/tmp/rakuseru-export-preview-smoke/preview-validation.png`.
- Build warnings remain the existing ExcelJS direct-eval and chunk-size warnings.
