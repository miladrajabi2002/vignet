'use client'

import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'

/**
 * Dashboard error boundary.
 *
 * Server components in the dashboard tree (the layout calls `auth()` + Prisma
 * on every navigation) can throw on a transient hiccup — a slow/dropped DB
 * connection or a flaky session decode. Without a boundary, App Router soft
 * navigations (`router.push` / `router.refresh`) render a blank white page that
 * only a manual hard refresh recovers from.
 *
 * Here we auto-retry once (mimicking that manual refresh) and, if it still
 * fails, show a retry button instead of a blank page.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [autoRetrying, setAutoRetrying] = useState(true)
  const retried = useRef(false)

  useEffect(() => {
    console.error('[dashboard] render error:', error)
    if (retried.current) {
      setAutoRetrying(false)
      return
    }
    retried.current = true
    const id = setTimeout(() => reset(), 600)
    return () => clearTimeout(id)
  }, [error, reset])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <RefreshCw
        className={`h-6 w-6 text-[var(--text-muted)] ${autoRetrying ? 'animate-spin' : ''}`}
      />
      {autoRetrying ? (
        <p className="text-sm text-[var(--text-secondary)]">
          در حال بارگذاری دوباره…
        </p>
      ) : (
        <>
          <p className="text-sm text-[var(--text-secondary)]">
            بارگذاری صفحه با مشکل مواجه شد.
          </p>
          <button
            onClick={() => {
              setAutoRetrying(true)
              retried.current = false
              reset()
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-2 text-sm text-[var(--text-primary)] transition-colors hover:border-[var(--border-hover)]"
          >
            <RefreshCw className="h-4 w-4" />
            تلاش دوباره
          </button>
        </>
      )}
    </div>
  )
}
