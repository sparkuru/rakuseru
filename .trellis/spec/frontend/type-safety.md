# Type Safety

TypeScript strict mode is required. `SheetDocument`, `ColumnDef`, `RowData`, and `CellValue` in `src/model/document.ts` are the canonical contracts for editor state, storage, imports, and export adapters.

## Compiler Contract

`tsconfig.app.json` enables strict TypeScript with `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `isolatedModules`, and `allowJs: false`. New source should be TypeScript and should pass `./hako npm run typecheck`.

## Type Organization

Shared document types live in `src/model/document.ts`. Boundary modules import these types instead of redefining partial shapes.

Column type values are centralized in `COLUMN_TYPES` from `src/model/column.ts`. Use this list for UI selectors and validation instead of duplicating string arrays.

## Validation

Runtime validation for JSON imports and IndexedDB reads lives in `src/model/validation.ts`. It accepts `unknown`, returns `ValidationResult<SheetDocument>`, and normalizes cells through shared model helpers.

Validation boundary:

```ts
validateSheetDocument(input: unknown): ValidationResult<SheetDocument>
```

Bad imports should return user-readable error strings. Valid imports should return a version-1 `SheetDocument` with row cells aligned to current column ids.

## JSON Import Error Contract

### 1. Scope / Trigger

- Trigger: JSON import crosses adapter, model validation, Zustand state, and toolbar UI boundaries.
- Scope: `src/adapters/importJson.ts`, `src/model/validation.ts`, `src/state/sheetStore.ts`, and `src/components/Toolbar.tsx`.

### 2. Signatures

```ts
validateSheetDocument(input: unknown): ValidationResult<SheetDocument>
importJson(content: string): SheetDocument
setDocument(document: SheetDocument, message?: string): void
setError(message: string): void
```

### 3. Contracts

- `importJson` parses raw file text and either returns a validated `SheetDocument` or throws `Error`.
- `validateSheetDocument` accepts `unknown`, validates `version`, `title`, `columns`, `rows`, and row `cells`, then normalizes cells through `coerceCellValue`.
- Valid imports replace the active document and select the first column through `setDocument`.
- Failed imports leave the current document unchanged and surface the message through `setError`.

### 4. Validation & Error Matrix

- Invalid JSON syntax -> `Invalid JSON: <parser message>`.
- Wrong document version -> `Document version must be 1.`.
- Empty or invalid title -> `Document title is required.`.
- Missing or empty columns -> `Document must include at least one column.`.
- Duplicate valid column ids -> `Column ids must be unique.`.
- Malformed columns with synthetic fallback ids -> report the structural column error, not a duplicate-id error caused by fallback ids.
- Non-array rows -> `Rows must be an array.`.
- Unsupported column type -> `Column <n> has an unsupported type.`.
- Valid document -> version-1 `SheetDocument` with row cells aligned to current column ids.

### 5. Good/Base/Bad Cases

- Good: importing a file produced by `exportJson(document)` replaces the active document losslessly.
- Base: importing malformed JSON keeps the current document and shows a parse error in the status line.
- Bad: casting parsed JSON as `SheetDocument` or letting an async import handler fail without `try/catch`.

### 6. Tests Required

- Unit tests should cover validation failures in `validateSheetDocument`.
- Adapter tests should assert `importJson` throws user-readable `Error` messages when parse or validation behavior changes.
- Adapter tests should cover duplicate-id errors and malformed-column errors separately so validation fallback ids do not create misleading duplicate-id regressions.
- UI/store tests are required if the status display or import event flow becomes more complex than the current toolbar handler.

### 7. Wrong vs Correct

Wrong:

```ts
setDocument(importJson(content), `Imported ${file.name}`)
```

Correct:

```ts
try {
  setDocument(importJson(content), `Imported ${file.name}`)
} catch (error) {
  setError(error instanceof Error ? error.message : `Could not import ${file.name}`)
}
```

## Type Guards And Coercion

Use type guards for untrusted values, such as `isImageValue` in `src/model/cell.ts`. Keep coercion in `src/model/cell.ts` so UI edits, imports, and storage reads share behavior.

## Tests

Model tests in `src/model/document.test.ts` cover sample document creation, row/column operations, value coercion, and invalid import rejection. Add tests when changing model contracts, coercion behavior, or validation outcomes.

## Anti-Patterns

- Using `any` for document payloads.
- Casting imported JSON directly in components.
- Duplicating payload field extraction in multiple consumers.
- Creating a new column type without updating `ColumnType`, `COLUMN_TYPES`, `createEmptyCellValue`, `coerceCellValue`, validation, editors, export behavior, and tests.
