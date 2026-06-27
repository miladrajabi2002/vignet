'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Check, Loader2 } from 'lucide-react'

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
}: {
  contactId: string
  initialName: string
  initialStage: string
  initialTags: string[]
  initialNotes: string
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

      <div>
        <label className="text-xs text-[var(--text-secondary)]">
          {t('stage')}
        </label>
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value as Stage)}
          className="mt-1 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {t(STAGE_KEY[s])}
            </option>
          ))}
        </select>
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
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-1.5 text-sm font-medium text-black disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {t('detail.save')}
        </button>
      </div>
    </div>
  )
}
