'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Check, Loader2, RotateCcw, Star, Trash2, Bot, Headset } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

type Status = 'OPEN' | 'RESOLVED' | 'HANDED_OFF'

/**
 * ConversationActions — the always-visible action bar at the bottom of a
 * conversation thread.
 *
 *   • ۵-star CSAT rating (PATCH /api/conversations/:id { rating })
 *   • Resolve / Reopen toggle (PATCH /api/conversations/:id { status })
 *   • "پاسخ هوشمند" (smart reply) Switch — flips the conversation between
 *     AI mode (OPEN, agent replies) and OPERATOR mode (HANDED_OFF, only
 *     operator replies reach the contact). POST /api/conversations/:id/reset
 *   • "حذف گفتگو" (delete) — cascade-deletes the conversation + messages +
 *     handoff alerts. DELETE /api/conversations/:id — then navigates back
 *     to /conversations.
 */
export function ConversationActions({
  conversationId,
  status: initialStatus,
  rating: initialRating,
}: {
  conversationId: string
  status: Status
  rating: number | null
}) {
  const t = useTranslations('conversations')
  const router = useRouter()
  const [status, setStatus] = useState<Status>(initialStatus)
  const [rating, setRating] = useState<number | null>(initialRating)
  const [busy, setBusy] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const [aiMode, setAiMode] = useState<boolean>(initialStatus !== 'HANDED_OFF')
  const [togglingAi, setTogglingAi] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function patch(body: { status?: Status; rating?: number }) {
    setBusy(true)
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        if (body.status) setStatus(body.status)
        if (body.rating) setRating(body.rating)
        router.refresh()
      }
    } finally {
      setBusy(false)
    }
  }

  async function toggleAi(next: boolean) {
    if (togglingAi) return
    setTogglingAi(true)
    const prev = aiMode
    setAiMode(next)
    try {
      const res = await fetch(`/api/conversations/${conversationId}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: next ? 'AI' : 'OPERATOR' }),
      })
      if (res.ok) {
        // Local mirror of the server-side status so the resolve button label
        // stays in sync without an extra round-trip.
        setStatus(next ? 'OPEN' : 'HANDED_OFF')
        router.refresh()
      } else {
        setAiMode(prev)
      }
    } catch {
      setAiMode(prev)
    } finally {
      setTogglingAi(false)
    }
  }

  async function remove() {
    if (deleting) return
    if (
      !confirm(
        'این گفتگو و تمام پیام‌های آن برای همیشه حذف می‌شود. مطمئنی؟',
      )
    )
      return
    setDeleting(true)
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        router.replace('/conversations')
        router.refresh()
      }
    } finally {
      setDeleting(false)
    }
  }

  const resolved = status === 'RESOLVED'

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* CSAT rating */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-secondary)]">{t('csat')}</span>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                disabled={busy}
                onClick={() => patch({ rating: n })}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(null)}
                className="p-0.5 disabled:opacity-50"
                aria-label={`${n}`}
              >
                <Star
                  className={cn(
                    'h-4 w-4 transition-colors',
                    (hover ?? rating ?? 0) >= n
                      ? 'fill-[var(--amber)] text-[var(--amber)]'
                      : 'text-[var(--text-muted)]',
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Resolve / Reopen */}
        <button
          disabled={busy}
          onClick={() => patch({ status: resolved ? 'OPEN' : 'RESOLVED' })}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium disabled:opacity-50',
            resolved
              ? 'border border-[var(--border-default)] text-[var(--text-secondary)]'
              : 'bg-[var(--white)] text-[var(--bg-base)]',
          )}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : resolved ? (
            <RotateCcw className="h-4 w-4" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          {resolved ? t('reopen') : t('resolve')}
        </button>
      </div>

      {/* Smart-reply switch + Delete button */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-3">
        <label
          className="flex cursor-pointer items-center gap-2.5 text-sm text-[var(--text-primary)]"
          title="روشن: هوش مصنوعی پاسخ می‌دهد — خاموش: فقط اپراتور"
        >
          <Switch
            checked={aiMode}
            onChange={toggleAi}
            disabled={togglingAi}
            aria-label="پاسخ هوشمند"
          />
          <span className="flex items-center gap-1.5">
            {aiMode ? (
              <Bot className="h-4 w-4 text-[var(--green)]" />
            ) : (
              <Headset className="h-4 w-4 text-[var(--amber)]" />
            )}
            <span className="font-medium">پاسخ هوشمند</span>
            <span className="text-xs text-[var(--text-muted)]">
              {aiMode ? '(هوش مصنوعی)' : '(اپراتور)'}
            </span>
          </span>
        </label>

        <button
          onClick={remove}
          disabled={deleting}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:border-danger hover:text-danger disabled:opacity-50"
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          حذف گفتگو
        </button>
      </div>
    </div>
  )
}
