'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function DialogShell({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()
  const subtitleId = useId()
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
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
  }, [])

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:grid sm:place-items-center sm:p-3"
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
          'spatial-surface max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.75rem] bg-white shadow-2xl sm:rounded-[1.5rem]',
          wide ? 'max-w-4xl' : 'max-w-2xl',
        )}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] bg-white/95 p-4 pt-6 backdrop-blur sm:p-5">
          <span aria-hidden="true" className="absolute start-1/2 top-2 h-1.5 w-11 -translate-x-1/2 rounded-full bg-black/15 sm:hidden" />
          <div>
            <h2 id={titleId} className="text-base font-bold tracking-tight text-[var(--text-primary)]">{title}</h2>
            {subtitle && <p id={subtitleId} className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)]"
            aria-label="بستن"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="p-4 [padding-bottom:max(1rem,env(safe-area-inset-bottom))] sm:p-5">{children}</div>
      </motion.div>
    </motion.div>
  )
}
