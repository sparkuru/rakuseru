import { Kysely, MysqlDialect, sql } from 'kysely'
import { Migrator, type Migration, type MigrationProvider } from 'kysely/migration'
import { createPool, type Pool } from 'mysql2'
import type { ApiConfig } from '../config/config.js'
import * as securityFoundation from './migrations/001_security_foundation.js'
import type { DatabaseSchema } from './types.js'

export const CURRENT_MIGRATION = '001_security_foundation'

class StaticMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return { [CURRENT_MIGRATION]: securityFoundation }
  }
}

export interface DatabaseHandle {
  readonly db: Kysely<DatabaseSchema>
  readonly pool: Pool
  destroy(): Promise<void>
}

export function createDatabase(config: ApiConfig): DatabaseHandle {
  const pool = createPool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
    connectionLimit: config.database.connectionLimit,
    charset: 'utf8mb4',
    timezone: 'Z',
    supportBigNumbers: true,
    bigNumberStrings: true,
  })
  const db = new Kysely<DatabaseSchema>({ dialect: new MysqlDialect({ pool }) })
  return { db, pool, destroy: async () => db.destroy() }
}

export async function runMigrations(db: Kysely<DatabaseSchema>): Promise<void> {
  const migrator = new Migrator({ db, provider: new StaticMigrationProvider() })
  const result = await migrator.migrateToLatest()
  if (result.error) throw result.error
}

export async function databaseReady(db: Kysely<DatabaseSchema>): Promise<boolean> {
  try {
    await sql`SELECT 1`.execute(db)
    const result = await sql<{ name: string }>`
      SELECT name FROM kysely_migration ORDER BY timestamp DESC LIMIT 1
    `.execute(db)
    return result.rows[0]?.name === CURRENT_MIGRATION
  } catch {
    return false
  }
}
