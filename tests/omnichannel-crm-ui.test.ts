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
    expect(view).toContain('}, 280)')
    expect(view).toContain('router.replace(')
    expect(view).toContain('aria-live="polite"')
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
})

describe('CRM avatar and customer deletion contract', () => {
  it('uses the internal Instagram avatar proxy and puts channel identity in the trailing column', () => {
    const contacts = source('app/(dashboard)/contacts/page.tsx')
    const conversations = source('app/(dashboard)/conversations/page.tsx')
    const avatar = source('components/crm/contact-avatar.tsx')

    expect(contacts).toContain('contactAvatarSrc({')
    expect(conversations).toContain('<ContactAvatar src={channelAvatarSrc} alt={who} />')
    expect(conversations).toContain('flex shrink-0 flex-col items-end gap-1.5')
    expect(avatar).toContain('setUsingFallback(true)')
    expect(avatar).toContain('setBroken(true)')
  })

  it('provides an accessible customer deletion dialog with explicit history semantics', () => {
    const action = source('components/crm/contact-delete-action.tsx')
    const route = source('app/api/contacts/[contactId]/route.ts')

    expect(action).toContain('aria-modal="true"')
    expect(action).toContain("event.key === 'Escape'")
    expect(action).toContain("router.replace('/contacts')")
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
