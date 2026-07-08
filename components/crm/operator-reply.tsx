'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowUp, Loader2 } from 'lucide-react'

/**
 * Operator (human handoff) reply box. Sends a message directly to the contact
 * through the conversation's channel. For messenger channels the message is
 * pushed live; for widget / chat-link / API channels the message is persisted
 * and shown to the visitor the next time they load the chat (the backend reply
 * route always persists the operator message regardless of channel).
 *
 * Layout: textarea fills the row, send button is a compact icon-only circle on
 * the RIGHT (matching Instagram/Telegram DM). The textarea auto-grows but the
 * button stays vertically centered so the row never "jumps up" when typing or
 * after sending.
 */
export function OperatorReply({
  conversationId,
  canDeliver,
}: {
  conversationId: string
  canDeliver: boolean
}) {
  const t = useTranslations('conversations')
  const router = useRouter()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)

  // Auto-grow the textarea to fit content (capped at ~5 lines), then shrink
  // back when text is cleared. Keeps the reply box compact without making the
  // button jump around.
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`
  }, [text])

  async function send() {
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    setError(false)
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
      setText('')
      router.refresh()
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
      {!canDeliver && (
        <p className="mb-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
          برای کانال‌های ویجت/لینک چت، پیام شما ذخیره می‌شود و در بازدید بعدی کاربر نمایش داده می‌شود.
        </p>
      )}
      {/* dir="ltr" so the send button is reliably on the RIGHT (visual right)
          regardless of the page's RTL direction. The textarea itself is
          dir="auto" so Persian/English text renders correctly inside it. */}
      <div dir="ltr" className="flex items-end gap-2">
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          rows={1}
          dir="auto"
          placeholder={t('replyPlaceholder')}
          className="max-h-[120px] min-h-[40px] flex-1 resize-none rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] px-3.5 py-2.5 text-sm leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-strong)] focus:outline-none"
        />
        <button
          onClick={send}
          disabled={busy || !text.trim()}
          aria-label={t('send')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--white)] text-[var(--bg-base)] transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="h-4.5 w-4.5 animate-spin" />
          ) : (
            <ArrowUp className="h-5 w-5" />
          )}
        </button>
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-[var(--red)]">{t('replyFailed')}</p>
      ) : (
        <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">{t('replyHint')}</p>
      )}
    </div>
  )
}
