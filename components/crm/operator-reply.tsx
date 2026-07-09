'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Send, Loader2 } from 'lucide-react'
import type { ThreadMessage } from './conversation-thread'

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
 * Layout: textarea fills the row, send button is a compact icon-only circle on
 * the RIGHT (matching Instagram/Telegram DM). The textarea auto-grows but the
 * button stays vertically centered so the row never "jumps up" when typing or
 * after sending.
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
  const router = useRouter()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)

  // Auto-grow the textarea to fit content (capped at ~6 lines), then shrink
  // back when text is cleared. Uses `field-sizing: content` where supported
  // (Chrome 123+) as a no-JS fallback; the JS height override handles the
  // rest. Crucially, the textarea NEVER shows an internal scrollbar — it just
  // grows taller (up to max-h) so the composer stays readable.
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    // Reset to auto first so scrollHeight measures the content, not the
    // current capped height.
    ta.style.height = 'auto'
    const next = Math.min(ta.scrollHeight, 160)
    ta.style.height = `${next}px`
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
      const data = await res.json()
      // Instantly display the message via the parent's optimistic state.
      // The API returns { message: { id, content, createdAt, role }, delivered }.
      if (onSent && data.message) {
        onSent({
          id: data.message.id,
          role: data.message.role,
          content: data.message.content,
          createdAt: data.message.createdAt,
          contentType: 'TEXT',
          metadata: { operator: true },
          parentId: null,
          parent: null,
        })
      }
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

  return (
    <div>
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
          // No internal scrollbar: `scrollbar-width: none` (Firefox) +
          // `::-webkit-scrollbar { display: none }` (Chrome/Safari). The
          // textarea grows with content up to max-h, so a scrollbar never
          // appears — matching the chat input UX of Telegram/WhatsApp web.
          className="max-h-[160px] min-h-[40px] flex-1 resize-none overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] px-3.5 py-2.5 text-sm leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-strong)] focus:outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
            <Send className="h-5 w-5" />
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
