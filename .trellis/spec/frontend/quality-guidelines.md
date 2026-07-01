# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

Frontend changes must pass the Docker-backed checks through `./hako`. The wrapper is the approval boundary and keeps Node/npm off the host.

---

## Forbidden Patterns

- Do not run raw host `npm` for project validation.
- Do not add broad Codex allow rules for raw `docker`, `bash`, `sh`, or package-manager commands.
- Do not keep known high-severity runtime dependency audit findings when a reasonable dependency change removes them.
- Do not import heavy export libraries into the initial UI bundle when they are only needed after a button click.

---

## Required Patterns

- Use `./hako npm run typecheck`, `./hako npm run lint`, `./hako npm test`, and `./hako npm run build`.
- Use `npm audit --omit=dev` after adding runtime dependencies.
- Lazy-load heavy exporter dependencies when practical.
- Keep `hako` executable and `.devhome` gitignored.

---

## Testing Requirements

Model helpers and import validation need unit tests. UI-visible changes need at least a browser smoke test in addition to automated checks.

---

## Code Review Checklist

- Document contract changes are reflected in model helpers, validation, adapters, and tests.
- Components call store/model actions instead of duplicating mutation rules.
- Build warnings from large dependencies are acknowledged and mitigated where reasonable.
