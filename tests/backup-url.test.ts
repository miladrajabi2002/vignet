import { execFileSync, spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sanitizer = join(process.cwd(), 'deploy', 'sanitize-postgres-url.mjs')

function sanitize(url: string) {
	return execFileSync(process.execPath, [sanitizer, url], { encoding: 'utf8' }).trim()
}

describe('pg_dump connection URL sanitizer', () => {
	it('removes Prisma-only parameters while preserving libpq TLS options', () => {
		const result = new URL(sanitize(
			'postgresql://app:secret@db:5432/vigent?schema=public&pgbouncer=true&connection_limit=10&sslmode=require',
		))

		expect(result.protocol).toBe('postgresql:')
		expect(result.pathname).toBe('/vigent')
		expect(result.searchParams.has('schema')).toBe(false)
		expect(result.searchParams.has('pgbouncer')).toBe(false)
		expect(result.searchParams.has('connection_limit')).toBe(false)
		expect(result.searchParams.get('sslmode')).toBe('require')
	})

	it('accepts the postgres protocol and encoded credentials', () => {
		expect(sanitize('postgres://user:p%40ss@localhost:5432/app?schema=tenant'))
			.toBe('postgres://user:p%40ss@localhost:5432/app')
	})

	it('rejects a non-PostgreSQL connection without echoing the secret', () => {
		const result = spawnSync(process.execPath, [sanitizer, 'mysql://user:do-not-print@db/app'], {
			encoding: 'utf8',
		})

		expect(result.status).toBe(1)
		expect(result.stderr).toContain('must use postgresql:// or postgres://')
		expect(result.stderr).not.toContain('do-not-print')
	})
})
