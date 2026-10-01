import type { ReactNode } from 'react'
import { DocsSidebar } from '@/components/docs/docs-sidebar'

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="marketing-page-shell min-h-screen pb-24 pt-24 sm:pt-28">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 px-3 sm:px-5 md:grid-cols-[270px_minmax(0,1fr)] md:gap-6">
        <aside className="sticky top-20 z-30 h-max rounded-card bg-black p-2 text-white shadow-[var(--elev-2)] md:top-24 md:rounded-card md:p-4">
          <div className="mb-3 hidden items-center justify-between px-2 py-1.5 md:flex">
            <div><p className="font-mono text-[12px] uppercase tracking-[0.16em] text-white/40">Vigent Docs</p><p className="mt-1 text-[12px] text-white/65">مرکز راهنمای ویجنت</p></div>
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_5px_rgba(52,211,153,0.12)]" />
          </div>
          <DocsSidebar />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  )
}
