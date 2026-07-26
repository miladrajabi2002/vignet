'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { CircleCheck, TriangleAlert } from 'lucide-react'
import { ChatComposer } from '@/components/chat/chat-composer'
import type { ThreadMessage } from './conversation-thread'

type DeliveryFeedback = {
  status: 'sent' | 'unavailable' | 'failed'
  reason?: string
}

/**
 * Operator (human handoff) reply box. Sends a message directly to the contact
 * through the conversation's channel. For messenger channels the message is
 * pushed live; for widget / chat-link / API channels the message is persisted
 * and shown to the visitor the next time they load the chat (the backend reply
 * route always persists the operator message regardless of channel).
 *
 * OPTIMISTIC DISPLAY: When `onSent` is provided, the message is displayed
 * INSTANTLY in the UI (via the parent's state) — no page refresh needed.
 * `router.refresh()` still runs silently in the background to sync the
 * conversation status and handoff panel, but the user never waits for it.
 *
 * Input handling (Enter to send, auto-grow, send button, busy state) belongs to
 * the shared <ChatComposer>; this component only owns the send request and the
 * delivery feedback rendered in the composer's footer slot.
 */
export function OperatorReply({
  conversationId,
  canDeliver,
  onSent,
}: {
  conversationId: string
  canDeliver: boolean
  onSent?: (message: ThreadMessage) => void
}) {
  const t = useTranslations('conversations')
  const locale = useLocale()
  const router = useRouter()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [delivery, setDelivery] = useState<DeliveryFeedback | null>(null)

  async function send() {
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    setError(false)
    setDelivery(null)
    try {
      const res = await fetch(`/api/conversations/${conversationId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: body }),
      })
      if (!res.ok) {
        setError(true)
        return
      }
      const data = await res.json()
      const deliveryResult = data.delivery as DeliveryFeedback | undefined
      // Instantly display the message via the parent's optimistic state.
      // The API returns { message: { id, content, createdAt, role }, delivered }.
      if (onSent && data.message) {
        onSent({
          id: data.message.id,
          role: data.message.role,
          content: data.message.content,
          createdAt: data.message.createdAt,
          contentType: 'TEXT',
          metadata: {
            operator: true,
            ...(deliveryResult ? { delivery: deliveryResult } : {}),
          },
        })
      }
      if (deliveryResult) setDelivery(deliveryResult)
      setText('')
      // Silent background refresh to sync conversation status / handoff panel.
      // The message is already visible — this is just for metadata consistency.
      router.refresh()
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  const feedback = error ? (
    <p className="mt-1.5 text-xs text-[var(--red)]" role="alert">{t('replyFailed')}</p>
  ) : delivery?.status === 'failed' || (delivery?.status === 'unavailable' && canDeliver) ? (
    <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-amber-700" role="status" aria-live="polite">
      <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
      {locale === 'fa' ? 'پیام ذخیره شد، اما به کانال نرسید. اتصال کانال را بررسی و دوباره تلاش کنید.' : 'Saved, but not delivered. Check the channel connection and try again.'}
    </p>
  ) : delivery?.status === 'sent' ? (
    <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-emerald-700" role="status" aria-live="polite">
      <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
      {locale === 'fa' ? 'پیام با موفقیت به کانال رسید.' : 'Delivered to the channel.'}
    </p>
  ) : (
    <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">{t('replyHint')}</p>
  )

  return (
    <div>
      {!canDeliver && (
        <p className="mb-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
          {locale === 'fa'
            ? 'ارسال زنده برای این گفتگو در دسترس نیست؛ پیام در تاریخچه ذخیره می‌شود. برای کانال‌های پیام‌رسان، اتصال و دسترسی کانال را بررسی کنید.'
            : 'Live delivery is unavailable for this conversation; the message is still saved in the history. For messenger channels, check the channel connection and permissions.'}
        </p>
      )}
      <ChatComposer
        value={text}
        onChange={setText}
        onSend={send}
        busy={busy}
        placeholder={t('replyPlaceholder')}
        dir={locale === 'fa' ? 'rtl' : 'ltr'}
        sendLabel={t('send')}
        footer={feedback}
      />
    </div>
  )
}
