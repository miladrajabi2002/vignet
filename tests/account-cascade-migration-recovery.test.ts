import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20260808120000_account_cascade_retention_admin_mailbox/migration.sql',
)

describe('account cascade migration recovery', () => {
  it('repairs a baselined database that is missing KnowledgeChunk', () => {
    const sql = readFileSync(migrationPath, 'utf8')
    const repair = sql.indexOf('CREATE TABLE IF NOT EXISTS "KnowledgeChunk"')
    const cascade = sql.indexOf(
      'ALTER TABLE "KnowledgeChunk" DROP CONSTRAINT IF EXISTS "KnowledgeChunk_agentId_fkey"',
    )

    expect(repair).toBeGreaterThan(-1)
    expect(cascade).toBeGreaterThan(repair)
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "KnowledgeChunk_embedding_idx"')
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "KnowledgeChunk_content_fts_idx"')
  })
})
