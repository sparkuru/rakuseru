# Hosted service foundation evidence

## Implemented contracts

- Optional `@rakuseru/api` Node/Elysia service with MariaDB migration gate,
  `/api/app/**` browser routes, health/OpenAPI endpoints, local authentication,
  workspace policy, invitations, credentials, and append-only audit.
- Browser-neutral `@rakuseru/document-contract` with stable frontend
  `src/model/*` re-exports. Existing IndexedDB behavior remains local and is not
  migrated or read by the service.
- Production web/API images and three-service Compose topology. Only the web
  reverse proxy publishes a loopback host port.

## Root quality gate — passed

Run against the final reviewed source on 2026-08-10:

```text
./hako npm run lint                         pass
./hako npm run typecheck                    pass
./hako npm test                             pass
  frontend                                  60 passed
  @rakuseru/document-contract                8 passed
  @rakuseru/api unit/HTTP                    21 passed
  MariaDB conditional suite                 9 active gates plus 1 explicit
                                             skip marker shown as 10 skipped;
                                             covered by isolated gate below
./hako npm run build                        pass
./hako npm audit --omit=dev                 0 vulnerabilities
bash -n hako dev.sh                         pass
shellcheck hako dev.sh                      pass
shfmt -d -i 2 -ci hako dev.sh              pass
git diff --check                            pass
task.py validate                            pass, both 11-entry manifests
```

The frontend build retains the pre-existing ExcelJS direct-`eval` and large
chunk warnings; no new frontend failure was introduced.

## Independent Trellis review — passed after fixes

The independent reviewer found and fixed:

- high: missing credential-principal workspace binding and session-only
  service boundaries;
- high: membership policy TOCTOU across sensitive mutations and reads;
- high: session/credential authentication races with revoke, disable, member,
  and scope changes;
- medium: bootstrap singleton inconsistency, action-specific audit detail
  validation, credential reveal digest verification, and invitation replacement
  audit/lock ordering;
- low: non-canonical base64 credential keys.

Regression tests were added for each class. The review classified the change
as `human-required` because it changes authentication, authorization,
cryptography, database concurrency, and deployment behavior.

The submit-ready human review was approved on 2026-08-10.

## Isolated MariaDB, image, Compose, and restore gate

Run against the final post-review source in disposable projects:

- MariaDB integration: `9/9` passed on an empty named volume, internal-only
  network, single worker, no file parallelism, and no cache.
- Clean API image: `sha256:6e86b02e8d46305af78a3f85d39a70919eb458d670b020c90ca5d61f9041c2bd`.
  Complete compiled migrate/bootstrap/database output, workspace-local
  `@elysiajs/node`, native Argon2id hash/verify, and production-pruned audit
  (`0 vulnerabilities`) passed.
- Clean web image: `sha256:d9c8a5aba031cd651da4a80d242837a0ed7bdff45c5dc99ec341f1571bfe7909`.
- Source and fresh-restore stacks each reached `3/3 healthy`. Reverse-proxied
  live, ready, OpenAPI, static content, migration, bootstrap, and nginx config
  passed. Rendered Compose config defines published ports for `web` only.
- A non-empty logical dump passed SHA-256 verification, imported into a fresh
  named volume, and migrated. Matching-key reveal equaled the pre-backup secret
  exactly and appended a restore audit. A different valid 32-byte key returned
  strict HTTP `503 service_unavailable` without plaintext. Restoring the
  matching key made reveal succeed again.
- Test containers, volumes, networks, temporary directories, and integration
  image tags were removed. Only the two final production images were retained.

## Known boundaries

- The foundation intentionally exposes no `/api/v1/**` resource route.
  Credential bearer authentication is a service contract for the next hosted
  resource child.
- Login rate limiting and TLS termination belong to the trusted outer proxy or
  a later security task; the self-host guide calls this out explicitly.
- Local browser documents remain independent of hosted instance state.
- `npm audit --omit=dev` and the API production-pruned tree are clean. The full
  development/build tree still reports four high advisories in ESLint/Vite/
  jsdom transitive dependencies (`brace-expansion`, `nanoid`, `postcss`, and
  `undici`). They are absent from both runtime images; update the pinned tool
  chain and rerun clean image evidence in a dedicated dependency refresh.
