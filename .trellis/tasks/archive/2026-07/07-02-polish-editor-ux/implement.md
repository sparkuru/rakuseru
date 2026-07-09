# Implementation Plan

## Pre-Work

- Treat existing dirty `hako` and `dev.sh` changes as unrelated to this UI task.
- Load frontend specs with `trellis-before-dev` before editing app files.
- Re-check `src/state/sheetStore.ts`, `src/components/*.tsx`, and `src/app/styles.css` before patching.

## Steps

- [x] Extend `sheetStore` with transient active row/cell selection state and selection actions.
- [x] Update row/column removal behavior to avoid stale selected ids.
- [x] Wire `SheetView` clicks to active row/cell/column state.
- [x] Add row/cell/selected-column class names in `SheetView`.
- [x] Refactor multi-select cells into chip/toggle controls without changing `CellValue`.
- [x] Refine image cell empty, preview, filename, and clear interaction states.
- [x] Reorganize `HeaderEditor` into grouped sections and add a safer column delete confirmation.
- [x] Reorganize `Toolbar` action groups without changing import/export behavior.
- [x] Update `styles.css` for active state affordances, grouped controls, chip controls, image states, and responsive behavior.
- [x] Run automated checks.
- [x] Run browser render smoke test.
- [x] Run full interactive browser smoke test.

## Validation Commands

```bash
./hako npm run lint
./hako npm run typecheck
./hako npm test
./hako npm run build
```

## Manual Smoke Checklist

- [x] Title edit autosaves.
- [x] Clicking cells changes active cell/row/column affordances.
- [x] Row add/delete works and leaves selection valid.
- [x] Column add/delete works, with confirmation for delete.
- [x] Text, number, money, single select, multi-select, image, and link cells remain editable.
- [x] JSON import/export still works.
- [x] Markdown/CSV/XLSX export still works.
- [x] Refresh reloads saved document.

## Rollback Points

- If selection state causes instability, roll back store selection changes and keep only CSS/layout grouping.
- If grouped toolbar risks breaking import/export, keep current button wiring and change only layout classes.
- If option chip editing expands scope, leave schema options as textarea for this task.
