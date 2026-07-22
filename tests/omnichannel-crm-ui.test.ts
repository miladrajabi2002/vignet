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

    expect(reply).toContain("delivery?.status === 'failed'")
    expect(reply).toContain("delivery?.status === 'sent'")
    expect(route).toContain("delivery: { status: delivery.status, reason: delivery.reason }")
    expect(activity).toContain('ذخیره شد؛ تحویل نشد')
  })
})
