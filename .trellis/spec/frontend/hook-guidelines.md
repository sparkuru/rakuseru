# Hook Guidelines

> How hooks are used in this project.

---

## Overview

MVP state is accessed through Zustand store hooks from `src/state/sheetStore.ts`. React effects should coordinate lifecycle behavior such as initial load and debounced autosave; they should not own document mutation rules.

---

## Custom Hook Patterns

Do not add custom hooks until there is repeated stateful UI logic. Prefer store selectors for shared app state.

---

## Data Fetching

No server data fetching exists in MVP. IndexedDB access stays behind `src/storage/indexedDb.ts`; do not add React Query/SWR until backend state exists.

---

## Naming Conventions

Custom hooks must use the `use*` naming convention and should return typed values/actions rather than raw unvalidated payloads.

---

## Common Mistakes

- Do not put schema coercion or import validation inside React hooks.
- Do not create a hook just to wrap a single store selector.
