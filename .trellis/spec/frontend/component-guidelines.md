# Component Guidelines

> How components are built in this project.

---

## Overview

Components are functional React components written in TypeScript. Keep them thin: components render controls and call store actions; document mutation and validation stay in `src/model/` and `src/state/`.

---

## Component Structure

Use named exports for app components. Put component-local event handlers inside the component when they only coordinate UI events.

```tsx
type CellEditorProps = {
  row: RowData
  column: ColumnDef
}

export function CellEditor({ row, column }: CellEditorProps) {
  // render type-specific editor and call store action
}
```

---

## Props Conventions

Define explicit `type` aliases for props when a component accepts more than one primitive prop or receives domain objects. Import `ColumnDef`, `RowData`, and other contracts from `src/model/`; do not redefine shape fragments in components.

---

## Styling Patterns

The current app uses plain global CSS in `src/app/styles.css`. Keep layout dimensions stable for table cells, toolbar buttons, and side panels so editing controls do not shift the grid.

---

## Accessibility

Icon-only buttons need `aria-label` and `title`. Inputs and selects should be wrapped in visible labels when space allows. Table headers should remain keyboard-clickable for schema selection.

---

## Common Mistakes

- Do not make components parse imported JSON or construct export file formats.
- Do not introduce landing-page or marketing hero UI; Rakuseru opens directly into the working editor.
