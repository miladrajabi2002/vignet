import Link from 'next/link'
import { ExternalLink, LogOut, ShieldCheck } from 'lucide-react'
import { ADMIN_OWNER_NAME, requireAdmin } from '@/lib/admin/auth'
import { adminLogout } from '../login/actions'
import { AdminNavContent, BrandHeader } from './admin-nav'
import { MobileNavTrigger } from './mobile-nav'
import { VigentoCommandDock, VigentoCommandTrigger } from '@/components/admin/vigento-command-dock'

export const metadata = {
  title: 'پنل مالک | Vigent',
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
}
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Standalone admin guard — separate from the OTP/next-auth user session.
  await requireAdmin()

  return (
    <div dir="rtl" className="admin-root min-h-dvh bg-[var(--bg-base)] font-fa text-[var(--text-primary)]">
      <MobileNavTrigger />
      <div className="mx-auto flex max-w-[1720px] gap-4 px-3 py-3 sm:px-4 md:gap-5 md:px-5 md:py-5">
        {/* Desktop sidebar */}
        <aside className="admin-command-rail sticky top-5 hidden h-[calc(100dvh-2.5rem)] w-[16.5rem] shrink-0 flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#101113] p-3.5 text-white shadow-[0_32px_90px_-42px_rgba(0,0,0,.85)] md:flex">
          <div className="px-1 pb-3 pt-1">
            <BrandHeader />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pe-0.5">
            <AdminNavContent />
          </div>
          <div className="mt-2 border-t border-white/[0.07] pt-3">
            <div className="flex items-center gap-2 rounded-xl bg-white/[0.055] px-3 py-2.5 text-[11px] text-white/40">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40 motion-reduce:animate-none" /><span className="relative h-2 w-2 rounded-full bg-emerald-500" /></span>
              <span className="min-w-0 flex-1"><b className="block truncate text-xs text-white">{ADMIN_OWNER_NAME} · مالک پلتفرم</b><span className="mt-0.5 block truncate">دسترسی امن و ثبت‌شونده</span></span>
              <ShieldCheck className="h-4 w-4 text-emerald-300/70" />
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 pb-8">
          <div className="spatial-control sticky top-3 z-20 mb-5 hidden min-h-[4.25rem] items-center justify-between rounded-2xl px-4 md:flex">
            <div><p className="text-sm font-black text-black">مرکز کنترل Vigent</p><p className="mt-1 flex items-center gap-1.5 text-[10px] font-medium tracking-wide text-[var(--text-muted)]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> PLATFORM LIVE · {ADMIN_OWNER_NAME}</p></div>
            <div className="flex items-center gap-2">
              <VigentoCommandTrigger className="admin-primary-button min-h-10 text-[11px]" />
              <Link href="/" className="admin-toolbar-button"><ExternalLink className="h-4 w-4" /> مشاهده سایت</Link>
              <form action={adminLogout}>
              <button
                type="submit"
                className="admin-toolbar-button hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              >
                <LogOut className="h-4 w-4" />
                خروج
              </button>
            </form>
            </div>
          </div>
          <div className="mx-auto w-full max-w-[92rem]">{children}</div>
        </main>
      </div>
      <VigentoCommandDock />
    </div>
  )
}
