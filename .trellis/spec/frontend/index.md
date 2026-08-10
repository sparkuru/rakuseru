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

For browser-accessible UI work, follow the Playwright profile below. If Docker, dependency installation, browser validation, or another material check cannot run, record the exact blocker and replacement evidence before finishing.

### Trellis Plus: Playwright Validation Profile

- execution mode: `docker-wrapper`; project commands use `./hako`, but no browser-test runner is installed yet.
- setup/install: not configured. The first `playwright-required` task must add a development-only Playwright Test dependency, a browser-capable container path, and repository scripts/config, then replace every unavailable field below with exact commands before submit-ready.
- app readiness: start with `./dev.sh` and wait for `http://127.0.0.1:5173/`; stop with `./dev.sh down`. `vite.config.ts` fixes the container port at `5173` and binds `0.0.0.0`.
- focused test command: unavailable until the first Playwright bootstrap; the task must add an exact narrow command and selection example.
- full/CI browser command: unavailable; no browser CI workflow exists.
- test location and config: none; no `playwright.config.*` or browser-test directory exists.
- browser projects and supported viewports: none declared; a future responsive task must define at least the supported desktop and narrow-mobile projects it actually verifies.
- fixtures and test-data boundary: no browser fixture harness exists. The current product is browser-local and persists through IndexedDB; tests must use deterministic test-owned browser data and must not use personal sessions or production data.
- accessibility policy: no automated scanner is configured. Browser tests must still prefer semantic locators and assert changed accessible names, keyboard flow, and focus behavior when applicable.
- visual baseline policy: diagnostic screenshots only. No deterministic snapshot baseline or snapshot-update approval process exists.
- failure artifacts: not configured. The bootstrap must define reporter output, failure screenshots, traces, and console/network evidence locations.

Until the bootstrap is complete, an eligible browser task is `playwright-unavailable`, not a passing smoke test. Record the exact missing prerequisite or attempted command and request only the smallest targeted manual or CI replacement. Once Playwright or an equivalent runner is installed, update this single profile instead of creating task-local command profiles.

### Trellis Plus: UUPM Integration Profile

- initialization: complete for Codex via `.codex/skills/ui-ux-pro-max/SKILL.md` using UUPM CLI 2.10.2.
- search entry point: `python3 .codex/skills/ui-ux-pro-max/scripts/search.py`; the installed script supports `--design-system`, `--stack react`, Markdown output, persistence, and design variance/motion/density controls.
- plan: for each user-visible frontend task, save raw task-specific output to `.trellis/tasks/<task>/research/ui-ux-pro-max.md`, then synthesize approved UI decisions and states into the task's `design.md`.
- context: in sub-agent mode, add the UUPM research and relevant frontend specs to both `implement.jsonl` and `check.jsonl`. Do not duplicate automatically injected `design.md` in these spec/research manifests.
- implement: read the approved design record and UUPM research before editing UI; do not silently replace an approved product or interaction decision.
- check: verify responsive and narrow-width behavior, relevant loading/empty/error/disabled/success/permission states, accessibility, keyboard/focus flow, reduced motion, touch targets, and applicable Playwright evidence.
- update spec: promote only reusable project conventions here or in the linked frontend guides. Keep raw research and task-only decisions inside the task.

The generated `.codex/` skill bundle follows the repository's existing ignore behavior and must not be force-staged. A non-Codex platform must initialize its own project-local UUPM entry point before using UUPM commands.

### Trellis Plus Submit-Ready Profile

Before proposing a work commit, compare the diff, task acceptance criteria, and validation evidence:

- Required automated checks: `./hako npm run lint`, `./hako npm run typecheck`, `./hako npm test`, and `./hako npm run build`.
- Dependency changes: also run `./hako npm audit --omit=dev` when runtime dependencies are added or upgraded.
- Browser-accessible UI, workflow, layout, accessibility, export/import, or persistence changes: classify against the Playwright profile and run focused automation when available; record the tested path, states, viewports, and fixtures.
- Manual review is required when a material browser-automatable path remains unvalidated, automation is unavailable, a real device/private environment is required, a material check cannot run, or product judgment remains unresolved.
- Manual review is optional when all required checks and applicable focused browser tests pass and only a small visual or preference judgment remains.
- Manual review is not needed for mechanical/documentation-only changes or changes whose acceptance criteria are fully covered by focused automated checks with no residual human-only risk.

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
- For UI-visible changes, verify the approved UUPM decisions and include focused Playwright evidence, or record the exact automation blocker and targeted replacement check.
