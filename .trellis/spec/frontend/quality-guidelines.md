# Frontend Quality Guidelines

Frontend changes should pass the Docker-backed checks through `./hako`. The wrapper is the command boundary and keeps Node/npm execution consistent for this repository.

## Required Commands

Use the narrow repo-local wrapper:

```bash
./hako npm run lint
./hako npm run typecheck
./hako npm test
./hako npm run build
```

Run `./hako npm audit --omit=dev` after adding runtime dependencies. For user-facing UI work, perform a browser smoke test in addition to automated checks when possible.

## Current Tooling

- Vite dev server runs on port 5173.
- Vitest uses `jsdom` and global test APIs from `vite.config.ts`.
- ESLint uses `@eslint/js`, `typescript-eslint`, `react-hooks`, and `react-refresh`.
- `eslint.config.js` ignores `dist`, `node_modules`, and `.devhome`.

## Testing Expectations

- Model helpers and import validation need unit tests.
- Adapter behavior should be tested when escaping, file format, or error behavior changes.
- UI-visible workflow changes need a browser smoke test and, when practical, a focused component or integration test.
- Keep tests close to the module they verify; `src/model/document.test.ts` is the current pattern.

## Dependency And Bundle Review

- Do not import heavy export libraries into the initial UI bundle when they are only needed after a button click. `src/adapters/exportXlsx.ts` lazy-loads `exceljs`.
- Prefer existing dependencies before adding new ones: React, Zustand, TanStack Table, idb, lucide-react, ExcelJS, Vitest, Vite.
- Avoid broadening the approved command surface to raw Docker or package-manager commands when `./hako` can run the check.

## Review Checklist

- Document contract changes are reflected in model helpers, validation, adapters, and tests.
- Components call store/model actions instead of duplicating mutation rules.
- Import and storage paths validate untrusted payloads.
- Build warnings from large dependencies are acknowledged and mitigated where practical.
- User-facing failures are visible through status/error UI, not only console output.
