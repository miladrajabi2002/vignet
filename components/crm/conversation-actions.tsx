'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Check, Loader2, RotateCcw, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

type Status = 'OPEN' | 'RESOLVED' | 'HANDED_OFF'

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

  const resolved = status === 'RESOLVED'

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
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

      <button
        disabled={busy}
        onClick={() => patch({ status: resolved ? 'OPEN' : 'RESOLVED' })}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium disabled:opacity-50',
          resolved
            ? 'border border-[var(--border-default)] text-[var(--text-secondary)]'
            : 'bg-white text-black',
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
  )
}
