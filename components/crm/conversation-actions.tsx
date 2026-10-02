'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import {
  Bot,
  Check,
  CheckCircle2,
  Headset,
  Loader2,
  Maximize2,
  MoreVertical,
  RotateCcw,
  Star,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Switch } from '@/components/ui/switch'
import { queueUndo } from '@/lib/undo-queue'
import { cn } from '@/lib/utils'

type Status = 'OPEN' | 'RESOLVED' | 'HANDED_OFF'

async function patchConversation(conversationId: string, body: { status?: Status; rating?: number }) {
  const response = await fetch(`/api/conversations/${conversationId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return response.ok
}

/**
 * Conversation header actions: the one thing an operator does when finished
 * («حل شد»), with the rare ones (full page, delete) behind a menu.
 */
export function ConversationHeaderActions({
  conversationId,
  status: initialStatus,
  fullPageHref,
}: {
  conversationId: string
  status: Status
  /** Set inside the inbox pane, where the thread can also open on its own page. */
  fullPageHref?: string
}) {
  const t = useTranslations('conversations')
  const locale = useLocale()
  const fa = locale !== 'en'
  const router = useRouter()
  const [status, setStatus] = useState<Status>(initialStatus)
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => setStatus(initialStatus), [initialStatus])

  async function setResolved(next: boolean) {
    if (busy) return
    setBusy(true)
    try {
      const target: Status = next ? 'RESOLVED' : 'OPEN'
      if (await patchConversation(conversationId, { status: target })) {
        setStatus(target)
        router.refresh()
      }
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, { method: 'DELETE' })
      if (response.ok) {
        setShowDelete(false)
        // Queue the global «بازگردانی» toast BEFORE navigating back to the
        // inbox — the toast lives in the dashboard layout and survives it.
        queueUndo('conversation', [conversationId], fa ? 'گفتگو' : 'conversation')
        router.replace('/conversations')
        router.refresh()
        return
      }
      setDeleteError(t('deleteFailed'))
    } catch {
      setDeleteError(t('deleteFailed'))
    } finally {
      setDeleting(false)
    }
  }

  const resolved = status === 'RESOLVED'

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        disabled={busy}
        onClick={() => void setResolved(!resolved)}
        className={cn(
          'spatial-press inline-flex min-h-10 items-center gap-1.5 rounded-control px-3 text-[13px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 disabled:opacity-50',
          resolved
            ? 'border border-[var(--border-default)] bg-white font-medium text-[var(--text-primary)] hover:border-[var(--border-hover)]'
            : 'bg-[var(--text-primary)] text-white',
        )}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : resolved ? (
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
        )}
        {resolved ? (fa ? 'بازگشایی' : 'Reopen') : (fa ? 'حل شد' : 'Resolve')}
      </button>

      <div className="relative" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false) }}>
        <button
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={fa ? 'کارهای دیگر' : 'More actions'}
          className="grid h-10 w-10 place-items-center rounded-control border border-[var(--border-default)] bg-white text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <MoreVertical className="h-4 w-4" aria-hidden="true" />
        </button>
        {menuOpen && (
          <div role="menu" className="absolute end-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-xl border border-[var(--border-default)] bg-white py-1 shadow-[var(--elev-2)]">
            {fullPageHref && (
              <Link
                href={fullPageHref}
                role="menuitem"
                className="flex min-h-11 w-full items-center gap-2 px-3 text-start text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              >
                <Maximize2 className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
                {fa ? 'باز کردن در صفحهٔ کامل' : 'Open full page'}
              </Link>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                setDeleteError(null)
                setShowDelete(true)
              }}
              className="flex min-h-11 w-full items-center gap-2 px-3 text-start text-[13px] text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {t('delete')}
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showDelete}
        title={t('deleteTitle')}
        description={t('deleteDescription')}
        undoNote={t('deleteUndoNote')}
        confirmLabel={deleting ? t('deleting') : t('deleteConfirm')}
        cancelLabel={t('deleteCancel')}
        tone="danger"
        busy={deleting}
        error={deleteError}
        onConfirm={() => void remove()}
        onClose={() => {
          if (!deleting) setShowDelete(false)
        }}
      />
    </div>
  )
}

/**
 * Who answers next (agent or operator) and the satisfaction score: two quiet
 * rows in the summary tab instead of a coloured card.
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
  const [aiMode, setAiMode] = useState(initialStatus !== 'HANDED_OFF')
  const [togglingAi, setTogglingAi] = useState(false)
  const [modeError, setModeError] = useState(false)

  useEffect(() => {
    setStatus(initialStatus)
    setAiMode(initialStatus !== 'HANDED_OFF')
  }, [initialStatus])

  async function rate(value: number) {
    if (busy) return
    setBusy(true)
    try {
      if (await patchConversation(conversationId, { rating: value })) {
        setRating(value)
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
    <div className="divide-y divide-[var(--border-subtle)] rounded-card border border-[var(--border-subtle)] bg-white">
      <div className="p-3.5">
        <div className="flex items-center gap-3">
          <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', automaticReplies ? 'bg-[var(--signal-soft)] text-[var(--signal-strong)]' : 'bg-[var(--bg-muted)] text-[var(--text-secondary)]')}>
            {automaticReplies ? <Bot className="h-4 w-4" aria-hidden="true" /> : <Headset className="h-4 w-4" aria-hidden="true" />}
          </span>
          <p className="min-w-0 flex-1 text-[13px] font-bold text-[var(--text-primary)]">{t('aiControlTitle')}</p>
          <Switch
            checked={automaticReplies}
            onChange={toggleAi}
            disabled={resolved || togglingAi}
            aria-label={t('aiControlTitle')}
          />
        </div>
        <p className="mt-2 text-[12px] leading-5 text-[var(--text-secondary)]">
          {resolved
            ? t('aiControlClosed')
            : automaticReplies
              ? t('aiControlAutomatic')
              : t('aiControlOperatorOnly')}
        </p>
        {modeError && (
          <p role="alert" className="mt-1.5 text-[12px] text-[var(--red)]">
            {t('aiControlError')}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 px-3.5 py-1.5">
        <span className="text-[13px] text-[var(--text-secondary)]">{t('csat')}</span>
        <div className="flex items-center" dir="ltr">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              disabled={busy}
              onClick={() => void rate(value)}
              onMouseEnter={() => setHover(value)}
              onMouseLeave={() => setHover(null)}
              className="inline-flex h-10 w-9 items-center justify-center rounded-lg transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-50"
              aria-label={`${value}`}
              aria-pressed={rating === value}
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
    </div>
  )
}

/** Closes the operator alert once the reason it was raised is handled. */
export function HandoffAlertResolve({ alertId, resolved: initiallyResolved }: { alertId: string; resolved: boolean }) {
  const t = useTranslations('conversations')
  const router = useRouter()
  const [resolving, setResolving] = useState(false)
  const [resolved, setResolved] = useState(initiallyResolved)

  useEffect(() => setResolved(initiallyResolved), [initiallyResolved])

  async function resolveAlert() {
    if (resolving || resolved) return
    setResolving(true)
    try {
      const res = await fetch(`/api/handoff-alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 'resolved' }),
      })
      if (res.ok) {
        setResolved(true)
        router.refresh()
      }
    } finally {
      setResolving(false)
    }
  }

  if (resolved) {
    return (
      <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        {t('alertResolved')}
      </p>
    )
  }

  return (
    <button
      type="button"
      onClick={() => void resolveAlert()}
      disabled={resolving}
      className="spatial-press mt-2.5 inline-flex min-h-9 items-center gap-1.5 rounded-control border border-amber-500/30 bg-white px-3 text-[12px] font-medium text-amber-900 hover:border-amber-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-50"
    >
      {resolving ? <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
      {t('resolveAlert')}
    </button>
  )
}
