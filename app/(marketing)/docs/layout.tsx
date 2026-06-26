import type { ReactNode } from 'react'
import { DocsSidebar } from '@/components/docs/docs-sidebar'

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-black pb-24 pt-28">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 md:grid-cols-[220px_1fr]">
        <aside className="h-max md:sticky md:top-28">
          <div className="mb-4 px-3 font-mono text-xs uppercase tracking-widest text-white/30">
            Docs
          </div>
          <DocsSidebar />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  )
}
