import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('marketing homepage UX contracts', () => {
	it('keeps every homepage navigation anchor backed by a real section', () => {
		const navbar = read('components/marketing/navbar.tsx')
		const sections = [
			'components/marketing/hero.tsx',
			'components/marketing/capabilities-section.tsx',
			'components/marketing/home-onboarding.tsx',
			'components/marketing/pricing-section.tsx',
		].map(read).join('\n')
		const anchorIds = [...navbar.matchAll(/href: '\/#([^']+)'/g)].map((match) => match[1])

		expect(anchorIds).toContain('solutions')
		expect(anchorIds).not.toContain('businesses')
		for (const id of anchorIds) expect(sections).toContain(`id="${id}"`)
		expect(read('app/(marketing)/solutions/[slug]/page.tsx')).not.toContain('#businesses')
	})

	it('uses a persistent five-destination mobile bar with a session-aware account action', () => {
		const mobileNav = read('components/marketing/mobile-bottom-nav.tsx')
		const navbar = read('components/marketing/navbar.tsx')

		expect(mobileNav).toContain('grid-cols-5')
		expect(mobileNav).toContain('env(safe-area-inset-bottom)')
		expect(mobileNav).toContain("href={authenticated ? '/overview' : '/login'}")
		expect(mobileNav).toContain("href: '/docs'")
		expect(mobileNav).toContain('copy.startFree')
		expect(mobileNav).toContain('bg-emerald-500')
		expect(navbar).toContain('<MarketingMobileBottomNav')
		expect(navbar).not.toContain('MarketingMobileMenu')
		expect(existsSync(join(root, 'components/marketing/mobile-menu.tsx'))).toBe(false)
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

	it('routes the homepage secondary call to action to the capability overview', () => {
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
		expect(hero).toContain('href="#solutions"')
		expect(hero).not.toContain('href="#demo"')
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

	it('keeps the compact channel logos in the hero and the full unified-inbox story after capabilities', () => {
		const page = read('app/(marketing)/page.tsx')
		const hero = read('components/marketing/hero.tsx')
		const channels = read('components/marketing/channels-section.tsx')

		expect(page).toContain("import('@/components/marketing/channels-section')")
		expect(page).toContain('<ChannelsSection locale={locale} />')
		expect(page.indexOf('<CapabilitiesSection locale={locale} />')).toBeLessThan(
			page.indexOf('<ChannelsSection locale={locale} />'),
		)
		expect(hero).toContain('ConnectedChannelLogos')
		expect(hero).toContain('/brands/bale-logo.svg')
		expect(hero).toContain('/brands/rubika-logo.svg')
		expect(hero).toContain("fa: 'اینستاگرام'")
		expect(hero).toContain("fa: 'تلگرام'")
		expect(hero).not.toContain('پیام جدید از')
		expect(hero).not.toContain('marketing-node-ring')
		expect(channels).toContain("title: 'صندوق پیام یکپارچه'")
		expect(channels).toContain('id="unified-system"')
		expect(channels).toContain('loading="lazy"')
		expect(channels).toContain('marketing-section-channels')
	})

	it('marks the middle pricing plan as the recommended default', () => {
		const pricing = read('components/marketing/pricing-section.tsx')

		expect(pricing).toContain("recommended: plan === 'PRO'")
		expect(pricing).toContain('open={view.recommended}')
		expect(pricing).toContain("locale === 'fa' ? 'پیشنهاد ما' : 'Recommended'")
	})

	it('plays DM, story reply and comment-to-DM as one staged Instagram simulation', () => {
		const mocks = read('components/marketing/home-variants/shared/mocks.tsx')

		expect(mocks).toContain("type InstagramDemoMode = 'direct' | 'story' | 'comment'")
		expect(mocks).toContain("fa ? 'دایرکت هوشمند' : 'Smart DM'")
		expect(mocks).toContain("fa ? 'ریپلای استوری' : 'Story reply'")
		expect(mocks).toContain("fa ? 'کامنت به دایرکت' : 'Comment to DM'")
		expect(mocks).toContain('showCommentFeed')
		expect(mocks).toContain('showStoryViewer')
		expect(mocks).toContain('InstagramDarkConversationScreen')
		expect(mocks).toContain('InstagramStoryViewer')
		expect(mocks).toContain('InstagramStoryReplyCard')
		expect(mocks).toContain('InstagramSeen')
		expect(mocks).toContain('InstagramIncomingReply')
		expect(mocks).toContain('InstagramMessageComposer')
		expect(mocks).toContain('useInstagramTypedText')
		expect(mocks).toContain("fa ? 'مشتری در حال نوشتن پیام است'")
		expect(mocks).toContain('InstagramProductCatalog')
		expect(mocks).toContain('INSTAGRAM_SCENARIO_DELAYS')
		expect(mocks).toContain('direct: [650, 1600, 650')
		expect(mocks).toContain('story: [2000, 1600, 700')
		expect(mocks).toContain('comment: [1600, 650, 900')
		expect(mocks).toContain("mode === 'comment' && step < 4")
		expect(mocks).toContain("id: 'story-follow-up'")
		expect(mocks).toContain("id: 'comment-follow-up'")
		expect(mocks).toContain("fa ? 'مشتری در حال نوشتن کامنت است'")
		expect(mocks).toContain("fa ? 'مشتری در حال نوشتن ریپلای استوری است'")
		expect(mocks).toContain('key="send"')
		expect(mocks).toContain('key="camera"')
		expect(mocks).toContain('absolute right-1.5 top-1/2')
		expect(mocks).not.toContain('absolute left-1.5 top-1/2')
		expect(mocks).toContain('if (!active || reduce) return')
		expect(mocks).toContain('<AnimatePresence mode="wait" initial={false}>')
		expect(mocks).toContain("dir=\"ltr\"")
		expect(mocks).toContain("className=\"ml-auto flex w-[82%] shrink-0 flex-col items-end\"")
		expect(mocks).toContain("fa ? 'ویجنت این گفتگو را هوشمند پاسخ می‌دهد'")
		expect(mocks).toContain("fa ? 'دایرکت با موفقیت ارسال شد'")
		expect(mocks).toContain('useReducedMotion()')
		expect(mocks).toContain('md:hidden')
		expect(mocks).toContain('InstagramPhoneStatusBar')
		expect(mocks).toContain('aspect-[393/852]')
		expect(mocks).toContain('rounded-[50px]')
		expect(mocks).toContain('rounded-[43px]')
		expect(mocks).toContain('min-h-11')
		expect(mocks).toContain('activeScenario + 1')
		expect(mocks).toContain('در حال نمایش:')
		expect(mocks).not.toContain('از ۹')
		expect(mocks).not.toContain('شبیه‌ساز زندهٔ اینستاگرام')
	})

	it('defers the Instagram simulation until its reserved viewport area is reached', () => {
		const lazyDemo = read('components/marketing/instagram-demo-lazy.tsx')
		const demo = read('components/marketing/instagram-demo.tsx')

		expect(lazyDemo).toContain("import dynamic from 'next/dynamic'")
		expect(lazyDemo).toContain('ssr: false')
		expect(lazyDemo).toContain('new IntersectionObserver')
		expect(lazyDemo).toContain("rootMargin: '600px 0px'")
		expect(lazyDemo).toContain('min-h-[43rem] md:min-h-[45rem]')
		expect(demo).toContain('<InstagramMock locale={locale} inverse active />')
		expect(demo).toContain('LazyMotion')
	})

	it('keeps the initial homepage motion path free of Framer Motion', () => {
		for (const file of [
			'components/marketing/hero.tsx',
			'components/marketing/neural-operation-graph.tsx',
			'components/marketing/channels-section.tsx',
			'components/marketing/social-proof.tsx',
			'components/marketing/faq-section.tsx',
		]) {
			expect(read(file), file).not.toContain('framer-motion')
		}
	})

	it('uses one adaptive onboarding flow instead of duplicated or viewport-locking markup', () => {
		const onboarding = read('components/marketing/home-onboarding.tsx')

		expect(onboarding).toContain('lg:hidden')
		expect(onboarding).toContain('lg:grid-cols-[0.72fr_1.28fr]')
		expect(onboarding.match(/<StepCard/g)).toHaveLength(1)
		expect(onboarding).not.toContain('compact')
		expect(onboarding).toContain('data-scroll-reveal="up"')
		expect(onboarding).not.toContain('360svh')
		expect(onboarding).not.toContain('sticky top-0 h-[100svh]')
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
