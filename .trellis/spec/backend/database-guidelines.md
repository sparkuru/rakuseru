# Database Guidelines

Rakuseru does not use a server database, ORM, migrations, or query layer. Current persistence is browser-local IndexedDB through `idb`.

## Current Persistence

`src/storage/indexedDb.ts` owns the only persistence boundary:

- Database name: `rakuseru`
- Object store: `documents`
- Active document key: `active`
- Stored value: full `SheetDocument`

Reads validate stored payloads through `validateSheetDocument`. Invalid stored data is ignored by returning `undefined`, which lets the app start from a fresh sample document.

## Local Storage Rules

- Keep IndexedDB details in `src/storage/indexedDb.ts`.
- Validate every persisted document before returning it to app state.
- Store the canonical `SheetDocument` shape from `src/model/document.ts`.
- Do not duplicate schema normalization in components or adapters.

## Future Database Work

Only add a backend database after the product scope requires remote persistence or collaboration. The first database task must define migrations, ownership of document versions, attachment storage, transaction boundaries, and API compatibility with `SheetDocument.version`.

## Anti-Patterns

- Adding an ORM while the product remains browser-only.
- Writing raw IndexedDB calls from components.
- Storing a partial or UI-specific document shape that bypasses `validateSheetDocument`.
