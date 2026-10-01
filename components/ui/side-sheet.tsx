'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Edge sheet for long editors: a drawer on the inline-end edge on desktop and
 * a near-full-height bottom sheet on phones. Portalled to <body> so dashboard
 * page transforms can never capture its `position: fixed` (see DialogShell).
 * Header and footer stay pinned; only the body scrolls.
 */
export function SideSheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
  closeLabel = 'بستن',
  className,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  closeLabel?: string
  className?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()
  const reduceMotion = useReducedMotion()
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [desktop, setDesktop] = useState(true)

  useEffect(() => {
    setHost(document.body)
    const query = window.matchMedia('(min-width: 768px)')
    const sync = () => setDesktop(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!host) return
    const panel = panelRef.current
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusables = () => Array.from(panel?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    ) ?? [])
    const preferred = panel?.querySelector<HTMLElement>('[data-sheet-initial-focus]')
    ;(preferred ?? panel)?.focus({ preventScroll: true })

    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Let open popovers (date picker, selects) consume Escape first.
        if (event.defaultPrevented) return
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
      previousFocus?.focus({ preventScroll: true })
    }
  }, [host])

  if (!host) return null

  const rtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl'
  // Inline-end edge: left in RTL, right in LTR.
  const offscreen = desktop ? { x: rtl ? '-104%' : '104%', y: 0 } : { x: 0, y: '100%' }

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[70] bg-black/35 backdrop-blur-[3px]"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.18 }}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onCloseRef.current() }}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'fixed flex flex-col bg-white shadow-[var(--elev-2)] outline-none',
          'inset-x-0 bottom-0 max-h-[94dvh] rounded-t-sheet',
          'md:inset-y-3 md:end-3 md:start-auto md:max-h-none md:w-[min(40rem,calc(100vw-1.5rem))] md:rounded-sheet',
          className,
        )}
        initial={reduceMotion ? false : offscreen}
        animate={{ x: 0, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.34, ease: [0.16, 1, 0.3, 1] }}
      >
        <header className="relative flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border-subtle)] px-5 pb-4 pt-6 md:pt-5">
          <span aria-hidden className="absolute start-1/2 top-2 h-1.5 w-11 -translate-x-1/2 rounded-full bg-black/15 rtl:translate-x-1/2 md:hidden" />
          <div className="min-w-0">
            <h2 id={titleId} className="ui-h2">{title}</h2>
            {subtitle ? <p className="ui-caption mt-0.5">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
        {footer ? (
          <footer className="shrink-0 border-t border-[var(--border-subtle)] bg-white/95 px-5 py-3.5 [padding-bottom:max(0.875rem,env(safe-area-inset-bottom))] backdrop-blur md:rounded-b-sheet">
            {footer}
          </footer>
        ) : null}
      </motion.div>
    </motion.div>,
    host,
  )
}
