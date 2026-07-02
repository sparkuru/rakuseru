# State Management

Rakuseru uses Zustand for app-level editor state. The store owns the active `SheetDocument`, selected column, persistence status, and user-facing status message.

## Store Ownership

`src/state/sheetStore.ts` is the source of truth for:

- Active `document`.
- `selectedColumnId`.
- Save/load `status`.
- User-facing `message`.
- Actions that mutate the document through model helpers.

Store actions call `src/model/column.ts`, `src/model/row.ts`, and `src/model/document.ts` helpers instead of mutating nested document state inline in components.

## State Categories

- Global state: active document, selected column id, save/load status.
- Local component state: refs and transient UI-only values that do not affect the document contract.
- Browser persistence: IndexedDB through `src/storage/indexedDb.ts`.
- Server state: none in MVP.
- URL state: none in MVP; add routing only when URL-addressable cells or multi-file flows are implemented.

## Persistence Flow

`App` calls `load()` on mount, then debounces `save()` when the document changes. `loadActiveDocument()` validates stored data and returns `undefined` for invalid or missing data, so the store can fall back to `createSheetDocument()`.

## Error State

Use `setError(message)` for user-visible failures. Import handlers should catch adapter errors and store the message; see `src/components/Toolbar.tsx`.

## Anti-Patterns

- Mutating `SheetDocument` in components.
- Scattering cell coercion rules across components.
- Introducing remote-state libraries before a backend/API exists.
- Storing imported documents without validation.
