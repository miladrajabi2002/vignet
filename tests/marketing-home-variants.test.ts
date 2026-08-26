import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('marketing homepage composition', () => {
	it('retires the five temporary concept routes and components', () => {
		for (let variant = 1; variant <= 5; variant += 1) {
			expect(existsSync(join(root, `app/(marketing)/(home-variants)/${variant}/page.tsx`))).toBe(false)
			expect(existsSync(join(root, `components/marketing/home-variants/v${variant}/page.tsx`))).toBe(false)
		}
	})

	it('integrates the selected concept sections into the homepage in order', () => {
		const homepage = read('app/(marketing)/page.tsx')
		const sections = [
			'<CapabilitiesBento locale={locale} />',
			'<LiveChatDemo locale={locale} />',
			'<InstagramAutomationSection locale={locale} />',
			'<SalesBookingChapter locale={locale} />',
			'<OnboardingTimeline locale={locale} id="onboarding" />',
		]

		for (const section of sections) expect(homepage).toContain(section)
		for (let index = 1; index < sections.length; index += 1) {
			expect(homepage.indexOf(sections[index - 1])).toBeLessThan(homepage.indexOf(sections[index]))
		}
		expect(homepage).not.toContain('<FeaturesSection />')
	})

	it('keeps homepage navigation anchors available', () => {
		const sections = read('components/marketing/home-sections.tsx')
		expect(sections).toContain('id="solutions"')
		expect(sections).toContain('id="demo"')
		expect(sections).toContain('id="product"')
		expect(read('components/marketing/vigento-section.tsx')).toContain('id="vigento"')
		expect(read('components/marketing/pricing-section.tsx')).toContain('id="pricing"')
	})

	it('does not keep footer links for the retired concept routes', () => {
		const footer = read('components/marketing/footer.tsx')
		expect(footer).not.toContain('variantBase')
		expect(footer).not.toContain('usePathname')
		expect(footer).toContain("['/#product', '/#solutions', '/#vigento', '/pricing']")
	})
})
