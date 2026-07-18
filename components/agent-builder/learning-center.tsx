'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  BookOpenCheck,
  Check,
  CircleHelp,
  Clock3,
  GraduationCap,
  Loader2,
  MessageSquare,
  Sparkles,
  X,
} from 'lucide-react'

export interface LearningItem {
  id: string
  question: string
  conversationId: string
  /** Prefilled answer when the pair came from a human operator reply. */
  operatorAnswer?: string
}

export function LearningCenter({
  agentId,
  initial,
  initialLearnedCount,
}: {
  agentId: string
  initial: LearningItem[]
  initialLearnedCount: number
}) {
  const t = useTranslations('learning')
  const router = useRouter()
  const [items, setItems] = useState(initial)
  const [learnedCount, setLearnedCount] = useState(initialLearnedCount)

  useEffect(() => {
    setItems(initial)
    setLearnedCount(initialLearnedCount)
  }, [initial, initialLearnedCount])

  function resolve(id: string, outcome: 'approved' | 'dismissed') {
    setItems((current) => current.filter((item) => item.id !== id))
    if (outcome === 'approved') setLearnedCount((count) => count + 1)
    // Refresh the server layout too, so the Learning tab badge clears immediately.
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2" aria-label={t('summaryLabel')}>
        <article className="spatial-surface flex min-h-28 items-center gap-4 overflow-hidden rounded-[1.5rem] p-4 sm:p-5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-400/15 text-amber-700">
            <Clock3 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--text-secondary)]">{t('pending')}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-[var(--text-primary)] tabular-nums">
              {items.length.toLocaleString('fa-IR')}
            </p>
          </div>
        </article>
        <article className="spatial-surface flex min-h-28 items-center gap-4 overflow-hidden rounded-[1.5rem] p-4 sm:p-5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-success/10 text-success">
            <BookOpenCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--text-secondary)]">{t('learned')}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-success tabular-nums">
              {learnedCount.toLocaleString('fa-IR')}
            </p>
          </div>
        </article>
      </div>

      {items.length === 0 ? (
        <div className="spatial-surface overflow-hidden rounded-[1.75rem] p-6 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <span className="grid h-14 w-14 place-items-center rounded-[1.15rem] bg-success/10 text-success">
              <GraduationCap className="h-6 w-6" />
            </span>
            <p className="mt-4 text-base font-bold text-[var(--text-primary)]">{t('empty')}</p>
            <p className="mt-1 max-w-md text-xs leading-6 text-[var(--text-secondary)]">{t('emptyHint')}</p>
          </div>
          <div className="mx-auto mt-7 max-w-2xl rounded-[1.35rem] border border-black/[0.055] bg-black/[0.018] p-4 sm:p-5">
            <p className="text-xs font-bold text-[var(--text-primary)]">{t('howTitle')}</p>
            <ol className="mt-4 grid gap-3 sm:grid-cols-2">
              {([1, 2, 3, 4] as const).map((n) => (
                <li key={n} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-[11px] font-bold text-[var(--text-primary)] shadow-sm">
                    {n.toLocaleString('fa-IR')}
                  </span>
                  <p className="text-xs leading-6 text-[var(--text-secondary)]">{t(`howStep${n}`)}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : (
        <section className="space-y-4" aria-labelledby="learning-review-title">
          <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="learning-review-title" className="text-base font-bold text-[var(--text-primary)]">
                {t('reviewTitle')}
              </h2>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{t('reviewHint')}</p>
            </div>
            <span className="inline-flex min-h-8 w-fit items-center rounded-full border border-amber-500/15 bg-amber-400/[0.09] px-3 text-[11px] font-bold text-amber-700 tabular-nums">
              {t('pendingCount', { count: items.length })}
            </span>
          </div>
          <div className="space-y-4">
            {items.map((item) => (
              <LearningCard
                key={item.id}
                agentId={agentId}
                item={item}
                onResolved={(outcome) => resolve(item.id, outcome)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function LearningCard({
  agentId,
  item,
  onResolved,
}: {
  agentId: string
  item: LearningItem
  onResolved: (outcome: 'approved' | 'dismissed') => void
}) {
  const t = useTranslations('learning')
  const [answer, setAnswer] = useState(item.operatorAnswer ?? '')
  const [suggesting, setSuggesting] = useState(false)
  const [approving, setApproving] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = suggesting || approving || dismissing

  async function suggest() {
    if (busy) return
    setSuggesting(true)
    setError(null)
    try {
      const res = await fetch(`/api/agents/${agentId}/learning/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: item.question }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error === 'NO_CREDIT' ? t('noKey') : t('error'))
        return
      }
      setAnswer(data.answer ?? '')
    } catch {
      setError(t('error'))
    } finally {
      setSuggesting(false)
    }
  }

  async function approve() {
    if (!answer.trim() || busy) return
    setApproving(true)
    setError(null)
    try {
      const res = await fetch(`/api/agents/${agentId}/learning/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: item.id, question: item.question, answer: answer.trim() }),
      })
      if (!res.ok) {
        setError(t('error'))
        return
      }
      onResolved('approved')
    } catch {
      setError(t('error'))
    } finally {
      setApproving(false)
    }
  }

  async function dismiss() {
    if (busy) return
    setDismissing(true)
    setError(null)
    try {
      const res = await fetch(`/api/agents/${agentId}/learning`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: item.id }),
      })
      if (!res.ok) {
        setError(t('error'))
        return
      }
      onResolved('dismissed')
    } catch {
      setError(t('error'))
    } finally {
      setDismissing(false)
    }
  }

  return (
    <article className="spatial-surface overflow-hidden rounded-[1.75rem]">
      <header className="flex items-start justify-between gap-3 border-b border-black/[0.055] bg-black/[0.012] px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[0.9rem] bg-black text-white shadow-[var(--shadow-control)]">
            <CircleHelp className="h-4 w-4" />
          </span>
          <div className="min-w-0 pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[var(--text-primary)]">{t('question')}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                <Clock3 className="h-3 w-3" />
                {t('pending')}
              </span>
              {item.operatorAnswer && (
                <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">
                  {t('fromOperator')}
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">{t('reviewCardHint')}</p>
          </div>
        </div>
        <Link
          href={`/conversations/${item.conversationId}`}
          title={t('viewConversation')}
          className="spatial-press inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-black/[0.065] bg-white px-3 text-[11px] font-semibold text-[var(--text-secondary)] shadow-sm transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 focus-visible:ring-offset-2"
        >
          <MessageSquare className="h-4 w-4" />
          <span className="hidden sm:inline">{t('viewConversation')}</span>
        </Link>
      </header>

      <div className="space-y-5 p-4 sm:p-5">
        <div className="rounded-[1.25rem] border border-black/[0.055] bg-black/[0.022] px-4 py-3.5 sm:px-5">
          <p className="text-sm font-semibold leading-7 text-[var(--text-primary)]">{item.question}</p>
        </div>

        <div>
          <label htmlFor={`learning-answer-${item.id}`} className="mb-2 flex items-center justify-between gap-3 px-1">
            <span className="text-xs font-bold text-[var(--text-primary)]">{t('answerLabel')}</span>
            <span className="text-[11px] text-[var(--text-muted)]">{t('answerHint')}</span>
          </label>
          <textarea
            id={`learning-answer-${item.id}`}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            rows={4}
            placeholder={t('answerPlaceholder')}
            disabled={busy}
            className="min-h-32 w-full resize-y rounded-[1.25rem] border border-black/[0.08] bg-white px-4 py-3 text-sm leading-7 text-[var(--text-primary)] shadow-[0_8px_26px_-22px_rgba(0,0,0,0.65)] placeholder:text-[var(--text-muted)] transition-[border-color,box-shadow] duration-150 focus:border-black/25 focus:outline-none focus:ring-4 focus:ring-black/[0.045] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-black/[0.055] pt-4 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={dismiss}
            disabled={busy}
            className="spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-xs font-semibold text-[var(--text-muted)] transition-colors hover:bg-danger/5 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {dismissing ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <X className="h-4 w-4" />}
            {dismissing ? t('dismissing') : t('dismiss')}
          </button>

          <div className="flex flex-col gap-2 sm:ms-auto sm:flex-row">
            <button
              type="button"
              onClick={suggest}
              disabled={busy}
              className="spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-black/[0.075] bg-white px-4 text-xs font-semibold text-[var(--text-secondary)] shadow-sm transition-colors hover:border-black/15 hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {suggesting ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Sparkles className="h-4 w-4" />}
              {suggesting ? t('suggesting') : t('suggest')}
            </button>

            <button
              type="button"
              onClick={approve}
              disabled={busy || !answer.trim()}
              className="spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-black px-5 text-xs font-bold text-white shadow-[var(--shadow-control)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-35"
            >
              {approving ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Check className="h-4 w-4" />}
              {approving ? t('approving') : t('approve')}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
