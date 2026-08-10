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

Run these commands serially. The current `./hako` wrapper publishes Vite port 5173 for every invocation, so parallel `./hako ...` commands can fail with a Docker port-allocation error even when the underlying check is healthy.

Run `./hako npm audit --omit=dev` after adding runtime dependencies. For browser-accessible UI work, read the `Trellis Plus: Playwright Validation Profile` in `index.md`, classify the task, and run focused reproducible browser coverage when the profile supports it. If appropriate automation is unavailable, record the exact blocker and targeted replacement evidence instead of reporting a generic smoke pass.

## Current Tooling

- Vite dev server runs on port 5173.
- Vitest uses `jsdom` and global test APIs from `vite.config.ts`.
- ESLint uses `@eslint/js`, `typescript-eslint`, `react-hooks`, and `react-refresh`.
- `eslint.config.js` ignores `dist`, `node_modules`, and `.devhome`.

## Testing Expectations

- Model helpers and import validation need unit tests.
- Adapter behavior should be tested when escaping, file format, or error behavior changes.
- UI-visible workflow changes need a focused browser test when their acceptance criteria are browser-automatable, plus focused component or integration coverage where it adds distinct signal.
- Prefer semantic browser locators and deterministic test-owned data. Cover changed focus, keyboard, accessible-name, responsive, and error/success states when applicable.
- Preserve failure artifacts and do not update screenshot baselines without an intentional review reason.
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
