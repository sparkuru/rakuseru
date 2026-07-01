# Rakuseru MVP Design

## Architecture

Rakuseru should be a pure frontend TypeScript app. The planned baseline is:

- Vite for the build/dev server.
- React for UI composition.
- TypeScript for the document model and exporter contracts.
- A small state layer, preferably reducer or Zustand, around a single active `SheetDocument`.
- IndexedDB for local autosave.
- A mature table rendering foundation, likely TanStack Table, with custom typed cell editors on top.
- `xlsx` or a compatible spreadsheet export library for XLSX output.

No backend is part of the MVP. The app should still keep clean seams around document operations so a later backend can call the same model/query/export functions.

Tools from the broader future-stack note in `mvp.md` are intentionally deferred:

- `heyapi` waits until there is an OpenAPI-described backend.
- React Query waits until the app has meaningful remote server state.
- TanStack Router waits until multi-page flows, URL-addressable cells, or multi-file management need routing.
- Elysia.js waits until a backend is introduced.
- shadcn/ui remains optional and should be chosen only if the implementation wants its Tailwind/Radix design-system trade-off.

## Data Contracts

The canonical document shape comes from `mvp.md` and should live under `src/model/`.

```ts
type SheetDocument = {
  version: 1
  title: string
  columns: ColumnDef[]
  rows: RowData[]
}

type ColumnDef = {
  id: string
  title: string
  type: 'text' | 'number' | 'money' | 'singleSelect' | 'multiSelect' | 'image' | 'link'
  width?: number
  lockedWidth?: boolean
  wrap?: boolean
  options?: string[]
  required?: boolean
}

type RowData = {
  id: string
  height?: number
  lockedHeight?: boolean
  cells: Record<string, CellValue>
}

type CellValue =
  | string
  | number
  | string[]
  | {
      kind: 'image'
      name: string
      mime: string
      dataUrl: string
    }
```

Implementation should tighten this with discriminated helpers where needed, but the persisted JSON format should stay easy to inspect and version.

## Module Boundaries

Planned layout:

```text
src/
  app/
    App.tsx
    bootstrap.tsx
  components/
    CellEditor.tsx
    HeaderEditor.tsx
    ImportExportDialog.tsx
    SheetView.tsx
    Toolbar.tsx
  model/
    cell.ts
    column.ts
    document.ts
    row.ts
    validation.ts
  state/
    sheetStore.ts
  adapters/
    exportCsv.ts
    exportJson.ts
    exportMarkdown.ts
    exportXlsx.ts
    importJson.ts
  storage/
    indexedDb.ts
  utils/
    ids.ts
    image.ts
    width.ts
```

Keep UI components thin. Mutations should flow through model/state helpers so import/export, autosave, and future API access use the same data rules as the editor.

## Data Flow

1. App boots and asks `storage/indexedDb.ts` for the latest saved document.
2. If no saved document exists, create a sample procurement sheet fixture.
3. UI renders `SheetDocument` through `SheetView`.
4. Cell and schema edits call state actions.
5. State actions validate/coerce values against `ColumnDef`.
6. Autosave writes the full document to IndexedDB after changes.
7. Exporters read the current document and produce JSON, Markdown, XLSX, or CSV output.
8. JSON import validates the incoming document and replaces the active document only after a successful parse.

## Editing Model

- `text`: string input.
- `number`: numeric input with empty-value handling.
- `money`: numeric input plus display formatting; store as number for MVP.
- `singleSelect`: select/menu constrained to `ColumnDef.options`.
- `multiSelect`: checkbox/menu/tag interaction constrained to `ColumnDef.options`; store `string[]`.
- `image`: upload/paste file, convert to data URL, store metadata and data URL.
- `link`: URL input, render as link when not editing.

Header editing changes the schema, not just the displayed label. When a column type changes, existing cell values should be coerced conservatively or cleared with a visible state update.

## Import And Export Strategy

- JSON import/export is the only lossless round-trip format in MVP.
- Markdown export is display-only and should flatten images to labels or inline image markdown when data URLs are acceptable.
- XLSX export should preserve human-readable sheet content and useful column labels. It does not need to preserve the full Rakuseru schema in a re-importable way for MVP.
- CSV export can be added only if it remains cheap; it cannot represent images or full schema and should not block MVP completion.

## Storage Strategy

Use IndexedDB for autosave with one active document record in MVP. Keep the API shaped so multi-file management can later change storage from "single active document" to "document collection" without changing editor components.

Images are stored as data URLs in the document for MVP. This is intentionally simple but has size trade-offs; later versions can move images to separate blobs or backend attachment storage.

## Validation And Quality

Validation should happen at two levels:

- Runtime document validation for imported JSON and schema/cell consistency.
- TypeScript compile-time coverage for model helpers and exporter contracts.

Once the project is scaffolded, expected checks are:

```bash
./hako npm run lint
./hako npm run typecheck
./hako npm test
./hako npm run build
```

The exact scripts must be created in `package.json` during the scaffold slice. Until then, the repository has no runnable app checks.

## Trade-Offs

- React is confirmed because it aligns with the future stack notes in `mvp.md` and has strong table/editor ecosystem support.
- Data URL images are acceptable for MVP because they make JSON round-trip simple. They are not a long-term attachment strategy.
- XLSX export is in scope; XLSX import is deferred. Import fidelity is a larger problem than export.
- A pure frontend app keeps deployment simple and matches the current need. Backend API design should remain possible but not implemented.

## Rollback Shape

The implementation should land in small slices. If a later slice fails, keep the scaffold, model, and passing earlier slices intact. Avoid mixing scaffold, model contracts, UI, storage, and exporters into one large commit.
