'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Bot,
  Check,
  CircleCheck,
  Headset,
  Loader2,
  RotateCcw,
  Star,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
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
  const [aiMode, setAiMode] = useState(initialStatus !== 'HANDED_OFF')
  const [togglingAi, setTogglingAi] = useState(false)
  const [modeError, setModeError] = useState(false)

  useEffect(() => {
    setStatus(initialStatus)
    setAiMode(initialStatus !== 'HANDED_OFF')
  }, [initialStatus])

  async function patch(body: { status?: Status; rating?: number }) {
    if (busy) return
    setBusy(true)
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (response.ok) {
        if (body.status) setStatus(body.status)
        if (body.rating) setRating(body.rating)
        router.refresh()
      }
    } finally {
      setBusy(false)
    }
  }

  async function toggleAi(next: boolean) {
    if (togglingAi || status === 'RESOLVED') return
    setTogglingAi(true)
    setModeError(false)
    const previousMode = aiMode
    setAiMode(next)

    try {
      const response = await fetch(`/api/conversations/${conversationId}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: next ? 'AI' : 'OPERATOR' }),
      })
      if (response.ok) {
        setStatus(next ? 'OPEN' : 'HANDED_OFF')
        router.refresh()
      } else {
        setAiMode(previousMode)
        setModeError(true)
      }
    } catch {
      setAiMode(previousMode)
      setModeError(true)
    } finally {
      setTogglingAi(false)
    }
  }

  const resolved = status === 'RESOLVED'
  const automaticReplies = !resolved && aiMode

  return (
    <section className="spatial-surface space-y-4 rounded-[1.5rem] p-5">
      {resolved && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-slate-600 ring-1 ring-slate-200">
              <CircleCheck className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {t('conversationClosedTitle')}
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                {t('conversationClosedDescription')}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => patch({ status: 'OPEN' })}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            {t('reopen')}
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-secondary)]">{t('csat')}</span>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                disabled={busy}
                onClick={() => patch({ rating: value })}
                onMouseEnter={() => setHover(value)}
                onMouseLeave={() => setHover(null)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:opacity-50"
                aria-label={`${value}`}
              >
                <Star
                  className={cn(
                    'h-4 w-4 transition-colors',
                    (hover ?? rating ?? 0) >= value
                      ? 'fill-[var(--amber)] text-[var(--amber)]'
                      : 'text-[var(--text-muted)]',
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        {!resolved && (
          <button
            type="button"
            disabled={busy}
            onClick={() => patch({ status: 'RESOLVED' })}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--white)] px-4 text-sm font-medium text-[var(--bg-base)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {t('resolve')}
          </button>
        )}
      </div>

      <div
        className={cn(
          'rounded-2xl border p-4 transition-[background-color,border-color] duration-200',
          resolved
            ? 'border-slate-200 bg-slate-50/80'
            : automaticReplies
              ? 'border-emerald-500/20 bg-emerald-500/[0.06]'
              : 'border-amber-500/25 bg-amber-500/[0.08]',
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--text-primary)]">
              {t('aiControlTitle')}
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
              {t('aiControlDescription')}
            </p>
          </div>
          <Switch
            checked={automaticReplies}
            onChange={toggleAi}
            disabled={resolved || togglingAi}
            aria-label={t('aiControlTitle')}
          />
        </div>

        <div className="mt-3 flex items-start gap-2.5 border-t border-black/[0.06] pt-3">
          <span
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-xl',
              resolved
                ? 'bg-slate-200/70 text-slate-600'
                : automaticReplies
                  ? 'bg-emerald-500/12 text-emerald-700'
                  : 'bg-amber-500/15 text-amber-700',
            )}
          >
            {automaticReplies ? (
              <Bot className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Headset className="h-4 w-4" aria-hidden="true" />
            )}
          </span>
          <p className="text-xs font-medium leading-5 text-[var(--text-primary)]">
            {resolved
              ? t('aiControlClosed')
              : automaticReplies
                ? t('aiControlAutomatic')
                : t('aiControlOperatorOnly')}
          </p>
        </div>
      </div>

      {modeError && (
        <p role="alert" className="text-xs text-red-600">
          {t('aiControlError')}
        </p>
      )}
    </section>
  )
}
