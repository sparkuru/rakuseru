import { describe, expect, it } from 'vitest'
import {
  Argon2PasswordHasher,
  credentialAad,
  decryptCredential,
  encryptCredential,
  generateOpaqueToken,
} from '../src/security/crypto.js'

describe('security crypto', () => {
  it('uses an Argon2id PHC hash and verifies without storing plaintext', async () => {
    const hasher = new Argon2PasswordHasher()
    const password = 'a sufficiently long passphrase'
    const encoded = await hasher.hash(password)
    expect(encoded).toMatch(/^\$argon2id\$/)
    expect(encoded).not.toContain(password)
    await expect(hasher.verify(encoded, password)).resolves.toBe(true)
    await expect(hasher.verify(encoded, `${password}!`)).resolves.toBe(false)
  })

  it('generates high-entropy digest-only token material', () => {
    const first = generateOpaqueToken('rkc_')
    const second = generateOpaqueToken('rkc_')
    expect(first.raw).not.toBe(second.raw)
    expect(first.digest).toHaveLength(32)
    expect(first.digest.toString('utf8')).not.toContain(first.raw)
  })

  it('authenticates ciphertext, key, AAD, and version context', () => {
    const key = Buffer.alloc(32, 11)
    const aad = credentialAad('credential', 'workspace', 'user', 1, 3)
    const envelope = encryptCredential('rkc_secret', key, 3, aad)
    expect(decryptCredential(envelope, key, aad)).toBe('rkc_secret')

    const tampered = { ...envelope, ciphertext: Buffer.from(envelope.ciphertext) }
    tampered.ciphertext[0] ^= 1
    expect(() => decryptCredential(tampered, key, aad)).toThrow()
    expect(() => decryptCredential(envelope, Buffer.alloc(32, 12), aad)).toThrow()
    expect(() => decryptCredential(envelope, key, credentialAad('credential', 'workspace', 'user', 2, 3))).toThrow()
  })
})
