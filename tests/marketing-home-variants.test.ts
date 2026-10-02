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
		// The navbar no longer treats /1 … /5 as landing pages.
		expect(read('components/marketing/navbar.tsx')).not.toContain('HOME_VARIANT_PATH')
	})

	it('renders the homepage sections in story order', () => {
		const homepage = read('app/(marketing)/page.tsx')
		const sections = [
			'<Hero locale={locale} />',
			'<QuickFacts locale={locale} />',
			'<Capabilities locale={locale} />',
			'<InstagramSection locale={locale} />',
			'<Onboarding locale={locale} />',
			'<SolutionsStrip locale={locale} />',
			'<Pricing locale={locale} />',
			'<PopularPosts />',
			'<Faq locale={locale} items={faqItems} />',
		]

		for (const section of sections) expect(homepage).toContain(section)
		for (let index = 1; index < sections.length; index += 1) {
			expect(homepage.indexOf(sections[index - 1])).toBeLessThan(homepage.indexOf(sections[index]))
		}
	})

	it('keeps homepage navigation anchors available', () => {
		expect(read('components/marketing/site/home/quick-facts.tsx')).toContain('id="what"')
		expect(read('components/marketing/site/home/capabilities.tsx')).toContain('id="capabilities"')
		expect(read('components/marketing/site/home/instagram.tsx')).toContain('id="instagram"')
		expect(read('components/marketing/site/home/pricing.tsx')).toContain('id="pricing"')
		expect(read('components/marketing/popular-posts.tsx')).toContain('id="blog"')
		expect(existsSync(join(root, 'components/marketing/live-chat-demo.tsx'))).toBe(false)
	})

	it('serves locale-aware footer links without the retired concept routes', () => {
		const footer = read('components/marketing/footer.tsx')
		expect(footer).not.toContain('variantBase')
		expect(footer).not.toContain('usePathname')
		expect(footer).toContain("{ href: '/#capabilities', label: 'قابلیت‌ها' }")
		expect(footer).toContain("{ href: '/#pricing', label: 'قیمت‌ها' }")
		expect(footer).toContain("{ href: '/en#capabilities', label: 'Features' }")
		expect(footer).toContain("{ href: '/en#pricing', label: 'Pricing' }")
	})
})
