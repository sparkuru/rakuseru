import { loadConfig } from '../config/config.js'
import { createDatabase, runMigrations } from '../db/database.js'

const database = createDatabase(loadConfig())
try {
  await runMigrations(database.db)
} finally {
  await database.destroy()
}
