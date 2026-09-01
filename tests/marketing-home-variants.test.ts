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
			'<CapabilitiesSection locale={locale} />',
			'<ChannelsSection locale={locale} />',
			'<InstagramAutomationSection locale={locale} />',
			'<HomeOnboarding locale={locale} />',
		]

		for (const section of sections) expect(homepage).toContain(section)
		for (let index = 1; index < sections.length; index += 1) {
			expect(homepage.indexOf(sections[index - 1])).toBeLessThan(homepage.indexOf(sections[index]))
		}
		expect(homepage).not.toContain('<FeaturesSection />')
		expect(homepage).not.toContain('<SalesBookingChapter locale={locale} />')
	})

	it('keeps homepage navigation anchors available', () => {
		expect(read('components/marketing/capabilities-section.tsx')).toContain('id="solutions"')
		expect(read('components/marketing/hero.tsx')).toContain('id="product"')
		expect(read('components/marketing/home-onboarding.tsx')).toContain('id="vigento"')
		expect(existsSync(join(root, 'components/marketing/live-chat-demo.tsx'))).toBe(false)
		expect(read('components/marketing/pricing-section.tsx')).toContain('id="pricing"')
	})

	it('does not keep footer links for the retired concept routes', () => {
		const footer = read('components/marketing/footer.tsx')
		expect(footer).not.toContain('variantBase')
		expect(footer).not.toContain('usePathname')
		expect(footer).toContain("['/#product', '/#solutions', '/#vigento', '/pricing']")
	})
})
