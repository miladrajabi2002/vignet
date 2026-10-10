import Link from 'next/link'
import { ExternalLink, LogOut, Mail, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { adminLogout } from '../login/actions'
import { VigentoCard } from './vigento-card'

const nf = new Intl.NumberFormat('fa-IR')

// Same square as the user header's support/bell/logout buttons.
const ICON_BUTTON =
  'spatial-press relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-card border border-black/[0.07] bg-white/80 text-[var(--text-muted)] shadow-[var(--elev-1)] transition-colors hover:border-black/[0.12] hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 xl:h-14 xl:w-14'

/**
 * Admin header — the user dashboard's header in structure and size (greeting
 * at the start, the assistant's card and square shortcuts at the end), so moving
 * between the two panels feels like one product.
 */
export function AdminHeader({ ownerName, mailUnreadCount }: { ownerName: string; mailUnreadCount: number }) {
  return (
    <header className="dashboard-shell-header sticky top-0 z-30 [padding-top:max(0.75rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex min-h-[4.5rem] max-w-[112rem] items-center justify-between gap-2 rounded-card border border-black/[0.07] bg-white/[0.76] px-3 shadow-[var(--elev-1)] backdrop-blur-xl supports-[backdrop-filter:none]:bg-white/[0.92] sm:gap-3 sm:px-4 xl:min-h-[5.5rem] xl:rounded-sheet xl:px-5">
        <div className="flex min-w-0 flex-1 items-center">
          {/* Phones: the assistant's card takes the start slot and the free width. */}
          <div className="min-w-0 flex-1 sm:hidden">
            <VigentoCard compact />
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
            <VigentoCard />
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
