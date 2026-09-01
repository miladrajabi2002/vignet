'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Check, Loader2 } from 'lucide-react'
import { MaterialSelect } from '@/components/ui/material-select'
import { cn } from '@/lib/utils'

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
  initialMarketingOptIn,
  embedded = false,
  onSaved,
}: {
  contactId: string
  initialName: string
  initialStage: string
  initialTags: string[]
  initialNotes: string
  initialMarketingOptIn: boolean
  embedded?: boolean
  onSaved?: (contact: {
    name: string | null
    stage: string
    tags: string[]
    notes: string | null
    marketingOptIn: boolean
  }) => void
}) {
  const t = useTranslations('contacts')
  const router = useRouter()
  const nameId = useId()
  const consentId = useId()
  const stageId = useId()
  const tagsId = useId()
  const notesId = useId()
  const [name, setName] = useState(initialName)
  const [stage, setStage] = useState<Stage>(
    (STAGES as readonly string[]).includes(initialStage)
      ? (initialStage as Stage)
      : 'lead',
  )
  const [tags, setTags] = useState(initialTags.join(', '))
  const [notes, setNotes] = useState(initialNotes)
  const [marketingOptIn, setMarketingOptIn] = useState(initialMarketingOptIn)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || undefined,
          stage,
          tags: tags
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          notes: notes.trim() || null,
          marketingOptIn,
        }),
      })
      if (!res.ok) throw new Error('SAVE_FAILED')
      const body = await res.json().catch(() => null)
      if (body?.contact) onSaved?.(body.contact)
      setSaved(true)
      router.refresh()
    } catch {
      setError(t('detail.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={cn(
        'space-y-4',
        !embedded && 'spatial-surface rounded-[1.5rem] p-5 sm:p-6',
      )}
    >
      <div>
        <label htmlFor={nameId} className="text-xs text-[var(--text-secondary)]">
          {t('detail.name')}
        </label>
        <input
          id={nameId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('anonymous')}
          className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-base text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] focus-visible:ring-2 focus-visible:ring-black/10 sm:text-sm"
        />
      </div>

      <label htmlFor={consentId} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-3">
        <input
          id={consentId}
          type="checkbox"
          checked={marketingOptIn}
          onChange={(event) => setMarketingOptIn(event.target.checked)}
          className="mt-1 h-4 w-4 accent-violet-500"
        />
        <span>
          <span className="block text-sm text-[var(--text-primary)]">{t('detail.consentLabel')}</span>
          <span className="mt-1 block text-[11px] leading-5 text-[var(--text-muted)]">{t('detail.consentHint')}</span>
        </span>
      </label>

      <div>
        <span id={stageId} className="text-xs text-[var(--text-secondary)]">
          {t('stage')}
        </span>
        <MaterialSelect
          value={stage}
          onValueChange={(value) => setStage(value as Stage)}
          ariaLabel={t('stage')}
          className="mt-1"
          buttonClassName="text-base sm:text-sm"
          options={STAGES.map((item) => ({ value: item, label: t(STAGE_KEY[item]) }))}
        />
      </div>

      <div>
        <label htmlFor={tagsId} className="text-xs text-[var(--text-secondary)]">
          {t('detail.tags')}
        </label>
        <input
          id={tagsId}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder={t('detail.tagsPlaceholder')}
          className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-base text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] focus-visible:ring-2 focus-visible:ring-black/10 sm:text-sm"
        />
      </div>

      <div>
        <label htmlFor={notesId} className="text-xs text-[var(--text-secondary)]">
          {t('detail.notes')}
        </label>
        <textarea
          id={notesId}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder={t('detail.notesPlaceholder')}
          className="mt-1 w-full resize-y rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-base text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] focus-visible:ring-2 focus-visible:ring-black/10 sm:text-sm"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-success">
            <Check className="h-3.5 w-3.5" />
            {t('detail.saved')}
          </span>
        )}
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-base)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
          {t('detail.save')}
        </button>
      </div>

    </div>
  )
}
