import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  Check,
  CircleDashed,
  GraduationCap,
  Headphones,
  Package,
  QrCode,
  type LucideIcon,
} from 'lucide-react'
import { DashboardPanel } from '@/components/dashboard/panel'
import { capabilityLabel, getCapabilityOption, type CapabilityKey } from '@/lib/verticals/registry'
import type { CapabilityReadinessMap } from '@/lib/verticals/readiness'
import { cn } from '@/lib/utils'

const ICONS: Record<CapabilityKey, LucideIcon> = {
  products: Package,
  bookings: CalendarDays,
  services: BriefcaseBusiness,
  instagram: Camera,
  'digital-menu': QrCode,
  courses: GraduationCap,
  support: Headphones,
}

// Where "open" leads once a capability is ready.
const HOME: Record<CapabilityKey, string> = {
  products: '/products',
  bookings: '/appointments',
  services: '/services',
  instagram: '/instagram',
  'digital-menu': '/menu',
  courses: '/courses',
  support: '/conversations',
}

/**
 * Overview card: every capability the business switched on, whether it can
 * already work (ready) or still misses its first piece of real data, with a
 * direct link to that missing piece.
 */
export function CapabilityStatusPanel({
  capabilities,
  readiness,
  fa,
}: {
  capabilities: readonly CapabilityKey[]
  readiness: CapabilityReadinessMap
  fa: boolean
}) {
  const Arrow = fa ? ArrowLeft : ArrowRight
  const pending = capabilities.filter((key) => readiness[key]?.state === 'setup')
  // Unfinished first: that is what the owner can act on today.
  const ordered = [...pending, ...capabilities.filter((key) => !pending.includes(key))]

  return (
    <DashboardPanel
      title={fa ? 'قابلیت‌های شما' : 'Your capabilities'}
      subtitle={pending.length
        ? (fa ? `${pending.length.toLocaleString('fa-IR')} قابلیت هنوز آماده کار نیست` : `${pending.length} still need setup`)
        : (fa ? 'همه قابلیت‌های روشن آماده کارند' : 'Everything you turned on is ready')}
      action={<Link href="/settings#settings-business-profile" className="ui-link">{fa ? 'مدیریت' : 'Manage'}<Arrow aria-hidden /></Link>}
    >
      {ordered.length ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {ordered.map((key) => {
            const status = readiness[key]
            const Icon = ICONS[key]
            const ready = status?.state === 'ready'
            const done = status?.steps.filter((step) => step.done).length ?? 0
            const total = status?.steps.length ?? 0
            const href = ready || !status?.next ? HOME[key] : status.next.href
            return (
              <li key={key}>
                <Link
                  href={href}
                  className="group flex min-h-[4.25rem] items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2.5 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[var(--accent-border)]"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-xs font-semibold text-[var(--text-primary)]">{capabilityLabel(key, fa ? 'fa' : 'en')}</span>
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[11.5px] font-bold',
                        ready ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700',
                      )}>
                        {ready ? <Check className="h-3 w-3" strokeWidth={3} /> : <CircleDashed className="h-3 w-3" />}
                        {ready ? (fa ? 'آماده' : 'Ready') : (fa ? `${done.toLocaleString('fa-IR')} از ${total.toLocaleString('fa-IR')}` : `${done} of ${total}`)}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-[var(--text-muted)]">
                      {ready || !status?.next
                        ? (fa ? getCapabilityOption(key).descriptionFa : getCapabilityOption(key).descriptionEn)
                        : (fa ? `قدم بعد: ${status.next.fa}` : `Next: ${status.next.en}`)}
                    </span>
                  </span>
                  <Arrow className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" />
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <Link href="/settings#settings-business-profile" className="flex min-h-14 items-center justify-center rounded-xl border border-dashed border-[var(--border-default)] text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--border-strong)]">
          {fa ? 'هنوز قابلیتی روشن نیست؛ از تنظیمات انتخاب کنید' : 'No capability on yet — pick some in settings'}
        </Link>
      )}
    </DashboardPanel>
  )
}
