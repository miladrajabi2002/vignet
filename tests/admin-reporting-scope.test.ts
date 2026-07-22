import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import {
  ADMIN_VISIBLE_KNOWLEDGE_WHERE,
  ADMIN_VISIBLE_RELATED_WHERE,
  ADMIN_VISIBLE_USER_WHERE,
  ADMIN_VISIBLE_WORKSPACE_WHERE,
  adminVisibleWorkspaceSql,
} from '@/lib/admin/reporting-scope'

describe('admin reporting scope', () => {
  it('excludes every workspace explicitly marked as internal', () => {
    expect(ADMIN_VISIBLE_WORKSPACE_WHERE).toEqual({
      excludeFromAdminReports: false,
    })
    expect(ADMIN_VISIBLE_USER_WHERE).toEqual({
      workspace: ADMIN_VISIBLE_WORKSPACE_WHERE,
    })
    expect(ADMIN_VISIBLE_RELATED_WHERE).toEqual({
      workspace: ADMIN_VISIBLE_WORKSPACE_WHERE,
    })
    expect(ADMIN_VISIBLE_KNOWLEDGE_WHERE).toEqual({
      agent: ADMIN_VISIBLE_RELATED_WHERE,
    })
  })

  it('provides the same exclusion for raw aggregate queries', () => {
    const clause = adminVisibleWorkspaceSql(Prisma.sql`usage."workspaceId"`)
    const sql = clause.strings.join('?')
    expect(sql).toContain('EXISTS')
    expect(sql).toContain('admin_scope_workspace."id"')
    expect(sql).toContain('admin_scope_workspace."excludeFromAdminReports" = false')
  })

  it('scopes knowledge counts through the owning agent relation', async () => {
    const agentsPage = await readFile(path.join(process.cwd(), 'app/admin/(dash)/agents/page.tsx'), 'utf8')

    expect(agentsPage).toMatch(
      /prisma\.knowledgeBase\.count\(\{\s*where: \{\s*\.\.\.ADMIN_VISIBLE_KNOWLEDGE_WHERE/,
    )
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
      expect(source, file).toMatch(/ADMIN_VISIBLE_|adminVisibleWorkspace|admin_scope_workspace/)
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

  it('removes workspace roles from the schema and admin-facing user data', async () => {
    const schema = await readFile(path.join(process.cwd(), 'prisma/schema.prisma'), 'utf8')
    const migration = await readFile(path.join(process.cwd(), 'prisma/migrations/20260722034500_single_owner_workspace_reporting/migration.sql'), 'utf8')
    const auth = await readFile(path.join(process.cwd(), 'auth.ts'), 'utf8')
    const explorer = await readFile(path.join(process.cwd(), 'lib/admin/database-explorer.ts'), 'utf8')
    const userDetail = await readFile(path.join(process.cwd(), 'app/admin/(dash)/users/[userId]/page.tsx'), 'utf8')

    expect(schema).not.toContain('enum UserRole')
    expect(schema).toMatch(/\bowner\s+User\?/)
    expect(schema).toContain('@@unique([workspaceId])')
    expect(schema).toContain('excludeFromAdminReports')
    expect(migration).toContain('ALTER TABLE "User" DROP COLUMN "role"')
    expect(migration).toContain('CREATE UNIQUE INDEX "User_workspaceId_key"')
    expect(migration).toContain('owner."platformRole" = \'ADMIN\'')
    expect(auth).toContain("excludeFromAdminReports: platformRole === 'ADMIN'")
    expect(explorer).not.toContain('visibleDatabaseRow')
    expect(userDetail).not.toContain('ROLE_LABEL')
    expect(userDetail).not.toContain('user.role')
    expect(userDetail).toContain('user.platformRole')
  })
})
