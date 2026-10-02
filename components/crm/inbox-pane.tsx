'use client'

import { type ReactNode, useEffect, useState } from 'react'
import { useLinkStatus } from 'next/link'
import { ArrowRight, ChevronLeft, Loader2, PanelLeft, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The inbox pane only exists from the tablet breakpoint up. Phones open a
 * conversation on its own page, so the thread (and its 5s polling) is
 * unmounted there instead of being hidden with CSS.
 */
export function InboxDesktopOnly({ children }: { children: ReactNode }) {
  const [show, setShow] = useState(true)

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const sync = () => setShow(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  return show ? <>{children}</> : null
}

/** Spinner inside an inbox row while its conversation is loading. */
export function InboxRowPending() {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--text-muted)] motion-reduce:animate-none" aria-hidden="true" />
}

/**
 * Thread beside the customer summary. Three columns need a wide screen; below
 * xl the summary swaps in for the thread behind one button.
 */
export function InboxPaneFrame({
  locale,
  header,
  strip,
  thread,
  details,
}: {
  locale: 'fa' | 'en'
  header: ReactNode
  /** One line of summary under the header while the side column is tucked away. */
  strip?: ReactNode
  thread: ReactNode
  details: ReactNode
}) {
  const fa = locale === 'fa'
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div className="grid min-h-0 min-w-0 xl:grid-cols-[minmax(0,1fr)_20.5rem]">
      <section className={cn('min-h-0 min-w-0 flex-col', showDetails ? 'hidden xl:flex' : 'flex')}>
        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-2.5">
          <div className="min-w-0 flex-1">{header}</div>
          <button
            type="button"
            onClick={() => setShowDetails(true)}
            aria-label={fa ? 'خلاصه و مشخصات مشتری' : 'Summary and customer details'}
            className="spatial-press inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-control border border-[var(--border-default)] bg-white px-2.5 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] xl:hidden"
          >
            <PanelLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden lg:inline">{fa ? 'مشتری' : 'Customer'}</span>
          </button>
        </div>
        {strip && (
          <button
            type="button"
            onClick={() => setShowDetails(true)}
            className="flex min-h-10 w-full shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--signal-soft)] px-4 text-[12px] text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] xl:hidden"
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--signal-strong)]" aria-hidden="true" />
            {strip}
            <ChevronLeft className="h-4 w-4 shrink-0 text-[var(--text-muted)] ltr:rotate-180" aria-hidden="true" />
          </button>
        )}
        {thread}
      </section>

      <aside
        aria-label={fa ? 'خلاصهٔ مشتری' : 'Customer summary'}
        className={cn('min-h-0 min-w-0 overflow-y-auto bg-[var(--bg-base)] xl:block xl:border-s xl:border-[var(--border-subtle)]', showDetails ? 'block' : 'hidden')}
      >
        <div className="border-b border-[var(--border-subtle)] bg-white px-3 py-2 xl:hidden">
          <button
            type="button"
            onClick={() => setShowDetails(false)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-control px-2 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <ArrowRight className="h-4 w-4 ltr:rotate-180" aria-hidden="true" />
            {fa ? 'بازگشت به گفتگو' : 'Back to conversation'}
          </button>
        </div>
        {details}
      </aside>
    </div>
  )
}
