'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The assistant's shortcut, in the header slot the user dashboard gives its
 * plan card. It is the console's one filled block — the only place the accent
 * appears at full strength — so it is not repeated in the rail or the sheet.
 */
export function VigentoCard({ compact = false }: { compact?: boolean }) {
  const active = usePathname().startsWith('/admin/vigento')
  return (
    <Link
      href="/admin/vigento"
      aria-current={active ? 'page' : undefined}
      aria-label="Vigento AI؛ مدیریت هوشمند پلتفرم"
      className={cn(
        'spatial-press group flex min-w-0 items-center bg-[var(--signal)] text-white shadow-[var(--shadow-control)] outline-none transition-colors duration-200 hover:bg-[var(--signal-strong)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2',
        compact
          ? 'h-12 w-full max-w-[17rem] gap-2 rounded-control px-1.5 pe-2.5'
          : 'h-14 w-[15rem] gap-2.5 rounded-card px-3 xl:h-[4.25rem] xl:w-[17rem] xl:px-3.5',
        active && 'ring-2 ring-[var(--signal)] ring-offset-2',
      )}
    >
      <span className={cn('grid shrink-0 place-items-center rounded-full bg-white/15', compact ? 'h-9 w-9' : 'h-10 w-10 xl:h-12 xl:w-12')}>
        <Sparkles aria-hidden="true" className={cn('stroke-[1.9]', compact ? 'h-4 w-4' : 'h-[1.1rem] w-[1.1rem] xl:h-5 xl:w-5')} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate font-bold', compact ? 'text-[12px] leading-4' : 'text-[13px] leading-4 xl:text-[15px] xl:leading-5')}>
          Vigento AI
        </span>
        <span className={cn('block truncate text-[12px] leading-4 text-white/75', compact ? 'mt-0.5' : 'mt-1')}>مدیریت هوشمند پلتفرم</span>
      </span>
      <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-white/70 transition-transform duration-200 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
    </Link>
  )
}
