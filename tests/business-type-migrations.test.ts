import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('BusinessType database enum', () => {
  it('has migration SQL for every value declared in the Prisma schema', () => {
    const root = process.cwd()
    const schema = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8')
    const enumBody = schema.match(/enum\s+BusinessType\s*\{([\s\S]*?)\}/)?.[1]
    expect(enumBody).toBeTruthy()

    const values = enumBody!
      .split(/\r?\n/)
      .map((line) => line.replace(/\/\/.*$/, '').trim())
      .filter(Boolean)

    const migrationsRoot = join(root, 'prisma', 'migrations')
    const migrationSql = readdirSync(migrationsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => readFileSync(join(migrationsRoot, entry.name, 'migration.sql'), 'utf8'))
      .join('\n')

    for (const value of values) {
      expect(migrationSql, `missing BusinessType migration value: ${value}`)
        .toContain(`'${value}'`)
    }
  })
})
