import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

const HOME_SECTIONS = [
	'components/marketing/site/home/hero.tsx',
	'components/marketing/site/home/quick-facts.tsx',
	'components/marketing/site/home/capabilities.tsx',
	'components/marketing/site/home/instagram.tsx',
	'components/marketing/site/home/onboarding.tsx',
	'components/marketing/site/home/solutions-strip.tsx',
	'components/marketing/site/home/pricing.tsx',
	'components/marketing/popular-posts.tsx',
	'components/marketing/site/faq.tsx',
]

describe('marketing homepage UX contracts', () => {
	it('keeps every homepage navigation anchor backed by a real section', () => {
		const sections = HOME_SECTIONS.map(read).join('\n')
		const linkSources = [
			'components/marketing/navbar.tsx',
			'components/marketing/mobile-bottom-nav.tsx',
			'components/marketing/footer.tsx',
			'components/marketing/site/home/hero.tsx',
		].map(read).join('\n')
		const anchorIds = new Set([
			...[...linkSources.matchAll(/\$\{home(?:Href)?\}#([a-z-]+)/g)].map((match) => match[1]),
			...[...linkSources.matchAll(/['"](?:\/en)?\/#([a-z-]+)['"]/g)].map((match) => match[1]),
			...[...linkSources.matchAll(/href="#([a-z-]+)"/g)].map((match) => match[1]),
		])

		expect([...anchorIds].sort()).toEqual(['capabilities', 'instagram', 'pricing', 'what'])
		for (const id of anchorIds) expect(sections).toContain(`id="${id}"`)
		expect(read('app/(marketing)/solutions/[slug]/page.tsx')).not.toContain('/#demo')
	})

	it('uses a persistent five-destination mobile bar with a session-aware account action', () => {
		const mobileNav = read('components/marketing/mobile-bottom-nav.tsx')
		const navbar = read('components/marketing/navbar.tsx')

		expect(mobileNav).toContain('grid-cols-5')
		expect(mobileNav).toContain('env(safe-area-inset-bottom)')
		expect(mobileNav).toContain("href={authenticated ? '/overview' : '/login'}")
		expect(mobileNav).toContain('href="/login?next=/onboarding"')
		expect(mobileNav).toContain('copy.startFree')
		expect(mobileNav).toContain('bg-emerald-500')
		expect(mobileNav).toContain("window.matchMedia('(prefers-reduced-motion: reduce)')")
		expect(navbar).toContain('<MarketingMobileBottomNav')
		expect(navbar).not.toContain('MarketingMobileMenu')
		expect(existsSync(join(root, 'components/marketing/mobile-menu.tsx'))).toBe(false)
		expect(navbar).toContain('col-start-3 hidden items-center')
	})

	it('does not render sub-nine-pixel copy inside the hero product mockup', () => {
		const hero = read('components/marketing/site/home/hero.tsx')
		const pixelSizes = [...hero.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)]
			.map((match) => Number(match[1]))
			.filter((size) => size < 9)

		expect(pixelSizes).toEqual([])
	})

	it('keeps the hero on a single primary call to action and away from the old demo', () => {
		const hero = read('components/marketing/site/home/hero.tsx')
		const ui = read('components/marketing/site/ui.tsx')
		const page = read('app/(marketing)/page.tsx')

		expect(ui).toContain("export const SIGNUP_HREF = '/login?next=/onboarding'")
		expect(hero.match(/<Link href=\{SIGNUP_HREF\}/g)).toHaveLength(1)
		// The secondary action scrolls to the "what is Vigent" section instead of a separate demo.
		expect(hero).toContain('href="#what"')
		expect(hero).not.toContain('href="#demo"')
		expect(existsSync(join(root, 'components/marketing/demo-section.tsx'))).toBe(false)
		expect(existsSync(join(root, 'components/marketing/social-proof.tsx'))).toBe(false)
		expect(page).not.toContain('DemoSection')
		expect(page).not.toContain('OperationsSection')
	})

	it('reveals sections only after hydration and never hides content for reduced motion', () => {
		const pauser = read('components/marketing/site/motion-pauser.tsx')
		const styles = read('components/marketing/site/site.css')

		// Content is server-rendered visible; the hidden pre-reveal state is armed by a
		// class on <html> that MotionPauser only adds when entrances are enabled.
		expect(styles).toContain('.vg-rv-ready .vg-rv:not(.vg-in)')
		expect(pauser).toContain("const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches")
		expect(pauser).toContain('const entrances = supportsIO && !reduce')
		expect(pauser).toContain("if (entrances) root.classList.add('vg-rv-ready')")
		// Blocks already on screen are revealed in the same frame, so nothing flashes.
		expect(pauser).toContain('rect.top < window.innerHeight * 0.9 && rect.bottom > 0')
		expect(styles).toContain('.vg-cv { content-visibility: auto;')
	})

	it('registers marketing sections that stream in after the reveal controller mounts', () => {
		const pauser = read('components/marketing/site/motion-pauser.tsx')

		expect(pauser).toContain('new MutationObserver')
		expect(pauser).toContain("document.getElementById('marketing-main')")
		expect(pauser).toContain('mutations.disconnect()')
	})

	it('marks the middle pricing plan as the recommended default', () => {
		const pricing = read('components/marketing/pricing-section.tsx')

		expect(pricing).toContain("recommended: plan === 'PRO'")
		// Mobile plan accordions start collapsed (tap to expand; the exclusive
		// `name` group keeps a single card open) — the recommended plan keeps its
		// highlight but no longer pre-expands on phones.
		expect(pricing).toContain('name="mobile-pricing-plan"')
		expect(pricing).not.toContain('open={view.recommended}')
		expect(pricing).toContain("locale === 'fa' ? 'پیشنهاد ما' : 'Recommended'")
	})

	it('plays DM, story reply and comment-to-DM as one staged Instagram simulation', () => {
		const mocks = read('components/marketing/home-variants/shared/mocks.tsx')

		expect(mocks).toContain("export type InstagramDemoMode = 'direct' | 'story' | 'comment'")
		expect(mocks).toContain("fa ? 'دایرکت هوشمند' : 'Smart DM'")
		expect(mocks).toContain("fa ? 'ریپلای استوری' : 'Story reply'")
		expect(mocks).toContain("fa ? 'کامنت به دایرکت' : 'Comment to DM'")
		expect(mocks).toContain('const INSTAGRAM_SCENARIO_DELAYS: Record<InstagramDemoMode, readonly number[]>')
		expect(mocks).toContain("const showStoryViewer = mode === 'story' && step < 2")
		expect(mocks).toContain("const showCommentFeed = mode === 'comment' && step < 4")
		for (const part of [
			'InstagramStoryViewer',
			'InstagramStoryReplyCard',
			'InstagramSeen',
			'InstagramIncomingReply',
			'InstagramProductCatalog',
			'useInstagramTypedText',
		]) {
			expect(mocks).toContain(part)
		}
		// Timers stop off screen and reduced motion jumps to the final, readable frame.
		expect(mocks).toContain('useReducedMotion()')
		expect(mocks).toContain('if (!active || reduce) return')
		expect(mocks).toContain('INSTAGRAM_SCENARIO_DELAYS[firstMode].length - 1')
		expect(mocks).toContain('return () => window.clearTimeout(timer)')
		expect(mocks).not.toContain('شبیه‌ساز زندهٔ اینستاگرام')
	})

	it('defers the Instagram simulation until its reserved viewport area is reached', () => {
		const section = read('components/marketing/site/home/instagram.tsx')
		const lazyDemo = read('components/marketing/instagram-demo-lazy.tsx')
		const demo = read('components/marketing/instagram-demo.tsx')

		expect(section).toContain('<InstagramDemoLazy locale={locale} />')
		expect(lazyDemo).toContain("import dynamic from 'next/dynamic'")
		expect(lazyDemo).toContain('ssr: false')
		expect(lazyDemo).toContain('new IntersectionObserver')
		expect(lazyDemo).toContain("mobile ? '1400px 0px' : '600px 0px'")
		expect(lazyDemo).toContain('min-h-[30rem] md:min-h-[45rem]')
		expect(lazyDemo).toContain('<InstagramDemo locale={locale} active={inView} />')
		expect(demo).toContain('<InstagramMock locale={locale} inverse active={active} />')
		expect(demo).toContain('<LazyMotion features={loadMotionFeatures} strict>')
	})

	it('keeps the initial homepage motion path free of Framer Motion', () => {
		for (const file of [
			...HOME_SECTIONS,
			'components/marketing/navbar.tsx',
			'components/marketing/mobile-bottom-nav.tsx',
			'components/marketing/footer.tsx',
			'components/marketing/site/motion-pauser.tsx',
			'components/marketing/instagram-demo-lazy.tsx',
		]) {
			expect(read(file), file).not.toContain('framer-motion')
		}
	})

	it('uses one adaptive onboarding flow instead of duplicated or viewport-locking markup', () => {
		const onboarding = read('components/marketing/site/home/onboarding.tsx')
		const player = read('components/marketing/site/home/onboarding-player.tsx')

		expect(onboarding.match(/<OnboardingPlayer\b/g)).toHaveLength(1)
		expect(player).toContain('role="tablist"')
		expect(player).toContain('role="tabpanel"')
		for (const source of [onboarding, player]) {
			expect(source).not.toContain('360svh')
			expect(source).not.toContain('sticky top-0 h-[100svh]')
		}
	})

	it('advertises the active language without inventing duplicate hreflang URLs', () => {
		const page = read('app/(marketing)/page.tsx')

		expect(page).toContain("locale: locale === 'fa' ? 'fa_IR' : 'en_US'")
		expect(page).toContain("alternateLocale: locale === 'fa' ? ['en_US'] : ['fa_IR']")
		expect(page).toContain("'content-language': locale === 'fa' ? 'fa-IR' : 'en-US'")
		expect(page).toContain('title: { absolute: copy.title }')
		expect(page).toContain('/android-chrome-512x512.png')
		expect(page).not.toContain('/icon.png')
		// /en URLs are real (middleware rewrite + x-vigent-locale), so hreflang
		// alternates are now expected — and must point at the /en prefix.
		expect(page).toMatch(/languages:\s*\{[^}]*en:\s*`\$\{SITE_URL\}\/en`/s)
		expect(page).toContain("'x-default': SITE_URL")
	})

	it('publishes a directly callable support number from the shared constant', () => {
		const footer = read('components/marketing/footer.tsx')
		const page = read('app/(marketing)/page.tsx')
		const contact = read('lib/marketing/contact.ts')

		// The number lives in exactly one place; every surface must consume it.
		expect(contact).toContain("export const SUPPORT_PHONE_E164 = '+989128352271'")
		expect(contact).toContain("export const SUPPORT_PHONE_DISPLAY = '09128352271'")
		expect(footer).toContain('href={`tel:${SUPPORT_PHONE_E164}`}')
		expect(footer).toContain('{faNum(locale, SUPPORT_PHONE_DISPLAY)}')
		expect(footer).toContain('aria-label={`${c.call} ${faNum(locale, SUPPORT_PHONE_DISPLAY)}`}')
		expect(page).toContain('telephone: SUPPORT_PHONE_E164')
		expect(page).toContain("contactType: 'customer support'")
	})
})
