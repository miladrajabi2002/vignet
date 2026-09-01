import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(path, 'utf8')

describe('public adaptive UI contracts', () => {
  it('keeps public mobile navigation persistent and reserves its safe area', () => {
    const layout = source('app/(marketing)/layout.tsx')
    const navbar = source('components/marketing/navbar.tsx')
    const mobileNav = source('components/marketing/mobile-bottom-nav.tsx')
    const backToTop = source('components/marketing/back-to-top.tsx')

    expect(layout).toContain('pb-[calc(5.75rem+env(safe-area-inset-bottom))]')
    expect(mobileNav).toContain('[bottom:max(0.75rem,env(safe-area-inset-bottom))]')
    expect(mobileNav).toContain('grid-cols-5')
    expect(navbar).not.toContain('MarketingMobileMenu')
    expect(existsSync('components/marketing/mobile-menu.tsx')).toBe(false)
    expect(backToTop).toContain('lg:bottom-6')
  })

  it('provides mobile legal navigation, documentation search, and code copy', () => {
    const legal = source('components/marketing/legal-page.tsx')
    const legalNav = source('components/marketing/legal-mobile-navigation.tsx')
    const docsNav = source('components/docs/docs-sidebar.tsx')
    const docsContent = source('components/docs/doc-content.tsx')

    expect(legal).toContain('<LegalMobileNavigation')
    expect(legal).toContain('hidden rounded-[1.5rem]')
    expect(legalNav).toContain('<MobileBottomSheet')
    expect(docsNav).toContain('type="search"')
    expect(docsNav).toContain('filteredItems')
    expect(docsContent).toContain('<CopyButton')
  })

  it('adds live blog search and preserves minimum mobile touch targets', () => {
    const blog = source('components/blog/public-blog-index.tsx')
    const card = source('components/blog/public-post-card.tsx')
    const chat = source('app/c/[slug]/chat-client.tsx')
    const auth = source('components/auth/phone-otp-form.tsx')

    expect(blog).toContain('useDeferredValue')
    expect(blog).toContain('type="search"')
    expect(card).toContain('h-11 w-11')
    expect(chat).toContain('className="flex h-11 w-11')
    expect(auth).toContain('min-h-11 items-center')
  })

  it('keeps every mobile status row separated without changing the desktop grid', () => {
    const status = source('app/(marketing)/status/page.tsx')

    expect(status).toContain('index < report.checks.length - 1')
    expect(status).toContain('index >= report.checks.length - 2')
    expect(status).toContain('md:border-b-0')
  })
})
