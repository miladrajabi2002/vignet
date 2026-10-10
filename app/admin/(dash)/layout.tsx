import { ADMIN_OWNER_NAME, requireAdmin } from '@/lib/admin/auth'
import { AdminRail } from './admin-nav'
import { AdminHeader } from './admin-header'
import { AdminMobileNav } from './mobile-nav'
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
          <AdminHeader ownerName={ADMIN_OWNER_NAME} mailUnreadCount={mailUnreadCount} />

          <main id="admin-main" tabIndex={-1} className="dashboard-shell-content flex-1 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4 sm:pt-5 md:pb-10 focus:outline-none">
            <div className="dashboard-main">{children}</div>
          </main>
        </div>
        <AdminMobileNav mailUnreadCount={mailUnreadCount} />
    </div>
    </ScopedIntlProvider>
  )
}
