# Frontend Development Guidelines

> Best practices for frontend development in this project.

---

## Overview

This directory contains guidelines for frontend development. Fill in each file with your project's specific conventions.

---

## Project Validation Profile

Current state:

- The repository has no frontend package manifest, test runner, CI workflow, or dev-command wrapper yet.
- MVP implementation should scaffold these before feature work begins.
- After scaffold, development commands should run through the repo-local Docker wrapper `./hako`.

Expected checks after scaffold:

```bash
./hako npm run lint
./hako npm run typecheck
./hako npm test
./hako npm run build
```

For user-facing UI work, perform a browser smoke test in addition to automated checks. If Docker, dependency installation, browser validation, or any material check cannot run, record the skipped check and request targeted human review before commit.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | To fill |
| [Component Guidelines](./component-guidelines.md) | Component patterns, props, composition | To fill |
| [Hook Guidelines](./hook-guidelines.md) | Custom hooks, data fetching patterns | To fill |
| [State Management](./state-management.md) | Local state, global state, server state | To fill |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns | To fill |
| [Type Safety](./type-safety.md) | Type patterns, validation | To fill |

---

## How to Fill These Guidelines

For each guideline file:

1. Document your project's **actual conventions** (not ideals)
2. Include **code examples** from your codebase
3. List **forbidden patterns** and why
4. Add **common mistakes** your team has made

The goal is to help AI assistants and new team members understand how YOUR project works.

---

**Language**: All documentation should be written in **English**.
