'use client'

import { useState } from 'react'
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
  const [model, setModel] = useState<ModelAlias>('fast')
  const fa = locale === 'fa'
  const nf = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')
  const selected = AGENT_MODELS.find((item) => item.id === model) ?? AGENT_MODELS[0]
  const replyPriceIRR = pricesIRR[model]
  const remaining = estimateRemainingReplies(balanceIRR, replyPriceIRR)

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
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
                ? 'مدل را عوض کنید تا برآورد زنده با قیمت دقیق پلن شما به‌روزرسانی شود.'
                : 'Switch models to update the estimate using your plan’s exact price.'}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-3 text-center sm:min-w-52">
          <div className="flex items-center justify-center gap-2 text-emerald-700">
            <MessageSquareText className="h-4 w-4" />
            <strong className="text-2xl font-semibold tabular-nums">≈ {nf.format(remaining)}</strong>
          </div>
          <p className="mt-1 text-[11px] text-emerald-700/80">
            {fa ? `پاسخ موفق با «${selected.name}»` : `successful replies with ${selected.provider}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 border-t border-[var(--border-subtle)] sm:grid-cols-4">
        {AGENT_MODELS.map((item) => {
          const selectedModel = item.id === model
          const price = pricesIRR[item.id]
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={selectedModel}
              onClick={() => setModel(item.id)}
              className={`min-h-16 border-s border-[var(--border-subtle)] px-3 py-2 text-start transition-colors first:border-s-0 ${
                selectedModel ? 'bg-[var(--bg-hover)]' : 'hover:bg-[var(--bg-muted)]'
              }`}
            >
              <span className="block truncate text-xs font-medium text-[var(--text-primary)]">{item.name}</span>
              <span className="mt-1 block text-[10px] text-[var(--text-muted)]">
                {nf.format(price / 10)} {fa ? 'تومان / پاسخ' : 'toman / reply'}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
