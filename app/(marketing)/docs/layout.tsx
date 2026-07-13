import type { ReactNode } from 'react'
import { DocsSidebar } from '@/components/docs/docs-sidebar'

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="marketing-page-shell min-h-screen pb-24 pt-24 sm:pt-28">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 px-3 sm:px-5 md:grid-cols-[270px_minmax(0,1fr)] md:gap-6">
        <aside className="h-max overflow-x-auto rounded-[1.5rem] bg-black p-3 text-white shadow-[0_22px_65px_rgba(0,0,0,0.16)] md:sticky md:top-24 md:overflow-visible md:p-4">
          <div className="mb-3 flex items-center justify-between px-2 py-1.5">
            <div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">Vigent Docs</p><p className="mt-1 text-[11px] text-white/65">مرکز راهنمای ویجنت</p></div>
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_5px_rgba(52,211,153,0.12)]" />
          </div>
          <DocsSidebar />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  )
}
