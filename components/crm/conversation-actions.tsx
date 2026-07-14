'use client'

import { useEffect, useRef, useState } from 'react'
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const deleteTriggerRef = useRef<HTMLButtonElement>(null)
  const deleteDialogRef = useRef<HTMLDivElement>(null)
  const confirmDeleteRef = useRef<HTMLButtonElement>(null)
  const deletingRef = useRef(false)

  deletingRef.current = deleting

  useEffect(() => {
    if (!showDeleteDialog) return

    const deleteTrigger = deleteTriggerRef.current
    confirmDeleteRef.current?.focus()
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
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setShowDeleteDialog(false)
        deleteTriggerRef.current?.focus()
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
          ref={deleteTriggerRef}
          onClick={() => {
            setDeleteError(null)
            setShowDeleteDialog(true)
          }}
          disabled={deleting}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:border-danger hover:text-danger disabled:opacity-50"
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          {t('delete')}
        </button>
      </div>

      {showDeleteDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleting) setShowDeleteDialog(false)
          }}
        >
          <div
            ref={deleteDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-conversation-title"
            aria-describedby="delete-conversation-description"
            className="w-full max-w-md rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-400">
                <Trash2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 id="delete-conversation-title" className="font-semibold text-[var(--text-primary)]">
                  {t('deleteTitle')}
                </h2>
                <p id="delete-conversation-description" className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                  {t('deleteDescription')}
                </p>
              </div>
            </div>

            {deleteError && (
              <p role="alert" className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {deleteError}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteDialog(false)}
                disabled={deleting}
                className="rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] disabled:opacity-50"
              >
                {t('deleteCancel')}
              </button>
              <button
                ref={confirmDeleteRef}
                type="button"
                onClick={remove}
                disabled={deleting}
                className="inline-flex min-w-28 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {deleting ? t('deleting') : t('deleteConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
