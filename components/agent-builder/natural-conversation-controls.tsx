'use client'

import { useId, useState } from 'react'
import { ChevronDown, MessageCircleMore } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { MaterialSelect } from '@/components/ui/material-select'
import { SwitchTrack } from '@/components/ui/switch'
import type { PromptConversationConfig } from '@/lib/ai/prompt-builder'

export function NaturalConversationControls({
        value,
        onChange,
}: {
        value: PromptConversationConfig
        onChange: (value: PromptConversationConfig) => void
}) {
        const t = useTranslations('agents.naturalConversation')
        const [open, setOpen] = useState(true)
        const titleId = useId()
        const controlsId = useId()
        const set = <K extends keyof PromptConversationConfig>(
                key: K,
                next: PromptConversationConfig[K],
        ) => onChange({ ...value, [key]: next })

        const selectFields = [
                {
                        key: 'formality' as const,
                        options: ['formal', 'balanced', 'casual'] as const,
                },
                {
                        key: 'initiative' as const,
                        options: ['answer_only', 'guided', 'proactive'] as const,
                },
                {
                        key: 'empathy' as const,
                        options: ['neutral', 'balanced', 'warm'] as const,
                },
                {
                        key: 'followUp' as const,
                        options: ['rare', 'when_needed', 'often'] as const,
                },
        ]

        const toggles = [
                { key: 'mirrorCustomerTone' as const, label: t('mirrorCustomerTone') },
                { key: 'useCustomerName' as const, label: t('useCustomerName') },
                { key: 'avoidRepeatedGreetings' as const, label: t('avoidRepeatedGreetings') },
        ]

        return (
                <section
                        aria-labelledby={titleId}
                        className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-black/[0.018]"
                >
                        <button
                                type="button"
                                aria-expanded={open}
                                aria-controls={controlsId}
                                onClick={() => setOpen((current) => !current)}
                                className="spatial-press flex min-h-14 w-full items-center gap-2.5 p-3.5 text-start sm:p-4"
                        >
                                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-black/[0.055] text-[var(--text-secondary)]">
                                        <MessageCircleMore className="h-4 w-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                        <span id={titleId} className="block text-sm font-semibold text-[var(--text-primary)]">
                                                {t('title')}
                                        </span>
                                        <span className="mt-0.5 block truncate text-[12px] leading-5 text-[var(--text-muted)] sm:text-[12px]">
                                                {[
                                                        t(`formality.options.${value.formality}`),
                                                        t(`initiative.options.${value.initiative}`),
                                                        t(`empathy.options.${value.empathy}`),
                                                ].join(' · ')}
                                        </span>
                                </span>
                                <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
                        </button>

                        {open && (
                                <div id={controlsId} className="border-t border-[var(--border-subtle)] p-3.5 sm:p-4">
                                        <p className="text-[12px] leading-5 text-[var(--text-muted)]">
                                                {t('description')}
                                        </p>

                                        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                                                {selectFields.map(({ key, options }) => (
                                                        <MaterialSelect
                                                                key={key}
                                                                value={value[key]}
                                                                onValueChange={(next) => set(key, next as PromptConversationConfig[typeof key])}
                                                                options={options.map((option) => ({
                                                                        value: option,
                                                                        label: t(`${key}.options.${option}`),
                                                                }))}
                                                                label={t(`${key}.label`)}
                                                                ariaLabel={t(`${key}.label`)}
                                                        />
                                                ))}
                                        </div>

                                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                                {toggles.map(({ key, label }) => {
                                                        const active = value[key]
                                                        return (
                                                                <button
                                                                        key={key}
                                                                        type="button"
                                                                        role="switch"
                                                                        aria-checked={active}
                                                                        onClick={() => set(key, !active)}
                                                                        className="spatial-press flex min-h-12 items-center justify-between gap-3 rounded-xl border border-[var(--border-default)] bg-white px-3 text-start text-[13px] font-medium text-[var(--text-primary)] transition-[border-color] duration-150 hover:border-black/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                                                >
                                                                        <span className="min-w-0">{label}</span>
                                                                        <SwitchTrack checked={active} />
                                                                </button>
                                                        )
                                                })}
                                        </div>
                                </div>
                        )}
                </section>
        )
}
