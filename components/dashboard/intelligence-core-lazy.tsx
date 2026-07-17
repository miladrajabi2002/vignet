'use client'

import dynamic from 'next/dynamic'
import type { IntelligenceCoreProps } from './intelligence-core'

const LazyIntelligenceCore = dynamic(
  () => import('./intelligence-core').then((module) => module.IntelligenceCore),
  {
    loading: () => (
      <div className="min-h-[20rem] animate-pulse rounded-[1.75rem] border border-[var(--border-default)] bg-white/80 shadow-[var(--shadow-soft)] motion-reduce:animate-none" aria-hidden="true">
        <div className="m-6 h-4 w-32 rounded-full bg-[var(--bg-muted)]" />
        <div className="mx-auto mt-14 h-24 w-24 rounded-full bg-[var(--bg-muted)]" />
        <div className="mx-auto mt-8 h-3 w-44 rounded-full bg-[var(--bg-muted)]" />
      </div>
    ),
  },
)

export function IntelligenceCoreLazy(props: IntelligenceCoreProps) {
  return <LazyIntelligenceCore {...props} />
}
