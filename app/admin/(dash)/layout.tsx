import { ShieldCheck, LogOut } from 'lucide-react'
import { requireAdmin } from '@/lib/admin/auth'
import { adminLogout } from '../login/actions'
import { AdminNavContent, BrandHeader } from './admin-nav'
import { MobileNavTrigger } from './mobile-nav'

export const metadata = { title: 'پنل مدیریت — ویجنت' }
export const dynamic = 'force-dynamic'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Standalone admin guard — separate from the OTP/next-auth user session.
  requireAdmin()

  return (
    <div dir="rtl" className="min-h-screen bg-zinc-50 font-fa text-zinc-900">
      <MobileNavTrigger />
      <div className="mx-auto flex max-w-[1400px] gap-6 px-4 py-6 md:px-6">
        {/* Desktop sidebar */}
        <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-64 shrink-0 flex-col rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:flex">
          <div className="px-1 pb-5">
            <BrandHeader />
          </div>
          <div className="flex-1 overflow-y-auto">
            <AdminNavContent />
          </div>
          <div className="mt-3 border-t border-zinc-100 pt-3">
            <div className="flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2 text-[11px] text-zinc-500">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              دسترسی مدیر سیستم
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1">
          {/* Top-left logout (desktop) — in RTL, justify-end = left side */}
          <div className="mb-4 hidden items-center justify-end md:flex">
            <form action={adminLogout}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-600 shadow-sm transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              >
                <LogOut className="h-4 w-4" />
                خروج
              </button>
            </form>
          </div>
          {children}
        </main>
      </div>
    </div>
  )
}
