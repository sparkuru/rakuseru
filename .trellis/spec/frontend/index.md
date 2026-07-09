# Frontend Development Guidelines

Rakuseru is a Vite + React + TypeScript single-page editor for structured procurement sheets. The frontend owns the current product: schema editing, table editing, local IndexedDB autosave, JSON import, and JSON/Markdown/CSV/XLSX export.

## Project Validation Profile

Run development commands through the repo-local Docker wrapper `./hako`:

```bash
./hako npm run lint
./hako npm run typecheck
./hako npm test
./hako npm run build
```

For user-facing UI work, also run a browser smoke test when possible. If Docker, dependency installation, browser validation, or another material check cannot run, record the skipped check and the reason before finishing.

### Trellis Plus Submit-Ready Profile

Before proposing a work commit, compare the diff, task acceptance criteria, and validation evidence:

- Required automated checks: `./hako npm run lint`, `./hako npm run typecheck`, `./hako npm test`, and `./hako npm run build`.
- Dependency changes: also run `./hako npm audit --omit=dev` when runtime dependencies are added or upgraded.
- User-facing UI, workflow, layout, accessibility, export/import, or persistence changes: run a browser smoke test when possible and record the tested path.
- Manual review is required when a material check cannot run, browser/device behavior cannot be verified by the agent, or product judgment remains unresolved.
- Manual review is optional when all required checks pass and the remaining risk is a small visible behavior that the user can quickly smoke test.
- Manual review is not needed for mechanical or documentation-only changes covered by focused review.

When human feedback is required or optional, ask for concrete signals: pass/fail for named paths, screenshots or recordings for UI failures, browser console output, logs, and expected-vs-actual notes.

### Docker Dev Wrapper

Rakuseru already has a repo-local Docker-backed command wrapper:

- one-shot commands: `./hako ...`
- dev server helper: `./dev.sh` / `./dev.sh down`
- cache/home directory: `.devhome` (gitignored)
- Codex allow rule: `.codex/rules/default.rules` allows only the `./hako` prefix.

Do not broaden allow rules to raw `docker`, `bash`, `sh`, or package-manager commands when `./hako` can run the check. If a future task needs to recreate or substantially change the wrapper, apply the `dev-it-in-docker` skill first.

## Guidelines Index

| Guide | Use |
|-------|-----|
| [Directory Structure](./directory-structure.md) | Source layout and ownership boundaries |
| [Component Guidelines](./component-guidelines.md) | React component shape, props, accessibility, styling |
| [Hook Guidelines](./hook-guidelines.md) | Effects, store selectors, and when to add custom hooks |
| [State Management](./state-management.md) | Zustand store and local/browser/server state boundaries |
| [Quality Guidelines](./quality-guidelines.md) | Required checks, tests, dependency and review expectations |
| [Type Safety](./type-safety.md) | Canonical document types, validation, import error contract |

## Pre-Development Checklist

- Read the relevant guide above before editing a layer.
- For model or import/export changes, read `type-safety.md` and `state-management.md`.
- For UI changes, read `component-guidelines.md` and `hook-guidelines.md`.
- For dependency, build, or validation changes, read `quality-guidelines.md`.
- Keep `mvp.md` in mind: the first version is frontend-only.

## Quality Check

- Run the required commands from `quality-guidelines.md`.
- For model, validation, adapter, or persistence changes, verify `type-safety.md` and `state-management.md` still match the code.
- For component changes, verify `component-guidelines.md` accessibility and boundary rules.
- For UI-visible changes, include a browser smoke test or record why it was skipped.
