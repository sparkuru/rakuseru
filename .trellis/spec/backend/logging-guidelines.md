# Backend Logging and Audit Guidelines

## Scenario: Observe a hosted request or security mutation

### 1. Scope / Trigger

Use this contract whenever adding structured logs, audit actions/details,
authentication failures, or operator diagnostics.

### 2. Signatures

```ts
interface StructuredLogger {
  log(level: 'info' | 'warn' | 'error', event: string,
      fields?: Record<string, unknown>): void
}

writeAudit(db, {
  workspaceId, actorType, actorUserId, action,
  targetType, targetId, requestId, details, now,
}): Promise<void>
```

### 3. Contracts

- Request logs contain event name, request ID, method, normalized path, status,
  and duration. They never contain bodies or raw query secrets.
- Redaction recursively removes sensitive key names and known raw bearer,
  invitation, and credential token patterns before serialization.
- Audit actions and detail keys are compile-time allow-lists. Details contain
  only safe IDs, roles, scopes, transitions, expiry, and reason codes.
- Successful security mutations append audit within the same transaction.
  Rejected sign-in/bearer authentication uses bounded best effort so audit
  failure does not replace the intended authentication error.
- `audit_events` is append-only in both application API and MariaDB triggers.

### 4. Validation & Error Matrix

- Unsupported audit action/detail key -> reject the write.
- Audit details over the size limit -> reject the write.
- Audit failure inside a protected mutation -> roll back the mutation.
- Best-effort rejected-auth audit failure -> preserve the original `401`.
- Circular or sensitive log object -> serialize with redacted placeholders.

### 5. Good/Base/Bad Cases

- Good: `credential.reveal` records actor/credential/workspace/request IDs and
  no secret.
- Base: browser UI continues using visible status messages rather than server
  logging as user feedback.
- Bad: logging request headers, cookies, bodies, environment, document payloads,
  ciphertext plaintext, password hashes, or raw tokens.

### 6. Tests Required

- Every new security mutation asserts its audit action and safe target fields.
- Exactly-once assertions for bootstrap and successful member removal.
- Forced audit insertion failure proves transaction rollback.
- Sentinel password/session/CSRF/invitation/credential values are absent from
  captured logs and serialized audit rows.
- Database update/delete against `audit_events` is rejected when trigger
  behavior changes.

### 7. Wrong vs Correct

Wrong:

```ts
logger.log('error', 'request.failed', { headers: request.headers, body, error })
```

Correct:

```ts
logger.log('warn', 'http.error', {
  requestId, method, path, status, errorCode,
})
```

Do not add analytics or telemetry to the browser application without separate
product scope and privacy review.
