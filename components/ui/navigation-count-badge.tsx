import { cn } from '@/lib/utils'

export function NavigationCountBadge({
  count,
  active = false,
  locale = 'fa-IR',
  label,
  className,
}: {
  count: number
  active?: boolean
  locale?: string
  label?: string
  className?: string
}) {
  if (count <= 0) return null

  const formatter = new Intl.NumberFormat(locale)
  const displayCount = count > 99 ? `${formatter.format(99)}+` : formatter.format(count)

  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none tabular-nums ring-1 ring-inset',
        active
          ? 'bg-white text-black ring-white'
          : 'bg-black text-white ring-black',
        className,
      )}
    >
      {label && <span className="sr-only">{label}: </span>}
      {displayCount}
    </span>
  )
}
