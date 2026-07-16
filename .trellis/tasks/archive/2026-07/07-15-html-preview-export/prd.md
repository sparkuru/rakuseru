# Add HTML preview and export

## Goal

Let users review and download the active procurement sheet as HTML so it can be opened directly in a browser or shared as a readable snapshot, without changing Rakuseru's canonical JSON model.

## Confirmed Facts

- Rakuseru is a frontend-only Vite + React + TypeScript app with no backend, routing, or cloud storage.
- JSON is the lossless canonical format. CSV, Markdown, and XLSX are derived exports.
- `Toolbar` owns export-format selection and download actions; `ExportPreviewDialog` owns the pre-download review surface.
- The preview already renders CSV, Markdown, JSON, and an HTML-table approximation for Excel. ExcelJS remains lazy-loaded until download confirmation.
- The document model supports text, number, money, single-select, multi-select, image, and link cells, plus optional width, wrapping, and alignment metadata.
- The MVP lists HTML as a browser-facing export target, but there is no `exportHtml` adapter or HTML option in the toolbar today.

## Requirements

- Keep the feature frontend-only and add no UI framework or backend dependency.
- Add HTML as a selectable export format and show it through the existing preview-before-download flow.
- Derive HTML only from the current `SheetDocument`; do not make HTML a new import format or source of truth.
- Export one self-contained HTML snapshot: inline its CSS and rely only on document data, including existing image data URLs, so recipients can open it offline without Rakuseru or network access.
- Make the exported HTML a portable editing handoff: embed a lossless canonical JSON payload so Rakuseru can recover the sheet for continued editing when the file returns to the project.
- Extend the existing import-as-new picker to accept `.json` and Rakuseru-generated `.html`; HTML recovery must extract the embedded payload, use the existing document validation boundary, and add the result as a new document.
- Exported HTML is a clean, read-only report: title, semantic table, images, clickable links, and stored presentation metadata belong in it; Rakuseru editing controls and local-library controls do not.
- The report header shows the document title and the export timestamp so a standalone file remains identifiable as a dated snapshot.
- The pre-download dialog renders the generated report in a sandboxed visual preview, so users review the actual report layout rather than a table approximation.
- HTML report images are clickable and open a no-script, full-size lightbox within the standalone file.
- The standalone HTML report itself is 85% of the viewport width on desktop, with its table filling that report; narrow screens expand to the available width.
- HTML is the initially selected export format. Markdown embeds valid image data URLs using standard image syntax; CSV retains the image filename because CSV cells cannot contain rendered image binary data.
- When a sheet contains image cells, CSV and Markdown must be unavailable export choices; their controls visually communicate that restriction.
- Image-bearing sheets may export as HTML, XLSX with embedded images, or a Rakuseru JSON ZIP archive. The archive contains one JSON manifest and image files under `img/`; importing the archive restores the original canonical document as a new sheet.
- Sheets without image values retain the existing plain `.json` export. Sheets with image values export JSON as a `.zip` archive instead.
- Preserve the existing export, validation-warning, accessibility, and lazy-loading behavior for other formats.

## Acceptance Criteria

- [x] HTML export is a self-contained snapshot that recipients can open offline, with inline CSS and no runtime dependency on Rakuseru or the network.
- [x] The report presents a title and export timestamp, a semantic table, images, safe clickable links, and column/row display metadata; it contains no Rakuseru editing or local-library controls.
- [x] User-provided text, titles, URLs, and image metadata cannot break the generated document structure or execute as markup.
- [x] The preview dialog renders the same generated HTML in an isolated, keyboard-accessible iframe; link activation remains possible without allowing scripts in the preview.
- [x] An exported HTML file can be returned to Rakuseru without losing the canonical sheet data.
- [x] The import-as-new picker accepts `.json` and `.html`; it only recovers HTML that contains one valid Rakuseru canonical payload and surfaces understandable errors for all other files.
- [x] HTML recovery uses the existing `validateSheetDocument` import boundary and preserves the original document title and canonical document data.
- [x] Existing export, validation-warning, accessibility, and lazy-loading behavior remains unchanged for non-image CSV, JSON, Markdown, and Excel workflows.
- [x] Adapter and UI-adjacent unit tests cover HTML rendering, escaping, payload recovery, invalid/foreign HTML rejection, and exact document round-trip.
- [x] `./hako npm run lint`, `./hako npm run typecheck`, `./hako npm test`, and `./hako npm run build` pass.
- [x] Clicking an exported HTML image opens a full-size, keyboard-accessible no-script lightbox and can be closed with its visible link.
- [x] The exported HTML report occupies 85% viewport width on desktop, its table fills that report, and it stays usable on narrow viewports.
- [x] HTML is the default selected export format.
- [x] A sheet with image cells disables CSV and Markdown selection with an understandable unavailable affordance, while still allowing HTML, JSON ZIP, and Excel.
- [x] A JSON ZIP archive stores a JSON manifest plus deduplicated image files and imports losslessly as a new document through the existing validation boundary.
- [x] XLSX embeds supported image files in their data cells rather than exporting only their names.

## Out Of Scope

- General-purpose HTML import; only Rakuseru HTML files carrying the embedded canonical payload are eligible for recovery.
- Backend hosting, sharing links, cloud storage, or collaboration.
- URL cell queries and color metadata; they are separate MVP follow-up items.

## Technical Notes

- Existing image cells already use data URLs, so the adapter can retain them without introducing an asset-upload or network boundary.
- The existing import picker only accepts JSON. Supporting HTML handoff requires a narrow importer that extracts and validates the embedded canonical JSON before adding it as a document.
- `src/components/Toolbar.tsx` is the sole integration point for format selection, download actions, and import-as-new; `src/components/ExportPreviewDialog.tsx` owns the preview dialog.
- `src/adapters/importJson.ts` already funnels JSON through `validateSheetDocument`; the HTML importer should reuse that boundary rather than duplicate structural validation.
- The HTML adapter must escape all interpolated markup and JSON-script terminators; only `http:` and `https:` URLs should become anchors. Other link values remain readable text.
- The generated canonical payload is inert (`application/json`) and carries the unmodified `SheetDocument`; its only consumer is the narrow HTML importer.
- CSV and Markdown remain text-oriented exports and are deliberately unavailable for image-bearing sheets. A dedicated JSON ZIP archive will carry image files for portable edit handoff.

## Open Question


## Review Notes

- Browser smoke verified the local app loads and that selecting HTML opens the preview dialog with a `sandbox="allow-popups"` iframe carrying the generated canonical payload.
- `./hako npm test` passed with 49 tests; lint, typecheck, and build also passed. The build retains only the pre-existing ExcelJS direct-eval and chunk-size warnings.
- Follow-up browser smoke verified the default HTML selection and generated 85%-width table/lightbox styles. `./hako npm test` then passed with 50 tests; lint, typecheck, and build passed again.
- Corrected the desktop report width from an inner 85%-width table to an 85vw report container after the supplied browser screenshot showed the outer `1200px` limit was masking the intended result. ZIP round-trip, XLSX image embedding, lint, typecheck, tests (53), and build passed.
