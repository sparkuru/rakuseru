# Backend Quality Guidelines

## Scenario: Submit a hosted-service change

### 1. Scope / Trigger

Run this gate for changes to `apps/api`, `packages/document-contract`, root
workspace scripts, production dependencies, Docker/Compose, or self-hosting
operations.

### 2. Signatures

```bash
./hako npm run lint
./hako npm run typecheck
./hako npm test
./hako npm run build
./hako npm audit --omit=dev
bash -n hako dev.sh
shellcheck hako dev.sh
shfmt -d -i 2 -ci hako dev.sh
git diff --check
```

Package scripts remain `dev`, `build`, `start`, `typecheck`, `test`, `migrate`,
and `bootstrap`; production migration/bootstrap execute compiled JavaScript.

### 3. Contracts

- `./hako` is the Docker-first command path and publishes no port for one-shot
  commands. `dev.sh` uses exact labels and variable loopback web ports.
- The MariaDB integration suite runs only with `DB_TEST_HOST` and an empty,
  disposable database; a skip in the ordinary root suite is explicit, not
  equivalent to a passed database gate.
- Docker build contexts ignore `.env*`, VCS/Trellis/agent metadata,
  `node_modules`, `dist`, and `*.tsbuildinfo`. TypeScript production builds use
  forced fresh emit so host incremental state cannot suppress image output.
- Production images contain production dependencies and compiled commands;
  verify workspace-local `node_modules` resolution after dependency updates.
- Human review is required for auth/security/deployment changes even when all
  automated checks pass.

### 4. Validation & Error Matrix

- Any lint/type/test/build/audit/diff failure -> not submit-ready.
- Conditional MariaDB suite skipped without a separate real run -> material
  check missing.
- Production container fails module resolution or Argon2 runtime -> image gate
  failed even if local tests pass.
- Matching-key restore not proven or wrong-key reveal returns data -> restore
  gate failed.
- Only mechanics tested for a user-visible or operator workflow -> targeted
  human review remains required.

### 5. Good/Base/Bad Cases

- Good: clean image build, real MariaDB suite, isolated Compose health and port
  smoke, credential dump/restore, then root checks and independent review.
- Base: ordinary root tests report MariaDB tests skipped while recorded
  isolated evidence covers them separately.
- Bad: copy host `dist`/`.tsbuildinfo` into Docker context, include dev
  dependencies to make production commands work, or claim a skipped integration
  suite passed.

### 6. Tests Required

- Unit/HTTP tests for every new function or route; regression test for every
  bug fix.
- Real MariaDB gates listed in `database-guidelines.md`.
- Exact-image Argon2 hash/verify and compiled migrate/bootstrap smoke.
- Compose: all services healthy, only web publishes a port, reverse-proxied
  live/ready/OpenAPI/static page and security headers.
- Logical dump to a fresh named volume; safe row continuity, matching-key
  credential equality, and wrong-key fail-closed.
- Confirm the frontend bundle contains no server module and IndexedDB tests stay
  green.

### 7. Wrong vs Correct

Wrong:

```dockerfile
COPY . .
RUN tsc -b
```

Correct:

```text
.dockerignore excludes **/*.tsbuildinfo and **/dist
production build forces a clean TypeScript emit
runtime smoke imports and starts the final image
```

Record exact commands and outcomes in the active Trellis task before requesting
submit-ready review. Do not remove production or rehearsal volumes as part of
an automated rollback.
