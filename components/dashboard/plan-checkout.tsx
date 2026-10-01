'use client'

import { useState } from 'react'
// NOTE: lucide v1 removed brand icons (incl. Bitcoin) — Coins stands in for crypto.
import { CreditCard, Coins, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Checkout actions for one plan card: rial (ZarinPay) is the primary button,
 * crypto (NowPayments) a quiet link under it.
 * POSTs /api/billing/checkout and redirects the browser to the gateway link.
 */
export function PlanCheckout({
  plan,
  labels,
  disabled,
  emphasis,
}: {
  plan: 'STARTER' | 'PRO' | 'BUSINESS'
  labels: { rial: string; crypto: string; error: string }
  disabled?: boolean
  /** Solid primary button — used for the current and the recommended plan. */
  emphasis?: boolean
}) {
  const [loading, setLoading] = useState<'ZARINPAY' | 'NOWPAYMENTS' | null>(null)
  const [error, setError] = useState(false)

  async function checkout(gateway: 'ZARINPAY' | 'NOWPAYMENTS') {
    setLoading(gateway)
    setError(false)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'SUBSCRIPTION', plan, gateway }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.url) {
        window.location.href = data.url
        return
      }
      setError(true)
    } catch {
      setError(true)
    }
    setLoading(null)
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => checkout('ZARINPAY')}
        disabled={disabled || loading !== null}
        className={cn(
          'spatial-press flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold transition-[border-color,opacity] disabled:cursor-not-allowed disabled:opacity-50',
          emphasis
            ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-elevated)] hover:opacity-90'
            : 'border-[var(--border-hover)] bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:border-[var(--border-strong)]',
        )}
      >
        {loading === 'ZARINPAY' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="h-4 w-4" />
        )}
        {labels.rial}
      </button>
      <button
        type="button"
        onClick={() => checkout('NOWPAYMENTS')}
        disabled={disabled || loading !== null}
        className="mx-auto flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium text-[var(--text-secondary)] underline decoration-[var(--border-strong)] underline-offset-4 transition-colors hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading === 'NOWPAYMENTS' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Coins className="h-3.5 w-3.5" />
        )}
        {labels.crypto}
      </button>
      {error && (
        <p className="text-center text-xs text-red-500">{labels.error}</p>
      )}
    </div>
  )
}
