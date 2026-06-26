import crypto from 'crypto'

/**
 * AES-256-GCM encryption for secrets at rest (e.g. OpenRouter API keys).
 *
 * ENCRYPTION_KEY must be 64 hex characters (32 bytes).
 * Generate with: openssl rand -hex 32
 *
 * Stored format: ivHex:authTagHex:cipherTextHex
 */

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96-bit IV is recommended for GCM

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) throw new Error('ENCRYPTION_KEY is not set')
  const key = Buffer.from(raw, 'hex')
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
  }
  return key
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(payload: string): string {
  const key = getKey()
  const [ivHex, authTagHex, dataHex] = payload.split(':')
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error('Invalid encrypted payload format')
  }
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivHex, 'hex'),
  )
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}

/**
 * Produce a non-reversible hint for display, e.g. "sk-or-…a1b2".
 * Never store or show the full key.
 */
export function keyHint(plaintext: string): string {
  if (plaintext.length <= 8) return '••••'
  const prefix = plaintext.slice(0, 6)
  const suffix = plaintext.slice(-4)
  return `${prefix}…${suffix}`
}
