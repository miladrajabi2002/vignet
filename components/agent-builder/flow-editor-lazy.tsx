'use client'

import dynamic from 'next/dynamic'

/**
 * @xyflow/react is heavy and canvas-based (useless during SSR) — load the
 * flow editor lazily so the builder route ships a light initial bundle.
 */
export const FlowEditor = dynamic(
  () => import('./flow-editor').then((m) => m.FlowEditor),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-[560px] w-full animate-pulse rounded-2xl border border-[var(--border-default)] bg-[var(--bg-muted)]"
        aria-hidden="true"
      />
    ),
  },
)
