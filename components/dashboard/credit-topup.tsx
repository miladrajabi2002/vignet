'use client'

import { useState } from 'react'
import { CreditCard, Loader2, Check } from 'lucide-react'

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
    <div>
      <p className="mb-2.5 text-xs font-medium text-[var(--text-muted)]">
        {fa ? 'افزایش اعتبار' : 'Top up credit'}
      </p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {AMOUNTS_IRR.map((amount) => {
          const selected = amountIRR === amount
          return (
            <button
              key={amount}
              type="button"
              onClick={() => setAmountIRR(amount)}
              aria-pressed={selected}
              className={`relative flex min-h-14 flex-col items-center justify-center rounded-xl border p-2 text-center transition-[border-color,background-color,color,transform,box-shadow] duration-200 ${
                selected
                  ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-base)] shadow-sm'
                  : 'border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]'
              }`}
            >
              {selected && (
                <span className="absolute end-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white/20">
                  <Check className="h-2.5 w-2.5" />
                </span>
              )}
              <span className="text-sm font-bold tabular-nums">
                {number.format(amount / 10)}
              </span>
              <span className={`text-[12px] ${selected ? 'opacity-70' : 'text-[var(--text-muted)]'}`}>
                {fa ? 'تومان' : 'toman'}
              </span>
            </button>
          )
        })}
      </div>

      {/* Pay button */}
      <button
        type="button"
        onClick={checkout}
        disabled={loading}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-sm font-medium text-[var(--bg-base)] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="h-4 w-4" />
        )}
        {fa ? `پرداخت ${number.format(amountIRR / 10)} تومان` : `Pay ${number.format(amountIRR / 10)} toman`}
      </button>

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
          {fa ? 'ساخت لینک پرداخت ناموفق بود.' : 'Could not create the payment link.'}
        </div>
      )}

      {/* Trust note */}
      <p className="mt-3 text-center text-[12px] text-[var(--text-muted)]">
        {fa
          ? 'پرداخت با زرین‌پی · کارت‌به‌کارت خودکار و کاملاً امن'
          : 'Paid through ZarinPay · automatic card-to-card, fully secure'}
      </p>
    </div>
  )
}
