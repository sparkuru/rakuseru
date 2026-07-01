# Type Safety

> Type safety patterns in this project.

---

## Overview

TypeScript strict mode is required. `SheetDocument`, `ColumnDef`, `RowData`, and `CellValue` are the canonical contracts for editor state, storage, and export adapters.

---

## Type Organization

Shared document types live in `src/model/document.ts`. Boundary modules import these types instead of redefining partial shapes.

---

## Validation

Runtime validation for JSON imports and IndexedDB reads lives in `src/model/validation.ts`. It accepts `unknown`, returns a `ValidationResult<SheetDocument>`, and normalizes cells through shared model helpers.

Validation boundary:

```ts
validateSheetDocument(input: unknown): ValidationResult<SheetDocument>
```

Bad imports should return user-readable error strings. Valid imports should return a version-1 `SheetDocument` with row cells aligned to current column ids.

## JSON Import Error Contract

### 1. Scope / Trigger

- Trigger: JSON import crosses adapter, store, and UI boundaries.
- Scope: `src/adapters/importJson.ts`, `src/state/sheetStore.ts`, and toolbar import handlers.

### 2. Signatures

```typescript
validateSheetDocument(input: unknown): ValidationResult<SheetDocument>
importJson(content: string): SheetDocument
setError(message: string): void
```

### 3. Contracts

- `importJson` parses raw file text and either returns a validated `SheetDocument` or throws `Error`.
- Error messages must be user-readable parse or validation messages.
- UI import handlers must catch `importJson` errors and call `setError`; they must not let rejected promises become invisible console-only failures.
- The app status surface must display the stored error message when `status === 'error'`.

### 4. Validation & Error Matrix

- Invalid JSON syntax -> `Invalid JSON: <parser message>` shown in UI status.
- Wrong document version -> validation error shown in UI status.
- Missing/invalid columns or rows -> validation error shown in UI status.
- Valid document -> replace active document and select the first column.

### 5. Good/Base/Bad Cases

- Good: importing a valid exported JSON file replaces the active document losslessly.
- Base: importing an empty or malformed file leaves the current document unchanged and shows the parse error.
- Bad: wrapping `importJson` in an async handler without `try/catch`; users get no visible failure.

### 6. Tests Required

- Unit tests should cover validation failures in `validateSheetDocument`.
- Adapter tests should assert `importJson` throws user-readable `Error` messages for malformed JSON and invalid documents when adapter behavior changes.
- UI/store tests are required if the status display or import event flow becomes more complex than the current toolbar handler.

### 7. Wrong vs Correct

#### Wrong

```typescript
setDocument(importJson(content), `Imported ${file.name}`)
```

#### Correct

```typescript
try {
  setDocument(importJson(content), `Imported ${file.name}`)
} catch (error) {
  setError(error instanceof Error ? error.message : `Could not import ${file.name}`)
}
```

---

## Common Patterns

Use type guards for untrusted values, such as image cells. Keep coercion in `src/model/cell.ts` so UI and import paths share behavior.

---

## Forbidden Patterns

- Do not use `any` for document payloads.
- Do not cast imported JSON directly in components.
- Do not duplicate payload field extraction in multiple consumers; add or reuse a model-level guard/normalizer.
