import { createApp } from './app.js'
import { loadConfig, redactedConfig } from './config/config.js'
import { createDatabase, databaseReady, runMigrations } from './db/database.js'
import { SecurityService } from './modules/security/security-service.js'
import { JsonLogger } from './observability/logger.js'
import { Argon2PasswordHasher } from './security/crypto.js'

const config = loadConfig()
const logger = new JsonLogger()
logger.log('info', 'service.configured', redactedConfig(config))

const database = createDatabase(config)
await runMigrations(database.db)

const security = new SecurityService(database.db, new Argon2PasswordHasher(), config)
const app = createApp({ config, security, ready: () => databaseReady(database.db), logger })
app.listen({ hostname: config.host, port: config.port })
logger.log('info', 'service.started', { host: config.host, port: config.port })

let shuttingDown = false
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  logger.log('info', 'service.stopping', { signal })
  await app.stop()
  await database.destroy()
}

process.once('SIGINT', () => { void shutdown('SIGINT') })
process.once('SIGTERM', () => { void shutdown('SIGTERM') })
