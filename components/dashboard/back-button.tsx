'use client'

import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { ChevronLeft, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Unified "back" control for the dashboard and the admin panel.
 *
 * Two looks built from the same round chevron:
 *  - `variant="label"` (default) — a ghost breadcrumb: the chevron sits in a
 *    small white disc followed by the destination's name. Used above detail
 *    heroes (agent, contact, conversation, product).
 *  - `variant="icon"` — the disc alone, sized as a 40px touch target. Used
 *    inline at the start of PageHeader; `label` becomes its accessible name.
 *
 * On hover the disc inks in (black with a white chevron) — one quiet, precise
 * affordance instead of a bordered pill. The chevron flips for RTL.
 *
 * Behaviour — "scroll is state":
 *  When the user arrived here through an in-app navigation (list → detail),
 *  clicking back performs a real history back so Next.js restores the exact
 *  scroll position of the list they came from. Deep links (no in-app history)
 *  fall back to a plain push of `href`.
 *
 * Usage:
 *
 *   <BackButton href="/agents" label={t('title')} />
 *   <BackButton href="/instagram" label="اینستاگرام" variant="icon" />
 */
export function BackButton({
  href,
  label,
  icon: Icon,
  variant = 'label',
  className,
}: {
  href: string
  label: string
  /** Optional glyph instead of the chevron. */
  icon?: LucideIcon
  variant?: 'label' | 'icon'
  className?: string
}) {
  const router = useRouter()
  const fa = useLocale() !== 'en'

  function handleBack() {
    // `idx` is the Next.js App Router history index. idx > 0 means this page
    // was reached through an in-app navigation, so a real `back()` restores
    // the previous page (and its scroll position). Direct loads / deep links
    // have no in-app history to return to — push the fallback href instead.
    const idx = window.history.state?.idx
    if (typeof idx === 'number' && idx > 0) {
      router.back()
    } else {
      router.push(href)
    }
  }

  const Glyph = Icon ?? ChevronLeft
  const iconOnly = variant === 'icon'

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label={iconOnly ? (fa ? `بازگشت به ${label}` : `Back to ${label}`) : undefined}
      title={iconOnly ? label : undefined}
      className={cn(
        'group/back inline-flex shrink-0 items-center rounded-full text-[13px] font-semibold text-[var(--text-secondary)]',
        'transition-colors duration-150 hover:text-[var(--text-primary)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)]',
        'active:scale-[0.96] motion-reduce:active:scale-100',
        iconOnly ? 'h-10 w-10 justify-center' : 'min-h-10 gap-2 pe-2',
        className,
      )}
    >
      <span
        className={cn(
          'grid shrink-0 place-items-center rounded-full border border-black/[0.08] bg-white text-[var(--text-primary)]',
          'shadow-[var(--elev-1)]',
          'transition-[background-color,border-color,color,box-shadow] duration-150',
          'group-hover/back:border-[var(--text-primary)] group-hover/back:bg-[var(--text-primary)] group-hover/back:text-white',
          iconOnly ? 'h-10 w-10' : 'h-8 w-8',
        )}
      >
        <Glyph
          aria-hidden="true"
          className={cn(
            'shrink-0 transition-transform duration-150 rtl:rotate-180',
            iconOnly ? 'h-[1.15rem] w-[1.15rem]' : 'h-4 w-4',
            'ltr:group-hover/back:-translate-x-0.5 rtl:group-hover/back:translate-x-0.5',
          )}
        />
      </span>
      {!iconOnly && <span className="max-w-[14rem] truncate">{label}</span>}
    </button>
  )
}
