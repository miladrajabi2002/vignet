import { normalizePhone } from '@/lib/phone'

type Env = Record<string, string | undefined>

export interface ProductionEnvReport {
  errors: string[]
  warnings: string[]
}

const REQUIRED = [
  'DATABASE_URL',
  'DIRECT_URL',
  'AUTH_SECRET',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_WIDGET_URL',
  'ADMIN_OWNER_PHONE',
  'ADMIN_PASS',
  'ADMIN_SESSION_SECRET',
  'ADMIN_TOTP_SECRET',
  'PUBLIC_CONVERSATION_SECRET',
  'ENCRYPTION_KEY',
  'REDIS_URL',
  'OPENROUTER_API_KEY',
  'S3_ENDPOINT',
  'S3_ACCESS_KEY',
  'S3_SECRET_KEY',
  'ZARINPAY_ACCESS_TOKEN',
  'ZARINPAY_STORE_ID',
] as const

const SECRET_MIN_LENGTHS: Record<string, number> = {
  AUTH_SECRET: 32,
  NEXTAUTH_SECRET: 32,
  ADMIN_PASS: 16,
  ADMIN_SESSION_SECRET: 32,
  PUBLIC_CONVERSATION_SECRET: 32,
  S3_SECRET_KEY: 16,
}

const PLACEHOLDER = /(change[-_ ]?me|replace[-_ ]?me|example|your[-_ ]|todo|placeholder)/i

function value(env: Env, key: string): string {
  return env[key]?.trim() ?? ''
}

function requireGroup(
  env: Env,
  errors: string[],
  label: string,
  alternatives: readonly (readonly string[])[],
) {
  if (alternatives.some((keys) => keys.every((key) => value(env, key)))) return
  errors.push(`${label}: configure ${alternatives.map((keys) => keys.join(' + ')).join(' OR ')}`)
}

function validateHttpsUrl(env: Env, errors: string[], key: string) {
  const raw = value(env, key)
  if (!raw) return
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') errors.push(`${key}: production URL must use https`)
    if (['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)) {
      errors.push(`${key}: production URL cannot point to a local host`)
    }
  } catch {
    errors.push(`${key}: invalid URL`)
  }
}

function warnIncompletePair(
  env: Env,
  warnings: string[],
  label: string,
  keys: readonly string[],
) {
  const configured = keys.filter((key) => value(env, key))
  if (configured.length > 0 && configured.length < keys.length) {
    warnings.push(`${label}: partial configuration; missing ${keys.filter((key) => !value(env, key)).join(', ')}`)
  }
}

/**
 * Validate launch-critical production configuration without ever returning
 * environment values. Optional integrations remain warnings so they do not
 * block deployments that intentionally do not offer those channels.
 */
export function validateProductionEnv(env: Env): ProductionEnvReport {
  const errors: string[] = []
  const warnings: string[] = []

  for (const key of REQUIRED) {
    const raw = value(env, key)
    if (!raw) errors.push(`${key}: missing`)
    else if (PLACEHOLDER.test(raw)) errors.push(`${key}: placeholder value is not allowed`)
  }

  for (const [key, min] of Object.entries(SECRET_MIN_LENGTHS)) {
    const raw = value(env, key)
    if (raw && raw.length < min) errors.push(`${key}: must be at least ${min} characters`)
  }

  const encryptionKey = value(env, 'ENCRYPTION_KEY')
  if (encryptionKey && !/^[a-f0-9]{64}$/i.test(encryptionKey)) {
    errors.push('ENCRYPTION_KEY: must be exactly 64 hexadecimal characters')
  }

  const totpSecret = value(env, 'ADMIN_TOTP_SECRET')
  if (totpSecret && !/^[A-Z2-7]{16,}$/i.test(totpSecret)) {
    errors.push('ADMIN_TOTP_SECRET: must be a Base32 secret of at least 16 characters')
  }

  const storeId = value(env, 'ZARINPAY_STORE_ID')
  if (storeId && !/^\d+$/.test(storeId)) errors.push('ZARINPAY_STORE_ID: must be an integer')

  for (const key of ['ADMIN_OWNER_PHONE', 'ADMIN_COMMERCIAL_SMS_PHONE']) {
    const phone = value(env, key)
    if (phone && !normalizePhone(phone)) errors.push(`${key}: invalid Iranian mobile number`)
  }

  const databaseUrl = value(env, 'DATABASE_URL')
  const directUrl = value(env, 'DIRECT_URL')
  if (databaseUrl && !/^postgres(?:ql)?:\/\//i.test(databaseUrl)) errors.push('DATABASE_URL: must be a PostgreSQL URL')
  if (directUrl && !/^postgres(?:ql)?:\/\//i.test(directUrl)) errors.push('DIRECT_URL: must be a PostgreSQL URL')

  const redisUrl = value(env, 'REDIS_URL')
  if (redisUrl && !/^rediss?:\/\//i.test(redisUrl)) errors.push('REDIS_URL: must use redis:// or rediss://')

  for (const key of ['NEXTAUTH_URL', 'NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_WIDGET_URL']) {
    validateHttpsUrl(env, errors, key)
  }

  if (value(env, 'TRUST_PROXY_HEADERS') !== '1') {
    errors.push('TRUST_PROXY_HEADERS: must be 1 behind the checked-in trusted nginx proxy configuration')
  }

  if (value(env, 'NODE_TLS_REJECT_UNAUTHORIZED') === '0') {
    errors.push('NODE_TLS_REJECT_UNAUTHORIZED: must never be 0 in production')
  }

  requireGroup(env, errors, 'OTP delivery', [
    ['IPPANEL_PROXY_URL', 'IPPANEL_PROXY_SECRET', 'IPPANEL_PATTERN_CODE', 'IPPANEL_FROM_NUMBER'],
    ['IPPANEL_API_KEY', 'IPPANEL_PATTERN_CODE', 'IPPANEL_FROM_NUMBER'],
  ])

  warnIncompletePair(env, warnings, 'NOWPayments', ['NOWPAYMENTS_API_KEY', 'NOWPAYMENTS_IPN_SECRET'])
  warnIncompletePair(env, warnings, 'Meta channels', ['META_APP_ID', 'META_APP_SECRET', 'META_APP_VERIFY_TOKEN'])
  warnIncompletePair(env, warnings, 'WhatsApp bridge', ['WHATSAPP_BRIDGE_URL', 'WHATSAPP_BRIDGE_SECRET'])
  warnIncompletePair(env, warnings, 'Resend alerts', ['RESEND_API_KEY', 'ALERT_EMAIL'])
  warnIncompletePair(env, warnings, 'Off-site backups', [
    'BACKUP_S3_ENDPOINT',
    'BACKUP_S3_ACCESS_KEY',
    'BACKUP_S3_SECRET_KEY',
  ])

  if (!value(env, 'BACKUP_S3_ENDPOINT')) {
    warnings.push('BACKUP_S3_ENDPOINT: backups are not copied to an independent off-site store')
  }

  if (!value(env, 'FINANCE_USD_TO_IRR')) {
    warnings.push('FINANCE_USD_TO_IRR: admin profit reporting cannot show a reliable IRR total')
  }

  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] }
}
