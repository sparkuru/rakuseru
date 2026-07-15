# Refine toolbar and column property layout

## Goal

Refine Rakuseru's toolbar wrapping and column property controls based on screenshot feedback so narrow widths preserve command order and the column schema panel reads as coherent property groups.

## Requirements

- Keep the editor-first layout and current toolbar actions.
- When horizontal space is limited, toolbar action groups should wrap below the `Title` input and keep this visual order:
  - document library controls;
  - row/column structure controls;
  - import controls;
  - validation/export controls.
- Avoid the current right-edge stacking/jumping behavior where action groups visually detach from the title row.
- Keep toolbar controls accessible with visible names or `aria-label` / `title` for compact icon buttons.
- Refine the column schema panel:
  - width is shown as a unit-based number, defaulting to a logical unit value of `1`;
  - existing pixel widths are converted for display using the current base width convention;
  - if a manually dragged width is fractional in unit terms, using the number input stepper should move to the nearest integer unit;
  - `lockedWidth` belongs inside the width group;
  - `wrap`, `required`, and new horizontal alignment (`left`, `center`, `right`) belong inside a separate 属性 group;
  - boolean and alignment controls should feel like grouped settings instead of isolated card fragments.
- Add a column alignment property without changing existing documents' validity:
  - missing alignment defaults to left for text/link/select/image-like display and right for number/money where existing rendering already implies right alignment;
  - user-set alignment should affect visible table cell display;
  - XLSX export should use the configured alignment when present.
- Preserve import/export compatibility for existing JSON documents.
- Keep implementation frontend-only and avoid new dependencies.

## Acceptance Criteria

- [x] Toolbar action groups wrap under the title field in the intended order at narrow widths.
- [x] Toolbar controls no longer stack as detached right-side vertical islands in the reported screenshot scenario.
- [x] Column width editor displays unit values with default `1`.
- [x] Width stepper changes round dragged fractional unit widths to the nearest integer step.
- [x] `锁定宽度` is grouped with width.
- [x] `自动换行`, `必填`, and `对齐` are grouped under 属性.
- [x] Alignment can be set to left/center/right from the column schema panel.
- [x] Table cell display reflects the selected alignment.
- [x] JSON validation accepts optional alignment while existing documents without alignment still import/load.
- [x] XLSX export applies configured alignment where practical.
- [x] `./hako npm run lint`, `./hako npm run typecheck`, `./hako npm test`, and `./hako npm run build` pass.
- [x] Browser smoke covers toolbar wrapping and the column properties panel.

## Notes

- Width unit convention: one UI unit maps to the existing default non-image column width (`160px`).
- Validation: `./hako npm run typecheck`, `./hako npm test`, `./hako npm run lint`, and `./hako npm run build` passed.
- Browser smoke: headless Chrome at `1160x768` verified toolbar action order below the title field, property section grouping, default width `1`, fractional width `1.6` snapping to `2`, and table cell alignment update.
