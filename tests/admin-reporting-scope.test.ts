import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import {
  ADMIN_VISIBLE_RELATED_WHERE,
  ADMIN_VISIBLE_USER_WHERE,
  ADMIN_VISIBLE_WORKSPACE_WHERE,
  adminVisibleWorkspaceSql,
} from '@/lib/admin/reporting-scope'

describe('admin reporting scope', () => {
  it('excludes every workspace which contains a platform admin', () => {
    expect(ADMIN_VISIBLE_WORKSPACE_WHERE).toEqual({
      users: { none: { platformRole: 'ADMIN' } },
    })
    expect(ADMIN_VISIBLE_USER_WHERE).toEqual({
      workspace: ADMIN_VISIBLE_WORKSPACE_WHERE,
    })
    expect(ADMIN_VISIBLE_RELATED_WHERE).toEqual({
      workspace: ADMIN_VISIBLE_WORKSPACE_WHERE,
    })
  })

  it('provides the same exclusion for raw aggregate queries', () => {
    const clause = adminVisibleWorkspaceSql(Prisma.sql`usage."workspaceId"`)
    const sql = clause.strings.join('?')
    expect(sql).toContain('NOT EXISTS')
    expect(sql).toContain('admin_scope_user."workspaceId"')
    expect(sql).toContain('admin_scope_user."platformRole" = \'ADMIN\'')
  })

  it('keeps every customer-facing admin data surface on the shared scope', async () => {
    const files = [
      'app/admin/(dash)/page.tsx',
      'app/admin/(dash)/users/page.tsx',
      'app/admin/(dash)/agents/page.tsx',
      'app/admin/(dash)/conversations/page.tsx',
      'app/admin/(dash)/payments/page.tsx',
      'app/admin/(dash)/usage/page.tsx',
      'app/api/admin/vigento/route.ts',
      'app/api/admin/notifications/route.ts',
      'lib/admin/revenue.ts',
      'lib/admin/charts.ts',
      'lib/admin/ai-usage.ts',
      'lib/admin/database-explorer.ts',
    ]

    for (const file of files) {
      const source = await readFile(path.join(process.cwd(), file), 'utf8')
      expect(source, file).toMatch(/ADMIN_VISIBLE_|adminVisibleWorkspace|admin_scope_user/)
    }
  })

  it('uses scoped usage logs instead of provider-wide daily and monthly totals', async () => {
    const page = await readFile(path.join(process.cwd(), 'app/admin/(dash)/ai/page.tsx'), 'utf8')
    const health = await readFile(path.join(process.cwd(), 'app/api/admin/health/route.ts'), 'utf8')

    expect(page).toContain('getCurrentDayAiSpendUSD()')
    expect(page).toContain('getCurrentMonthAiSpendUSD()')
    expect(page).not.toContain('formatProviderUSD(account.usageDailyUSD)')
    expect(page).not.toContain('formatProviderUSD(account.usageMonthlyUSD)')
    expect(health).toContain('getCurrentMonthAiSpendUSD()')
    expect(health).not.toContain('usageMonthlyUSD: usage.usageMonthlyUSD')
  })

  it('hides the obsolete workspace role from admin-facing user data', async () => {
    const explorer = await readFile(path.join(process.cwd(), 'lib/admin/database-explorer.ts'), 'utf8')
    const userDetail = await readFile(path.join(process.cwd(), 'app/admin/(dash)/users/[userId]/page.tsx'), 'utf8')

    expect(explorer).toContain("key !== 'role'")
    expect(explorer).not.toContain("key !== 'platformRole'")
    expect(userDetail).not.toContain('ROLE_LABEL')
    expect(userDetail).not.toContain('user.role')
    expect(userDetail).toContain('user.platformRole')
  })
})
