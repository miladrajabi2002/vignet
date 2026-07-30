'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Check, Loader2, RotateCcw, Star, Trash2, Bot, Headset } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
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
  const [modeError, setModeError] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const deleteTriggerRef = useRef<HTMLButtonElement>(null)
  const deleteDialogRef = useRef<HTMLDivElement>(null)
  const cancelDeleteRef = useRef<HTMLButtonElement>(null)
  const deletingRef = useRef(false)
  const reduceMotion = useReducedMotion()

  deletingRef.current = deleting

  useEffect(() => {
    setStatus(initialStatus)
    setAiMode(initialStatus !== 'HANDED_OFF')
  }, [initialStatus])

  useEffect(() => {
    if (!showDeleteDialog) return

    const deleteTrigger = deleteTriggerRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cancelDeleteRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !deletingRef.current) {
        setShowDeleteDialog(false)
        return
      }
      if (event.key !== 'Tab') return

      const focusable = Array.from(
        deleteDialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      )
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || !deleteDialogRef.current?.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !deleteDialogRef.current?.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      deleteTrigger?.focus()
    }
  }, [showDeleteDialog])

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
    setModeError(false)
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
        setModeError(true)
      }
    } catch {
      setAiMode(prev)
      setModeError(true)
    } finally {
      setTogglingAi(false)
    }
  }

  async function remove() {
    if (deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setShowDeleteDialog(false)
        router.replace('/conversations')
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
    <div className="spatial-surface space-y-3 rounded-[1.5rem] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* CSAT rating */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-secondary)]">{t('csat')}</span>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                disabled={busy}
                onClick={() => patch({ rating: n })}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(null)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:opacity-50"
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
          type="button"
          disabled={busy}
          onClick={() => patch({ status: resolved ? 'OPEN' : 'RESOLVED' })}
          className={cn(
            'inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:opacity-50',
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
        <div
          className={cn(
            'flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl border px-3 py-2 transition-[background-color,border-color] duration-200',
            aiMode
              ? 'border-emerald-500/15 bg-emerald-500/[0.055]'
              : 'border-amber-500/20 bg-amber-500/[0.07]',
          )}
          title={t('aiControlHint')}
        >
          <Switch
            checked={aiMode}
            onChange={toggleAi}
            disabled={togglingAi}
            aria-label={t('aiControlTitle')}
          />
          <span className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                aiMode
                  ? 'bg-emerald-500/10 text-emerald-700'
                  : 'bg-amber-500/12 text-amber-700',
              )}
            >
              {aiMode ? <Bot className="h-4 w-4" /> : <Headset className="h-4 w-4" />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[var(--text-primary)]">
                {t('aiControlTitle')}
              </span>
              <span className="block text-xs leading-5 text-[var(--text-muted)]">
                {aiMode ? t('aiControlAutomatic') : t('aiControlOperatorOnly')}
              </span>
            </span>
          </span>
        </div>

        <button
          type="button"
          ref={deleteTriggerRef}
          onClick={() => {
            setDeleteError(null)
            setShowDeleteDialog(true)
          }}
          disabled={deleting}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border-default)] px-3 text-sm text-[var(--text-muted)] transition-colors hover:border-danger hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-50"
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          {t('delete')}
        </button>
      </div>
      {modeError && (
        <p role="alert" className="text-xs text-red-600">
          {t('aiControlError')}
        </p>
      )}

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showDeleteDialog && (
            <motion.div
              className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-4 backdrop-blur-md"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.16, ease: 'easeOut' }}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !deleting) setShowDeleteDialog(false)
              }}
            >
              <motion.div
                ref={deleteDialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-conversation-title"
                aria-describedby="delete-conversation-description"
                className="w-full max-w-[27rem] overflow-hidden rounded-[1.5rem] border border-black/10 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
                initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 6 }}
                transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="p-6 pb-5 text-center sm:text-start">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100 sm:mx-0">
                    <Trash2 className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h2 id="delete-conversation-title" className="mt-4 text-lg font-bold tracking-tight text-[var(--text-primary)]">
                    {t('deleteTitle')}
                  </h2>
                  <p id="delete-conversation-description" className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    {t('deleteDescription')}
                  </p>

                  {deleteError && (
                    <p role="alert" className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-start text-sm text-red-700">
                      {deleteError}
                    </p>
                  )}
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-base)]/60 p-4 sm:flex-row sm:justify-end">
                  <button
                    ref={cancelDeleteRef}
                    type="button"
                    onClick={() => setShowDeleteDialog(false)}
                    disabled={deleting}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border-default)] bg-white px-4 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)] disabled:opacity-50"
                  >
                    {t('deleteCancel')}
                  </button>
                  <button
                    type="button"
                    onClick={remove}
                    disabled={deleting}
                    className="inline-flex min-h-11 min-w-32 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deleting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    {deleting ? t('deleting') : t('deleteConfirm')}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}
