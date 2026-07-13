import { Calculator, MessageSquareText } from 'lucide-react'
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
  const estimates = AGENT_MODELS.map((item) => ({ ...item, price: pricesIRR[item.id], replies: estimateRemainingReplies(balanceIRR, pricesIRR[item.id]) }))
  const minimum = Math.min(...estimates.map((item) => item.replies))
  const maximum = Math.max(...estimates.map((item) => item.replies))

  return (
    <section className="spatial-surface overflow-hidden rounded-[1.75rem]">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-muted)]">
            <Calculator className="h-5 w-5 text-[var(--text-secondary)]" />
          </span>
          <div>
            <h2 className="font-medium text-[var(--text-primary)]">
              {fa ? 'این موجودی چند پاسخ می‌دهد؟' : 'How many replies can this balance cover?'}
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
              {fa
                ? 'این بازه بر اساس سطح پاسخ تعیین‌شده توسط مدیر سامانه و قیمت دقیق پلن شماست.'
                : 'This range uses the platform-managed response tier and your plan’s exact price.'}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-3 text-center sm:min-w-52">
          <div className="flex items-center justify-center gap-2 text-emerald-700">
            <MessageSquareText className="h-4 w-4" />
            <strong className="text-xl font-semibold tabular-nums">≈ {nf.format(minimum)} تا {nf.format(maximum)}</strong>
          </div>
          <p className="mt-1 text-[11px] text-emerald-700/80">
            {fa ? 'پاسخ موفق، بسته به سطح پاسخ' : 'successful replies by response tier'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 border-t border-[var(--border-subtle)] sm:grid-cols-4">
        {estimates.map((item) => {
          return (
            <div
              key={item.id}
              className="min-h-20 border-s border-[var(--border-subtle)] px-3 py-3 text-start first:border-s-0"
            >
              <span className="block truncate text-xs font-medium text-[var(--text-primary)]">{item.name}</span>
              <span className="mt-1 block text-[10px] text-[var(--text-muted)]">
                {nf.format(item.price / 10)} {fa ? 'تومان / پاسخ' : 'toman / reply'}
              </span>
              <span className="mt-1 block text-[11px] font-bold text-black">≈ {nf.format(item.replies)}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
