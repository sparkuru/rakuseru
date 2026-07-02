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
