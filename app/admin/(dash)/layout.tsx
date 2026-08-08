import Link from 'next/link'
import { ExternalLink, LogOut, ShieldCheck } from 'lucide-react'
import { ADMIN_OWNER_NAME, requireAdmin } from '@/lib/admin/auth'
import { adminLogout } from '../login/actions'
import { AdminNavContent, BrandHeader } from './admin-nav'
import { MobileNavTrigger } from './mobile-nav'
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
        <aside className="spatial-surface sticky top-3 m-3 me-0 hidden h-[calc(100dvh-1.5rem)] w-[17rem] shrink-0 flex-col overflow-hidden rounded-[1.75rem] p-3 md:flex">
          <div className="pb-3">
            <BrandHeader />
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <AdminNavContent mailUnreadCount={mailUnreadCount} />
          </div>
          <div className="mt-2 border-t border-[var(--border-default)] pt-2">
            <div className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-[11px] text-black/45">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40 motion-reduce:animate-none" /><span className="relative h-2 w-2 rounded-full bg-emerald-500" /></span>
              <span className="min-w-0 flex-1"><b className="block truncate text-xs text-black">{ADMIN_OWNER_NAME} · مالک پلتفرم</b><span className="mt-0.5 block truncate">دسترسی امن و ثبت‌شونده</span></span>
              <ShieldCheck className="h-4 w-4 text-emerald-600/70" />
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 px-3 pt-3 sm:px-6 lg:px-8 xl:px-10">
          <div className="flex min-h-16 items-center justify-between gap-2 rounded-[1.35rem] border border-black/[0.07] bg-white/72 px-2 shadow-[0_8px_28px_rgba(0,0,0,0.055)] backdrop-blur-xl transition-[background-color,box-shadow] duration-200 supports-[backdrop-filter:none]:bg-white/90 sm:px-3.5">
            <div className="flex min-w-0 items-center gap-3.5">
              <MobileNavTrigger mailUnreadCount={mailUnreadCount} />
              <div className="hidden min-w-0 sm:block"><p className="truncate text-sm font-bold leading-5 text-black">مرکز کنترل ویجنت</p><p className="mt-1 flex items-center gap-1.5 text-[11px] leading-4 text-[var(--text-muted)]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> سامانه زنده · {ADMIN_OWNER_NAME}</p></div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/" aria-label="مشاهده سایت" title="مشاهده سایت" className="spatial-press inline-flex h-10 items-center gap-2 rounded-xl px-3 text-[11px] font-semibold text-black/55 hover:bg-black/[0.045] hover:text-black"><ExternalLink className="h-4 w-4" /><span className="hidden sm:inline">مشاهده سایت</span></Link>
              <form action={adminLogout}>
              <button
                type="submit"
                aria-label="خروج از پنل مدیریت"
                title="خروج"
                className="spatial-press inline-flex h-10 w-10 items-center justify-center rounded-xl text-black/45 hover:bg-black/[0.045] hover:text-black"
              >
                <LogOut className="h-[1.05rem] w-[1.05rem] rtl:rotate-180" />
              </button>
            </form>
            </div>
          </div>
          </header>

          <main className="flex-1 px-4 pb-24 pt-4 sm:px-6 sm:pt-5 md:pb-10 lg:px-8 xl:px-10">
            <div className="dashboard-main mx-auto w-full md:w-[calc(100%_-_1.5rem)] xl:w-[calc(100%_-_3rem)]">{children}</div>
          </main>
        </div>
    </div>
    </ScopedIntlProvider>
  )
}
