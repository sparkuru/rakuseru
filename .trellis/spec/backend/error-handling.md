# Backend Error Handling

There is no backend error response contract yet. Current errors are browser-side and should stay close to their boundary.

## Current Error Boundaries

- JSON parse and import validation: `src/adapters/importJson.ts`
- User-facing import/save/load status: `src/state/sheetStore.ts`
- IndexedDB validation fallback: `src/storage/indexedDb.ts`
- Image file read failures: `src/utils/image.ts`

`importJson` throws `Error` with user-readable messages. Toolbar import handling catches those errors and calls `setError`, so failures appear in the app status instead of being console-only.

## Current Pattern

- Parse untrusted input as `unknown`.
- Validate or normalize in `src/model/validation.ts`.
- Return `ValidationResult<T>` for model validation.
- Throw `Error` at adapter boundaries when the UI needs a single failure message.
- Catch async UI boundary errors and store a visible message.

## Future API Errors

If a backend is added, define one typed error response format before implementing endpoints. Keep parse/validation errors user-readable and do not leak stack traces, raw database errors, or secrets.

## Anti-Patterns

- Letting rejected import or save promises become invisible failures.
- Returning unvalidated imported JSON as `SheetDocument`.
- Inventing an API error format before there is an API.
