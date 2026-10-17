'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ADMIN_NAV_ITEMS, isAdminNavActive } from './nav-items'

/**
 * The assistant's shortcut. It is a header control like its neighbours — same
 * height, a hairline border — and the accent marks it only as tint and text,
 * so each page's own primary action stays the strongest thing on screen.
 * On phones it shrinks to the icon square beside the other shortcuts.
 */
export function VigentoCard({ compact = false }: { compact?: boolean }) {
  const active = usePathname().startsWith('/admin/vigento')
  return (
    <Link
      href="/admin/vigento"
      aria-current={active ? 'page' : undefined}
      aria-label="Vigento AI؛ مدیریت هوشمند پلتفرم"
      title="Vigento AI"
      className={cn(
        'spatial-press inline-flex shrink-0 items-center justify-center rounded-card border font-bold outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2',
        active
          ? 'border-[var(--signal)] bg-[var(--signal-soft)] text-[var(--signal-strong)]'
          : 'border-[color-mix(in_srgb,var(--signal)_28%,transparent)] bg-white text-[var(--signal-strong)] hover:bg-[var(--signal-soft)]',
        compact ? 'h-12 w-12' : 'h-12 gap-2 px-4 text-[13px] xl:h-14 xl:px-5 xl:text-sm',
      )}
    >
      <Sparkles aria-hidden="true" className={cn('shrink-0 stroke-[1.9]', compact ? 'h-[1.05rem] w-[1.05rem]' : 'h-4 w-4 xl:h-[1.1rem] xl:w-[1.1rem]')} />
      {!compact && <span dir="ltr">Vigento AI</span>}
    </Link>
  )
}

/** Phones: the header names the open page in the room the old card took. */
export function AdminPageTitle() {
  const pathname = usePathname()
  const current = pathname.startsWith('/admin/vigento')
    ? 'Vigento AI'
    : ADMIN_NAV_ITEMS.find((item) => isAdminNavActive(pathname, item))?.label ?? 'پنل مدیریت'
  return (
    <p className="min-w-0 px-1">
      <span className="block truncate text-[15px] font-bold leading-6 text-[var(--text-primary)]">{current}</span>
      <span className="block truncate text-[12px] leading-4 text-[var(--text-muted)]">پنل مدیریت ویجنت</span>
    </p>
  )
}
