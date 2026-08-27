import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('marketing homepage UX contracts', () => {
	it('keeps every homepage navigation anchor backed by a real section', () => {
		const navbar = read('components/marketing/navbar.tsx')
		const sections = [
			'components/marketing/channels-section.tsx',
			'components/marketing/features-section.tsx',
			'components/marketing/pricing-section.tsx',
			'components/marketing/vigento-section.tsx',
		].map(read).join('\n')
		const anchorIds = [...navbar.matchAll(/href: '\/#([^']+)'/g)].map((match) => match[1])

		expect(anchorIds).toContain('solutions')
		expect(anchorIds).not.toContain('businesses')
		for (const id of anchorIds) expect(sections).toContain(`id="${id}"`)
		expect(read('app/(marketing)/solutions/[slug]/page.tsx')).not.toContain('#businesses')
	})

	it('uses an accessible full-viewport mobile dialog with session-aware actions', () => {
		const menu = read('components/marketing/mobile-menu.tsx')
		const navbar = read('components/marketing/navbar.tsx')

		expect(menu).toContain('<dialog')
		expect(menu).toContain('dialog.showModal()')
		expect(menu).toContain('onCancel=')
		expect(menu).toContain("document.documentElement.style.overflow = 'hidden'")
		expect(menu).toContain('h-[100dvh]')
		expect(menu).toContain('href="/overview"')
		expect(menu).toContain('href="/login"')
		expect(navbar).toContain("const mobileLinks = links.filter((link) => link.id !== 'home')")
		expect(navbar).toContain('col-start-3 hidden items-center')
	})

	it('does not render sub-nine-pixel copy inside the hero product mockup', () => {
		const mockup = [
			'components/marketing/hero.tsx',
			'components/marketing/neural-operation-graph.tsx',
		].map(read).join('\n')
		const pixelSizes = [...mockup.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)]
			.map((match) => Number(match[1]))
			.filter((size) => size < 9)

		expect(pixelSizes).toEqual([])
	})

	it('removes the demo and routes its former calls to action to Vigento', () => {
		const hero = read('components/marketing/hero.tsx')
		const graph = read('components/marketing/neural-operation-graph.tsx')
		const page = read('app/(marketing)/page.tsx')
		const solutionPage = read('app/(marketing)/solutions/[slug]/page.tsx')

		expect(hero).not.toContain('یک ایجنت، یک پاسخ دقیق')
		expect(hero).not.toContain('پیام دریافت شد')
		expect(hero).not.toContain('دانش پیدا شد')
		expect(hero).not.toContain('پاسخ و اقدام ثبت شد')
		expect(graph).not.toContain('sharedBrain')
		expect(existsSync(join(root, 'components/marketing/demo-section.tsx'))).toBe(false)
		expect(page).not.toContain('DemoSection')
		expect(hero).toContain('href="#vigento"')
		expect(hero).not.toContain('#demo')
		expect(solutionPage).toContain('href="/#vigento"')
		expect(solutionPage).not.toContain('/#demo')
	})

	it('renders final geometry before native hash navigation aligns a homepage target', () => {
		const styles = read('app/globals.css')

		expect(styles).toContain('html:has(.marketing-story-section:target) .marketing-story-section')
		expect(styles).toContain('html.marketing-motion-ready .marketing-story-section:target')
	})

	it('registers marketing sections that stream in after the reveal controller mounts', () => {
		const controller = read('components/marketing/section-reveal.tsx')

		expect(controller).toContain('new MutationObserver')
		expect(controller).toContain('mutation.addedNodes.forEach(observeWithin)')
		expect(controller).toContain("document.getElementById('marketing-main')")
		expect(controller).toContain('mutationObserver.disconnect()')
	})

	it('keeps both desktop and mobile channel maps visibly connected', () => {
		const channels = read('components/marketing/channels-section.tsx')

		expect(channels).toContain('hidden lg:block')
		expect(channels).toContain('grid-cols-[18%_38%_18%]')
		expect(channels).toContain('const channelPairs = [0, 2, 4, 6]')
		expect(channels).toContain('relative grid grid-cols-2 gap-7')
		expect(channels).toContain('connectorPaths.map')
		expect(channels).toContain('useReducedMotion')
	})

	it('advertises the active language without inventing duplicate hreflang URLs', () => {
		const page = read('app/(marketing)/page.tsx')

		expect(page).toContain("locale: locale === 'fa' ? 'fa_IR' : 'en_US'")
		expect(page).toContain("alternateLocale: locale === 'fa' ? ['en_US'] : ['fa_IR']")
		expect(page).toContain("'content-language': locale === 'fa' ? 'fa-IR' : 'en-US'")
		expect(page).toContain('title: { absolute: copy.title }')
		expect(page).toContain('/android-chrome-512x512.png')
		expect(page).not.toContain('/icon.png')
		expect(page).not.toMatch(/alternates:\s*\{[^}]*languages:/s)
	})

	it('publishes a directly callable support number', () => {
		const footer = read('components/marketing/footer.tsx')
		const page = read('app/(marketing)/page.tsx')

		expect(footer).toContain('href="tel:+989128352271"')
		expect(footer).toContain('09128352271')
		expect(footer).toContain('aria-label={copy.supportAriaLabel}')
		expect(page).toContain("telephone: '+989128352271'")
		expect(page).toContain("contactType: 'customer support'")
	})
})
