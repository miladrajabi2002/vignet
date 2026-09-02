import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(path, 'utf8')
}

describe('shared adaptive mobile UI contract', () => {
  it('activates edge-to-edge safe areas and reserves room for persistent mobile navigation', () => {
    const rootLayout = source('app/layout.tsx')
    const dashboardLayout = source('app/(dashboard)/layout.tsx')
    const adminLayout = source('app/admin/(dash)/layout.tsx')
    const dashboardHeader = source('components/dashboard/header.tsx')
    const dashboardNav = source('components/dashboard/mobile-nav.tsx')
    const adminNav = source('app/admin/(dash)/mobile-nav.tsx')
    const bottomSheet = source('components/ui/mobile-bottom-sheet.tsx')

    expect(rootLayout).toContain("viewportFit: 'cover'")
    expect(rootLayout).toContain("width: 'device-width'")
    expect(dashboardLayout).toContain('pb-[calc(7rem+env(safe-area-inset-bottom))]')
    expect(adminLayout).toContain('pb-[calc(7rem+env(safe-area-inset-bottom))]')
    expect(dashboardHeader).toContain('env(safe-area-inset-top)')
    expect(adminLayout).toContain('env(safe-area-inset-top)')
    expect(dashboardNav).toContain('[bottom:max(0.75rem,env(safe-area-inset-bottom))]')
    expect(adminNav).toContain('[bottom:max(0.75rem,env(safe-area-inset-bottom))]')
    expect(bottomSheet).toContain("!footer && '[padding-bottom:max(1rem,env(safe-area-inset-bottom))]'")
  })

  it('turns shared dialogs into mobile bottom sheets while preserving desktop dialogs', () => {
    const dialog = source('components/ui/dialog-shell.tsx')

    expect(dialog).toContain('flex items-end justify-center')
    expect(dialog).toContain('sm:grid sm:place-items-center')
    expect(dialog).toContain('rounded-t-[1.75rem]')
    expect(dialog).toContain('sm:rounded-[1.5rem]')
    expect(dialog).toContain('env(safe-area-inset-bottom)')
    expect(dialog).toContain("event.key === 'Escape'")
  })

  it('uses sticky mobile product search and sheet filters', () => {
    const products = source('components/products/product-grid.tsx')
    const productForm = source('components/products/product-form.tsx')
    const page = source('app/(dashboard)/products/page.tsx')

    expect(products).toContain('sticky top-[5.35rem]')
    expect(products).toContain('<MobileBottomSheet')
    expect(products).toContain('activeFacetCount')
    expect(products).toContain('text-base sm:text-sm')
    expect(page).toContain('totalResults={totalProducts}')
    expect(productForm).toContain('grid gap-4 sm:grid-cols-2')
    expect(productForm).toContain('mt-3 grid gap-2 sm:grid-cols-3')
    expect(productForm).toContain('min-h-11 w-full')
  })

  it('aligns orders with the shared commerce and customer mobile patterns', () => {
    const orders = source('app/(dashboard)/products/orders/page.tsx')
    const mobileOrder = source('components/products/mobile-order-card.tsx')
    const search = source('components/products/orders-search-form.tsx')
    const tabs = source('components/products/commerce-tabs.tsx')

    expect(search).toContain('sticky top-[5.35rem]')
    expect(search).toContain('<MobileBottomSheet')
    expect(search).toContain('<MaterialSelect')
    expect(search).not.toContain('aria-live="polite"')
    expect(orders).toContain('<MobileOrderCard')
    expect(mobileOrder).toContain('<MobileBottomSheet')
    expect(mobileOrder).toContain('aria-haspopup="dialog"')
    expect(orders).toContain('spatial-surface hidden overflow-hidden rounded-[1.5rem] !bg-white')
    expect(search).toContain('spatial-surface rounded-[1.35rem] !bg-white')
    expect(tabs).toContain('spatial-surface grid grid-cols-2')
    expect(tabs).toContain("selected ? 'bg-white/10' : 'bg-black/[0.045]'")
  })

  it('keeps fixed feedback and actions above the mobile bottom navigation', () => {
    const productGrid = source('components/products/product-grid.tsx')
    const automationForm = source('components/instagram/automation-form.tsx')
    const automationManager = source('components/instagram/automation-manager.tsx')

    expect(productGrid).toContain('[bottom:calc(6rem+env(safe-area-inset-bottom))]')
    expect(automationForm).toContain('[bottom:calc(6rem+env(safe-area-inset-bottom))]')
    expect(automationManager).toContain('[bottom:calc(6rem+env(safe-area-inset-bottom))]')
  })

  it('pairs every data-dense desktop table with a dedicated mobile card view', () => {
    const pairedViews = [
      'app/(dashboard)/products/orders/page.tsx',
      'app/admin/(dash)/users/page.tsx',
      'app/admin/(dash)/payments/page.tsx',
      'app/admin/(dash)/conversations/page.tsx',
      'app/admin/(dash)/revenue/page.tsx',
      'app/admin/(dash)/ai/page.tsx',
      'components/blog/admin-blog-manager.tsx',
      'components/admin/service-health-panel.tsx',
    ]

    for (const path of pairedViews) {
      const file = source(path)
      expect(file, `${path} must expose a mobile card view`).toContain('md:hidden')
      expect(file, `${path} must keep its dense view desktop-only`).toMatch(/hidden[^"']*md:block/)
    }

    const contacts = source('components/crm/contacts-view.tsx')
    const database = source('app/admin/(dash)/database/page.tsx')
    expect(contacts).toContain('space-y-3 md:hidden')
    expect(contacts).toContain('spatial-surface hidden')
    expect(database).toContain('<DatabaseMobileRows')
    expect(database).toMatch(/hidden[^"']*md:block/)
  })

  it('uses the same mobile search, filter-sheet, and quick-detail hierarchy', () => {
    const contacts = source('components/crm/contacts-view.tsx')
    const contactDetail = source('components/crm/contact-detail-sheet.tsx')
    const orderSearch = source('components/products/orders-search-form.tsx')
    const orderDetail = source('components/products/mobile-order-card.tsx')
    const adminUsers = source('app/admin/(dash)/users/page.tsx')
    const adminPayments = source('app/admin/(dash)/payments/page.tsx')
    const adminConversations = source('app/admin/(dash)/conversations/page.tsx')
    const adminBlog = source('components/blog/admin-blog-manager.tsx')

    expect(contacts).toContain('type="search"')
    expect(contacts).toContain('<MobileBottomSheet')
    expect(contacts).toContain('<ContactDetailSheet')
    expect(contactDetail).toContain('motionPreset="detail"')
    expect(orderSearch).toContain('type="search"')
    expect(orderSearch).toContain('<MobileBottomSheet')
    expect(orderDetail).toContain('motionPreset="detail"')
    for (const file of [adminUsers, adminPayments, adminConversations]) {
      expect(file).toContain('<AdminUsersSearchForm')
      expect(file).toContain('<AdminFilterSheet')
    }
    expect(adminBlog).toContain('type="search"')
    expect(adminBlog).toContain('<MobileBottomSheet')
    expect(adminBlog).toContain('md:hidden')
  })

  it('opens a compact mobile conversation preview before entering the thread', () => {
    const page = source('app/(dashboard)/conversations/page.tsx')
    const card = source('components/crm/mobile-conversation-card.tsx')
    const filters = source('components/dashboard/conversation-filters.tsx')

    expect(page).toContain('<MobileConversationCard')
    expect(card).toContain('<MobileBottomSheet')
    expect(card).toContain('motionPreset="detail"')
    expect(card).toContain('ورود به گفتگو')
    expect(card).not.toContain('agent')
    expect(card).not.toContain('message summary')
    expect((filters.match(/نیاز به اپراتور/g) ?? [])).toHaveLength(1)
  })

  it('keeps Excel export exclusive to contacts', () => {
    const contacts = source('components/crm/contacts-view.tsx')
    const orders = source('app/(dashboard)/products/orders/page.tsx')
    const analytics = source('app/(dashboard)/analytics/page.tsx')
    const agentAnalytics = source('app/(dashboard)/agents/[agentId]/analytics/page.tsx')

    expect(contacts).toContain('/api/contacts/export')
    expect(existsSync('app/api/contacts/export/route.ts')).toBe(true)
    expect(orders).not.toContain('download')
    expect(analytics).not.toContain('download')
    expect(agentAnalytics).not.toContain('download')
    expect(existsSync('app/api/products/orders/export/route.ts')).toBe(false)
    expect(existsSync('app/api/analytics/export/route.ts')).toBe(false)
  })

  it('uses deterministic mobile scroll motion and a non-wrapping action rail', () => {
    const backToTop = source('components/marketing/back-to-top.tsx')
    const pageHeader = source('components/dashboard/page-header.tsx')
    const dashboardHeader = source('components/dashboard/header.tsx')

    expect(backToTop).toContain('window.requestAnimationFrame(tick)')
    expect(backToTop).toContain("window.addEventListener('touchstart', interrupt")
    expect(backToTop).not.toContain("behavior: 'smooth'")
    expect(pageHeader).toContain('flex-nowrap')
    expect(pageHeader).toContain('overflow-x-auto')
    expect(pageHeader).toContain('sm:flex-wrap')
    expect(dashboardHeader.indexOf('href="/billing"')).toBeLessThan(
      dashboardHeader.indexOf('<NotificationBell'),
    )
  })

  it('keeps plan status beside notifications and derives its ring from subscription days', () => {
    const dashboardHeader = source('components/dashboard/header.tsx')
    const actionGroupStart = dashboardHeader.indexOf(
      '<div className="flex shrink-0 items-center justify-end gap-1.5 xl:gap-2.5">',
    )
    const actionGroup = dashboardHeader.slice(actionGroupStart)

    expect(actionGroupStart).toBeGreaterThan(-1)
    expect(actionGroup.indexOf('<HeaderPlan')).toBeLessThan(
      actionGroup.indexOf('<NotificationBell'),
    )
    expect(dashboardHeader).toContain('(daysLeft / PERIOD_DAYS) * 100')
    expect(dashboardHeader).toContain('daysLeft !== null && daysLeft > 0')
    expect(dashboardHeader).toContain('bg-emerald-500')
    expect(dashboardHeader).toContain('href="/vigento"')
    expect(dashboardHeader).not.toContain('remainingPercent')
    expect(dashboardHeader).not.toContain('percentLabel')
  })
})
