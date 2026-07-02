# Backend Logging Guidelines

Rakuseru has no backend logging layer. The current app should not add persistent logs, telemetry, or analytics as part of normal frontend feature work.

## Current State

- No logging library is configured.
- No server process exists.
- User-visible status messages live in `src/state/sheetStore.ts`.
- Validation errors are surfaced in the UI status line, not logged as the primary feedback path.

## Browser Diagnostics

Use explicit user-facing status for recoverable import, save, and load failures. Temporary `console.*` debugging should not be committed as an observability strategy.

## Future Backend Logging

If a backend is introduced, logging must be designed with the server package. Define levels, structured fields, request correlation, redaction rules, and retention before logging document contents or uploaded image metadata.

## Anti-Patterns

- Logging full `SheetDocument` payloads or image data URLs.
- Adding analytics or telemetry without product scope.
- Hiding user-action failures in console output instead of `setError` or another visible UI path.
