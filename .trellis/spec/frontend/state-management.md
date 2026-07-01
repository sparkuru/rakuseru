# State Management

> How state is managed in this project.

---

## Overview

Rakuseru uses Zustand for app-level editor state. The store owns the active `SheetDocument`, selected column, persistence status, and user-facing status message.

---

## State Categories

- Global state: active document, selected column id, save/load status.
- Local component state: transient UI-only values that do not affect the document contract.
- Server state: none in MVP. Do not add React Query until a backend/API exists.
- URL state: none in MVP. Add router state only when URL-addressable cells or multi-file flows are implemented.

---

## When to Use Global State

Use global state when the value changes the document, schema editor, table rendering, autosave, import/export, or cross-component selection. Keep one-off control display state local.

---

## Server State

MVP persistence is local IndexedDB through `src/storage/indexedDb.ts`. Store actions call model helpers, then autosave writes the full validated document.

---

## Common Mistakes

- Do not mutate `SheetDocument` in components.
- Do not scatter cell coercion rules across components; call model helpers through store actions.
- Do not introduce remote-state libraries before there is remote state.
