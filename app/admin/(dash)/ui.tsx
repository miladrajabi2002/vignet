import Link from 'next/link'
import { ChevronRight, ChevronLeft } from 'lucide-react'

/** Severity badge for an ErrorLog level. */
export function LevelBadge({ level }: { level: string }) {
  const danger = level === 'error'
  return (
    <span
      className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
        danger ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'
      }`}
    >
      {danger ? 'خطا' : 'هشدار'}
    </span>
  )
}

/** Compact Persian date+time for admin tables. */
export function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat('fa-IR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/** Dark-themed prev/next pagination for the admin area (RTL). */
export function AdminPagination({
  page,
  hasNext,
  makeHref,
}: {
  page: number
  hasNext: boolean
  makeHref: (page: number) => string
}) {
  if (page <= 1 && !hasNext) return null
  return (
    <nav className="flex items-center justify-between gap-3 pt-3">
      <PageBtn href={page > 1 ? makeHref(page - 1) : null} label="قبلی" icon={<ChevronRight className="h-4 w-4" />} />
      <span className="text-xs text-zinc-600">صفحه {page.toLocaleString('fa-IR')}</span>
      <PageBtn href={hasNext ? makeHref(page + 1) : null} label="بعدی" icon={<ChevronLeft className="h-4 w-4" />} after />
    </nav>
  )
}

function PageBtn({
  href,
  label,
  icon,
  after = false,
}: {
  href: string | null
  label: string
  icon: React.ReactNode
  after?: boolean
}) {
  const base =
    'inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm transition-colors'
  if (!href) {
    return (
      <span className={`${base} cursor-not-allowed border-zinc-800 text-zinc-700 opacity-50`}>
        {!after && icon}
        {label}
        {after && icon}
      </span>
    )
  }
  return (
    <Link href={href} className={`${base} border-zinc-800 text-zinc-300 hover:border-zinc-600`}>
      {!after && icon}
      {label}
      {after && icon}
    </Link>
  )
}
