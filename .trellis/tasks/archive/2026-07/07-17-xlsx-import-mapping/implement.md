# Implementation Plan: XLSX import and mapping validation

## Steps

1. Read the frontend adapter, type-safety, component, hook, state-management, and quality specs through `trellis-before-dev`; inspect `ExportPreviewDialog` styling and dialog behavior for reuse.
2. Add the pure XLSX import adapter and focused tests. Keep ExcelJS dynamically loaded. Define preview, mapping, warning, and blocking-issue types; test normalized worksheet extraction and document construction before wiring UI.
3. Add the XLSX confirmation dialog. Keep mapping state local, provide accessible labels and cancellation, and disable confirmation on blocking errors.
4. Extend Toolbar file acceptance and routing: existing formats retain their direct imports, while XLSX parses then opens the dialog. On confirm call `importDocumentAsNew`; on parsing failure call `setError`.
5. Add any minimal CSS needed for the mapping review layout without altering unrelated editor behavior.
6. Run focused tests first, then serially run `./hako npm run lint`, `./hako npm run typecheck`, `./hako npm test`, and `./hako npm run build`. Run a browser smoke test covering valid import, a blocked mapping, warning-only import, and cancellation.
7. Review the diff against this PRD, update relevant frontend specs if a durable adapter/import boundary is learned, then request final quality review before committing.

## Risk Controls

- Keep all parsed data and mappings dialog-local until the final adapter build succeeds; do not mutate the store during preview.
- Do not add a formula type, storage migration, new dependency, or eager ExcelJS import.
- Keep sheet/image/merge detection in the adapter and keep the component free of ExcelJS-specific objects.

## Rollback Points

- Adapter tests must pass before Toolbar routing changes.
- If browser memory or bundle behavior regresses, preserve the dynamic import boundary and avoid retaining raw workbook objects after preview generation.
- If confirm behavior is unsafe, disable the XLSX picker route while retaining existing import formats unchanged.
