# Hook Guidelines

MVP state is accessed through Zustand store hooks from `src/state/sheetStore.ts`. React effects coordinate lifecycle behavior such as initial load and debounced autosave; they should not own document mutation rules.

## Existing Hook Patterns

`src/app/App.tsx` is the main reference:

- Store selectors read only the state/actions needed by the component.
- One effect loads the active document once.
- A second effect debounces autosave after the initial load.
- `useRef` gates autosave so the initial sample document is not immediately saved before load finishes.
- `useMemo` derives the status label from `status` and `message`.

`src/components/SheetView.tsx` uses `useMemo` for TanStack table column definitions because the definitions depend on document columns and selected-column state.

## Custom Hooks

Do not add custom hooks until there is repeated stateful UI logic. Prefer direct store selectors for shared app state and local component functions for one-off event coordination.

If a custom hook is warranted, it must:

- Use the `use*` naming convention.
- Return typed values/actions.
- Avoid exposing raw unvalidated payloads.
- Keep model coercion and validation in `src/model/`.

## Data Fetching

No server data fetching exists in MVP. IndexedDB access stays behind `src/storage/indexedDb.ts`; do not add React Query/SWR until backend state exists.

## Anti-Patterns

- Putting schema coercion or import validation inside React hooks.
- Creating a hook just to wrap a single store selector.
- Triggering autosave before `load()` has had a chance to read IndexedDB.
