'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Megaphone,
  Send,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import type { CampaignAudienceInput } from '@/lib/campaigns/audience'

type Preview = {
  totalMatched: number
  eligibleCount: number
  excludedNoConsent: number
  excludedNoChannel: number
  capped: boolean
  sample: Array<{ id: string; label: string; channel: string }>
}

type DraftCampaign = {
  id: string
  name: string
  status: 'DRAFT'
  expectedRecipientCount: number
}

export function CampaignComposer({
  audience,
  locale,
  onClose,
}: {
  audience: CampaignAudienceInput
  locale: 'fa' | 'en'
  onClose: () => void
}) {
  const isFa = locale === 'fa'
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewing, setPreviewing] = useState(true)
  const [name, setName] = useState(isFa ? 'اطلاع‌رسانی مشتریان' : 'Customer update')
  const [message, setMessage] = useState('')
  const [creating, setCreating] = useState(false)
  const [campaign, setCampaign] = useState<DraftCampaign | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [queueing, setQueueing] = useState(false)
  const [queued, setQueued] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !queueing) onClose()
      if (event.key !== 'Tab') return
      const focusables = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]',
      ) ?? [])
      if (!focusables.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, queueing])

  useEffect(() => {
    let cancelled = false
    setPreviewing(true)
    fetch('/api/campaigns/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(audience),
    })
      .then(async (response) => {
        const data = await response.json() as Preview
        if (!response.ok) throw new Error('PREVIEW_FAILED')
        if (!cancelled) setPreview(data)
      })
      .catch(() => !cancelled && setError(isFa ? 'پیش‌نمایش مخاطبان آماده نشد.' : 'Audience preview failed.'))
      .finally(() => !cancelled && setPreviewing(false))
    return () => { cancelled = true }
  }, [audience, isFa])

  async function createDraft() {
    if (!preview || preview.eligibleCount === 0 || !message.trim() || !name.trim() || creating) return
    setCreating(true)
    setError(null)
    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), message: message.trim(), audience }),
      })
      const data = await response.json() as { campaign?: DraftCampaign; error?: string }
      if (!response.ok || !data.campaign) throw new Error(data.error ?? 'CREATE_FAILED')
      setCampaign(data.campaign)
    } catch {
      setError(isFa ? 'پیش‌نویس کمپین ساخته نشد. مخاطبان را دوباره بررسی کنید.' : 'Campaign draft could not be created. Review the audience.')
    } finally {
      setCreating(false)
    }
  }

  async function confirmAndQueue() {
    if (!campaign || !confirmed || queueing) return
    setQueueing(true)
    setError(null)
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirm: true,
          expectedRecipientCount: campaign.expectedRecipientCount,
        }),
      })
      if (!response.ok) throw new Error('QUEUE_FAILED')
      setQueued(true)
    } catch {
      setError(isFa ? 'کمپین وارد صف نشد؛ دوباره تأیید کنید.' : 'Campaign was not queued. Confirm again.')
    } finally {
      setQueueing(false)
    }
  }

  const optOutFooter = isFa
    ? 'برای لغو پیام‌های اطلاع‌رسانی، STOP را ارسال کنید.'
    : 'Recipients can reply STOP to opt out of future informational campaigns.'

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="campaign-title"
        className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-2xl sm:rounded-3xl"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 p-5 backdrop-blur">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400"><Megaphone className="h-5 w-5" /></span>
            <div><h2 id="campaign-title" className="font-semibold text-[var(--text-primary)]">{isFa ? 'کمپین پیام‌رسانی امن' : 'Safe messaging campaign'}</h2><p className="mt-1 text-xs text-[var(--text-muted)]">{isFa ? 'پیش‌نمایش ← ساخت پیش‌نویس ← تأیید نهایی ← صف ارسال' : 'Preview → draft → final confirmation → delivery queue'}</p></div>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-[var(--bg-hover)]" aria-label={isFa ? 'بستن' : 'Close'}><X className="h-5 w-5" /></button>
        </header>

        <div className="space-y-5 p-5 sm:p-6">
          {queued ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
              <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">{isFa ? 'کمپین وارد صف شد' : 'Campaign queued'}</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-[var(--text-secondary)]">{isFa ? 'رضایت و فعال‌بودن کانال برای هر مخاطب دوباره بررسی می‌شود. نتیجه هر ارسال جداگانه ثبت خواهد شد.' : 'Consent and channel availability are rechecked per recipient. Each delivery result is recorded separately.'}</p>
              <button type="button" onClick={onClose} className="mt-6 min-h-11 rounded-xl bg-[var(--white)] px-5 text-sm font-medium text-[var(--bg-base)]">{isFa ? 'بستن' : 'Close'}</button>
            </div>
          ) : (
            <>
              <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] p-4">
                <div className="flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]"><Users className="h-4 w-4 text-violet-400" />{isFa ? '۱. پیش‌نمایش مخاطبان' : '1. Audience preview'}</h3>{previewing && <Loader2 className="h-4 w-4 animate-spin" />}</div>
                {preview && (
                  <div className="mt-4">
                    <div className="grid grid-cols-3 gap-2 text-center"><AudienceStat label={isFa ? 'مجاز برای ارسال' : 'Eligible'} value={preview.eligibleCount} tone="success" /><AudienceStat label={isFa ? 'بدون رضایت' : 'No consent'} value={preview.excludedNoConsent} tone="warning" /><AudienceStat label={isFa ? 'بدون کانال فعال' : 'No active channel'} value={preview.excludedNoChannel} tone="muted" /></div>
                    {preview.sample.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{preview.sample.map((item) => <span key={item.id} className="rounded-full border border-[var(--border-default)] px-2.5 py-1 text-[10px] text-[var(--text-secondary)]">{item.label} · {item.channel}</span>)}</div>}
                    {preview.capped && <p className="mt-3 text-[11px] text-amber-500">{isFa ? 'این کمپین برای ایمنی به ۵۰۰ مخاطب اول محدود شده است.' : 'For safety, this campaign is capped at the first 500 contacts.'}</p>}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] p-4">
                <h3 className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]"><Send className="h-4 w-4 text-violet-400" />{isFa ? '۲. متن و پیش‌نمایش' : '2. Message & preview'}</h3>
                <label className="mt-4 block"><span className="mb-1.5 block text-xs text-[var(--text-secondary)]">{isFa ? 'نام داخلی کمپین' : 'Internal campaign name'}</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} disabled={Boolean(campaign)} className="input" /></label>
                <label className="mt-3 block"><span className="mb-1.5 block text-xs text-[var(--text-secondary)]">{isFa ? 'پیام' : 'Message'}</span><textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} rows={5} disabled={Boolean(campaign)} className="input resize-y" /></label>
                <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-xs leading-6 text-[var(--text-secondary)]" dir="auto"><p className="whitespace-pre-wrap">{message || (isFa ? 'پیش‌نمایش پیام اینجا نمایش داده می‌شود.' : 'Message preview appears here.')}</p><p className="mt-2 border-t border-[var(--border-subtle)] pt-2 text-[10px] text-[var(--text-muted)]">{optOutFooter}</p></div>
              </section>

              {!campaign ? (
                <button type="button" onClick={createDraft} disabled={creating || !preview || preview.eligibleCount === 0 || !message.trim() || !name.trim()} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--white)] px-4 text-sm font-medium text-[var(--bg-base)] disabled:opacity-50">{creating && <Loader2 className="h-4 w-4 animate-spin" />}{isFa ? 'ساخت پیش‌نویس؛ هنوز ارسال نشود' : 'Create draft; do not send yet'}</button>
              ) : (
                <section className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"><AlertTriangle className="h-4 w-4 text-amber-500" />{isFa ? '۳. تأیید نهایی ارسال' : '3. Final delivery confirmation'}</h3>
                  <p className="mt-2 text-xs leading-6 text-[var(--text-secondary)]">{isFa ? `این اقدام پیام را برای ${campaign.expectedRecipientCount.toLocaleString('fa-IR')} مخاطب واجد شرایط وارد صف می‌کند و قابل بازگردانی نیست.` : `This queues the message for ${campaign.expectedRecipientCount} eligible recipients and cannot be undone.`}</p>
                  <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-amber-500/20 bg-[var(--bg-surface)] p-3"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 h-4 w-4 accent-amber-500" /><span className="text-xs leading-6 text-[var(--text-secondary)]">{isFa ? 'مخاطبان، متن و رضایت ثبت‌شده را بازبینی کردم و ارسال را تأیید می‌کنم.' : 'I reviewed the audience, message, and recorded consent and confirm delivery.'}</span></label>
                  <button type="button" onClick={confirmAndQueue} disabled={!confirmed || queueing} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-semibold text-zinc-950 disabled:opacity-50">{queueing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}{isFa ? 'تأیید نهایی و ورود به صف' : 'Final confirm and queue'}</button>
                </section>
              )}
              {error && <p className="text-xs text-danger" role="alert">{error}</p>}
            </>
          )}
        </div>
      </section>
    </div>
  )
}

function AudienceStat({ label, value, tone }: { label: string; value: number; tone: 'success' | 'warning' | 'muted' }) {
  return <div className={`rounded-xl border p-2.5 ${tone === 'success' ? 'border-emerald-500/20 bg-emerald-500/[0.06]' : tone === 'warning' ? 'border-amber-500/20 bg-amber-500/[0.06]' : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'}`}><span className="block text-lg font-semibold text-[var(--text-primary)]">{value.toLocaleString('fa-IR')}</span><span className="mt-0.5 block text-[9px] text-[var(--text-muted)]">{label}</span></div>
}
