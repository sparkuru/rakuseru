# State Management

Rakuseru uses Zustand for app-level editor state. The store owns the local document library, active `SheetDocument`, editor selection state, persistence status, and user-facing status message.

## Store Ownership

`src/state/sheetStore.ts` is the source of truth for:

- Local document library summaries and the active document id.
- Active `document`.
- `selectedColumnId`.
- Save/load `status`.
- User-facing `message`.
- Actions that mutate the document through model helpers.

Store actions call `src/model/column.ts`, `src/model/row.ts`, `src/model/document.ts`, and `src/model/library.ts` helpers instead of mutating nested document/library state inline in components.

## State Categories

- Global state: document library summaries, active document id, active document, selected column id, save/load status.
- Local component state: refs and transient UI-only values that do not affect the document contract.
- Browser persistence: IndexedDB through `src/storage/indexedDb.ts`.
- Server state: none in MVP.
- URL state: none in MVP; add routing only when URL-addressable cells or multi-file flows are implemented.

## Persistence Flow

`App` calls `load()` on mount, then debounces `save()` when the active document changes. `loadDocumentLibrary()` validates stored library records, migrates the legacy single-key `active` document when present, and falls back to a default library snapshot when stored data is invalid or missing.

The IndexedDB `documents` object store is key-value shaped:

- `library:index` stores the active document id and ordered document ids.
- `library:document:<id>` stores each library record.
- `active` is the legacy single-document key and should be read only as a migration source.

Autosave should persist the active library record plus index metadata. Creating, duplicating, importing, or deleting sheets should persist the changed library snapshot so inactive document list changes are not lost.

## Error State

Use `setError(message)` for user-visible failures. Import handlers should catch adapter errors and store the message; see `src/components/Toolbar.tsx`.

## Document Library Actions

- `createDocument`, `duplicateDocument`, `switchDocument`, `deleteDocument`, `importDocumentAsNew`, and `replaceActiveDocument` belong in the store, not in toolbar components.
- Title editing must keep the active library metadata title and canonical `document.title` synchronized.
- Switching documents should save the current active document before opening the target when practical.
- Deleting a document must leave a valid active document. If the last document is deleted, create a default replacement.

## Scenario: Local Document Library Persistence

### 1. Scope / Trigger

- Trigger: multi-sheet local workspace, IndexedDB migration from the legacy single active sheet, and toolbar-driven document lifecycle actions.
- Scope: `src/model/library.ts`, `src/storage/indexedDb.ts`, `src/state/sheetStore.ts`, and toolbar document controls.

### 2. Signatures

```ts
type LibraryDocumentRecord = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  document: SheetDocument
}

type LibraryDocumentSummary = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

type DocumentLibrarySnapshot = {
  version: 1
  activeDocumentId: string
  summaries: LibraryDocumentSummary[]
  records: LibraryDocumentRecord[]
}

loadDocumentLibrary(): Promise<DocumentLibrarySnapshot>
saveActiveLibraryDocument(snapshot: DocumentLibrarySnapshot): Promise<void>
saveDocumentLibrary(snapshot: DocumentLibrarySnapshot): Promise<void>
```

### 3. Contracts

- IndexedDB database: `rakuseru`.
- IndexedDB object store: `documents`.
- `library:index` stores `{ version: 1, activeDocumentId, order }`.
- `library:document:<id>` stores `LibraryDocumentRecord`.
- Legacy `active` stores the previous single `SheetDocument` and is read only as a migration source.
- Storage must validate every nested `SheetDocument` with `validateSheetDocument` before returning it to the store.
- Export and content validation receive only the active `SheetDocument`; adapters should not know about library metadata.

### 4. Validation & Error Matrix

- Missing library index + valid legacy `active` -> create one library record from legacy data and persist the new library keys.
- Missing library index + invalid/missing legacy `active` -> create a default library snapshot.
- Library index references missing/invalid records -> skip invalid records; choose a valid fallback active id.
- Library index has no valid records -> fall back to legacy `active`, then default snapshot.
- Active id points to a missing record -> use the first valid record and rewrite the index.
- Import JSON parse/validation failure -> leave current library and active document unchanged; surface `setError`.

### 5. Good/Base/Bad Cases

- Good: title editing updates both the active summary title and `document.title`, then autosave persists the active record.
- Base: fresh browser storage opens one default sheet and marks it active.
- Bad: toolbar creates or deletes local arrays directly instead of calling store actions.
- Bad: storage returns a cast `LibraryDocumentRecord` without validating the nested `SheetDocument`.

### 6. Tests Required

- Pure library helper tests for record creation, duplication, fallback active id selection, stored index creation, and record validation.
- Store tests for switch, duplicate, delete fallback, title synchronization, and import-as-new behavior.
- Browser smoke for fresh load, create, switch, rename, duplicate, delete, JSON import as a new sheet, export preview, and reload persistence.

### 7. Wrong vs Correct

Wrong:

```ts
const parsed = JSON.parse(raw) as LibraryDocumentRecord
set({ document: parsed.document })
```

Correct:

```ts
const record = validateLibraryDocumentRecord(raw)
if (record) {
  set({ document: record.document })
}
```

## Anti-Patterns

- Mutating `SheetDocument` in components.
- Mutating document-library arrays in components.
- Scattering cell coercion rules across components.
- Introducing remote-state libraries before a backend/API exists.
- Storing imported documents without validation.
