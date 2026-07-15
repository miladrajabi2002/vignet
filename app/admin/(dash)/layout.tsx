import Link from 'next/link'
import { ExternalLink, LogOut, ShieldCheck } from 'lucide-react'
import { ADMIN_OWNER_NAME, requireAdmin } from '@/lib/admin/auth'
import { adminLogout } from '../login/actions'
import { AdminNavContent, BrandHeader } from './admin-nav'
import { MobileNavTrigger } from './mobile-nav'

export const metadata = {
  title: 'پنل مالک | Vigent',
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
}
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Standalone admin guard — separate from the OTP/next-auth user session.
  await requireAdmin()

  return (
    <div dir="rtl" className="admin-root dashboard-canvas min-h-dvh bg-[var(--bg-base)] font-fa text-[var(--text-primary)]">
      <MobileNavTrigger />
      <div className="mx-auto flex max-w-[1720px] gap-4 px-3 py-3 sm:px-4 md:gap-5 md:px-5 md:py-5">
        {/* Desktop sidebar */}
        <aside className="spatial-surface sticky top-5 hidden h-[calc(100dvh-2.5rem)] w-[16.5rem] shrink-0 flex-col overflow-hidden rounded-[1.75rem] p-3.5 md:flex">
          <div className="px-1 pb-2 pt-0.5">
            <BrandHeader />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pe-0.5">
            <AdminNavContent />
          </div>
          <div className="mt-1 border-t border-black/[0.06] pt-2">
            <div className="flex items-center gap-2 rounded-xl bg-black/[0.035] px-3 py-2 text-[11px] text-black/45">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40 motion-reduce:animate-none" /><span className="relative h-2 w-2 rounded-full bg-emerald-500" /></span>
              <span className="min-w-0 flex-1"><b className="block truncate text-xs text-black">{ADMIN_OWNER_NAME} · مالک پلتفرم</b><span className="mt-0.5 block truncate">دسترسی امن و ثبت‌شونده</span></span>
              <ShieldCheck className="h-4 w-4 text-emerald-600/70" />
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 pb-8">
          <div className="sticky top-3 z-20 mb-4 hidden min-h-16 items-center justify-between rounded-[1.35rem] border border-black/[0.07] bg-white/72 px-3.5 shadow-[0_8px_28px_rgba(0,0,0,0.055)] backdrop-blur-xl transition-[background-color,box-shadow] duration-200 supports-[backdrop-filter:none]:bg-white/90 md:flex">
            <div><p className="text-sm font-black text-black">مرکز کنترل ویجنت</p><p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium text-[var(--text-muted)]"><span className="h-1.5 w-1.5 rounded-full bg-black" /> سامانه زنده · {ADMIN_OWNER_NAME}</p></div>
            <div className="flex items-center gap-2">
              <Link href="/" aria-label="مشاهده سایت" title="مشاهده سایت" className="spatial-press inline-flex h-10 items-center gap-2 rounded-xl px-3 text-[11px] font-semibold text-black/55 hover:bg-black/[0.045] hover:text-black"><ExternalLink className="h-4 w-4" /><span>مشاهده سایت</span></Link>
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
          <div className="mx-auto w-full max-w-[92rem]">{children}</div>
        </main>
      </div>
    </div>
  )
}
