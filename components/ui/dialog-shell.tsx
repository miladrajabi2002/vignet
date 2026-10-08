'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function DialogShell({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
  compact = false,
  stableWidth = false,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
  /** Narrow panel for confirmations. */
  compact?: boolean
  /** Always take the full max width on desktop. By default the panel hugs its
   *  content there, so a dialog whose body loads asynchronously changes width
   *  when the data lands — set this to keep it still. */
  stableWidth?: boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()
  const subtitleId = useId()
  const reduceMotion = useReducedMotion()
  // Portal target. Rendering in place breaks `position: fixed`: the dashboard
  // page wrapper runs a transform entrance animation (fill-mode keeps it
  // "transformed"), which turns it into the containing block. The overlay then
  // spans the whole page height, the panel centres far below the fold and the
  // body scroll lock leaves it unreachable — the dialog looked frozen.
  const [host, setHost] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setHost(document.body)
  }, [])

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!host) return
    const panel = panelRef.current
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    const focusables = () => Array.from(panel?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    ) ?? [])

    document.body.style.overflow = 'hidden'
    const preferredFocus = panel?.querySelector<HTMLElement>('[data-dialog-initial-focus]')
    ;(preferredFocus ?? focusables()[0])?.focus()

    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusables()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handler)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handler)
      previousFocus?.focus()
    }
  }, [host])

  if (!host) return null

  return createPortal(
    <motion.div
      className={cn(
        'fixed inset-0 z-[70] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:p-3',
        // A centred GRID item is sized by its content; a FLEX item resolves
        // `w-full` against the overlay, so the panel is exactly its max width.
        stableWidth ? 'sm:items-center' : 'sm:grid sm:place-items-center',
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={subtitle ? subtitleId : undefined}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.16, ease: 'easeOut' }}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onCloseRef.current() }}
    >
      <motion.div
        ref={panelRef}
        className={cn(
          'spatial-surface max-h-[92dvh] w-full overflow-y-auto rounded-t-sheet bg-white shadow-2xl sm:rounded-card',
          wide ? 'max-w-4xl' : compact ? 'max-w-md' : 'max-w-2xl',
        )}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] bg-white/95 p-4 pt-6 backdrop-blur sm:p-5">
          <span aria-hidden="true" className="absolute start-1/2 top-2 h-1.5 w-11 -translate-x-1/2 rtl:translate-x-1/2 rounded-full bg-black/15 sm:hidden" />
          <div>
            <h2 id={titleId} className="text-base font-bold tracking-tight text-[var(--text-primary)]">{title}</h2>
            {subtitle && <p id={subtitleId} className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            aria-label="بستن"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="p-4 [padding-bottom:max(1rem,env(safe-area-inset-bottom))] sm:p-5">{children}</div>
      </motion.div>
    </motion.div>,
    host,
  )
}
