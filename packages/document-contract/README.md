# `@rakuseru/document-contract`

Browser-neutral version-1 `SheetDocument` contract shared by the local editor
and hosted services.

The package exports the canonical document, column, row, cell, and inline-image
types; the supported column/alignment constants; pure cell coercion and color
normalization helpers; and `validateSheetDocument(input: unknown)`. Validation
preserves the existing local JSON behavior: optional presentation metadata is
normalized, row cells are aligned to current column ids, and inline images stay
embedded as `dataUrl` values.

Hosted attachment references are intentionally not part of this package. A
later resource service must add them through an explicitly version-compatible
boundary rather than changing version-1 local JSON implicitly.
