# Component Guidelines

Components are functional React components written in TypeScript. Keep them thin: components render controls and call store actions; document mutation and validation stay in `src/model/` and `src/state/`.

## Component Shape

Use named exports for app components. Put component-local event handlers inside the component when they only coordinate UI events.

Reference pattern: `src/components/CellEditor.tsx` accepts `RowData` and `ColumnDef`, then switches on `column.type` to render the correct controlled input and call `updateCell`.

## Props Conventions

Define explicit `type` aliases for props when a component accepts more than one primitive prop or receives domain objects. Import `ColumnDef`, `RowData`, and other contracts from `src/model/`; do not redefine shape fragments in components.

Examples:

- `ToolbarProps` in `src/components/Toolbar.tsx` keeps the toolbar API small by accepting `statusLabel`.
- `CellEditorProps` in `src/components/CellEditor.tsx` uses model types instead of local structural casts.

## Styling Patterns

The app uses plain global CSS in `src/app/styles.css`. Keep layout dimensions stable for table cells, toolbar buttons, and side panels so editing controls do not shift the grid.

Rakuseru opens directly into the working editor. Do not add landing-page or marketing hero UI for product work.

## Accessibility

- Icon-only buttons need `aria-label` and `title`; see row deletion in `src/components/SheetView.tsx` and image clearing in `src/components/CellEditor.tsx`.
- Inputs and selects should be wrapped in visible labels when space allows; see `src/components/HeaderEditor.tsx`.
- Interactive table headers should remain keyboard-clickable buttons for schema selection.

## Anti-Patterns

- Parsing imported JSON in a component.
- Constructing export file formats in a component.
- Duplicating cell coercion or image type guards outside `src/model/`.
- Adding custom SVG icons when an existing `lucide-react` icon fits the action.
