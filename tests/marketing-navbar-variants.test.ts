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

describe('marketing navbar landing routes', () => {
	it('treats / and /en as the landing page and keeps section anchors on it', () => {
		expect(navbar).toContain("const english = pathname === '/en' || pathname.startsWith('/en/')")
		expect(navbar).toContain("const isLandingPath = basePath === '/'")
		expect(navbar).toContain("const home = english ? '/en' : '/'")
		expect(navbar).toContain("{ id: 'capabilities', href: `${home}#capabilities`")
		expect(navbar).toContain("{ id: 'pricing', href: `${home}#pricing`")
		expect(navbar).toContain(': isLandingPath && activeSection === link.id')
	})

	it('passes the landing context to the mobile bar while onboarding uses a stable route', () => {
		expect(navbar).toContain('homeHref={home}')
		expect(navbar).toContain('isLandingPath={isLandingPath}')
		expect(mobileNav).toContain('href="/login?next=/onboarding"')
		expect(mobileNav).toContain('href: `${homeHref}#capabilities`')
		expect(mobileNav).toContain('href: `${homeHref}#pricing`')
	})

	it('keeps the desktop destinations in sync with the scroll-spy sections', () => {
		expect(navbar).toContain("const SECTION_IDS = ['capabilities', 'instagram', 'pricing', 'blog'] as const")
		expect(navbar).toContain("{ id: 'solutions', href: '/solutions', label: copy.solutions }")
		expect(navbar).toContain("{ id: 'blog', href: '/blog', label: copy.blog }")
		// Solutions and the blog are real pages, so they mark the current page, not a scroll location.
		expect(navbar).toContain("link.id === 'solutions' || link.id === 'blog' ? 'page' : 'location'")
	})
})
