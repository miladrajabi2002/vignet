import { describe, it, expect, beforeAll } from 'vitest'
import crypto from 'crypto'

// AES-256-GCM needs a 32-byte (64 hex char) key. Set one before importing the
// module under test so getKey() resolves during the round-trip.
beforeAll(() => {
  process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex')
})

describe('crypto encrypt/decrypt', () => {
  it('round-trips a secret', async () => {
    const { encrypt, decrypt } = await import('@/lib/crypto')
    const secret = 'sk-or-v1-abcdef0123456789'
    const enc = encrypt(secret)
    expect(enc).not.toContain(secret) // ciphertext must not leak plaintext
    expect(enc.split(':')).toHaveLength(3) // iv:authTag:cipher
    expect(decrypt(enc)).toBe(secret)
  })

  it('produces a different ciphertext each time (random IV)', async () => {
    const { encrypt } = await import('@/lib/crypto')
    expect(encrypt('same')).not.toBe(encrypt('same'))
  })

  it('rejects a tampered payload', async () => {
    const { encrypt, decrypt } = await import('@/lib/crypto')
    const enc = encrypt('tamper-me')
    const [iv, tag, data] = enc.split(':')
    const flipped = data.slice(0, -1) + (data.endsWith('0') ? '1' : '0')
    expect(() => decrypt(`${iv}:${tag}:${flipped}`)).toThrow()
  })

  it('rejects a malformed payload', async () => {
    const { decrypt } = await import('@/lib/crypto')
    expect(() => decrypt('not-valid')).toThrow()
  })
})

describe('keyHint', () => {
  it('masks the middle of a key', async () => {
    const { keyHint } = await import('@/lib/crypto')
    expect(keyHint('sk-or-v1-abcdef')).toBe('sk-or-…cdef')
  })
  it('fully masks short values', async () => {
    const { keyHint } = await import('@/lib/crypto')
    expect(keyHint('short')).toBe('••••')
  })
})
