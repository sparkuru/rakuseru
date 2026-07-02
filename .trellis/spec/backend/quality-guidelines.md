# Backend Quality Guidelines

Backend quality work currently means preserving the frontend-only architecture unless a task explicitly expands the scope.

## Required Review Checks

- Confirm backend work is in scope for the task.
- Read `mvp.md` and document why the frontend-only decision no longer applies.
- Keep document contracts aligned with `src/model/document.ts` and `src/model/validation.ts`.
- Add validation commands and tests for any new server package in the same task.
- Update this backend spec directory once real backend patterns exist.

## Validation Commands

There are no backend-specific commands today. Current project checks are frontend commands through `./hako`:

```bash
./hako npm run lint
./hako npm run typecheck
./hako npm test
./hako npm run build
```

## Anti-Patterns

- Adding server code without tests, scripts, and spec updates.
- Duplicating document validation separately from the current model contract.
- Treating a future backend as required for local import/export or IndexedDB autosave.
