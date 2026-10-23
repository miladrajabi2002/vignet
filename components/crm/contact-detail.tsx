'use client'

import { useId, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { MaterialSelect } from '@/components/ui/material-select'
import { Switch } from '@/components/ui/switch'
import { AutoSaveStatus } from '@/components/ui/auto-save-status'
import { TagInput } from '@/components/ui/tag-input'
import { useAutoSave } from '@/lib/hooks/use-auto-save'
import { cn } from '@/lib/utils'
import { AI_BRIEF_MAX, AI_BRIEF_PRESETS, CUSTOM_FIELDS_MAX, type CustomField } from '@/lib/crm/customer-brief'

const STAGES = ['lead', 'qualified', 'customer', 'lost'] as const
type Stage = (typeof STAGES)[number]

const STAGE_KEY: Record<Stage, string> = {
  lead: 'stageLead',
  qualified: 'stageQualified',
  customer: 'stageCustomer',
  lost: 'stageLost',
}

export function ContactDetailEditor({
  contactId,
  initialName,
  initialStage,
  initialTags,
  initialNotes,
  initialAiBrief = '',
  initialCustomFields = [],
  initialMarketingOptIn,
  embedded = false,
  onSaved,
}: {
  contactId: string
  initialName: string
  initialStage: string
  initialTags: string[]
  initialNotes: string
  initialAiBrief?: string
  initialCustomFields?: CustomField[]
  initialMarketingOptIn: boolean
  embedded?: boolean
  onSaved?: (contact: {
    name: string | null
    stage: string
    tags: string[]
    notes: string | null
    aiBrief: string | null
    marketingOptIn: boolean
  }) => void
}) {
  const t = useTranslations('contacts')
  const router = useRouter()
  const locale = useLocale() === 'en' ? 'en' : 'fa'
  const nameId = useId()
  const consentId = useId()
  const stageId = useId()
  const tagsId = useId()
  const notesId = useId()
  const aiBriefId = useId()
  const [name, setName] = useState(initialName)
  const [stage, setStage] = useState<Stage>(
    (STAGES as readonly string[]).includes(initialStage)
      ? (initialStage as Stage)
      : 'lead',
  )
  const [tags, setTags] = useState<string[]>(initialTags)
  const [notes, setNotes] = useState(initialNotes)
  const [aiBrief, setAiBrief] = useState(initialAiBrief)
  const [fields, setFields] = useState<CustomField[]>(initialCustomFields)
  const [marketingOptIn, setMarketingOptIn] = useState(initialMarketingOptIn)
  const [error, setError] = useState<string | null>(null)

  // Every edit saves by itself: after a pause in typing, or on leaving a field.
  const auto = useAutoSave({
    value: {
      name: name.trim() || undefined,
      stage,
      tags,
      notes: notes.trim() || null,
      aiBrief: aiBrief.trim() || null,
      // Half-typed rows (a label with no value yet) are not saved.
      customFields: fields.filter((field) => field.label.trim() && field.value.trim()),
      marketingOptIn,
    },
    save: async (value) => {
      setError(null)
      try {
        const res = await fetch(`/api/contacts/${contactId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(value),
        })
        if (!res.ok) throw new Error('SAVE_FAILED')
        const body = await res.json().catch(() => null)
        if (body?.contact) onSaved?.(body.contact)
        router.refresh()
      } catch (cause) {
        setError(t('detail.saveFailed'))
        throw cause
      }
    },
  })

  return (
    <div
      onBlur={auto.flush}
      className={cn(
        'min-w-0 space-y-4',
        !embedded && 'spatial-surface rounded-card p-5 sm:p-6',
      )}
    >
      <div>
        <label htmlFor={nameId} className="ui-field-label">
          {t('detail.name')}
        </label>
        <input
          id={nameId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('anonymous')}
          className="input"
        />
      </div>

      <div>
        <span id={stageId} className="ui-field-label">
          {t('stage')}
        </span>
        <MaterialSelect
          value={stage}
          onValueChange={(value) => setStage(value as Stage)}
          ariaLabel={t('stage')}
          buttonClassName="text-base sm:text-sm"
          options={STAGES.map((item) => ({ value: item, label: t(STAGE_KEY[item]) }))}
        />
      </div>

      <div>
        <label htmlFor={tagsId} className="ui-field-label">
          {t('detail.tags')}
        </label>
        <TagInput
          id={tagsId}
          value={tags}
          onChange={setTags}
          locale={locale}
          placeholder={t('detail.tagsPlaceholder')}
        />
      </div>

      <div>
        <label htmlFor={aiBriefId} className="ui-field-label">
          {t('detail.aiBrief')}
        </label>
        <p className="mb-2 text-[12px] leading-5 text-[var(--text-muted)]">{t('detail.aiBriefHint')}</p>
        <textarea
          id={aiBriefId}
          value={aiBrief}
          onChange={(e) => setAiBrief(e.target.value.slice(0, AI_BRIEF_MAX))}
          rows={3}
          placeholder={t('detail.aiBriefPlaceholder')}
          className="input resize-y leading-7"
        />
        <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label={t('detail.aiBriefPresets')}>
          <span className="text-[11.5px] text-[var(--text-muted)]">{t('detail.aiBriefPresets')}:</span>
          {AI_BRIEF_PRESETS[locale].filter((line) => !aiBrief.includes(line)).map((line) => (
            <button
              key={line}
              type="button"
              onClick={() => setAiBrief((current) => (current.trim() ? `${current.trim()}\n${line}` : line).slice(0, AI_BRIEF_MAX))}
              className="min-h-8 rounded-full border border-[var(--border-default)] px-3 text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-black/[0.035]"
            >
              {line}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="ui-field-label">{t('detail.customFields')}</span>
        <p className="mb-2 text-[12px] leading-5 text-[var(--text-muted)]">{t('detail.customFieldsHint')}</p>
        <div className="space-y-2">
          {fields.map((field, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                value={field.label}
                onChange={(e) => setFields((current) => current.map((item, i) => (i === index ? { ...item, label: e.target.value.slice(0, 40) } : item)))}
                placeholder={t('detail.fieldLabel')}
                aria-label={t('detail.fieldLabel')}
                className="input w-[38%] min-w-0"
              />
              <input
                value={field.value}
                onChange={(e) => setFields((current) => current.map((item, i) => (i === index ? { ...item, value: e.target.value.slice(0, 300) } : item)))}
                placeholder={t('detail.fieldValue')}
                aria-label={t('detail.fieldValue')}
                className="input min-w-0 flex-1"
              />
              <button
                type="button"
                onClick={() => setFields((current) => current.filter((_, i) => i !== index))}
                aria-label={t('detail.removeField')}
                className="grid size-10 shrink-0 place-items-center rounded-xl text-[var(--text-muted)] hover:bg-black/[0.035]"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ))}
          {fields.length < CUSTOM_FIELDS_MAX && (
            <button
              type="button"
              onClick={() => setFields((current) => [...current, { label: '', value: '' }])}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-dashed border-[var(--border-default)] px-3 text-[12.5px] text-[var(--text-secondary)] hover:bg-black/[0.035]"
            >
              <Plus className="size-4" aria-hidden />
              {t('detail.addField')}
            </button>
          )}
        </div>
      </div>

      <div>
        <label htmlFor={notesId} className="ui-field-label">
          {t('detail.notes')}
        </label>
        <p className="mb-2 text-[12px] leading-5 text-[var(--text-muted)]">{t('detail.notesHint')}</p>
        <textarea
          id={notesId}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder={t('detail.notesPlaceholder')}
          className="input resize-y leading-7"
        />
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-[var(--border-subtle)] pt-4">
        <span id={consentId}>
          <span className="block text-[13px] text-[var(--text-primary)]">{t('detail.consentLabel')}</span>
          <span className="mt-0.5 block text-[12px] leading-5 text-[var(--text-muted)]">{t('detail.consentHint')}</span>
        </span>
        <Switch checked={marketingOptIn} onChange={setMarketingOptIn} aria-label={t('detail.consentLabel')} />
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end">
        <AutoSaveStatus status={auto.status} onRetry={auto.flush} />
      </div>

    </div>
  )
}
