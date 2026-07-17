# Implementation Plan: Sheet color styling

1. Load frontend model, component, state, type-safety, and quality specs through `trellis-before-dev`; inspect existing panel and export test patterns.
2. Add the central color model utility, document types, JSON normalization, and pure helper tests. Update row/column helpers so metadata survives normal edits and stale cell keys are removed.
3. Add the reusable background-color control and row panel; wire column and cell panels to store/model actions without mutating documents in components.
4. Render resolved colors in `SheetView`, including the agreed header and row-action scopes, while preserving selection and validation affordances.
5. Apply resolved colors in HTML and XLSX adapters and add focused export tests.
6. Run focused tests, then serially run `./hako npm run lint`, `./hako npm run typecheck`, `./hako npm test`, and `./hako npm run build`. Run browser smoke for set, override, clear, persistence, and export behavior.
7. Review the diff against this PRD, update frontend specs with the color-contract boundary, and ask for final quality/commit review.
