'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/** One status action on a chat pre-order or back-in-stock alert. */
export function ChatRequestAction({
  endpoint,
  status,
  label,
  errorLabel,
  tone = 'neutral',
}: {
  endpoint: string
  status: string
  label: string
  errorLabel: string
  tone?: 'primary' | 'neutral'
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  async function run() {
    setBusy(true)
    setError(false)
    try {
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!response.ok) throw new Error('failed')
      startTransition(() => router.refresh())
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  const loading = busy || pending
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className={cn(
          'inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors disabled:cursor-wait disabled:opacity-70',
          tone === 'primary'
            ? 'bg-black text-white hover:bg-black/85'
            : 'border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]',
        )}
      >
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {label}
      </button>
      {error && <span role="alert" className="text-[11px] text-danger">{errorLabel}</span>}
    </span>
  )
}
