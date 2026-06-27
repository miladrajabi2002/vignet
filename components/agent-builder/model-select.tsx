'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, ChevronDown, Sparkles, Zap, Gem } from 'lucide-react'
import { AGENT_MODELS, DEFAULT_MODEL, type ModelTier } from '@/lib/ai/models'
import { cn } from '@/lib/utils'

const TIER_ICON: Record<ModelTier, typeof Zap> = {
  economy: Zap,
  balanced: Sparkles,
  premium: Gem,
}

/** 1–5 rating rendered as filled / empty dots. */
function Meter({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1" title={`${label}: ${value}/5`}>
      <span className="text-[10px] text-[var(--text-muted)]">{label}</span>
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
}: {
  value: string
  onChange: (value: string) => void
}) {
  const t = useTranslations('agents.models')
  const locale = useLocale()
  const isFa = locale === 'fa'

  // A custom (non-curated) slug was typed in before.
  const isCustom = value !== '' && !AGENT_MODELS.some((m) => m.id === value)
  const [advanced, setAdvanced] = useState(isCustom)

  // Empty value == use the default model card.
  const selectedId = value === '' ? DEFAULT_MODEL : value

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--text-muted)]">{t('intro')}</p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {AGENT_MODELS.map((m) => {
          const on = !advanced && selectedId === m.id
          const isDefault = m.id === DEFAULT_MODEL
          const Icon = TIER_ICON[m.tier]
          return (
            <button
              type="button"
              key={m.id}
              onClick={() => {
                setAdvanced(false)
                // Selecting the default model stores '' so the agent keeps
                // inheriting the workspace default.
                onChange(isDefault ? '' : m.id)
              }}
              className={cn(
                'flex flex-col gap-2 rounded-xl border p-3 text-start transition-colors',
                on
                  ? 'border-[var(--border-strong)] bg-[var(--bg-hover)]'
                  : 'border-[var(--border-default)] bg-[var(--bg-base)] hover:border-[var(--border-hover)]',
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {m.name}
                </span>
                {isDefault && (
                  <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-[var(--text-primary)]">
                    {t('default')}
                  </span>
                )}
                <span
                  className={cn(
                    'ms-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                    on ? 'border-white bg-white text-black' : 'border-[var(--border-hover)]',
                  )}
                >
                  {on && <Check className="h-3.5 w-3.5" />}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                {isFa ? m.descFa : m.descEn}
              </p>
              <div className="flex items-center gap-3">
                <Meter value={m.quality} label={t('quality')} />
                <Meter value={m.cost} label={t('cost')} />
              </div>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => setAdvanced((a) => !a)}
        className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
      >
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', advanced && 'rotate-180')} />
        {t('advanced')}
      </button>

      {advanced && (
        <div className="space-y-1">
          <input
            dir="ltr"
            value={isCustom ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="provider/model-name"
            className="input font-mono text-sm"
          />
          <p className="text-xs text-[var(--text-muted)]">{t('customHint')}</p>
        </div>
      )}
    </div>
  )
}
