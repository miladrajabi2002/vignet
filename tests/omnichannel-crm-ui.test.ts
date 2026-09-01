import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(path, 'utf8')
}

describe('omnichannel CRM user-visible contract', () => {
  it('keeps customer search server-backed, debounced, and phone-normalized', () => {
    const page = source('app/(dashboard)/contacts/page.tsx')
    const view = source('components/crm/contacts-view.tsx')

    expect(page).toContain('contactPhoneLookupVariants(query)')
    expect(page).toContain('prisma.contact.findMany')
    expect(view).toContain('window.setTimeout')
    expect(view).toContain('nextQuery === serverQuery ? 0 : 280')
    expect(page).toContain("...(stage ? { stage } : {})")
    expect(page).toContain("...(tag ? { tags: { has: tag } } : {})")
    expect(view).toContain('router.replace(')
    expect(view).toContain('aria-live="polite"')
  })

  it('uses adaptive customer cards, sticky mobile filters, and accessible detail sheets', () => {
    const view = source('components/crm/contacts-view.tsx')
    const detailSheet = source('components/crm/contact-detail-sheet.tsx')
    const bottomSheet = source('components/ui/mobile-bottom-sheet.tsx')
    const quickAdd = source('components/crm/contact-quick-add.tsx')
    const mobileNav = source('components/dashboard/mobile-nav.tsx')
    const route = source('app/api/contacts/[contactId]/route.ts')
    const createRoute = source('app/api/contacts/route.ts')
    const exportRoute = source('app/api/contacts/export/route.ts')

    expect(view).toContain('sticky top-[5.35rem]')
    expect(view).toContain('md:hidden')
    expect(view).toContain('hidden divide-y')
    expect(view).toContain('params.set(\'contact\', id)')
    expect(view).toContain('<MobileBottomSheet')
    expect(view).toContain('<ContactDetailSheet')
    expect(detailSheet).toContain('role="tablist"')
    expect(detailSheet).toContain("type DetailTab = 'overview' | 'conversations' | 'edit'")
    expect(detailSheet).toContain('navigator.clipboard?.writeText')
    expect(detailSheet).toContain('href={`tel:${phone}`}')
    expect(detailSheet).toContain('<ContactDeleteAction')
    expect(bottomSheet).toContain("event.key === 'Escape'")
    expect(bottomSheet).toContain('FOCUSABLE_SELECTOR')
    expect(bottomSheet).toContain('env(safe-area-inset-bottom)')
    expect(quickAdd).toContain("fetch('/api/contacts'")
    expect(quickAdd).toContain('mobileOnly={false}')
    expect(createRoute).toContain('export async function POST')
    expect(exportRoute).toContain('ReadableStream<Uint8Array>')
    expect(exportRoute).toContain('Content-Disposition')
    expect(exportRoute).toContain('spreadsheet applications')
    expect(mobileNav).toContain("['overview', 'conversations', 'contacts']")
    expect(mobileNav).toContain('env(safe-area-inset-bottom)')
    expect(mobileNav).toContain("aria-current={active ? 'page' : undefined}")
    expect(route).toContain('export async function GET')
    expect(route).toContain("'Cache-Control': 'private, no-store, max-age=0'")
  })

  it('shows and persists truthful operator delivery state', () => {
    const reply = source('components/crm/operator-reply.tsx')
    const route = source('app/api/conversations/[conversationId]/reply/route.ts')
    const activity = source('components/crm/conversation-activity.tsx')
    const apiClient = source('components/agent-builder/test-playground.tsx')

    expect(reply).toContain("delivery?.status === 'failed'")
    expect(reply).toContain("delivery?.status === 'sent'")
    expect(reply).toContain("delivery?.status === 'stored'")
    expect(reply).not.toContain('ارسال زنده برای این گفتگو در دسترس نیست')
    expect(route).toContain("delivery: { status: delivery.status, reason: delivery.reason }")
    expect(route).toContain("delivery.status === 'sent' || delivery.status === 'stored'")
    expect(activity).toContain("deliveryStatus === 'stored'")
    expect(activity).toContain("deliveryReason === 'not_push_channel'")
    expect(activity).not.toContain('ذخیره شد؛ تحویل نشد')
    expect(apiClient).toContain('/api/conversations/${encodeURIComponent(activeConversationId!)}/messages')
    expect(apiClient).toContain('window.setInterval(pollHistory, 5000)')
  })

  it('uses a real mobile inbox with cards, sheet filters, and detail tabs', () => {
    const list = source('app/(dashboard)/conversations/page.tsx')
    const filters = source('components/dashboard/conversation-filters.tsx')
    const detailLayout = source('components/crm/conversation-mobile-layout.tsx')
    const mobileNav = source('components/dashboard/mobile-nav.tsx')

    expect(list).toContain('sticky top-[5.35rem]')
    expect(list).toContain('key={`mobile-${c.id}`}')
    expect(list).toContain('key={`desktop-${c.id}`}')
    expect(list).toContain('<ConversationStatusBadge')
    expect(list).toContain('prisma.conversation.count({ where })')
    expect(filters).toContain('<MobileBottomSheet')
    expect(filters).toContain('activeFacetCount')
    expect(filters).toContain('text-base sm:text-sm')
    expect(detailLayout).toContain('role="tablist"')
    expect(detailLayout).toContain("type MobileConversationTab = 'thread' | 'details'")
    expect(detailLayout).toContain('min-h-11')
    expect(detailLayout).toContain("'ArrowLeft', 'ArrowRight', 'Home', 'End'")
    expect(detailLayout).toContain('tabIndex={tab === key ? 0 : -1}')
    expect(mobileNav).toContain('the labelled "More" item')
    expect(mobileNav).not.toContain('shadow-[var(--shadow-sm)]')
  })
})

describe('CRM avatar and customer deletion contract', () => {
  it('uses the internal Instagram avatar proxy and puts channel identity in the trailing column', () => {
    const contacts = source('app/(dashboard)/contacts/page.tsx')
    const conversations = source('app/(dashboard)/conversations/page.tsx')
    const avatar = source('components/crm/contact-avatar.tsx')

    expect(contacts).toContain('contactAvatarSrc({')
    expect(conversations).toContain('<ContactAvatar src={channelAvatarSrc} alt={who} />')
    expect(conversations).toContain('<ConversationStatusBadge')
    expect(avatar).toContain('setUsingFallback(true)')
    expect(avatar).toContain('setBroken(true)')
  })

  it('provides an accessible customer deletion dialog with explicit history semantics', () => {
    const action = source('components/crm/contact-delete-action.tsx')
    const route = source('app/api/contacts/[contactId]/route.ts')

    expect(action).toContain('aria-modal="true"')
    expect(action).toContain("event.key === 'Escape'")
    expect(action).toContain("returnTo = '/contacts'")
    expect(action).toContain('router.replace(returnTo)')
    expect(route).toContain('data: { contactId: null }')
    expect(route).toContain('preservedConversations')
  })
})

describe('conversation sales intelligence UI contract', () => {
  it('surfaces classification, probability, filtering, and historical backfill', () => {
    const list = source('app/(dashboard)/conversations/page.tsx')
    const detail = source('app/(dashboard)/conversations/[conversationId]/page.tsx')
    const filter = source('components/dashboard/conversation-filters.tsx')
    const backfill = source('components/crm/sales-insight-backfill.tsx')

    expect(list).toContain('<SalesInsightBadge insight={c.salesInsight}')
    expect(list).toContain("'HIGH_INTENT'")
    expect(filter).toContain('activeSales')
    expect(detail).toContain('<SalesInsightCard insight={displayedSalesInsight}')
    expect(detail).toContain('analyzeSalesConversation({')
    expect(backfill).toContain("fetch('/api/conversations/sales-insights/backfill'")
    expect(backfill).toContain('router.refresh()')
  })
})
