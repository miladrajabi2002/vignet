import Link from 'next/link'
import { ChevronLeft, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Unified "back" navigation button — Apple ChatGPT iOS inspired.
 *
 * Design language:
 *  - Capsule / pill shape (rounded-full) matching the iOS back chevron affordance.
 *  - Frosted-glass surface: semi-transparent white + backdrop-blur, so it floats
 *    calmly over the spatial canvas without competing with content cards.
 *  - A single chevron (not a full arrow) + the destination label, exactly like
 *    the iOS ChatGPT back control which shows ‹ + previous-screen title.
 *  - RTL-aware: the chevron auto-flips to point right (the "back" direction
 *    in Persian / RTL layouts) via `rtl:rotate-180`.
 *  - Tactile micro-interactions: hover lifts the surface + darkens text; active
 *    scales down 2.5% (matches the existing `.spatial-press` feel).
 *
 * Usage (drop-in replacement for the old bare `<Link>` back buttons):
 *
 *   <BackButton href="/agents" label={t('title')} />
 *   <BackButton href="/products" label="محصولات" icon={Package} />
 *
 * The component is intentionally a server component (no 'use client') — it's
 * a pure styled <Link> with no hooks, so it works everywhere.
 */
export function BackButton({
  href,
  label,
  icon: Icon,
  className,
}: {
  href: string
  label: string
  /** Optional leading icon (defaults to a chevron, iOS-style). */
  icon?: LucideIcon
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group/back inline-flex items-center gap-1.5 rounded-full',
        'border border-black/[0.06] bg-white/70 backdrop-blur-xl',
        'px-3.5 py-2 text-[13px] font-medium text-[var(--text-secondary)]',
        'shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
        'transition-all duration-150 ease-out',
        'hover:bg-white hover:text-[var(--text-primary)]',
        'hover:shadow-[0_4px_14px_-6px_rgba(0,0,0,0.12)]',
        'hover:border-black/[0.10]',
        'active:scale-[0.975]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)]/20 focus-visible:ring-offset-1',
        'motion-reduce:transition-none motion-reduce:active:scale-100',
        className,
      )}
    >
      {Icon ? (
        <Icon className="h-3.5 w-3.5 shrink-0 transition-transform duration-150 rtl:rotate-180 rtl:group-hover/back:-translate-x-0.5 group-hover/back:-translate-x-0.5" />
      ) : (
        <ChevronLeft className="h-4 w-4 shrink-0 transition-transform duration-150 rtl:rotate-180 rtl:group-hover/back:translate-x-0.5 group-hover/back:-translate-x-0.5" />
      )}
      <span className="max-w-[12rem] truncate">{label}</span>
    </Link>
  )
}
