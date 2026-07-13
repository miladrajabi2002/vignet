'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Check, Loader2 } from 'lucide-react'
import { MaterialSelect } from '@/components/ui/material-select'

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
}: {
  contactId: string
  initialName: string
  initialStage: string
  initialTags: string[]
  initialNotes: string
  initialMarketingOptIn: boolean
}) {
  const t = useTranslations('contacts')
  const router = useRouter()
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

  async function save() {
    setBusy(true)
    setSaved(false)
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
      if (res.ok) {
        setSaved(true)
        router.refresh()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
      <div>
        <label className="text-xs text-[var(--text-secondary)]">
          {t('detail.name')}
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('anonymous')}
          className="mt-1 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
        />
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-3">
        <input
          type="checkbox"
          checked={marketingOptIn}
          onChange={(event) => setMarketingOptIn(event.target.checked)}
          className="mt-1 h-4 w-4 accent-violet-500"
        />
        <span>
          <span className="block text-sm text-[var(--text-primary)]">رضایت پیام‌های اطلاع‌رسانی ثبت شده است</span>
          <span className="mt-1 block text-[11px] leading-5 text-[var(--text-muted)]">فقط وقتی مشتری صریحاً موافقت کرده این گزینه را فعال کنید. ارسال STOP آن را خودکار خاموش می‌کند.</span>
        </span>
      </label>

      <div>
        <label className="text-xs text-[var(--text-secondary)]">
          {t('stage')}
        </label>
        <MaterialSelect
          value={stage}
          onValueChange={(value) => setStage(value as Stage)}
          ariaLabel={t('stage')}
          className="mt-1"
          options={STAGES.map((item) => ({ value: item, label: t(STAGE_KEY[item]) }))}
        />
      </div>

      <div>
        <label className="text-xs text-[var(--text-secondary)]">
          {t('detail.tags')}
        </label>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder={t('detail.tagsPlaceholder')}
          className="mt-1 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
        />
      </div>

      <div>
        <label className="text-xs text-[var(--text-secondary)]">
          {t('detail.notes')}
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder={t('detail.notesPlaceholder')}
          className="mt-1 w-full resize-y rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-success">
            <Check className="h-3.5 w-3.5" />
            {t('detail.saved')}
          </span>
        )}
        <button
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--white)] px-4 py-1.5 text-sm font-medium text-[var(--bg-base)] disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {t('detail.save')}
        </button>
      </div>
    </div>
  )
}
