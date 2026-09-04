import { describe, expect, it } from 'vitest'
import robots from '@/app/robots'

describe('robots product media access', () => {
	it('allows public product images while keeping the rest of /api blocked', () => {
		const metadata = robots()
		const rules = Array.isArray(metadata.rules) ? metadata.rules : [metadata.rules]
		const wildcardRule = rules.find(
			(rule) => !Array.isArray(rule.userAgent) && rule.userAgent === '*',
		)

		expect(wildcardRule).toBeDefined()
		expect(wildcardRule?.allow).toContain('/api/uploads/products/')
		expect(wildcardRule?.disallow).toContain('/api')
	})
})
