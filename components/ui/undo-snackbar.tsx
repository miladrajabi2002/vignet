'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, RotateCcw, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The «بازگردانی» (undo) snackbar shown after EVERY delete — single or bulk.
 *
 * Design goals (user request: «قشنگ‌تر و حرفه‌ای‌تر»):
 *  • frosted-glass card with a soft layered shadow — premium, not flat
 *  • prominent inverted undo pill + thin countdown bar with rounded ends
 *  • countdown PAUSES while hovered/focused (Gmail behaviour) so nobody loses
 *    their undo to a slow hand
 *  • spring entrance, gentle exit; reduced-motion respected
 *  • mobile: floats above the bottom nav with safe-area padding;
 *    desktop: pinned to the bottom-end corner
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
  durationMs = 9_000,
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
  const mounted = typeof document !== 'undefined'

  // ── Auto-dismiss with hover/focus pause ─────────────────────────────────
  // We track the remaining time ourselves so pausing is exact — the CSS bar
  // pauses in parallel via an animation-play-state utility class.
  const [paused, setPaused] = useState(false)
  const remainingRef = useRef(durationMs)
  const startedAtRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function armTimer() {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(onDismiss, Math.max(0, remainingRef.current))
    startedAtRef.current = Date.now()
  }

  useEffect(() => {
    // A fresh "undo" phase restarts the clock from the full duration.
    if (phase === 'undo') remainingRef.current = durationMs
  }, [phase, durationMs])

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (phase === 'undo') {
      if (!paused) armTimer()
    } else if (phase === 'restored') {
      timerRef.current = setTimeout(onDismiss, 1_800)
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused, durationMs, onDismiss])

  function pauseCountdown() {
    if (phase !== 'undo' || paused) return
    // Bank the remaining time before pausing.
    if (startedAtRef.current != null) {
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAtRef.current))
      startedAtRef.current = null
    }
    setPaused(true)
  }

  function resumeCountdown() {
    if (phase !== 'undo' || !paused) return
    setPaused(false)
  }

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

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {phase && (
        <motion.div
          dir={fa ? 'rtl' : 'ltr'}
          role="status"
          aria-live="polite"
          onMouseEnter={pauseCountdown}
          onMouseLeave={resumeCountdown}
          onFocus={pauseCountdown}
          onBlur={resumeCountdown}
          className="fixed inset-x-3 z-[102] flex justify-center [bottom:calc(5.75rem+env(safe-area-inset-bottom))] sm:inset-x-auto sm:bottom-6 sm:end-6"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 22, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.985 }}
          transition={
            reduceMotion
              ? { duration: 0.12 }
              : { type: 'spring', bounce: 0.22, duration: 0.5 }
          }
        >
          <div
            className={cn(
              'relative w-full max-w-md overflow-hidden rounded-[1.35rem] border',
              // Frosted glass + layered shadow — reads as a floating layer
              // above the page, not a grey box.
              'border-black/[0.08] bg-[var(--bg-surface)]/90 shadow-[0_2px_8px_rgba(0,0,0,0.06),0_16px_48px_-8px_rgba(0,0,0,0.22)] backdrop-blur-xl backdrop-saturate-150',
            )}
          >
            {/* Subtle top highlight — gives the card a glassy "edge". */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent"
            />
            <div className="flex items-center gap-3 px-3.5 py-3">
              <span
                className={cn(
                  'grid h-10 w-10 shrink-0 place-items-center rounded-[0.85rem] transition-colors',
                  phase === 'restored'
                    ? 'bg-emerald-500/12 text-emerald-600'
                    : phase === 'error'
                      ? 'bg-red-500/12 text-red-600'
                      : 'bg-black/[0.055] text-[var(--text-secondary)]',
                )}
              >
                {phase === 'restored' ? (
                  <motion.span
                    initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', bounce: 0.5, duration: 0.45 }}
                    className="grid place-items-center"
                  >
                    <Check className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.75} aria-hidden="true" />
                  </motion.span>
                ) : phase === 'restoring' ? (
                  <Loader2 className="h-[1.15rem] w-[1.15rem] animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <RotateCcw className="h-[1.05rem] w-[1.05rem]" strokeWidth={2.25} aria-hidden="true" />
                )}
              </span>

              <p className="min-w-0 flex-1 text-[13.5px] font-semibold leading-5 text-[var(--text-primary)]">
                {message}
              </p>

              {(phase === 'undo' || phase === 'error') && (
                <button
                  type="button"
                  onClick={onUndo}
                  className={cn(
                    'spatial-press inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[0.85rem] px-3.5 text-[13px] font-bold',
                    'bg-[var(--text-primary)] text-[var(--bg-base)] shadow-[0_2px_10px_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-px active:translate-y-0',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-surface)]',
                  )}
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  {phase === 'error'
                    ? fa ? 'تلاش مجدد' : 'Retry'
                    : fa ? 'بازگردانی' : 'Undo'}
                </button>
              )}

              <button
                type="button"
                onClick={onDismiss}
                aria-label={fa ? 'بستن' : 'Dismiss'}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.85rem] text-[var(--text-muted)] transition-colors hover:bg-black/[0.05] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Countdown bar — rounded ends; pauses while the card is hovered. */}
            {phase === 'undo' && (
              <span
                aria-hidden="true"
                className="absolute inset-x-3 bottom-0 h-[3px] overflow-hidden rounded-full bg-black/[0.07]"
              >
                <span
                  className={cn(
                    'block h-full rounded-full bg-[var(--text-primary)] motion-reduce:!animate-none',
                    paused && '[animation-play-state:paused]',
                  )}
                  style={{
                    animation: `undo-countdown ${durationMs}ms linear forwards`,
                    animationPlayState: paused ? 'paused' : 'running',
                    transformOrigin: fa ? 'right' : 'left',
                  }}
                />
              </span>
            )}
            {phase === 'restoring' && (
              <span
                aria-hidden="true"
                className="absolute inset-x-3 bottom-0 h-[3px] overflow-hidden rounded-full bg-black/[0.07]"
              >
                <span className="undo-indeterminate block h-full w-1/3 rounded-full bg-[var(--text-primary)]" />
              </span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
