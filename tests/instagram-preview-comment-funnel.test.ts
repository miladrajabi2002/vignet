/**
 * The scenario preview of a comment→DM funnel has two sides: the post with
 * its comments, and the commenter's Direct thread — drawn in the order it
 * really happens (opening message → the tap → the reply), with a separate
 * path for someone who does not follow yet.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { IphonePreview, type IphonePreviewProps } from '@/components/instagram/iphone-preview'

const messages = [
  { id: 'm1', type: 'TEXT' as const, text: 'قیمت ۲۴۹۹ تومان' },
  { id: 'm2', type: 'IMAGE' as const, text: '', mediaUrl: 'https://cdn.example.com/a.jpg' },
]

function preview(props: Partial<IphonePreviewProps>): string {
  const html = renderToStaticMarkup(
    createElement(IphonePreview, {
      mode: 'COMMENT',
      accountUsername: 'shop',
      userText: 'قیمت',
      replyMode: 'STATIC',
      messages,
      dmOnComment: true,
      commentAckEnabled: true,
      commentAckText: 'تو دایرکت فرستادم 🌟',
      ...props,
    }),
  )
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

const opener = { text: 'برای دریافت بزنید 👇', button: 'مشاهده پست' }

describe('comment→DM preview — under the post', () => {
  it('shows the public part and a map of what continues in Direct', () => {
    const text = preview({ commentView: 'comment', dmOpener: opener, followGate: true, gateButton: 'فالو کردم' })
    expect(text).toContain('تو دایرکت فرستادم 🌟')
    expect(text).toContain('ادامه در دایرکت')
    expect(text).toContain('درخواست فالو با دکمهٔ «فالو کردم» (فقط غیرفالوورها)')
    expect(text).toContain('پیام شروع با دکمهٔ «مشاهده پست» (فالوورها)')
    expect(text).toContain('۲ پیام: متن، عکس')
    // The Direct messages themselves belong to the Direct view.
    expect(text).not.toContain('قیمت ۲۴۹۹ تومان')
  })

  it('does not mention an opener for a reply that is one short text', () => {
    const text = preview({ commentView: 'comment', messages: [messages[0]] })
    expect(text).not.toContain('پیام شروع')
    expect(text).toContain('۱ پیام: متن')
  })
})

describe('comment→DM preview — the Direct thread', () => {
  it('opens with the button message, then the tap, then every message', () => {
    const text = preview({ commentView: 'dm_follower', dmOpener: opener })
    const order = [
      'Replied to your comment',
      'برای دریافت بزنید 👇',
      'مشاهده پست', // the button, then the customer's tap
      'با زدن دکمه، پیام‌ها ارسال می‌شود',
      'قیمت ۲۴۹۹ تومان',
    ].map((piece) => text.indexOf(piece))
    expect(order.every((index) => index >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    // Button on the message + the customer's own bubble.
    expect(text.match(/مشاهده پست/g)).toHaveLength(2)
    // The post and the public reply are the other view.
    expect(text).not.toContain('تو دایرکت فرستادم')
  })

  it('sends a single short text straight away — no opener, no tap', () => {
    const text = preview({ commentView: 'dm_follower', messages: [messages[0]] })
    expect(text).toContain('قیمت ۲۴۹۹ تومان')
    expect(text).not.toContain('با زدن دکمه')
  })

  it('shows the follow request for someone who does not follow yet', () => {
    const text = preview({
      commentView: 'dm_new',
      dmOpener: opener,
      followGate: true,
      gatePrompt: 'اول پیج رو فالو کن',
      gateButton: 'فالو کردم',
    })
    expect(text).toContain('اول پیج رو فالو کن')
    expect(text).toContain('فالو تأیید شد — پیام‌ها ارسال می‌شود')
    expect(text).toContain('قیمت ۲۴۹۹ تومان')
    // A non-follower gets the follow request, not the opener.
    expect(text).not.toContain('برای دریافت بزنید')
  })

  it('shows the opener (not the follow request) for a follower of a gated funnel', () => {
    const text = preview({ commentView: 'dm_follower', dmOpener: opener, followGate: true, gatePrompt: 'اول پیج رو فالو کن' })
    expect(text).toContain('برای دریافت بزنید 👇')
    expect(text).not.toContain('اول پیج رو فالو کن')
  })

  it('falls back to the post view when the reply is not sent in Direct', () => {
    const text = preview({ commentView: 'dm_follower', dmOnComment: false, replyMode: 'MULTI_MESSAGE' })
    expect(text).not.toContain('Replied to your comment')
    expect(text).toContain('Comments')
  })
})
