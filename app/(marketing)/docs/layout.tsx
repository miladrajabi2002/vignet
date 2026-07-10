import type { ReactNode } from 'react'
import { DocsSidebar } from '@/components/docs/docs-sidebar'

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white pb-24 pt-28 sm:pt-32">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-5 sm:px-8 md:grid-cols-[240px_1fr] md:gap-12">
        <aside className="h-max md:sticky md:top-28">
          <div className="mb-4 px-3 font-mono text-[10px] uppercase tracking-[0.16em] text-black/35">
            Vigent Docs
          </div>
          <DocsSidebar />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  )
}
