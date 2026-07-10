# Document Library Workspace Design

## Architecture

Rakuseru stays a single-page, frontend-only editor. The new library layer wraps the existing `SheetDocument` without changing the canonical sheet model used by cell editing, validation, and export adapters.

```text
Toolbar document controls
  -> sheetStore library actions
  -> storage/indexedDb library snapshot
  -> existing SheetDocument editor surface
  -> existing validation/export flows
```

The active document remains the editor source of truth for `SheetView`, `EditorSidePanel`, validation, and exports. The store gains document-library metadata and actions so switching sheets replaces the active editor document through one controlled boundary.

## Data Contracts

Add a small library wrapper type outside the canonical `SheetDocument` contract:

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
```

Implementation can keep the summary/record split internally if it simplifies rendering, but stored records must carry stable ids and timestamps. `SheetDocument.version` remains `1`.

Document titles have two representations:

- `record.title`: library display metadata.
- `record.document.title`: canonical export/import title.

The store should keep them synchronized when title editing happens. Import validation still uses `validateSheetDocument` before a record is created or replaced.

## IndexedDB Shape

The existing IndexedDB database and object store are key-value shaped:

- database: `rakuseru`
- store: `documents`
- legacy key: `active`

Avoid recreating the object store in this task. Store namespaced library keys in the existing store:

```text
library:index          -> { version: 1, activeDocumentId, order: string[] }
library:document:<id>  -> LibraryDocumentRecord
active                 -> legacy SheetDocument, read only for migration
```

This avoids a risky object-store migration while still producing explicit document identity. A future route/query task can reuse `id` as the stable `sheetId`.

## Migration

`loadDocumentLibrary()` should follow this order:

1. Read `library:index`.
2. If the index is valid and at least one referenced record validates, return the library snapshot with a valid active id.
3. If no library index exists, read legacy `active`.
4. If legacy `active` validates as `SheetDocument`, create one library record from it and persist the new index/record.
5. If no valid stored document exists, create and persist a default document record from `createSheetDocument()`.

Invalid records should be skipped instead of crashing the app. If the active id points to a missing/invalid record, choose the first valid record and update the index. If all records are invalid, create a default record.

The legacy `active` key can remain in IndexedDB as an ignored migration source. Do not delete it in this task; leaving it avoids destructive migration behavior and makes rollback easier.

## Store Changes

Extend `sheetStore` from "single active document" to "library plus active document":

```ts
type SheetStore = {
  documents: LibraryDocumentSummary[]
  activeDocumentId: string
  document: SheetDocument
  load: () => Promise<void>
  save: () => Promise<void>
  createDocument: () => void
  duplicateDocument: () => void
  switchDocument: (id: string) => Promise<void> | void
  deleteDocument: (id: string) => void
  importDocumentAsNew: (document: SheetDocument, sourceName?: string) => void
  replaceActiveDocument: (document: SheetDocument, sourceName?: string) => void
}
```

Mutation rules:

- Existing sheet mutations still update `document` through model helpers.
- Title changes update both `document.title` and the active document summary/record title.
- `save()` persists the active record and library index, including `updatedAt`.
- Switching documents should save the current active document first when possible, then load the target record into editor state.
- Creating, duplicating, importing, replacing, and deleting should reset stale active cell/column panel state the same way `setDocument` currently does.

## Toolbar UI

Keep the first viewport as the editor. Add a compact document group in the existing toolbar:

- Current-sheet selector using summaries.
- New sheet action.
- Duplicate sheet action.
- Import JSON action that creates a new library record by default.
- Optional explicit "replace current" action if it stays simple and clearly labeled.
- Delete current sheet action with a confirmation dialog or equivalent guard.

The toolbar already owns import/export workflows, so this keeps file and document lifecycle actions in one visible place. It also avoids adding a sidebar that competes with the right editor panel and table width.

## JSON Import Flow

The adapter boundary remains unchanged:

```text
File text -> importJson(content) -> validated SheetDocument -> store library action
```

Default behavior should be "import as new sheet". Replacement is allowed only through a separate explicit action. Failed import leaves all existing library records and active document state unchanged, then surfaces a user-readable error through `setError`.

## Validation And Export Flow

No export adapter should know about the library. Toolbar and preview components continue to receive/use the active `document`.

Validation remains:

```text
active SheetDocument -> validateDocumentContent(document)
```

This keeps existing content validation and export preview behavior focused on one sheet at a time.

## Tests

Because no IndexedDB test helper dependency exists today, prefer pure helper tests for migration and state contracts unless browser APIs are already available in Vitest/jsdom.

Recommended test units:

- Pure library snapshot normalization/migration helpers.
- Record creation and duplication preserve content but produce separate ids.
- Delete fallback chooses a valid remaining document or creates a default.
- Import-as-new keeps the current document when validation/import fails.
- Existing model and adapter tests continue to pass.

## Trade-Offs

- Toolbar controls are less scalable than a sidebar for dozens of sheets, but they preserve the current editor-first workspace and are enough for the first document-library pass.
- Keeping namespaced keys in the existing object store is less normalized than new object stores, but it avoids destructive IndexedDB schema migration and is easier to roll back.
- Keeping legacy `active` after migration leaves stale data in storage, but avoids irreversible cleanup during the first migration pass.

## Rollback

Rollback is straightforward if implementation avoids deleting legacy `active`:

- Old code can still read `active` when present.
- New `library:*` keys can be ignored by old code.
- If a bug appears after migration, JSON export remains the lossless manual backup path.
