# Hosted stack evidence

Researched 2026-08-10 from primary project and runtime documentation. This note
supports planning decisions; implementation still resolves and locks exact
package/image versions in `package-lock.json` and Docker/Compose files.

## Elysia on Node

- Elysia's official Node integration installs `elysia` plus `@elysia/node` and
  constructs the application with `new Elysia({ adapter: node() })`. The guide
  also recommends strict TypeScript and shows `tsx` as a Node development
  runner. This supports using Elysia without making Bun a project runtime.
  Source: https://elysiajs.com/integrations/node
- Elysia's schema system validates request and response fields at runtime,
  infers TypeScript types, and generates OpenAPI schemas from the same source.
  The global error lifecycle can normalize validation failures. This supports
  one route-schema boundary plus the project error envelope rather than
  hand-maintained parallel DTO types.
  Sources: https://elysiajs.com/essential/validation and
  https://elysiajs.com/patterns/openapi

## Kysely and MariaDB

- Kysely's `MysqlDialect` uses the `mysql2` library and accepts a `mysql2` pool
  (or a lazy pool factory). The dialect is the selected compatibility boundary
  for MariaDB; database integration tests, rather than SQL-name assumptions,
  must verify migrations and query behavior.
  Sources: https://kysely-org.github.io/kysely-apidoc/classes/MysqlDialect.html
  and
  https://kysely-org.github.io/kysely-apidoc/interfaces/MysqlDialectConfig.html
- MariaDB documents `JSON` as a compatibility alias for `LONGTEXT COLLATE
  utf8mb4_bin`, with JSON validity enforced for the alias. It is not MySQL's
  binary JSON representation. Therefore audit detail JSON remains small,
  validated, and non-indexed; relational fields carry IDs, actions, and query
  boundaries.
  Source: https://mariadb.com/docs/server/reference/data-types/string-data-types/json

## Passwords and credential encryption

- The maintained `node-argon2` binding supports Argon2id by default, PHC string
  generation/verification, and currently documents Node 22+ as its tested
  baseline. The repository's existing Docker wrapper already selects Node 22,
  so implementation should pin a Node 22 image and an exact compatible argon2
  version, then test the native module inside that image.
  Source: https://github.com/ranisalt/node-argon2
- Node's crypto API provides `createCipheriv`/`createDecipheriv`; for GCM the
  authentication tag defaults to 16 bytes. Its documentation requires IVs to
  be unpredictable and unique and describes `randomBytes` as cryptographically
  strong pseudorandom data. The credential envelope therefore uses a fresh
  random IV per encryption, preserves the tag, binds stable credential context
  as authenticated data, and rejects any failed `final()` verification.
  Source: https://nodejs.org/api/crypto.html

## Planning consequences

1. Runtime: Node 22+, not Bun; exact Node, Elysia, adapter, Kysely, mysql2,
   argon2, and MariaDB versions are locked during implementation.
2. Schema source: Elysia route schemas own HTTP validation/OpenAPI; portable
   document validation remains in the browser-neutral contract package.
3. Database: use relational columns for authorization and audit lookup. JSON is
   limited to safe supplemental audit details.
4. Native dependency: Docker install/build and Compose smoke tests are mandatory
   for Argon2, including the target architecture used by this repository.
5. Cryptography: a deployment-provided 32-byte instance key is independent of
   the database backup; both are required to restore re-displayable secrets.
