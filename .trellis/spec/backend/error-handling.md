# Backend Error Handling

## Scenario: Return a hosted API failure

### 1. Scope / Trigger

Use this contract for validation, authentication, policy, state conflicts,
database readiness, credential integrity, and unexpected route failures.

### 2. Signatures

```ts
class ApiError extends Error {
  readonly status: 400 | 401 | 403 | 404 | 409 | 503
  readonly code: string
}

type ErrorEnvelope = {
  error: { code: string; message: string; requestId: string }
}
```

Every route declares the envelope for its possible non-success statuses.

### 3. Contracts

- One request ID is generated or accepted per request and reused in the
  response header, envelope, log, and audit context.
- Elysia validation failures map to `400 bad_request` with a stable generic
  message, not raw validator internals.
- Expected domain failures use `ApiError`. Unexpected failures become generic
  `internal_error`; stack, SQL, config, and crypto details remain server-side.
- Ownership-sensitive lookups use `404` where distinguishing existence would
  leak another workspace or user's credential.
- AES-GCM/key/AAD/version failures return fail-closed service unavailability,
  never ciphertext, partial plaintext, or key diagnostics.

### 4. Validation & Error Matrix

| Condition | Status/code |
| --- | --- |
| Invalid schema/email/password bounds | `400 bad_request` |
| Missing, disabled, expired, or revoked authentication | `401 unauthenticated` |
| Wrong Origin or CSRF digest | `403 forbidden` |
| Missing workspace capability | `403 forbidden` |
| Hidden/cross-workspace owned record | `404 not_found` |
| Final-owner or bootstrap conflict | `409 conflict` |
| Database not ready or credential integrity/key unavailable | `503 service_unavailable` |
| Unexpected exception | `500 internal_error` |

### 5. Good/Base/Bad Cases

- Good: client receives a stable code, safe message, and matching request ID.
- Base: frontend import errors retain their existing user-readable browser
  behavior and do not use the HTTP envelope.
- Bad: return `error.message` from mysql2, Argon2, AES-GCM, or config parsing.

### 6. Tests Required

- Invalid body asserts `400`, stable code/message, and identical request IDs in
  header and body.
- Origin/CSRF tests cover missing, wrong, and valid combinations.
- Cross-workspace/ownership tests assert non-enumerating behavior.
- Tampered/wrong-key credentials assert no secret and no crypto detail.
- Capture logs/audits with sentinel secrets and assert they are absent.

### 7. Wrong vs Correct

Wrong:

```ts
return new Response(JSON.stringify({ error: String(error) }), { status: 500 })
```

Correct:

```ts
const mapped = errorEnvelope(error, requestId(request))
set.status = mapped.status
return mapped.body
```

Browser adapter errors continue to accept untrusted data as `unknown`, use
`validateSheetDocument`, and surface user-readable messages through state/UI.
