import Link from 'next/link'
import { ChevronRight, ExternalLink, LogOut, Mail, ShieldAlert, ShieldCheck, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { adminLogout } from '../login/actions'

const nf = new Intl.NumberFormat('fa-IR')

// Same square as the user header's support/bell/logout buttons.
const ICON_BUTTON =
  'spatial-press relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-card border border-black/[0.07] bg-white/80 text-[var(--text-muted)] shadow-[var(--elev-1)] transition-colors hover:border-black/[0.12] hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 xl:h-14 xl:w-14'

type Pulse = { errors24h: number; newUsersToday: number }

/** Shield inside a full ring: iris while the platform is quiet, red when errors land. */
function PulseBadge({ compact = false, alert }: { compact?: boolean; alert: boolean }) {
  const Icon = alert ? ShieldAlert : ShieldCheck
  return (
    <span className={cn('relative grid shrink-0 place-items-center', compact ? 'h-9 w-9' : 'h-10 w-10 xl:h-12 xl:w-12')}>
      <svg aria-hidden="true" viewBox="0 0 44 44" className="absolute inset-0 h-full w-full">
        <circle cx="22" cy="22" r="19" fill="none" strokeWidth="2.5" className={alert ? 'stroke-red-500' : 'stroke-[var(--signal)]'} />
      </svg>
      <span
        className={cn(
          'grid place-items-center rounded-full border shadow-[var(--shadow-xs)]',
          compact ? 'h-7 w-7' : 'h-8 w-8 xl:h-9 xl:w-9',
          alert ? 'border-red-200 bg-red-50 text-red-700' : 'border-[var(--signal-border)] bg-[var(--signal-soft)] text-[var(--signal-strong)]',
        )}
      >
        <Icon aria-hidden="true" className={cn('stroke-[1.9]', compact ? 'h-3.5 w-3.5' : 'h-4 w-4 xl:h-[1.05rem] xl:w-[1.05rem]')} />
      </span>
    </span>
  )
}

/**
 * The admin counterpart of the user header's plan card: one glance at
 * platform health, and a tap through to the health page.
 */
function PulseCard({ compact = false, pulse }: { compact?: boolean; pulse: Pulse }) {
  const alert = pulse.errors24h > 0
  const status = alert ? 'نیازمند بررسی' : 'پایدار'
  const detail = `${alert ? `${nf.format(pulse.errors24h)} خطا در ۲۴ ساعت` : 'بدون خطا در ۲۴ ساعت'}، ${nf.format(pulse.newUsersToday)} کاربر جدید امروز`
  return (
    <Link
      href="/admin/system"
      aria-label={`سلامت سامانه: ${status}؛ ${detail}`}
      className={cn(
        'spatial-press group flex min-w-0 items-center border border-black/[0.08] bg-white/90 text-[var(--text-primary)] shadow-[var(--elev-1)] outline-none transition-[border-color,box-shadow] duration-200 hover:border-black/[0.15] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2',
        compact
          ? 'h-12 w-full max-w-[17rem] gap-2 rounded-control px-1.5 pe-2.5'
          : 'h-14 w-[15rem] gap-2.5 rounded-card px-3 xl:h-[4.25rem] xl:w-[17rem] xl:px-3.5',
      )}
    >
      <PulseBadge compact={compact} alert={alert} />
      <span className="min-w-0 flex-1">
        <span className={cn('flex min-w-0 items-center font-bold', compact ? 'text-[12px] leading-4' : 'text-[13px] leading-4 xl:text-[15px] xl:leading-5')}>
          <span className="truncate">سلامت سامانه</span>
          <span className="ms-1.5 inline-flex shrink-0 items-center gap-1">
            <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', alert ? 'bg-red-500' : 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.09)]')} />
            <span className={cn('text-[12px] font-medium', alert ? 'text-red-600' : 'text-emerald-700')}>{status}</span>
          </span>
        </span>
        <span className={cn('block truncate text-[12px] leading-4 text-[var(--text-muted)]', compact ? 'mt-0.5' : 'mt-1')}>{detail}</span>
      </span>
      {!compact && (
        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--text-secondary)] transition-transform duration-200 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
      )}
    </Link>
  )
}

/**
 * Admin header — the user dashboard's header in structure and size (greeting
 * at the start, a status card and square shortcuts at the end), so moving
 * between the two panels feels like one product.
 */
export function AdminHeader({ ownerName, mailUnreadCount, pulse }: { ownerName: string; mailUnreadCount: number; pulse: Pulse }) {
  return (
    <header className="dashboard-shell-header sticky top-0 z-30 [padding-top:max(0.75rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex min-h-[4.5rem] max-w-[112rem] items-center justify-between gap-2 rounded-card border border-black/[0.07] bg-white/[0.76] px-3 shadow-[var(--elev-1)] backdrop-blur-xl supports-[backdrop-filter:none]:bg-white/[0.92] sm:gap-3 sm:px-4 xl:min-h-[5.5rem] xl:rounded-sheet xl:px-5">
        <div className="flex min-w-0 flex-1 items-center">
          {/* Phones: the status card takes the start slot and the free width. */}
          <div className="min-w-0 flex-1 sm:hidden">
            <PulseCard compact pulse={pulse} />
          </div>
          <div className="hidden min-w-0 sm:block">
            <p className="flex min-w-0 items-center gap-2 text-sm font-bold leading-5 text-[var(--text-primary)] xl:text-[15px] xl:leading-6">
              <span className="truncate">سلام، {ownerName}</span>
              <span className="shrink-0 rounded-full bg-[var(--signal-soft)] px-2 text-[12px] font-bold leading-5 text-[var(--signal-strong)]">مالک</span>
            </p>
            <p className="mt-1 flex items-center gap-2 text-[12px] leading-4 text-[var(--text-muted)] xl:mt-1.5 xl:text-xs">
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.08)]" />
              <span className="truncate">پنل مدیریت پلتفرم · مرکز کنترل ویجنت</span>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-1.5 xl:gap-2.5">
          <div className="hidden sm:block">
            <PulseCard pulse={pulse} />
          </div>
          <Link href="/" target="_blank" rel="noreferrer" aria-label="مشاهده سایت" title="مشاهده سایت" className={cn(ICON_BUTTON, 'hidden lg:inline-flex')}>
            <ExternalLink aria-hidden="true" className="h-[1.05rem] w-[1.05rem]" />
          </Link>
          <Link
            href="/admin/mail"
            aria-label={mailUnreadCount > 0 ? `صندوق ایمیل، ${nf.format(mailUnreadCount)} خوانده‌نشده` : 'صندوق ایمیل'}
            title="صندوق ایمیل"
            className={ICON_BUTTON}
          >
            <Mail aria-hidden="true" className="h-[1.05rem] w-[1.05rem]" />
            {mailUnreadCount > 0 && (
              <span aria-hidden="true" className="absolute -end-1.5 -top-1.5 flex h-[1.2rem] min-w-[1.2rem] items-center justify-center rounded-full bg-[var(--notif)] px-1 text-[12px] font-bold tabular-nums text-[var(--notif-ink)] shadow-sm ring-2 ring-white">
                {nf.format(Math.min(mailUnreadCount, 99))}
              </span>
            )}
          </Link>
          {/* The owner reaches /admin from the user dashboard; this is the way back. */}
          <Link href="/overview" aria-label="بازگشت به پنل کاربر" title="پنل کاربر" className={ICON_BUTTON}>
            <UserRound aria-hidden="true" className="h-[1.05rem] w-[1.05rem]" />
          </Link>
          <form action={adminLogout} className="hidden sm:block">
            <button type="submit" aria-label="خروج از پنل مدیریت" title="خروج" className={ICON_BUTTON}>
              <LogOut aria-hidden="true" className="h-[1.05rem] w-[1.05rem] rtl:rotate-180" />
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
