/**
 * The key message of a Direct scenario: where its keys sit decides what a key
 * may do, and a message Instagram would refuse keeps the save action closed.
 */
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/instagram',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('next-intl', () => ({ useLocale: () => 'fa', useTranslations: () => (key: string) => key }))
vi.mock('@/lib/hooks/use-unsaved-changes-guard', () => ({ useUnsavedChangesGuard: () => undefined }))

import { AutomationForm } from '@/components/instagram/automation-form'
import type { Automation, AutomationMessage } from '@/components/instagram/types'

function renderForm(messages: Array<Omit<AutomationMessage, 'id'>>): string {
  const initial: Automation = {
    id: 'scenario-1',
    agentId: 'agent-1',
    channelId: 'channel-1',
    type: 'DIRECT_MESSAGE',
    name: 'قیمت',
    active: true,
    priority: 0,
    createdAt: '',
    updatedAt: '',
    trigger: { keywords: ['قیمت'], matchMode: 'CONTAINS', storyScope: 'KEYWORD', postIds: [] },
    action: { replyMode: 'STATIC', messages: messages as AutomationMessage[] },
  }
  const html = renderToString(
    createElement(AutomationForm, {
      agentId: 'agent-1',
      channelId: 'channel-1',
      accountUsername: 'shop',
      accountAvatarUrl: null,
      type: 'DIRECT_MESSAGE',
      mode: 'edit',
      initial,
    } as never),
  )
  // React separates adjacent text nodes with empty comments.
  return html.replace(/<!-- -->/g, '')
}

// The attribute itself — the button's classes also contain «disabled:».
const saveIsClosed = (html: string) => / disabled=""/.test(html.match(/<button type="submit"[^>]*>/)?.[0] ?? '')
const linkChoices = (html: string) => html.split('aria-label="کار کلید').length - 1

describe('key message form', () => {
  it('offers the text / link choice for a key inside the bubble', () => {
    const html = renderForm([
      { type: 'QUICK_REPLY', text: 'چه اطلاعاتی نیاز داری؟', buttonType: 'button', buttons: [{ title: 'قیمت‌ها' }, { title: 'سایت', url: 'https://vigent.ir' }] },
    ])

    expect(linkChoices(html)).toBe(2)
    expect(html).toContain('value="https://vigent.ir"')
    expect(saveIsClosed(html)).toBe(false)
  })

  it('offers no link on reply chips and says a typed link is not kept', () => {
    const html = renderForm([
      { type: 'QUICK_REPLY', text: 'ادامه بدم؟', buttonType: 'quick_reply', buttons: [{ title: 'بله', url: 'https://vigent.ir' }] },
    ])

    expect(linkChoices(html)).toBe(0)
    expect(html).not.toContain('value="https://vigent.ir"')
    expect(html).toContain('تراشه لینک باز نمی‌کند')
    expect(saveIsClosed(html)).toBe(false)
  })

  it('keeps the save action closed while a link key has no working link', () => {
    const html = renderForm([
      { type: 'QUICK_REPLY', text: 'سایت ما', buttonType: 'button', buttons: [{ title: 'سایت', url: 'قیمت ها' }] },
    ])

    expect(html).toContain('لینک کلید «سایت» معتبر نیست.')
    expect(saveIsClosed(html)).toBe(true)
  })

  it('keeps the save action closed for keys without the text above them', () => {
    const html = renderForm([{ type: 'QUICK_REPLY', text: '', buttonType: 'button', buttons: [{ title: 'قیمت‌ها' }] }])

    expect(html).toContain('اینستاگرام کلید بدون متن نمی‌فرستد')
    expect(saveIsClosed(html)).toBe(true)
  })

  it('counts a text against the one-message limit and refuses a longer one', () => {
    const html = renderForm([{ type: 'TEXT', text: 'ا'.repeat(950) }])

    expect(html).toContain('۹۵۰ / ۹۰۰')
    expect(saveIsClosed(html)).toBe(true)
  })

  it('does not offer a caption Instagram never sends with a video', () => {
    const html = renderForm([{ type: 'VIDEO', text: '', mediaUrl: 'https://vigent.ir/v.mp4' }])

    expect(html).toContain('ویدیو در دایرکت بدون کپشن فرستاده می‌شود')
    expect(html).not.toContain('کپشن (اختیاری)')
  })
})
