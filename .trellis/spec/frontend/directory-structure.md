# Frontend Directory Structure

Rakuseru is a single Vite + React + TypeScript app. Keep code organized by responsibility rather than by page until multi-page routing exists.

## Directory Layout

```text
src/
├── adapters/     # Import/export formats around SheetDocument
├── app/          # App bootstrap, shell, and global CSS
├── components/   # React UI components
├── model/        # SheetDocument contracts, pure update helpers, validation
├── state/        # Zustand store for active document and editor status
├── storage/      # IndexedDB persistence boundary
└── utils/        # Small browser utilities shared across layers
```

## Module Ownership

Model rules belong in `src/model/` first. UI components call state actions; they should not duplicate document validation, import parsing, or export formatting.

Adapters depend on `src/model/` contracts, not React components or Zustand internals. Storage owns IndexedDB details and returns validated `SheetDocument` values.

## Naming Conventions

- Components use PascalCase filenames, such as `SheetView.tsx`, `HeaderEditor.tsx`, and `CellEditor.tsx`.
- Non-component modules use lower camelCase filenames, such as `exportMarkdown.ts`, `importJson.ts`, and `indexedDb.ts`.
- Tests live next to the model/module they verify, such as `src/model/document.test.ts`.
- Use named exports for app modules; keep default exports for libraries that require them, such as Vite config.

## Reference Files

- `src/model/document.ts` defines the canonical document shape.
- `src/model/validation.ts` validates imported and stored payloads.
- `src/state/sheetStore.ts` owns editor actions and persistence status.
- `src/adapters/exportXlsx.ts` lazy-loads ExcelJS so the initial UI bundle stays smaller.

## Anti-Patterns

- Placing document mutation rules in components.
- Importing Zustand store state into adapters or model helpers.
- Adding route/page structure before URL-addressable workflows exist.
