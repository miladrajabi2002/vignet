import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { verifyAdminCredentials } from '@/lib/admin/auth'
import { createAdminActionToken, verifyAdminActionToken } from '@/lib/admin/vigento-actions'
import { isPlatformOwnerPhone } from '@/lib/admin/owner'

describe('owner-only admin security', () => {
  const previousPass = process.env.ADMIN_PASS
  const previousSecret = process.env.ADMIN_SESSION_SECRET

  beforeEach(() => {
    process.env.ADMIN_PASS = 'test-admin-password'
    process.env.ADMIN_SESSION_SECRET = 'test-admin-session-secret-with-enough-entropy'
  })

  afterEach(() => {
    process.env.ADMIN_PASS = previousPass
    process.env.ADMIN_SESSION_SECRET = previousSecret
  })

  it('accepts only Milad owner phone even when a valid password is supplied', () => {
    expect(verifyAdminCredentials('09128352271', 'test-admin-password')).toBe(true)
    expect(verifyAdminCredentials('09120000000', 'test-admin-password')).toBe(false)
  })

  it('keeps platform authority separate from workspace ownership', () => {
    expect(isPlatformOwnerPhone('+989128352271')).toBe(true)
    expect(isPlatformOwnerPhone('+989120000000')).toBe(false)
    const migration = readFileSync(path.join(process.cwd(), 'prisma/migrations/20260713233000_separate_platform_admin_role/migration.sql'), 'utf8')
    expect(migration).toContain('"platformRole"')
    expect(migration).toContain("WHERE \"phone\" = '+989128352271'")
  })

  it('signs confirmation payloads and rejects tampering', () => {
    const token = createAdminActionToken({
      kind: 'ADJUST_CREDIT',
      workspaceId: 'workspace-1',
      workspaceName: 'نمونه',
      amountIRR: 2_000_000,
      reason: 'تست رسید ادمین',
    })
    expect(verifyAdminActionToken(token)).toMatchObject({
      kind: 'ADJUST_CREDIT',
      workspaceId: 'workspace-1',
      amountIRR: 2_000_000,
    })
    expect(() => verifyAdminActionToken(`${token.slice(0, -1)}x`)).toThrow('INVALID_ACTION_TOKEN')
  })
})

describe('platform settings migration coverage', () => {
  it('ships every runtime setting and the admin audit table in a deployable migration', () => {
    const schema = readFileSync(path.join(process.cwd(), 'prisma/schema.prisma'), 'utf8')
    const migration = readFileSync(
      path.join(process.cwd(), 'prisma/migrations/20260713223000_platform_commercial_settings_admin_audit/migration.sql'),
      'utf8',
    )
    for (const field of ['sttModel', 'ttsModel', 'providerSort', 'zeroDataRetention', 'replyPricesIRR', 'trialCreditIRR', 'planConfig', 'financeUsdToIRR']) {
      expect(schema).toContain(field)
      expect(migration).toContain(`"${field}"`)
    }
    expect(schema).toContain('model AdminAuditLog')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "AdminAuditLog"')
  })
})
