'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Loader2, Mail } from 'lucide-react'

/**
 * Weekly business report opt-in. The report feature ships later — this card
 * collects the email so it can start arriving the moment it launches.
 */
export function WeeklyReportCard({ initialEmail }: { initialEmail: string }) {
  const t = useTranslations('settings.weeklyReport')
  const [email, setEmail] = useState(initialEmail)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(false)
    try {
      const res = await fetch('/api/workspace/report-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      if (!res.ok) {
        setError(true)
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)]">
          <Mail className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-medium text-[var(--text-primary)]">{t('title')}</h2>
            <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
              {t('soon')}
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{t('desc')}</p>
          <form onSubmit={save} className="mt-3 flex flex-wrap items-center gap-2">
            <input
              dir="ltr"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input max-w-xs text-sm"
            />
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saved ? (
                <Check className="h-4 w-4 text-success" />
              ) : null}
              {saved ? t('saved') : t('save')}
            </button>
          </form>
          {error && <p className="mt-2 text-xs text-danger">{t('error')}</p>}
        </div>
      </div>
    </div>
  )
}
