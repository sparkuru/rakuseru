# Directory Structure

> How frontend code is organized in this project.

---

## Overview

Rakuseru is a single Vite + React + TypeScript app. Keep code organized by responsibility rather than by page until multi-page routing exists.

---

## Directory Layout

src/
├── adapters/     # Import/export formats around SheetDocument
├── app/          # App bootstrap, shell, and global CSS
├── components/   # React UI components
├── model/        # SheetDocument contracts, reducers/helpers, validation
├── state/        # Zustand store for the active document/editor state
├── storage/      # IndexedDB persistence boundary
└── utils/        # Small browser utilities shared across layers
```

---

## Module Organization

Model rules belong in `src/model/` first. UI components call state actions; they should not duplicate document validation, import parsing, or export formatting.

Adapters must depend on `src/model/` contracts, not on React components or Zustand store internals. Storage owns IndexedDB details and returns validated `SheetDocument` values.

---

## Naming Conventions

- Components use PascalCase filenames, e.g. `SheetView.tsx`.
- Non-component modules use lower camelCase filenames, e.g. `exportMarkdown.ts`.
- Tests live next to the model/module they verify, e.g. `document.test.ts`.

---

## Examples

- `src/model/validation.ts` owns JSON import validation and normalization.
- `src/state/sheetStore.ts` owns editor actions and persistence status.
- `src/adapters/exportXlsx.ts` lazy-loads the heavy XLSX library so the main UI bundle stays smaller.
