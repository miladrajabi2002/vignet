import Link from 'next/link'
import { ArrowRight, ExternalLink } from 'lucide-react'
import { ADMIN_OWNER_NAME, requireAdmin } from '@/lib/admin/auth'
import { AdminRail, AdminTag } from './admin-nav'
import { AdminMobileNav } from './mobile-nav'
import { Logo } from '@/components/ui/logo'
import { ScopedIntlProvider } from '@/components/i18n/scoped-intl-provider'
import { ADMIN_CLIENT_MESSAGE_PATHS } from '@/lib/i18n/client-messages'
import { prisma } from '@/lib/prisma'

export const metadata = {
  title: 'پنل مالک | Vigent',
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
}
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Standalone admin guard — separate from the OTP/next-auth user session.
  await requireAdmin()
  const mailUnreadCount = await prisma.adminMailboxMessage.count({ where: { readAt: null } })

  return (
    <ScopedIntlProvider messagePaths={ADMIN_CLIENT_MESSAGE_PATHS}>
    <div dir="rtl" className="admin-root dashboard-canvas flex min-h-dvh bg-[var(--bg-base)] font-fa text-[var(--text-primary)]">
        {/* Keyboard users can jump past the admin sidebar/header chrome. */}
        <a
          href="#admin-main"
          className="sr-only focus:not-sr-only focus:fixed focus:inset-x-0 focus:top-2 focus:z-[80] focus:m-auto focus:block focus:w-fit focus:rounded-xl focus:bg-black focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          پرش به محتوای اصلی
        </a>
        <AdminRail mailUnreadCount={mailUnreadCount} ownerName={ADMIN_OWNER_NAME} />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 px-3 [padding-top:max(0.75rem,env(safe-area-inset-top))] sm:px-6 lg:px-8 xl:px-10">
            <div className="flex min-h-14 items-center justify-between gap-2 rounded-card border border-black/[0.07] bg-white/90 px-2.5 shadow-[var(--elev-1)] backdrop-blur-xl sm:px-3.5">
              {/* Phones have no rail, so the bar itself says which panel this is. */}
              <Link href="/admin" aria-label="داشبورد مدیریت" className="flex min-h-11 min-w-0 items-center gap-2 md:hidden">
                <Logo className="h-6 w-24" />
                <AdminTag />
              </Link>
              <div className="hidden min-w-0 md:block">
                <p className="truncate text-sm font-bold leading-5 text-[var(--text-primary)]">مرکز کنترل ویجنت</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[12px] leading-4 text-[var(--text-muted)]">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="truncate">سامانه زنده · {ADMIN_OWNER_NAME}</span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Link
                  href="/"
                  aria-label="مشاهده سایت"
                  title="مشاهده سایت"
                  className="spatial-press inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-control px-2.5 text-[12px] font-medium text-[var(--text-secondary)] hover:bg-black/[0.045] hover:text-[var(--text-primary)]"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">مشاهده سایت</span>
                </Link>
                {/* The owner reaches /admin from the user dashboard; this is the way back. */}
                <Link
                  href="/overview"
                  className="spatial-press inline-flex h-10 items-center gap-1.5 rounded-control border border-[var(--border-default)] bg-white px-3 text-[12px] font-medium text-[var(--text-primary)] shadow-[var(--shadow-xs)] hover:border-[var(--border-hover)]"
                >
                  <ArrowRight className="h-4 w-4 ltr:rotate-180" aria-hidden="true" />
                  <span className="md:hidden">پنل کاربر</span>
                  <span className="hidden md:inline">بازگشت به داشبورد</span>
                </Link>
              </div>
            </div>
          </header>

          <main id="admin-main" tabIndex={-1} className="flex-1 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pt-5 md:pb-10 lg:px-8 xl:px-10 focus:outline-none">
            <div className="dashboard-main mx-auto w-full md:w-[calc(100%_-_1.5rem)] xl:w-[calc(100%_-_3rem)]">{children}</div>
          </main>
        </div>
        <AdminMobileNav mailUnreadCount={mailUnreadCount} />
    </div>
    </ScopedIntlProvider>
  )
}
