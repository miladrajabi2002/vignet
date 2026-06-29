'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Send, Loader2 } from 'lucide-react'

/**
 * Operator (human handoff) reply box. Sends a message directly to the contact
 * through the conversation's channel. Only messenger channels can be pushed to;
 * for web-widget/API the box is replaced with an explanatory note.
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

  if (!canDeliver) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-3 text-center text-xs text-[var(--text-muted)]">
        {t('replyNoChannel')}
      </p>
    )
  }

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
    <div className="space-y-1.5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send()
          }}
          rows={2}
          placeholder={t('replyPlaceholder')}
          className="max-h-40 min-h-[2.5rem] flex-1 resize-y rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-strong)] focus:outline-none"
        />
        <button
          onClick={send}
          disabled={busy || !text.trim()}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[var(--white)] px-4 text-sm font-medium text-[var(--bg-base)] disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4 rtl:rotate-180" />
          )}
          {busy ? t('sending') : t('send')}
        </button>
      </div>
      {error ? (
        <p className="text-xs text-danger">{t('replyFailed')}</p>
      ) : (
        <p className="text-[11px] text-[var(--text-muted)]">{t('replyHint')}</p>
      )}
    </div>
  )
}
