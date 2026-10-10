'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { BarChart3, Mail, MessageSquareText, TrendingUp } from 'lucide-react'
import { AutoSaveStatus } from '@/components/ui/auto-save-status'
import { useAutoSave } from '@/lib/hooks/use-auto-save'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Weekly business report opt-in. The report feature ships later — this card
 * collects the email so it can start arriving the moment it launches.
 */
export function WeeklyReportCard({ initialEmail }: { initialEmail: string }) {
  const t = useTranslations('settings.weeklyReport')
  const fa = useLocale() !== 'en'
  const [email, setEmail] = useState(initialEmail)
  const [touched, setTouched] = useState(false)
  const value = email.trim()
  // Empty clears the address; anything else has to look like one before it is sent.
  const valid = value === '' || EMAIL.test(value)

  const auto = useAutoSave({
    value,
    valid,
    save: async (next) => {
      const res = await fetch('/api/workspace/report-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: next }),
      })
      if (!res.ok) throw new Error('SAVE_FAILED')
    },
  })

  return (
    <section id="settings-weekly-report" className="spatial-surface scroll-mt-28 overflow-hidden rounded-sheet">
      <div className="grid lg:grid-cols-[1fr_17rem]">
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-black text-white shadow-[var(--shadow-control)]">
              <Mail className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold text-[var(--text-primary)]">{t('title')}</h2>
                <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-muted)] px-2.5 py-1 text-[12px] font-bold text-[var(--text-secondary)]">{t('soon')}</span>
              </div>
              <p className="mt-1 max-w-xl text-xs leading-6 text-[var(--text-secondary)]">{t('desc')}</p>
            </div>
          </div>

          <input
            dir="ltr"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onBlur={() => { setTouched(true); auto.flush() }}
            onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
            aria-label={t('title')}
            aria-invalid={touched && !valid}
            placeholder="you@example.com"
            className="input mt-5 min-h-12 w-full text-left text-sm"
          />
          <div className="mt-2 flex min-h-8 items-center">
            {touched && !valid
              ? <p role="alert" className="text-xs text-red-600">{t('error')}</p>
              : <AutoSaveStatus status={auto.status} onRetry={auto.flush} className="-ms-2.5" />}
          </div>
        </div>

        <div className="relative overflow-hidden border-t border-[var(--border-default)] bg-black p-5 text-white lg:border-s lg:border-t-0">
          <div className="absolute -end-12 -top-12 h-36 w-36 rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex items-center justify-between">
            <span className="text-[12px] font-bold text-white/60">{fa ? 'نبض هفتگی کسب‌وکار' : 'Weekly pulse'}</span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <svg viewBox="0 0 220 54" className="relative mt-4 h-14 w-full" aria-hidden="true">
            <path d="M2 45 C28 42 35 30 57 35 S92 48 111 27 S145 16 164 23 S193 12 218 5" fill="none" stroke="rgba(255,255,255,.9)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M2 45 C28 42 35 30 57 35 S92 48 111 27 S145 16 164 23 S193 12 218 5 V54 H2 Z" fill="rgba(255,255,255,.07)" />
          </svg>
          <div className="relative mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/[0.07] p-3 ring-1 ring-white/10"><MessageSquareText className="h-4 w-4 text-white/60" /><p className="mt-2 text-[12px] text-white/60">{fa ? 'سلامت گفتگوها' : 'Conversation health'}</p></div>
            <div className="rounded-xl bg-white/[0.07] p-3 ring-1 ring-white/10"><BarChart3 className="h-4 w-4 text-white/60" /><p className="mt-2 text-[12px] text-white/60">{fa ? 'رشد و نقاط ضعف' : 'Growth & gaps'}</p></div>
          </div>
        </div>
      </div>
    </section>
  )
}
