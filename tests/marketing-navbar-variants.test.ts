import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const navbar = readFileSync(
	join(process.cwd(), 'components', 'marketing', 'navbar.tsx'),
	'utf8',
)
const mobileNav = readFileSync(
	join(process.cwd(), 'components', 'marketing', 'mobile-bottom-nav.tsx'),
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
		expect(navbar).toContain(': isLandingPath && activeSection === link.id')
	})

	it('keeps variant pricing context while docs and onboarding use stable routes', () => {
		expect(navbar).toContain("homeHref={homeVariantPath ?? '/'}")
		expect(mobileNav).toContain("href: '/docs'")
		expect(mobileNav).toContain('href="/login?next=/onboarding"')
		expect(mobileNav).toContain('href: `${homeHref}#pricing`')
	})
})
