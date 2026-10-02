'use client'

import { useState } from 'react'
import { BellRing, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AppointmentReminders } from '@/components/bookings/booking-model'

/**
 * Bookings side panel: customer reminders, 24 h and 2 h before, sent in the
 * customer's own conversation (never SMS). One switch for the workspace.
 */
export function ReminderSettingsCard({ fa, initialEnabled }: { fa: boolean; initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function toggle() {
    const next = !enabled
    setBusy(true)
    setFailed(false)
    setEnabled(next)
    const response = await fetch('/api/appointments/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remindersEnabled: next }),
    }).catch(() => null)
    setBusy(false)
    if (!response?.ok) { setEnabled(!next); setFailed(true) }
  }

  return (
    <section className="spatial-surface rounded-card p-4">
      <div className="flex items-start gap-2.5">
        <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', enabled ? 'bg-[var(--text-primary)] text-white' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]')}>
          <BellRing className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="ui-h3 leading-6">{fa ? 'یادآوری به مشتری' : 'Customer reminders'}</p>
          <p className="text-[13px] leading-6 text-[var(--text-muted)]">
            {fa ? '۲۴ ساعت و ۲ ساعت قبل از نوبت، در همان گفتگویی که مشتری با شما دارد.' : '24 h and 2 h before, in the customer’s own conversation.'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={fa ? 'یادآوری به مشتری' : 'Customer reminders'}
          disabled={busy}
          onClick={() => void toggle()}
          className={cn('relative mt-1 h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-60', enabled ? 'border-[var(--text-primary)] bg-[var(--text-primary)]' : 'border-[var(--border-hover)] bg-[var(--bg-muted)]')}
        >
          <span className={cn('absolute top-0.5 grid h-[1.125rem] w-[1.125rem] place-items-center rounded-full bg-white shadow transition-[inset-inline-start] duration-150', enabled ? 'start-[1.375rem]' : 'start-0.5')}>
            {busy && <Loader2 className="h-3 w-3 animate-spin text-[var(--text-muted)]" />}
          </span>
        </button>
      </div>
      <p className="mt-3 rounded-xl bg-[var(--bg-subtle)] px-3 py-2 text-[12px] leading-6 text-[var(--text-secondary)]">
        {fa
          ? 'مشتری می‌تواند همان‌جا جواب بدهد تا ایجنت نوبت را لغو یا جابه‌جا کند. اینستاگرام و واتس‌اپ فقط تا ۲۴ ساعت بعد از آخرین پیام مشتری اجازه پیام می‌دهند؛ بیرون از این بازه یادآوری رد می‌شود و روی نوبت علامت می‌خورد.'
          : 'Customers can reply there to cancel or move it. Instagram and WhatsApp only allow messages within 24 h of the customer’s last one; outside that window the reminder is skipped and marked on the booking.'}
      </p>
      {failed && <p role="alert" className="mt-2 text-[12px] font-medium text-red-700">{fa ? 'ذخیره نشد؛ دوباره تلاش کنید.' : 'Not saved. Try again.'}</p>}
    </section>
  )
}

const LABELS: Record<string, { fa: string; en: string; tone: 'ok' | 'muted' | 'warn' }> = {
  sent: { fa: 'فرستاده شد', en: 'sent', tone: 'ok' },
  stored: { fa: 'در گفتگوی سایت ثبت شد', en: 'posted in the site chat', tone: 'ok' },
  skipped_window: { fa: 'فرستاده نشد؛ بیرون از مهلت ۲۴ ساعته پیام', en: 'skipped: outside the 24 h window', tone: 'warn' },
  no_conversation: { fa: 'گفتگویی برای ارسال نبود', en: 'no conversation to send to', tone: 'muted' },
  failed: { fa: 'ارسال ناموفق', en: 'delivery failed', tone: 'warn' },
}

/** One line on a booking card: what happened to its reminders. */
export function ReminderStatusLine({ fa, reminders }: { fa: boolean; reminders?: AppointmentReminders }) {
  const entries = (['h24', 'h2'] as const).flatMap((stage) => {
    const item = reminders?.[stage]
    return item ? [{ stage, ...(LABELS[item.status] ?? LABELS.failed) }] : []
  })
  if (!entries.length) return null
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
      {entries.map((entry) => (
        <span key={entry.stage} className={cn('inline-flex items-center gap-1', entry.tone === 'ok' ? 'text-emerald-700' : entry.tone === 'warn' ? 'text-amber-700' : 'text-[var(--text-muted)]')}>
          <BellRing className="h-3.5 w-3.5" />
          {fa
            ? `یادآوری ${entry.stage === 'h24' ? '۲۴ ساعته' : '۲ ساعته'}: ${entry.fa}`
            : `${entry.stage === 'h24' ? '24 h' : '2 h'} reminder ${entry.en}`}
        </span>
      ))}
    </p>
  )
}
