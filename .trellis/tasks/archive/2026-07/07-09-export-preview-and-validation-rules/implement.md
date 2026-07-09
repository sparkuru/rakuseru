# Implementation Plan

## Pre-Work

- Load frontend specs with `trellis-before-dev` before coding.
- Re-read:
  - `src/components/Toolbar.tsx`
  - `src/components/SheetView.tsx`
  - `src/components/EditorSidePanel.tsx`
  - `src/state/sheetStore.ts`
  - `src/model/document.ts`
  - `src/model/cell.ts`
  - `src/model/validation.ts`
  - `src/adapters/exportCsv.ts`
  - `src/adapters/exportMarkdown.ts`
  - `src/adapters/exportJson.ts`
  - `src/adapters/exportXlsx.ts`
  - existing adapter/model tests
- Keep implementation frontend-only.

## Steps

- [x] Add `src/model/contentValidation.ts` with `ValidationIssue` and `validateDocumentContent(document)`.
- [x] Add unit tests for required, link, select, image, and coordinate issue behavior.
- [x] Add derived validation issues in the app layer.
- [x] Add validation markers to `SheetView` without changing table layout.
- [x] Add issue selection flow that selects the affected cell.
- [x] Add `ExportPreviewDialog` or equivalent component.
- [x] Move toolbar export button from direct download to opening preview.
- [x] Render CSV preview from `exportCsv(document)`.
- [x] Render JSON preview from `exportJson(document)`.
- [x] Render Markdown preview from `exportMarkdown(document)`.
- [x] Render Excel preview as a table approximation without importing ExcelJS.
- [x] Keep confirm-download using the existing adapter/download functions.
- [x] Show validation issues in preview and validation summary.
- [x] Add styles for preview dialog, issue list, code/text preview, and validation markers.
- [x] Update specs if a durable validation/preview convention is established.
- [x] Run automated checks.
- [x] Run browser smoke for validation summary, issue selection, preview, and confirm export.

## Validation Commands

```bash
./hako npm run lint
./hako npm run typecheck
./hako npm test
./hako npm run build
```

## Browser Smoke Checklist

- [x] Required column violation appears in validation summary.
- [x] Invalid link appears in validation summary.
- [x] Selecting a validation issue selects the target cell.
- [x] Validation marker appears on the target cell.
- [x] CSV preview opens from the export button and confirm downloads CSV.
- [x] JSON preview opens and confirm downloads JSON even with validation issues.
- [x] Markdown preview opens and shows Markdown output.
- [x] Excel preview opens as a table approximation and confirm downloads XLSX.
- [x] Existing import JSON flow still works.
- [x] Autosave still works after validation markers/previews are added.

## Review Notes

- Automated checks passed: `./hako npm run lint`, `./hako npm run typecheck`, `./hako npm test`, `./hako npm run build`.
- Browser smoke passed with validation summary, issue selection, cell marker, CSV/JSON/Markdown/Excel preview, and confirm downloads.
- Smoke screenshot: `/tmp/rakuseru-export-preview-smoke/preview-validation.png`.
- Build still reports the existing ExcelJS direct-eval and large-chunk warnings; no new build failure.

## Rollback Points

- Model validation helper can land independently from UI markers.
- Preview dialog can fall back to a side-panel preview if overlay behavior conflicts with sticky layout.
- Excel preview can stay table-only while preserving actual Excel export on confirm.
