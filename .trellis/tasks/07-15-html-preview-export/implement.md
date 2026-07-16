# Implementation Plan

## Ordered Work

1. Add pure HTML export/import adapters with shared, small escaping and safe-link helpers as needed.
2. Add adapter tests for a representative mixed-type document, self-contained report structure, metadata rendering, markup/JSON escaping, and exact HTML export/import round-trip.
3. Add HTML to `ExportFormat`, the toolbar selector, download handling, import file acceptance, and importer selection; preserve import-as-new behavior and error reporting.
4. Update `ExportPreviewDialog` to render the generated HTML in a titled sandboxed iframe, while keeping existing formats' preview behavior unchanged.
5. Add recovery failure tests for ordinary HTML, missing/duplicate payloads, malformed payload JSON, and invalid canonical payloads.
6. Run lint, typecheck, unit tests, and production build. Perform browser smoke for HTML visual preview, download, and re-import as a new document.
7. Add the CSS-only image lightbox, 85% responsive table layout, HTML default selection, and image-export coverage for Markdown and CSV.
8. Add a dynamically loaded JSON ZIP adapter, archive import restoration, image-aware format restrictions, and XLSX image embedding; change report width to 85% viewport width and cover all new paths with adapter tests and browser smoke.

## Validation Commands

```sh
./hako npm run lint
./hako npm run typecheck
./hako npm test
./hako npm run build
```

## Risk Points

- Raw user content must never be interpolated without escaping into HTML or the embedded JSON script.
- The iframe must allow links to open while retaining script isolation.
- HTML import must be deliberately narrow and must not bypass `validateSheetDocument`.
- Browser smoke must confirm HTML data URLs render offline and re-import does not replace the active document.
