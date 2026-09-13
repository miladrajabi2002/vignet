'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, Loader2, RotateCcw, X } from 'lucide-react'

/**
 * Bottom snackbar shown right after a bulk delete: "۱۲ مشتری حذف شد" with a
 * بازگردانی (undo) button and a countdown bar. Auto-dismisses — no clicking a
 * tiny ✕ required, on desktop and mobile alike.
 *
 * Phases:
 *   undo      — countdown running, undo available
 *   restoring — restore request in flight
 *   restored  — brief confirmation, then the bar closes itself
 *   error     — restore failed; retry or dismiss
 */

export type UndoPhase = 'undo' | 'restoring' | 'restored' | 'error'

export function UndoSnackbar({
  phase,
  count,
  entityLabel,
  locale,
  durationMs = 8_000,
  onUndo,
  onDismiss,
}: {
  phase: UndoPhase | null
  count: number
  entityLabel: string
  locale: 'fa' | 'en'
  durationMs?: number
  onUndo: () => void
  onDismiss: () => void
}) {
  const reduceMotion = useReducedMotion()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mounted = typeof document !== 'undefined'

  // Auto-dismiss: while the undo offer is on screen (or the success flash is
  // showing) run down the timer. Errors stay until dismissed — retrying must
  // remain possible for the whole undo window.
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (phase === 'undo') {
      timerRef.current = setTimeout(onDismiss, durationMs)
    } else if (phase === 'restored') {
      timerRef.current = setTimeout(onDismiss, 1_600)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [phase, durationMs, onDismiss])

  const fa = locale !== 'en'
  const nf = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')

  const message =
    phase === 'restored'
      ? fa ? 'بازگردانی شد' : 'Restored'
      : phase === 'error'
        ? fa ? 'بازگردانی ناموفق بود — دوباره تلاش کنید' : 'Restore failed — try again'
        : fa
          ? `${nf.format(count)} ${entityLabel} حذف شد`
          : `${nf.format(count)} ${entityLabel} deleted`

  // Portal OUTSIDE, AnimatePresence inside — the app's proven pattern
  // (see notification-bell). A conditional portal as a direct AnimatePresence
  // child does not register for presence tracking.
  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {phase && (
        <motion.div
          dir={fa ? 'rtl' : 'ltr'}
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 z-[102] flex justify-center [bottom:calc(6rem+env(safe-area-inset-bottom))] sm:inset-x-auto sm:bottom-6 sm:end-6"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={reduceMotion ? { duration: 0.12 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <span className={
                phase === 'restored'
                  ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600'
                  : phase === 'error'
                    ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/12 text-red-600'
                    : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/[0.06] text-[var(--text-secondary)]'
              }>
                {phase === 'restored'
                  ? <Check className="h-4 w-4" aria-hidden="true" />
                  : <RotateCcw className="h-4 w-4" aria-hidden="true" />}
              </span>
              <p className="min-w-0 flex-1 text-sm font-semibold text-[var(--text-primary)]">{message}</p>
              {(phase === 'undo' || phase === 'error') && (
                <button
                  type="button"
                  onClick={onUndo}
                  disabled={phase === 'error' && false}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--text-primary)] px-3.5 text-xs font-bold text-[var(--bg-base)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)] focus-visible:ring-offset-2"
                >
                  {phase === 'error'
                    ? (fa ? 'تلاش مجدد' : 'Retry')
                    : fa ? 'بازگردانی' : 'Undo'}
                </button>
              )}
              <button
                type="button"
                onClick={onDismiss}
                aria-label={fa ? 'بستن' : 'Dismiss'}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {/* Countdown bar — makes the auto-dismiss predictable. */}
            {phase === 'undo' && (
              <span className="absolute inset-x-0 bottom-0 h-[3px] bg-black/[0.08]" aria-hidden="true">
                <span
                  className="block h-full bg-[var(--text-primary)] motion-reduce:!animate-none"
                  style={{
                    animation: `undo-countdown ${durationMs}ms linear forwards`,
                    transformOrigin: fa ? 'right' : 'left',
                  }}
                />
              </span>
            )}
            {phase === 'restoring' && (
              <span className="absolute inset-x-0 bottom-0 flex h-[3px] items-center justify-center bg-black/[0.08]" aria-hidden="true">
                <Loader2 className="h-2.5 w-2.5 animate-spin text-[var(--text-primary)]" />
              </span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
