# Backend Directory Structure

Rakuseru has no backend directory today. Do not create `server/`, `api/`, route handlers, or server utilities for ordinary editor, import/export, or IndexedDB work.

## Current Boundaries

- App shell and bootstrap: `src/app/App.tsx`, `src/app/bootstrap.tsx`
- UI components: `src/components/`
- Document model and validation: `src/model/`
- Browser persistence: `src/storage/indexedDb.ts`
- File import/export: `src/adapters/`
- Browser-only utilities: `src/utils/`

The absence of a backend is intentional. `mvp.md` states that the MVP should remain frontend-only unless multi-user collaboration, permissions, cloud storage, audit logs, or centralized attachment management becomes necessary.

## If Backend Scope Is Approved

Create an explicit server package or top-level server directory instead of mixing server code into browser modules. The first backend task should define:

- Runtime and framework.
- API route layout.
- Shared document contract strategy.
- Validation and error response format.
- Test, lint, type-check, build, and dev commands.

Do not import browser-only modules such as `src/storage/indexedDb.ts`, `src/utils/download.ts`, or React components into server code.

## Anti-Patterns

- Adding ad hoc API helpers inside `src/components/`.
- Treating `src/storage/indexedDb.ts` as a backend abstraction.
- Introducing backend dependencies for local-only document editing or export formatting.
