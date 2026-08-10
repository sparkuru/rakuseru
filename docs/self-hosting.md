# Self-hosting Rakuseru

This stack adds an optional hosted service beside the existing browser-local
editor. It does not read, migrate, upload, or delete any document stored in
browser IndexedDB.

## Topology and trust boundary

Compose starts three persistent services:

- `web` serves the frontend and reverse-proxies `/api/`, `/health/`, and
  `/openapi` to the API.
- `api` listens only on the internal Compose network at port 3000.
- `mariadb` listens only on the internal Compose network at port 3306 and stores
  data in the project-scoped `mariadb_data` named volume.

Only `web` publishes a host port. The default binding is
`127.0.0.1:8080`; it is suitable for a trusted TLS reverse proxy on the same
host. The outer proxy must:

1. terminate TLS with a valid certificate;
2. forward only the configured public hostname to `127.0.0.1:8080`;
3. replace client-supplied forwarding headers and set `Host` and
   `X-Forwarded-Proto: https` itself;
4. apply network access controls and request-rate controls appropriate to the
   deployment.

Set `PUBLIC_ORIGIN` to the exact browser origin, including `https://` and any
non-default port. Production sessions use secure cookies. Do not publish the
default HTTP listener directly to an untrusted network. Login rate limiting is
not part of this foundation.

The persistent deployment Compose stack and `./hako` are separate mechanisms.
Compose runs the hosted service and owns its named database volume. `hako` runs
ephemeral development commands and must not be used to manage, stop, or delete
the hosted stack.

## Pinned runtime images

The repository pins these exact base image tags:

- Node `22.22.0-alpine3.23` for frontend builds and the API;
- nginx `1.29.8-alpine3.23` for the web runtime;
- MariaDB `11.8.8-noble` for persistent storage.

Record the resolved image digests with each release. Rebuild and rerun the full
quality gate when intentionally updating any tag, especially the API image's
native Argon2 binding.

## Prepare configuration

Requirements are Docker Engine, Docker Compose v2, `curl`, and `openssl`.

```bash
(
  set -Eeuo pipefail
  test ! -e .env
  cp -- .env.example .env
  chmod 0600 -- .env
  openssl rand -hex 32
  openssl rand -hex 32
  openssl rand -base64 32
)
```

Place the two hexadecimal values in `MARIADB_PASSWORD` and
`MARIADB_ROOT_PASSWORD`. Place the base64 value in
`CREDENTIAL_ENCRYPTION_KEY`. Do not paste generated values into logs, tickets,
shell arguments, or the repository. Keep `CREDENTIAL_KEY_VERSION=1` for the
initial key. The example file is intentionally non-runnable until all blank
required values are filled.

Replace `PUBLIC_ORIGIN` with the final TLS origin. Keep
`RAKUSERU_WEB_BIND_ADDRESS=127.0.0.1` when an outer proxy runs on the same host.
Every secret field must be non-empty; the API additionally rejects malformed
configuration. Compose interpolation places secrets in container environment
metadata, so Docker daemon access is privileged and must be restricted.

Validate without printing the rendered configuration, then build the exact
release images:

```bash
docker compose config --quiet
docker compose build --pull
```

## Initialize and bootstrap

Start MariaDB, run the forward migrations explicitly, then start the full
stack. API startup also checks migration state and will not report ready if the
database is unavailable or behind the application target.

```bash
docker compose up -d --wait mariadb
docker compose run --rm --no-deps api npm run migrate
docker compose up -d --wait
```

Create the first owner only after MariaDB is healthy. Read the password without
echoing it or storing it in shell history:

```bash
(
  set -Eeuo pipefail
  IFS= read -r -p 'Owner email: ' BOOTSTRAP_EMAIL
  IFS= read -r -p 'Workspace name: ' BOOTSTRAP_WORKSPACE_NAME
  IFS= read -r -s -p 'Owner password: ' BOOTSTRAP_PASSWORD
  printf '\n'
  export BOOTSTRAP_EMAIL BOOTSTRAP_WORKSPACE_NAME BOOTSTRAP_PASSWORD
  docker compose run --rm --no-deps \
    -e BOOTSTRAP_EMAIL \
    -e BOOTSTRAP_WORKSPACE_NAME \
    -e BOOTSTRAP_PASSWORD \
    api npm run bootstrap
)
```

The bootstrap transaction is idempotent for the completed identity and refuses
conflicting initialization. It never enables public registration.

## Verify a running stack

All public checks go through `web`; neither internal port is published.

```bash
curl --fail --silent --show-error http://127.0.0.1:8080/health/live
curl --fail --silent --show-error http://127.0.0.1:8080/health/ready
curl --fail --silent --show-error \
  --output /dev/null http://127.0.0.1:8080/openapi/json
docker compose ps
```

If `RAKUSERU_WEB_PORT` differs, replace `8080`. `docker compose ps` must show
healthy `web`, `api`, and `mariadb` services, with a published port only on
`web`. The public hostname must return the same checks over HTTPS after the
outer proxy is enabled.

Use the schemas at `/openapi` to perform the authenticated verification:

1. sign in through `POST /api/app/auth/sign-in`, retaining the session cookie
   and returned CSRF token;
2. list workspaces through `GET /api/app/workspaces`;
3. list a known credential, then call its `/reveal` route with the same cookie,
   exact `Origin`, and `X-Rakuseru-CSRF` header;
4. confirm the revealed credential matches the pre-backup value and that a new
   credential-reveal audit event was appended.

The foundation has no public `/api/v1` resource route; those bearer-protected
read routes belong to the later hosted-resource task. Credential bearer
authentication is covered by the API integration suite until such a route is
available.

## Stop without losing data

```bash
docker compose stop
docker compose down
```

Both commands preserve `mariadb_data`. Never add `--volumes` to routine stop,
upgrade, rollback, or troubleshooting commands. Removing containers does not
affect browser IndexedDB.

## Backup

Create and verify a logical dump before every production upgrade. This command
uses the database credentials already present inside the MariaDB container and
does not print them:

```bash
(
  set -Eeuo pipefail
  umask 077
  mkdir -p -- backups
  readonly BACKUP_FILE=backups/rakuseru-before-upgrade.sql
  test ! -e "${BACKUP_FILE}"
  test ! -e "${BACKUP_FILE}.sha256"
  docker compose exec -T mariadb sh -c \
    'MYSQL_PWD="$MARIADB_PASSWORD" exec mariadb-dump \
      --user="$MARIADB_USER" \
      --single-transaction \
      --skip-lock-tables \
      --hex-blob \
      --routines \
      --events \
      "$MARIADB_DATABASE"' > "${BACKUP_FILE}"
  test -s "${BACKUP_FILE}"
  sha256sum -- "${BACKUP_FILE}" > "${BACKUP_FILE}.sha256"
  sha256sum --check -- "${BACKUP_FILE}.sha256"
)
```

Back up `.env` separately to encrypted offline storage because it contains the
credential encryption key. Do not keep this copy beside the SQL dump on the
same host:

```bash
(
  set -Eeuo pipefail
  readonly KEY_BACKUP=/secure/offline/path/rakuseru-production.env
  test ! -e "${KEY_BACKUP}"
  install -m 0600 -- .env "${KEY_BACKUP}"
)
```

The SQL dump is insufficient on its own. Losing the matching instance key makes
stored credential secrets unrecoverable. Exposing the key compromises every
credential encrypted with it. Database passwords, the encryption key, and both
backup artifacts require independent access control and retention policy.

## Restore rehearsal

Rehearse restoration into a different Compose project and a fresh named volume.
Never test restoration by overwriting the production volume.

1. Copy the backed-up environment file to `restore.env` on an isolated host or
   isolated directory, set mode `0600`, and set `RAKUSERU_WEB_PORT=8081`.
2. Use the same application release that created the dump for the first boot.
3. Verify the checksum, start only the fresh database, and import the dump.

```bash
(
  set -Eeuo pipefail
  readonly BACKUP_FILE=backups/rakuseru-before-upgrade.sql
  chmod 0600 -- restore.env
  sha256sum --check -- "${BACKUP_FILE}.sha256"
  docker compose -p rakuseru-restore --env-file restore.env \
    up -d --wait mariadb
  docker compose -p rakuseru-restore --env-file restore.env \
    exec -T mariadb sh -c \
    'MYSQL_PWD="$MARIADB_PASSWORD" exec mariadb \
      --user="$MARIADB_USER" "$MARIADB_DATABASE"' < "${BACKUP_FILE}"
  docker compose -p rakuseru-restore --env-file restore.env \
    run --rm --no-deps api npm run migrate
  docker compose -p rakuseru-restore --env-file restore.env up -d --wait
)
```

Verify the restored public health endpoints on port 8081. Repeat the
authenticated sign-in, workspace-list, credential-reveal, and audit checks from
the running-stack section. Compare safe continuity counts without selecting
secret columns:

```bash
docker compose -p rakuseru-restore --env-file restore.env \
  exec -T mariadb sh -c \
  'MYSQL_PWD="$MARIADB_PASSWORD" exec mariadb \
    --batch --skip-column-names \
    --user="$MARIADB_USER" "$MARIADB_DATABASE" \
    --execute="SELECT COUNT(*) FROM users;
      SELECT COUNT(*) FROM workspace_members;
      SELECT COUNT(*) FROM api_credentials;
      SELECT COUNT(*) FROM audit_events;"'
```

A missing `CREDENTIAL_ENCRYPTION_KEY` must prevent API startup. In this isolated
rehearsal only, replacing it with a different valid 32-byte base64 key must make
credential reveal fail closed without returning partial plaintext. Restore the
matching key and confirm reveal succeeds again. A successful rehearsal records
the release tag, image digests, dump checksum, key version, safe row counts, and
verification time outside the repository.

Stopping the rehearsal preserves its named volume by default:

```bash
docker compose -p rakuseru-restore --env-file restore.env down
```

Delete a rehearsal volume only through a separately reviewed, explicit cleanup
operation after the evidence is retained.

## Upgrade

1. Announce a write-maintenance window.
2. Create and checksum a fresh database dump and separately verify key custody.
3. Record current application tags and image digests.
4. Build the candidate images under a new immutable application tag and run
   lint, strict typecheck, tests, builds, migration smoke, and restore rehearsal.
5. Stop write traffic, migrate explicitly, then start and verify the stack.

Set `RAKUSERU_IMAGE_TAG` in `.env` to the candidate release identifier before
building. Never reuse that identifier for different image contents.

```bash
(
  set -Eeuo pipefail
  docker compose stop web api
  docker compose build --pull web api
  docker compose run --rm --no-deps api npm run migrate
  docker compose up -d --wait
)
```

Do not enable MariaDB automatic upgrades. Change the pinned MariaDB image only
as its own reviewed upgrade with a verified restore rehearsal. Migration
commands are repeatable, but MariaDB DDL rollback is not assumed transactional
or reversible.

## Rollback

If the candidate fails before migration, restart the previously recorded web
and API images. If any non-reversible migration ran, do not point old code at
the upgraded schema and do not mutate the production named volume in place.

1. stop web/API writes and preserve the current database volume for diagnosis;
2. restore the pre-upgrade dump plus its matching environment/key backup into a
   fresh project-scoped volume;
3. start the previous application and MariaDB image versions against that
   restored volume;
4. repeat health, sign-in, membership, credential-reveal, and audit-continuity
   checks;
5. switch the trusted TLS proxy only after verification.

The previous production volume remains recoverable until an operator explicitly
removes it. Rollback never reads or changes browser IndexedDB.

## Routine operations

Inspect service status and redacted application logs without rendering Compose
configuration:

```bash
docker compose ps
docker compose logs --since 15m web api mariadb
```

Do not enable request-body logging at the outer proxy. Treat Docker environment
inspection, raw database diagnostic snapshots, support bundles, and shell
history as sensitive. API logs and audits must never contain passwords, raw
session/invitation/credential tokens, cookies, authorization headers, CSRF
values, ciphertext plaintext, or the instance encryption key.
