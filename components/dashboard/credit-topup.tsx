'use client'

import { useState } from 'react'
import { CreditCard, Loader2, WalletCards } from 'lucide-react'

const AMOUNTS_IRR = [1_000_000, 2_500_000, 5_000_000, 10_000_000]

export function CreditTopup({ locale }: { locale: 'fa' | 'en' }) {
  const [amountIRR, setAmountIRR] = useState(AMOUNTS_IRR[1])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const fa = locale === 'fa'
  const number = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')

  async function checkout() {
    setLoading(true)
    setError(false)
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'AI_CREDIT',
          gateway: 'ZARINPAY',
          amountIRR,
        }),
      })
      const data = await response.json().catch(() => null)
      if (response.ok && data?.url) {
        window.location.href = data.url
        return
      }
      setError(true)
    } catch {
      setError(true)
    }
    setLoading(false)
  }

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)]">
          <WalletCards className="h-5 w-5 text-[var(--text-secondary)]" />
        </span>
        <div>
          <h2 className="font-medium text-[var(--text-primary)]">
            {fa ? 'افزایش اعتبار پاسخ‌ها' : 'Top up reply credit'}
          </h2>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
            {fa
              ? 'اعتبار تاریخ انقضا ندارد و فقط بعد از یک پاسخ موفق از آن کم می‌شود.'
              : 'Credit does not expire and is deducted only after a successful reply.'}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {AMOUNTS_IRR.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => setAmountIRR(amount)}
            aria-pressed={amountIRR === amount}
            className={`min-h-11 rounded-xl border px-2 text-xs font-medium transition-colors ${
              amountIRR === amount
                ? 'border-black bg-black text-white'
                : 'border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]'
            }`}
          >
            {number.format(amount / 10)} {fa ? 'تومان' : 'toman'}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={checkout}
        disabled={loading}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        {fa ? 'پرداخت و افزایش اعتبار' : 'Pay and add credit'}
      </button>
      {error && <p className="mt-2 text-center text-xs text-red-600">{fa ? 'ساخت لینک پرداخت ناموفق بود.' : 'Could not create the payment link.'}</p>}
    </div>
  )
}
