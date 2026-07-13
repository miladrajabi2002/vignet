'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { BarChart3, Check, Loader2, Mail, MessageSquareText, TrendingUp } from 'lucide-react'

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
    <section className="spatial-surface overflow-hidden rounded-[1.75rem]">
      <div className="grid lg:grid-cols-[1fr_17rem]">
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-black text-white shadow-[var(--shadow-control)]">
              <Mail className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold text-[var(--text-primary)]">{t('title')}</h2>
                <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-muted)] px-2.5 py-1 text-[10px] font-bold text-[var(--text-secondary)]">{t('soon')}</span>
              </div>
              <p className="mt-1 max-w-xl text-xs leading-6 text-[var(--text-secondary)]">{t('desc')}</p>
            </div>
          </div>

          <form onSubmit={save} className="mt-5 flex flex-col gap-2 sm:flex-row">
            <input dir="ltr" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="input min-h-12 flex-1 text-left text-sm" />
            <button type="submit" disabled={saving} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-black px-5 text-sm font-bold text-white shadow-[var(--shadow-control)] disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : saved ? <Check className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
              {saved ? t('saved') : t('save')}
            </button>
          </form>
          <p aria-live="polite" className="mt-2 min-h-5 text-xs text-red-600">{error ? t('error') : ''}</p>
        </div>

        <div className="relative overflow-hidden border-t border-[var(--border-default)] bg-black p-5 text-white lg:border-s lg:border-t-0">
          <div className="absolute -end-12 -top-12 h-36 w-36 rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Weekly pulse</span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <svg viewBox="0 0 220 54" className="relative mt-4 h-14 w-full" aria-hidden="true">
            <path d="M2 45 C28 42 35 30 57 35 S92 48 111 27 S145 16 164 23 S193 12 218 5" fill="none" stroke="rgba(255,255,255,.9)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M2 45 C28 42 35 30 57 35 S92 48 111 27 S145 16 164 23 S193 12 218 5 V54 H2 Z" fill="rgba(255,255,255,.07)" />
          </svg>
          <div className="relative mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/[0.07] p-3 ring-1 ring-white/10"><MessageSquareText className="h-4 w-4 text-white/60" /><p className="mt-2 text-[10px] text-white/45">Conversation health</p></div>
            <div className="rounded-xl bg-white/[0.07] p-3 ring-1 ring-white/10"><BarChart3 className="h-4 w-4 text-white/60" /><p className="mt-2 text-[10px] text-white/45">Growth &amp; gaps</p></div>
          </div>
        </div>
      </div>
    </section>
  )
}
