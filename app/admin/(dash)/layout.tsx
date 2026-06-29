import { requireAdmin } from '@/lib/admin/auth'
import { AdminNav } from './admin-nav'

export const metadata = { title: 'پنل مدیریت — ویجنت' }
export const dynamic = 'force-dynamic'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Standalone admin guard — separate from the OTP/next-auth user session.
  requireAdmin()

  return (
    <div dir="rtl" className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <aside className="sticky top-6 hidden h-fit w-56 shrink-0 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3 md:block">
          <div className="px-3 pb-4 pt-2">
            <span className="text-sm font-medium text-zinc-300">مدیریت ویجنت</span>
          </div>
          <AdminNav />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
