import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'
import { hash, needsRehash, verify, argon2id } from 'argon2'

const TOKEN_BYTES = 32
const GCM_IV_BYTES = 12
const GCM_TAG_BYTES = 16

export interface PasswordHasher {
  hash(password: string): Promise<string>
  verify(encoded: string, password: string): Promise<boolean>
  needsRehash(encoded: string): boolean
}

export class Argon2PasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    assertPassword(password)
    return hash(password, {
      type: argon2id,
      memoryCost: 65_536,
      timeCost: 3,
      parallelism: 1,
      hashLength: 32,
    })
  }

  async verify(encoded: string, password: string): Promise<boolean> {
    assertPassword(password)
    try {
      return await verify(encoded, password)
    } catch {
      return false
    }
  }

  needsRehash(encoded: string): boolean {
    return needsRehash(encoded, { memoryCost: 65_536, timeCost: 3, parallelism: 1 })
  }
}

export interface OpaqueToken {
  readonly raw: string
  readonly digest: Buffer
}

export interface CredentialEnvelope {
  readonly ciphertext: Buffer
  readonly iv: Buffer
  readonly tag: Buffer
  readonly keyVersion: number
}

export function assertPassword(password: string): void {
  if (Buffer.byteLength(password, 'utf8') < 12 || Buffer.byteLength(password, 'utf8') > 1_024) {
    throw new Error('Password must be between 12 and 1024 UTF-8 bytes')
  }
}

export function digestSecret(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest()
}

export function digestsEqual(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && timingSafeEqual(left, right)
}

export function generateOpaqueToken(prefix = ''): OpaqueToken {
  const raw = `${prefix}${randomBytes(TOKEN_BYTES).toString('base64url')}`
  return { raw, digest: digestSecret(raw) }
}

export function credentialAad(
  credentialId: string,
  workspaceId: string,
  userId: string,
  secretVersion: number,
  keyVersion: number,
): Buffer {
  return Buffer.from(
    JSON.stringify({ credentialId, workspaceId, userId, secretVersion, keyVersion }),
    'utf8',
  )
}

export function encryptCredential(
  secret: string,
  key: Buffer,
  keyVersion: number,
  aad: Buffer,
): CredentialEnvelope {
  if (key.length !== 32) throw new Error('Credential encryption key must be 32 bytes')
  const iv = randomBytes(GCM_IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: GCM_TAG_BYTES })
  cipher.setAAD(aad)
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  return { ciphertext, iv, tag: cipher.getAuthTag(), keyVersion }
}

export function decryptCredential(envelope: CredentialEnvelope, key: Buffer, aad: Buffer): string {
  if (key.length !== 32) throw new Error('Credential encryption key must be 32 bytes')
  const decipher = createDecipheriv('aes-256-gcm', key, envelope.iv, {
    authTagLength: GCM_TAG_BYTES,
  })
  decipher.setAAD(aad)
  decipher.setAuthTag(envelope.tag)
  return Buffer.concat([decipher.update(envelope.ciphertext), decipher.final()]).toString('utf8')
}
