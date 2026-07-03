import Link from 'next/link'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { Sparkline } from '@/components/admin/sparkline'
import { cn } from '@/lib/utils'

// ─── FORMATTERS ───────────────────────────────────────────────────

/** Compact Persian date+time for admin tables. */
export function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat('fa-IR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/** Persian date only (no time). */
export function fmtDay(d: Date): string {
  return new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

/** Persian number formatting. */
export function fa(n: number | bigint | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return Number(n).toLocaleString('fa-IR')
}

/** Format IRR amount as Persian Toman with separator. */
export function fmtIRR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return `${amount.toLocaleString('fa-IR')} تومان`
}

/** Format USD amount. */
export function fmtUSD(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return `$${amount.toLocaleString('en-US')}`
}

/** Relative "x ago" in Persian. */
export function fmtAgo(d: Date): string {
  const diff = Date.now() - d.getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'لحظاتی پیش'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min.toLocaleString('fa-IR')} دقیقه پیش`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr.toLocaleString('fa-IR')} ساعت پیش`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day.toLocaleString('fa-IR')} روز پیش`
  return fmtDay(d)
}

// ─── CARD ─────────────────────────────────────────────────────────

/** The universal surface container — white card with subtle border + shadow. */
export function Card({
  children,
  className,
  pad = true,
}: {
  children: React.ReactNode
  className?: string
  pad?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-zinc-200 bg-white shadow-sm',
        pad && 'p-5',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Card with a titled header row. */
export function Panel({
  title,
  subtitle,
  href,
  linkLabel,
  action,
  children,
  className,
}: {
  title: string
  subtitle?: string
  href?: string
  linkLabel?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
        </div>
        {href && linkLabel ? (
          <Link
            href={href}
            className="shrink-0 text-xs font-medium text-zinc-900 underline-offset-4 hover:underline"
          >
            {linkLabel}
          </Link>
        ) : action ? (
          action
        ) : null}
      </div>
      {children}
    </Card>
  )
}

// ─── STAT CARD ────────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = 'default',
  trend,
  series,
}: {
  label: string
  value: string | number
  sub?: string
  icon?: React.ReactNode
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  trend?: { value: number; label?: string } // percentage, +/-
  series?: number[] // 7-day (or similar) daily values for an inline sparkline
}) {
  const toneRing = {
    default: 'bg-zinc-100 text-zinc-700',
    success: 'bg-emerald-50 text-emerald-600',
    warning: 'bg-amber-50 text-amber-600',
    danger: 'bg-red-50 text-red-600',
    info: 'bg-blue-50 text-blue-600',
  }[tone]

  const valueColor =
    tone === 'danger'
      ? 'text-red-600'
      : tone === 'success'
        ? 'text-emerald-600'
        : 'text-zinc-900'

  // Sparkline stroke color follows the card tone.
  const sparkColor =
    tone === 'danger'
      ? '#ef4444'
      : tone === 'success'
        ? '#22c55e'
        : tone === 'info'
          ? '#3b82f6'
          : tone === 'warning'
            ? '#f59e0b'
            : '#18181b'

  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-500">{label}</p>
          <p className={cn('mt-2 text-3xl font-semibold tracking-tight', valueColor)}>
            {typeof value === 'number' ? fa(value) : value}
          </p>
          {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
        </div>
        {icon && (
          <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', toneRing)}>
            {icon}
          </span>
        )}
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
              trend.value >= 0
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-red-50 text-red-600',
            )}
          >
            {trend.value >= 0 ? '▲' : '▼'} {Math.abs(trend.value).toLocaleString('fa-IR')}٪
          </span>
          {trend.label && <span className="text-[11px] text-zinc-400">{trend.label}</span>}
        </div>
      )}
      {series && series.length > 0 && (
        <div className="mt-3">
          <Sparkline data={series} color={sparkColor} width={200} height={32} fluid />
        </div>
      )}
    </Card>
  )
}

// ─── BADGES ───────────────────────────────────────────────────────

type BadgeTone = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted'

const BADGE_TONES: Record<BadgeTone, string> = {
  default: 'bg-zinc-900 text-white',
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  info: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  muted: 'bg-zinc-100 text-zinc-600',
}

export function Badge({
  children,
  tone = 'default',
  className,
}: {
  children: React.ReactNode
  tone?: BadgeTone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Severity badge for an ErrorLog level. */
export function LevelBadge({ level }: { level: string }) {
  return level === 'error' ? (
    <Badge tone="danger">خطا</Badge>
  ) : (
    <Badge tone="warning">هشدار</Badge>
  )
}

/** Status dot + label pill. */
export function StatusDot({ tone = 'success', label }: { tone?: BadgeTone; label?: string }) {
  const dot = {
    default: 'bg-zinc-400',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    info: 'bg-blue-500',
    muted: 'bg-zinc-300',
  }[tone]
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-600">
      <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
      {label}
    </span>
  )
}

// ─── TABLE HELPERS ────────────────────────────────────────────────

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'whitespace-nowrap px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-zinc-500',
        className,
      )}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  className,
}: {
  children?: React.ReactNode
  className?: string
}) {
  return <td className={cn('px-4 py-3 text-sm text-zinc-700', className)}>{children}</td>
}

export function TableShell({
  children,
  minWidth = 640,
}: {
  children: React.ReactNode
  minWidth?: number
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <table className="w-full" style={{ minWidth }}>
        {children}
      </table>
    </div>
  )
}

// ─── EMPTY STATE ──────────────────────────────────────────────────

export function EmptyState({
  children,
  icon,
  className,
}: {
  children: React.ReactNode
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-300 py-16 text-center',
        className,
      )}
    >
      {icon && <div className="text-zinc-300">{icon}</div>}
      <p className="text-sm text-zinc-500">{children}</p>
    </div>
  )
}

// ─── PAGE HEADER ──────────────────────────────────────────────────

export function PageHeader({
  title,
  subtitle,
  action,
  breadcrumbs,
}: {
  title: string
  subtitle?: React.ReactNode
  action?: React.ReactNode
  breadcrumbs?: { label: string; href?: string }[]
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="mb-1.5 flex items-center gap-1 text-xs text-zinc-400">
            {breadcrumbs.map((b, i) => (
              <span key={i} className="flex items-center gap-1">
                {b.href ? (
                  <Link href={b.href} className="hover:text-zinc-700">
                    {b.label}
                  </Link>
                ) : (
                  <span className="text-zinc-600">{b.label}</span>
                )}
                {i < breadcrumbs.length - 1 && <span className="text-zinc-300">/</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  )
}

// ─── PROGRESS BAR ─────────────────────────────────────────────────

export function Progress({
  value,
  max = 100,
  tone = 'default',
  className,
}: {
  value: number
  max?: number
  tone?: 'default' | 'success' | 'warning' | 'danger'
  className?: string
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const bar = {
    default: 'bg-zinc-900',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
  }[tone]
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-zinc-100', className)}>
      <div className={cn('h-full rounded-full transition-all', bar)} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ─── KEY/VALUE ROW ────────────────────────────────────────────────

export function KV({
  label,
  children,
  mono,
}: {
  label: string
  children: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className={cn('text-sm font-medium text-zinc-900', mono && 'font-mono text-xs')}>
        {children}
      </span>
    </div>
  )
}

// ─── SECTION DIVIDER ──────────────────────────────────────────────

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {children}
      </span>
      <div className="h-px flex-1 bg-zinc-200" />
    </div>
  )
}

// ─── PAGINATION ───────────────────────────────────────────────────

/** Light-themed prev/next pagination for the admin area (RTL). */
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
    <nav className="flex items-center justify-between gap-3 pt-4">
      <PageBtn
        href={page > 1 ? makeHref(page - 1) : null}
        label="قبلی"
        icon={<ChevronRight className="h-4 w-4" />}
      />
      <span className="text-xs text-zinc-500">صفحه {page.toLocaleString('fa-IR')}</span>
      <PageBtn
        href={hasNext ? makeHref(page + 1) : null}
        label="بعدی"
        icon={<ChevronLeft className="h-4 w-4" />}
        after
      />
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
    'inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium transition-colors'
  if (!href) {
    return (
      <span className={`${base} cursor-not-allowed border-zinc-200 text-zinc-300`}>
        {!after && icon}
        {label}
        {after && icon}
      </span>
    )
  }
  return (
    <Link
      href={href}
      className={`${base} border-zinc-200 text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50`}
    >
      {!after && icon}
      {label}
      {after && icon}
    </Link>
  )
}

// ─── FILTER PILLS ─────────────────────────────────────────────────

export function FilterPills({
  options,
}: {
  options: { label: string; href: string; active: boolean }[]
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1 text-xs">
      {options.map((o) => (
        <Link
          key={o.href}
          href={o.href}
          className={cn(
            'rounded-lg px-3 py-1.5 font-medium transition-colors',
            o.active
              ? 'bg-zinc-900 text-white'
              : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900',
          )}
        >
          {o.label}
        </Link>
      ))}
    </div>
  )
}

// ─── AVATAR (initials) ────────────────────────────────────────────

export function Avatar({ name, size = 40 }: { name?: string | null; size?: number }) {
  const initials = (name ?? '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white"
      style={{ width: size, height: size }}
    >
      {initials || '?'}
    </span>
  )
}
