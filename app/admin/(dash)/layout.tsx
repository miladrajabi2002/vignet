import Link from 'next/link'
import { Home, LogOut, ShieldCheck } from 'lucide-react'
import { ADMIN_OWNER_NAME, requireAdmin } from '@/lib/admin/auth'
import { adminLogout } from '../login/actions'
import { AdminNavContent, BrandHeader } from './admin-nav'
import { MobileNavTrigger } from './mobile-nav'

export const metadata = { title: 'پنل مالک | Vigento AI — ویجنت' }
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Standalone admin guard — separate from the OTP/next-auth user session.
  await requireAdmin()

  return (
    <div dir="rtl" className="admin-root min-h-dvh bg-[var(--bg-base)] font-fa text-[var(--text-primary)]">
      <MobileNavTrigger />
      <div className="mx-auto flex max-w-[1600px] gap-4 px-3 py-3 sm:px-4 md:gap-5 md:px-5 md:py-5">
        {/* Desktop sidebar */}
        <aside className="spatial-surface sticky top-5 hidden h-[calc(100dvh-2.5rem)] w-[15.5rem] shrink-0 flex-col rounded-[1.65rem] p-3.5 md:flex">
          <div className="px-1 pb-3 pt-1">
            <BrandHeader />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pe-0.5">
            <AdminNavContent />
          </div>
          <div className="mt-2 border-t border-black/[0.06] pt-3">
            <div className="flex items-center gap-2 rounded-xl bg-[#f4f4f2] px-3 py-2.5 text-[10px] text-black/45">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40 motion-reduce:animate-none" /><span className="relative h-2 w-2 rounded-full bg-emerald-500" /></span>
              <span className="min-w-0 flex-1"><b className="block truncate text-[11px] text-black/75">{ADMIN_OWNER_NAME} · مالک پلتفرم</b><span className="mt-0.5 block truncate">دسترسی امن و ثبت‌شونده</span></span>
              <ShieldCheck className="h-4 w-4 text-black/50" />
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 pb-8">
          <div className="spatial-control sticky top-3 z-20 mb-5 hidden min-h-[4.25rem] items-center justify-between rounded-2xl px-4 md:flex">
            <div><p className="text-sm font-bold text-black">سلام {ADMIN_OWNER_NAME}</p><p className="mt-1 flex items-center gap-1.5 text-[10px] text-black/45"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> مرکز عملیات Vigento AI</p></div>
            <div className="flex items-center gap-2">
              <Link href="/" className="admin-toolbar-button"><Home className="h-4 w-4" /> خانه سایت</Link>
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
          <div className="mx-auto w-full max-w-[84rem]">{children}</div>
        </main>
      </div>
    </div>
  )
}
