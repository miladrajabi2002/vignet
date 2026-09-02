import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const navbar = readFileSync(
	join(process.cwd(), 'components', 'marketing', 'navbar.tsx'),
	'utf8',
)
const mobileMenu = readFileSync(
	join(process.cwd(), 'components', 'marketing', 'mobile-menu.tsx'),
	'utf8',
)

describe('marketing navbar landing variants', () => {
	it('keeps exact /1 through /5 routes and their section anchors on the active landing page', () => {
		expect(navbar).toContain("const HOME_VARIANT_PATH = /^\\/[1-5]$/")
		expect(navbar).toContain("const isLandingPath = pathname === '/' || homeVariantPath !== null")
		expect(navbar).toContain("if (link.id === 'home') return { ...link, href: homeVariantPath }")
		expect(navbar).toContain('href: `${homeVariantPath}#${link.id}`')
		expect(navbar).toContain("href={homeVariantPath ?? '/'}")
		expect(navbar).toContain("? isLandingPath && activeSection === ''")
		expect(navbar).toContain(': isLandingPath && activeSection === id')
	})

	it('passes variant-aware links into the mobile menu while onboarding stays stable', () => {
		expect(navbar).toContain('links={mobileLinks}')
		expect(navbar).toContain('href: `${homeVariantPath}#${link.id}`')
		expect(mobileMenu).toContain('href="/login?next=/onboarding"')
	})
})
