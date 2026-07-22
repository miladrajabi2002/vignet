'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export function SalesInsightBackfill({
  missingCount,
  locale,
}: {
  missingCount: number
  locale: 'fa' | 'en'
}) {
  const router = useRouter()
  const started = useRef(false)
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (missingCount < 1 || started.current) return
    started.current = true
    const controller = new AbortController()

    async function backfill() {
      setActive(true)
      try {
        const response = await fetch('/api/conversations/sales-insights/backfill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit: 50 }),
          signal: controller.signal,
        })
        if (response.ok && !controller.signal.aborted) router.refresh()
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('[sales-insight] historical backfill failed:', error)
        }
      } finally {
        if (!controller.signal.aborted) setActive(false)
      }
    }

    void backfill()
    return () => controller.abort()
  }, [missingCount, router])

  if (!active) return null
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]" role="status">
      <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      {locale === 'fa'
        ? `در حال تحلیل ${Math.min(missingCount, 50).toLocaleString('fa-IR')} گفتگوی قبلی`
        : `Analyzing ${Math.min(missingCount, 50).toLocaleString('en-US')} earlier conversations`}
    </span>
  )
}
