'use client'

import { useState } from 'react'
// NOTE: lucide v1 removed brand icons (incl. Bitcoin) — Coins stands in for crypto.
import { CreditCard, Coins, Loader2 } from 'lucide-react'

/**
 * Checkout buttons for one plan card: rial (ZarinPay) or crypto (NowPayments).
 * POSTs /api/billing/checkout and redirects the browser to the gateway link.
 */
export function PlanCheckout({
  plan,
  labels,
  disabled,
}: {
  plan: 'STARTER' | 'PRO' | 'BUSINESS'
  labels: { rial: string; crypto: string; error: string }
  disabled?: boolean
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
        body: JSON.stringify({ plan, gateway }),
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
        onClick={() => checkout('ZARINPAY')}
        disabled={disabled || loading !== null}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--white)] px-4 py-2.5 text-sm font-medium text-[var(--bg-base)] transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading === 'ZARINPAY' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="h-4 w-4" />
        )}
        {labels.rial}
      </button>
      <button
        onClick={() => checkout('NOWPAYMENTS')}
        disabled={disabled || loading !== null}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-hover)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading === 'NOWPAYMENTS' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Coins className="h-4 w-4" />
        )}
        {labels.crypto}
      </button>
      {error && (
        <p className="text-center text-xs text-red-500">{labels.error}</p>
      )}
    </div>
  )
}
