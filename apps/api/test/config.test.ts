import { describe, expect, it } from 'vitest'
import { ConfigurationError, loadConfig } from '../src/config/config.js'

function validEnvironment(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    API_HOST: '0.0.0.0',
    API_PORT: '3000',
    PUBLIC_ORIGIN: 'https://sheets.example.net',
    DB_HOST: 'mariadb',
    DB_PORT: '3306',
    DB_NAME: 'rakuseru',
    DB_USER: 'rakuseru',
    DB_PASSWORD: 'generated-database-value-42',
    DB_CONNECTION_LIMIT: '10',
    SESSION_COOKIE_NAME: 'rakuseru_session',
    SESSION_TTL_SECONDS: '86400',
    CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
    CREDENTIAL_KEY_VERSION: '1',
  }
}

describe('loadConfig', () => {
  it('accepts a complete production configuration and keeps secrets out of errors', () => {
    const config = loadConfig(validEnvironment())
    expect(config.environment).toBe('production')
    expect(config.credentialEncryptionKey).toHaveLength(32)
  })

  it.each([
    ['PUBLIC_ORIGIN', 'https://rakuseru.example.com'],
    ['DB_HOST', 'example'],
    ['DB_NAME', 'placeholder'],
    ['DB_USER', 'changeme'],
    ['DB_PASSWORD', 'password'],
    ['CREDENTIAL_ENCRYPTION_KEY', Buffer.alloc(32).toString('base64')],
  ])('rejects production placeholder %s', (key, value) => {
    const env = validEnvironment()
    env[key] = value
    expect(() => loadConfig(env)).toThrow(ConfigurationError)
  })

  it('rejects a non-canonical or insecure production origin', () => {
    const env = validEnvironment()
    env.PUBLIC_ORIGIN = 'http://sheets.example.net/'
    expect(() => loadConfig(env)).toThrow('canonical origin')
  })

  it('rejects non-canonical base64 even when it decodes to 32 bytes', () => {
    const env = validEnvironment()
    const canonical = env.CREDENTIAL_ENCRYPTION_KEY as string
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    const finalDataIndex = canonical.length - 2
    const replacement = alphabet[alphabet.indexOf(canonical[finalDataIndex] as string) + 1]
    env.CREDENTIAL_ENCRYPTION_KEY = `${canonical.slice(0, finalDataIndex)}${replacement}${canonical.slice(finalDataIndex + 1)}`

    expect(Buffer.from(env.CREDENTIAL_ENCRYPTION_KEY, 'base64')).toHaveLength(32)
    expect(() => loadConfig(env)).toThrow('canonical base64')
  })
})
