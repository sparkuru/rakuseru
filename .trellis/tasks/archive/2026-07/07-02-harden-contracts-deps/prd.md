# Harden Contracts and Dependency Reproducibility

## Goal

Close the small architecture-audit gaps that already have clear fixes: dependency version reproducibility, adapter contract tests, and noisy validation errors.

## Scope

In scope:

- Pin `package.json` dependency and devDependency ranges to the versions currently resolved in `package-lock.json`.
- Add adapter tests for JSON import errors and pure export behavior.
- Fix validation error noise for malformed columns so structural errors do not cascade into misleading duplicate-id errors.

Out of scope:

- CI workflow creation.
- Image empty-state model changes; keep the current `''` image empty value.
- UI interaction framework work from `07-02-polish-editor-ux`.
- Backend or architecture restructuring.

## Requirements

- Preserve the existing frontend-only app architecture.
- Keep `SheetDocument` and `CellValue` contracts unchanged.
- Use current Vitest setup and keep tests close to the modules they verify.
- Keep import/export adapters pure and independent of React/Zustand.
- Do not mix unrelated dirty files (`hako`, `dev.sh`, `07-02-polish-editor-ux`) into this task's code changes or commit.

## Acceptance Criteria

- [x] `package.json` no longer uses `"latest"` for dependencies or devDependencies.
- [x] `package-lock.json` remains consistent with pinned `package.json`.
- [x] `src/adapters/importJson.test.ts` covers malformed JSON and the validation error matrix from `.trellis/spec/frontend/type-safety.md`.
- [x] Export adapter tests cover JSON formatting and CSV/Markdown escaping behavior.
- [x] Malformed non-object columns such as `{ columns: [null, null] }` do not produce a misleading duplicate-column-id error.
- [x] Existing model tests still pass.
- [x] `./hako npm run lint`, `./hako npm run typecheck`, `./hako npm test`, and `./hako npm run build` pass.

## Implementation Notes

- Use the versions from `package-lock.json` as the source of truth when pinning.
- A focused validation helper change is preferred over rewriting the validation layer.
- No browser smoke test is required unless implementation touches UI code.
