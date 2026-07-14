import { Calculator, MessageSquareText, Sparkles } from 'lucide-react'
import { AGENT_MODELS, type ModelAlias } from '@/lib/ai/models'
import { estimateRemainingReplies } from '@/lib/billing/credit-estimates'

export function ReplyCreditEstimator({
  balanceIRR,
  pricesIRR,
  locale,
}: {
  balanceIRR: number
  pricesIRR: Record<ModelAlias, number>
  locale: 'fa' | 'en'
}) {
  const fa = locale === 'fa'
  const nf = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')
  const estimates = AGENT_MODELS.map((item) => ({
    ...item,
    price: pricesIRR[item.id],
    replies: estimateRemainingReplies(balanceIRR, pricesIRR[item.id]),
  }))
  const minimum = Math.min(...estimates.map((item) => item.replies))
  const maximum = Math.max(...estimates.map((item) => item.replies))

  return (
    <section className="spatial-surface overflow-hidden rounded-[1.5rem]">
      {/* Header strip */}
      <div className="flex flex-col gap-4 border-b border-[var(--border-subtle)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--text-primary)]/10 text-[var(--text-primary)]">
            <Calculator className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)]">
              {fa ? 'این موجودی چند پاسخ می‌دهد؟' : 'How many replies can this balance cover?'}
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
              {fa
                ? 'بازه بر اساس سطح پاسخ و قیمت دقیق پلن شما.'
                : 'Range based on response tier and your plan price.'}
            </p>
          </div>
        </div>

        {/* Highlighted range badge */}
        <div className="flex items-center gap-3 rounded-2xl border border-success/20 bg-success/5 px-5 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/15 text-success">
            <MessageSquareText className="h-4 w-4" />
          </span>
          <div>
            <p className="text-lg font-bold tabular-nums text-success">
              ≈ {nf.format(minimum)}–{nf.format(maximum)}
            </p>
            <p className="text-[11px] text-success/70">
              {fa ? 'پاسخ موفق' : 'successful replies'}
            </p>
          </div>
        </div>
      </div>

      {/* Per-model grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4">
        {estimates.map((item, i) => (
          <div
            key={item.id}
            className={`flex flex-col gap-1 p-4 ${
              i < estimates.length - 1 ? 'border-b border-[var(--border-subtle)] sm:border-b-0 sm:border-s' : ''
            } ${i < 2 ? 'border-b sm:border-b-0' : ''}`}
          >
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-[var(--text-muted)]" />
              <span className="truncate text-xs font-medium text-[var(--text-primary)]">{item.name}</span>
            </div>
            <span className="text-[11px] text-[var(--text-muted)]">
              {nf.format(item.price / 10)} {fa ? 'تومان / پاسخ' : 'toman / reply'}
            </span>
            <span className="mt-0.5 text-base font-bold text-[var(--text-primary)]">
              ≈ {nf.format(item.replies)}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
