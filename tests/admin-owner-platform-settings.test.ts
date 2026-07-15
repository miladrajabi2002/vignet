import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { createAdminActionToken, verifyAdminActionToken } from '@/lib/admin/vigento-actions'

describe('owner-only admin security', () => {
  const previousPass = process.env.ADMIN_PASS
  const previousSecret = process.env.ADMIN_SESSION_SECRET
  const previousOwnerPhone = process.env.ADMIN_OWNER_PHONE
  const previousTotp = process.env.ADMIN_TOTP_SECRET

  beforeEach(() => {
    process.env.ADMIN_PASS = 'test-admin-password'
    process.env.ADMIN_SESSION_SECRET = 'test-admin-session-secret-with-enough-entropy'
    process.env.ADMIN_OWNER_PHONE = '09121112233'
    delete process.env.ADMIN_TOTP_SECRET
    vi.resetModules()
  })

  afterEach(() => {
    process.env.ADMIN_PASS = previousPass
    process.env.ADMIN_SESSION_SECRET = previousSecret
    if (previousOwnerPhone === undefined) delete process.env.ADMIN_OWNER_PHONE
    else process.env.ADMIN_OWNER_PHONE = previousOwnerPhone
    if (previousTotp === undefined) delete process.env.ADMIN_TOTP_SECRET
    else process.env.ADMIN_TOTP_SECRET = previousTotp
  })

  it('accepts only the environment-configured owner phone', async () => {
    const { verifyAdminCredentials } = await import('@/lib/admin/auth')
    expect(verifyAdminCredentials('09121112233', 'test-admin-password')).toBe(true)
    expect(verifyAdminCredentials('09120000000', 'test-admin-password')).toBe(false)
  })

  it('keeps platform authority separate from workspace ownership', async () => {
    const { isPlatformOwnerPhone } = await import('@/lib/admin/owner')
    expect(isPlatformOwnerPhone('+989121112233')).toBe(true)
    expect(isPlatformOwnerPhone('+989120000000')).toBe(false)
    const ownerSource = readFileSync(path.join(process.cwd(), 'lib/admin/owner.ts'), 'utf8')
    expect(ownerSource).not.toContain('09128352271')
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

  it('keeps natural-language CRUD allow-listed and never grants platform admin', () => {
    const token = createAdminActionToken({
      kind: 'CREATE_WORKSPACE_MEMBER',
      workspaceId: 'workspace-1',
      workspaceName: 'نمونه',
      phone: '+989121234567',
      name: 'عضو آزمایشی',
      role: 'MEMBER',
      reason: 'تست ابزار عضو',
    })
    const payload = verifyAdminActionToken(token)
    expect(payload).toMatchObject({ kind: 'CREATE_WORKSPACE_MEMBER', role: 'MEMBER' })
    expect(payload).not.toHaveProperty('platformRole')

    const actionSource = readFileSync(path.join(process.cwd(), 'lib/admin/vigento-actions.ts'), 'utf8')
    const routeSource = readFileSync(path.join(process.cwd(), 'app/api/admin/vigento/route.ts'), 'utf8')
    expect(actionSource).toContain("platformRole: 'USER'")
    expect(actionSource).toContain("throw new Error('PROTECTED_USER')")
    expect(routeSource).not.toContain('propose_raw_sql')
    expect(routeSource).not.toContain('execute_sql')
  })

  it('guards infrastructure health with the standalone admin session', () => {
    const healthSource = readFileSync(path.join(process.cwd(), 'app/api/admin/health/route.ts'), 'utf8')
    expect(healthSource).toContain('isAdminAuthed')
    expect(healthSource).toContain("{ error: 'UNAUTHORIZED' }")
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
