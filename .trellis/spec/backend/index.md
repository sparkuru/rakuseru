# Backend Development Guidelines

Rakuseru currently has no backend runtime. The product is a single-browser Vite React app with IndexedDB persistence and import/export adapters under `src/`.

Use this directory as a guardrail for future backend work: do not add API, database, server logging, authentication, or deployment code unless a task explicitly expands the scope beyond the current frontend-only MVP.

## Current Backend Status

- No server package, route framework, ORM, migration tool, API client, or backend test runner exists.
- `mvp.md` records the current product direction: the first version is a pure frontend app; backend work is deferred until collaboration, permissions, cloud storage, audit logs, or centralized attachment storage are required.
- Browser persistence lives in `src/storage/indexedDb.ts`, not a backend database layer.
- Import/export boundaries live in `src/adapters/`, not HTTP endpoints.

## Guidelines Index

| Guide | Use |
|-------|-----|
| [Directory Structure](./directory-structure.md) | Current no-backend boundary and future server placement rules |
| [Database Guidelines](./database-guidelines.md) | Current IndexedDB-only persistence and future database constraints |
| [Error Handling](./error-handling.md) | Current browser error surfaces and future API error expectations |
| [Logging Guidelines](./logging-guidelines.md) | Current no-logging policy and future structured logging expectations |
| [Quality Guidelines](./quality-guidelines.md) | Review checks before adding backend scope |

## Pre-Development Checklist

- Confirm the task explicitly asks for backend/server/API/database work.
- Read `mvp.md` before changing the frontend-only architecture decision.
- If backend scope is approved, add package manifests, validation commands, tests, and Trellis specs in the same task.
- Keep frontend document contracts in sync with any API payload contracts.

## Quality Check

- If no backend files changed, confirm the task did not accidentally add server scope.
- If backend files are added, require package scripts, tests, validation commands, and updated backend specs in the same task.
- Verify any API or persistence contract remains compatible with `src/model/document.ts` and `src/model/validation.ts`.
