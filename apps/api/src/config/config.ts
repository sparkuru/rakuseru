export type RuntimeEnvironment = 'development' | 'test' | 'production'

export interface ApiConfig {
  readonly environment: RuntimeEnvironment
  readonly host: string
  readonly port: number
  readonly publicOrigin: string
  readonly database: {
    readonly host: string
    readonly port: number
    readonly name: string
    readonly user: string
    readonly password: string
    readonly connectionLimit: number
  }
  readonly session: {
    readonly cookieName: string
    readonly ttlSeconds: number
    readonly secure: boolean
  }
  readonly credentialEncryptionKey: Buffer
  readonly credentialKeyVersion: number
}

export class ConfigurationError extends Error {
  override readonly name = 'ConfigurationError'
}

const PLACEHOLDER_PATTERN = /^(?:change[-_ ]?me|example|placeholder|password|secret|todo|xxx+)$/i

function rejectProductionPlaceholder(environment: string, key: string, value: string): void {
  if (environment !== 'production') return
  if (PLACEHOLDER_PATTERN.test(value) || value.includes('rakuseru.example.com')) {
    throw new ConfigurationError(`${key} contains an unsafe example value`)
  }
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim()
  if (!value) throw new ConfigurationError(`${key} is required`)
  return value
}

function integer(env: NodeJS.ProcessEnv, key: string, fallback?: number): number {
  const raw = env[key]?.trim()
  if (!raw && fallback !== undefined) return fallback
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ConfigurationError(`${key} must be a positive integer`)
  }
  return value
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const environment = env.NODE_ENV ?? 'development'
  if (!['development', 'test', 'production'].includes(environment)) {
    throw new ConfigurationError('NODE_ENV must be development, test, or production')
  }
  const publicOrigin = required(env, 'PUBLIC_ORIGIN')
  rejectProductionPlaceholder(environment, 'PUBLIC_ORIGIN', publicOrigin)
  const origin = new URL(publicOrigin)
  if (origin.origin !== publicOrigin || (environment === 'production' && origin.protocol !== 'https:')) {
    throw new ConfigurationError('PUBLIC_ORIGIN must be a canonical origin and use HTTPS in production')
  }
  const encodedKey = required(env, 'CREDENTIAL_ENCRYPTION_KEY')
  rejectProductionPlaceholder(environment, 'CREDENTIAL_ENCRYPTION_KEY', encodedKey)
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encodedKey) || encodedKey.length % 4 !== 0) {
    throw new ConfigurationError('CREDENTIAL_ENCRYPTION_KEY must be canonical base64')
  }
  const key = Buffer.from(encodedKey, 'base64')
  if (key.length !== 32 || key.toString('base64') !== encodedKey) {
    throw new ConfigurationError('CREDENTIAL_ENCRYPTION_KEY must be canonical base64 decoding to exactly 32 bytes')
  }
  if (environment === 'production' && key.every((byte) => byte === 0)) {
    throw new ConfigurationError('CREDENTIAL_ENCRYPTION_KEY contains an unsafe example value')
  }
  const databaseHost = required(env, 'DB_HOST')
  const databaseName = required(env, 'DB_NAME')
  const databaseUser = required(env, 'DB_USER')
  const databasePassword = required(env, 'DB_PASSWORD')
  rejectProductionPlaceholder(environment, 'DB_HOST', databaseHost)
  rejectProductionPlaceholder(environment, 'DB_NAME', databaseName)
  rejectProductionPlaceholder(environment, 'DB_USER', databaseUser)
  rejectProductionPlaceholder(environment, 'DB_PASSWORD', databasePassword)
  return {
    environment: environment as RuntimeEnvironment,
    host: env.API_HOST?.trim() || '0.0.0.0',
    port: integer(env, 'API_PORT', 3000),
    publicOrigin,
    database: {
      host: databaseHost,
      port: integer(env, 'DB_PORT', 3306),
      name: databaseName,
      user: databaseUser,
      password: databasePassword,
      connectionLimit: integer(env, 'DB_CONNECTION_LIMIT', 10),
    },
    session: {
      cookieName: env.SESSION_COOKIE_NAME?.trim() || 'rakuseru_session',
      ttlSeconds: integer(env, 'SESSION_TTL_SECONDS', 86_400),
      secure: environment === 'production',
    },
    credentialEncryptionKey: key,
    credentialKeyVersion: integer(env, 'CREDENTIAL_KEY_VERSION'),
  }
}

export function redactedConfig(config: ApiConfig): Record<string, unknown> {
  return {
    environment: config.environment,
    host: config.host,
    port: config.port,
    publicOrigin: config.publicOrigin,
    database: { ...config.database, password: '[REDACTED]' },
    session: config.session,
    credentialKeyVersion: config.credentialKeyVersion,
  }
}
