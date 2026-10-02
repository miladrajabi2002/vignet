'use client'

/**
 * Shared confirm dialog — replaces native `confirm()` / `alert()` in
 * customer-facing flows with the branded RTL modal pattern already used by
 * the CRM (contact-delete-action) and products (product-grid) dialogs:
 * portal + framer-motion, focus trap, Escape to close, scroll lock and
 * focus restore.
 *
 * Controlled component: the parent owns `open` and the busy/error state.
 *
 * Phones get a bottom sheet (grab handle, thumb-reach buttons, safe-area
 * padding); from `sm` up it is a centered card. `undoNote` adds the quiet
 * «you can undo this» row used by every soft-delete.
 *
 *   <ConfirmDialog
 *     open={showConfirm}
 *     title="حذف لینک گفتگو"
 *     description="این لینک غیرفعال می‌شود و بازدیدکنندگان دیگر به آن دسترسی ندارند."
 *     confirmLabel="حذف"
 *     tone="danger"
 *     busy={removing}
 *     onConfirm={remove}
 *     onClose={() => setShowConfirm(false)}
 *   />
 */

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AlertTriangle, Loader2, RotateCcw, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'انصراف',
  tone = 'danger',
  busy = false,
  error,
  icon,
  undoNote,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  description?: string
  confirmLabel: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  busy?: boolean
  error?: string | null
  icon?: ReactNode
  /** Shows the soft-delete reassurance row (the text to show). */
  undoNote?: string
  onConfirm: () => void
  onClose: () => void
}) {
  const reduceMotion = useReducedMotion()
  const reactId = useId()
  const titleId = `${reactId}-title`
  const descriptionId = `${reactId}-description`
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const busyRef = useRef(busy)
  const onCloseRef = useRef(onClose)

  busyRef.current = busy
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return

    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cancelRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      // Only the topmost modal reacts (this dialog can open over a sheet).
      const modals = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'))
      if (modals.at(-1) !== dialogRef.current) return
      if (event.key === 'Escape' && !busyRef.current) {
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
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
      if (event.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !dialogRef.current?.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      previousFocus?.focus()
    }
  }, [open])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/50 backdrop-blur-[6px] sm:items-center sm:p-4"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.16, ease: 'easeOut' }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) onClose()
          }}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            className="relative w-full overflow-hidden rounded-t-sheet border border-b-0 border-black/10 bg-white shadow-[var(--elev-2)] sm:max-w-[28rem] sm:rounded-card sm:border-b sm:shadow-[var(--elev-2)]"
            initial={reduceMotion ? false : { opacity: 0, y: 28, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.99 }}
            transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            <span aria-hidden className="mx-auto mt-2.5 block h-1.5 w-10 rounded-full bg-black/15 sm:hidden" />
            <div className="px-5 pb-5 pt-5 text-center sm:p-6 sm:pb-5 sm:text-start">
              <div className="sm:flex sm:items-start sm:gap-4">
                <span
                  className={cn(
                    'mx-auto grid h-12 w-12 shrink-0 place-items-center rounded-2xl sm:mx-0',
                    tone === 'danger'
                      ? 'bg-red-50 text-red-600 ring-1 ring-red-100'
                      : 'bg-[var(--bg-muted)] text-[var(--text-primary)] ring-1 ring-[var(--border-default)]',
                  )}
                >
                  {icon ??
                    (tone === 'danger' ? (
                      <Trash2 className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                    ))}
                </span>
                <div className="min-w-0 sm:flex-1">
                  <h2 id={titleId} className="mt-3.5 text-[18px] font-bold tracking-tight text-[var(--text-primary)] sm:mt-0.5">
                    {title}
                  </h2>
                  {description && (
                    <p id={descriptionId} className="mt-1.5 text-[13px] leading-6 text-[var(--text-secondary)]">
                      {description}
                    </p>
                  )}
                </div>
              </div>
              {undoNote && (
                <p className="mt-4 flex items-start gap-2.5 rounded-2xl border border-black/[0.06] bg-[var(--bg-surface)] px-3.5 py-2.5 text-start text-[13px] leading-6 text-[var(--text-secondary)]">
                  <RotateCcw className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--text-primary)]" aria-hidden="true" />
                  <span>{undoNote}</span>
                </p>
              )}
              {error && (
                <p
                  role="alert"
                  className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-start text-sm text-red-700"
                >
                  {error}
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-base)]/60 px-4 pt-4 [padding-bottom:max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:pb-4">
              <button
                ref={cancelRef}
                type="button"
                onClick={onClose}
                disabled={busy}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-white px-4 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-50 sm:min-h-11 sm:rounded-xl"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className={cn(
                  'spatial-press inline-flex min-h-12 min-w-32 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold text-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-11 sm:rounded-xl',
                  tone === 'danger'
                    ? 'bg-red-600 hover:bg-red-500 focus-visible:ring-red-600'
                    : 'bg-black hover:opacity-90 focus-visible:ring-[var(--focus-ring)]',
                )}
              >
                {busy && (
                  <Loader2
                    className="h-4 w-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                )}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
