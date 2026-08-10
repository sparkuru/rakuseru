import { randomUUID } from 'node:crypto'
import { loadConfig } from '../config/config.js'
import { createDatabase, runMigrations } from '../db/database.js'
import { SecurityService } from '../modules/security/security-service.js'
import { Argon2PasswordHasher } from '../security/crypto.js'

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required for bootstrap`)
  return value
}

const config = loadConfig()
const database = createDatabase(config)
try {
  await runMigrations(database.db)
  const service = new SecurityService(database.db, new Argon2PasswordHasher(), config)
  const result = await service.bootstrap(
    required('BOOTSTRAP_EMAIL'),
    required('BOOTSTRAP_PASSWORD'),
    required('BOOTSTRAP_WORKSPACE_NAME'),
    randomUUID(),
  )
  process.stdout.write(`${result}\n`)
} finally {
  await database.destroy()
}
