'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Check, Sparkles, Zap } from 'lucide-react'
import { AGENT_MODELS, DEFAULT_MODEL, resolveModelAlias, type ModelAlias, type ModelTier } from '@/lib/ai/models'
import { cn } from '@/lib/utils'
import { estimateRemainingReplies } from '@/lib/billing/credit-estimates'

const TIER_ICON: Record<ModelTier, typeof Zap> = {
  economy: Zap,
  smart: Sparkles,
}

/** 1–5 rating rendered as filled / empty dots. */
function Meter({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1" title={`${label}: ${value}/5`}>
      <span className="text-[12px] text-[var(--text-muted)]">{label}</span>
      <span className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              i < value ? 'bg-[var(--text-primary)]' : 'bg-[var(--border-hover)]',
            )}
          />
        ))}
      </span>
    </span>
  )
}

/**
 * Curated model picker. `value` is the agent's stored model slug; an empty
 * string means "inherit the workspace default model" — that card is marked as
 * the default so the user always sees what runs when they don't choose.
 */
export function ModelSelect({
  value,
  onChange,
  availableModels = AGENT_MODELS.map((model) => model.id),
  trialModel = DEFAULT_MODEL,
  isTrial = false,
  creditBalanceIRR,
  replyPricesIRR,
}: {
  value: string
  onChange: (value: string) => void
  availableModels?: ModelAlias[]
  trialModel?: ModelAlias
  isTrial?: boolean
  creditBalanceIRR?: number
  replyPricesIRR?: Partial<Record<ModelAlias, number>>
}) {
  const t = useTranslations('agents.models')
  const locale = useLocale()
  const isFa = locale === 'fa'

  // Empty value == use the default model card.
  const selectedId = value === '' ? (isTrial ? trialModel : DEFAULT_MODEL) : resolveModelAlias(value)
  const selectedModel = AGENT_MODELS.find((model) => model.id === selectedId) ?? AGENT_MODELS[0]
  const selectedPriceIRR = replyPricesIRR?.[selectedId] ?? selectedModel.replyPriceIRR
  const estimatedReplies = creditBalanceIRR == null
    ? null
    : estimateRemainingReplies(creditBalanceIRR, selectedPriceIRR)

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--text-muted)]">{t('intro')}</p>

      {estimatedReplies != null && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-800">
          <span>
            {isFa ? 'برآورد با موجودی فعلی' : 'Estimate with current balance'}
          </span>
          <strong className="font-semibold tabular-nums">
            ≈ {estimatedReplies.toLocaleString(isFa ? 'fa-IR' : 'en-US')} {isFa ? 'پاسخ موفق' : 'successful replies'}
          </strong>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {AGENT_MODELS.map((m) => {
          const on = selectedId === m.id
          const isDefault = m.id === DEFAULT_MODEL
          const allowed = isTrial ? m.id === trialModel : availableModels.includes(m.id)
          const Icon = TIER_ICON[m.tier]
          const replyPriceIRR = replyPricesIRR?.[m.id] ?? m.replyPriceIRR
          return (
            <button
              type="button"
              key={m.id}
              disabled={!allowed}
              aria-pressed={on}
              onClick={() => {
                if (!allowed) return
                // Selecting the default model stores '' so the agent keeps
                // inheriting the workspace default.
                onChange(isDefault ? '' : m.id)
              }}
              className={cn(
                'flex flex-col gap-3 rounded-2xl border p-4 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-45',
                on
                  ? 'border-[var(--text-primary)] bg-[var(--bg-base)] shadow-[var(--shadow-control)]'
                  : allowed
                    ? 'border-[var(--border-default)] bg-[var(--bg-base)] hover:border-[var(--border-hover)]'
                    : 'border-[var(--border-default)] bg-[var(--bg-muted)]',
              )}
            >
              <div className="flex items-start gap-3">
                <span className={cn(
                  'grid h-9 w-9 shrink-0 place-items-center rounded-xl',
                  on ? 'bg-[var(--text-primary)] text-[var(--bg-base)]' : 'bg-[var(--bg-muted)] text-[var(--text-primary)]',
                )}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-bold text-[var(--text-primary)]">
                      {isFa ? m.name : m.nameEn}
                    </span>
                    {isDefault && (
                      <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[12px] font-medium text-[var(--text-secondary)]">
                        {t('default')}
                      </span>
                    )}
                    {!allowed && (
                      <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[12px] text-[var(--text-muted)]">
                        {isTrial ? (isFa ? 'بسته آزمایشی' : 'Trial locked') : (isFa ? 'غیرفعال' : 'Disabled')}
                      </span>
                    )}
                  </span>
                  <span dir="ltr" className="mt-0.5 block text-start text-[12px] text-[var(--text-muted)]">{m.provider}</span>
                </span>
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                    on ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-base)]' : 'border-[var(--border-hover)]',
                  )}
                >
                  {on && <Check className="h-3.5 w-3.5" />}
                </span>
              </div>
              <p className="text-xs leading-6 text-[var(--text-secondary)]">
                {isFa ? m.descFa : m.descEn}
              </p>
              <span className="flex flex-wrap gap-1.5">
                {(isFa ? m.bestForFa : m.bestForEn).map((tag) => (
                  <span key={tag} className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[12px] text-[var(--text-secondary)]">
                    {tag}
                  </span>
                ))}
              </span>
              <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--border-subtle)] pt-3">
                <Meter value={m.quality} label={t('quality')} />
                <Meter value={m.cost} label={t('cost')} />
                <span className="ms-auto text-[12px] font-semibold tabular-nums text-emerald-700">
                  {(replyPriceIRR / 10).toLocaleString(isFa ? 'fa-IR' : 'en-US')} {isFa ? 'تومان / پاسخ' : 'toman / reply'}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {isTrial && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-700">
          {isFa
            ? 'در پلن آزمایشی فقط مدل انتخاب‌شده توسط مدیریت فعال است؛ برای انتخاب مدل‌های دیگر ابتدا پلن را ارتقا دهید.'
            : 'The trial plan only enables the model selected by the administrator. Upgrade to choose another model.'}
      </p>
      )}

      <p className="text-xs leading-5 text-[var(--text-muted)]">
        {isFa
          ? 'پاسخ و سایر درخواست‌های موفق AI مثل تحلیل و تست، با قیمت همین مدل از اعتبار کم می‌شوند؛ ویجنت کلید و زیرساخت را مدیریت می‌کند.'
          : 'Replies and other successful AI requests such as analysis and testing use this model price; Vigent manages the key and infrastructure.'}
      </p>
    </div>
  )
}
