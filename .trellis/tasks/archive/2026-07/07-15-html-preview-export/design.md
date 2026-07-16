# HTML Preview and Export Design

## Architecture

Add two pure adapters:

- `exportHtml(document)` returns one complete HTML document.
- `importHtml(content)` finds the exact Rakuseru payload marker, then delegates its JSON text to `importJson`, which delegates to `validateSheetDocument`.

`Toolbar` selects the importer from the file extension and triggers the existing `importDocumentAsNew` action. It also uses `exportHtml` to download an `.html` file. `ExportPreviewDialog` gets an `html` export format and displays that same adapter output through an iframe `srcDoc`; it does not maintain a separate report renderer.

For image-bearing sheets, `exportJsonZipBlob` and `importJsonZip` dynamically load JSZip. The archive contains one named JSON manifest with image references plus deduplicated `img/image-<n>.<extension>` binary files. Import restores data URLs before delegating to `importJson` and its existing validation boundary.

## Export Contract

The output is an offline, complete `<!doctype html>` report with:

- a UTF-8 document head, inline report CSS, title, document heading, and local export timestamp;
- a semantic table with `thead`, `tbody`, and `th`/`td` cells;
- column width, alignment, wrapping, and row-height metadata reflected as safe inline styles or CSS classes;
- image cells as their existing data URLs and their configured fit behavior;
- image cells wrapped in fragment links to a CSS `:target` lightbox, so full-size inspection works without executable JavaScript;
- `http:`/`https:` link cells as escaped anchors, and every other link value as escaped plain text;
- one stable, inert `<script type="application/json">` payload containing the canonical JSON document.

All dynamic markup is escaped. The embedded JSON additionally neutralizes a script-closing sequence so sheet data cannot terminate its inert script element. The report includes no executable JavaScript.

The report container is 85% of viewport width on desktop, its table fills that container, and narrow viewports use the available width. HTML becomes the toolbar's initial export selection. CSV and Markdown are disabled when the active sheet contains image values; native disabled options communicate that those formats cannot carry rendered images. Non-image sheets preserve the ordinary CSV, Markdown, and JSON workflows. The XLSX adapter embeds supported PNG, JPEG, and GIF image data in cells.

## Preview Isolation

The dialog's HTML preview iframe uses `srcDoc` from `exportHtml` and a restrictive sandbox. It permits popups only so report links can open in a new browsing context; scripts, same-origin access, forms, and top-level navigation stay disabled. The iframe has an accessible title and retains the existing preview dialog's close, validation, and confirm controls.

## Import Contract and Failure Modes

The picker accepts JSON, Rakuseru JSON ZIP archives, and `.html` files. Plain JSON remains unchanged for sheets without images. For HTML, `importHtml` parses inert markup, requires exactly one expected payload marker, reads its text content, and calls `importJson`. For ZIP, `importJsonZip` requires exactly one manifest, restores image data URLs only from validated `img/` entries, then calls `importJson`.

Missing markers, duplicate markers, malformed payload JSON, and structurally invalid documents are rejected with clear user-facing errors. No generic HTML-to-sheet conversion is attempted. A successful recovery is added as a new library document and keeps the recovered document's title and canonical content.

## Compatibility and Rollback

The new `html` format is additive to the `ExportFormat` union. Image restrictions apply only while the active sheet contains images. ZIP code remains lazy-loaded until JSON ZIP import or confirmed export; ExcelJS remains lazy-loaded until Excel download confirmation. Removing the ZIP adapter and its UI restriction restores ordinary non-image export behavior without stored-data migration.
