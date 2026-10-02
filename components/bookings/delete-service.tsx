'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, PauseCircle, Trash2 } from 'lucide-react'
import { DialogShell } from '@/components/ui/dialog-shell'
import { num, type Locale, type ServiceRow } from '@/components/bookings/booking-model'

type Impact = { total: number; upcoming: number }

/**
 * Confirmation for permanently deleting a service. It first asks the server
 * what the delete would remove: upcoming bookings block it (those customers
 * still expect to show up), past bookings are listed so nothing disappears
 * by surprise. Pausing is offered as the reversible alternative.
 */
export function DeleteServicePanel({
  locale,
  service,
  onDeleted,
  onCancel,
  onPause,
}: {
  locale: Locale
  service: ServiceRow
  onDeleted: (serviceId: string) => void
  onCancel: () => void
  /** Reversible alternative; hidden when the service is already paused. */
  onPause?: () => Promise<void> | void
}) {
  const fa = locale === 'fa'
  const [impact, setImpact] = useState<Impact | null>(null)
  const [busy, setBusy] = useState<'delete' | 'pause' | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    fetch(`/api/appointments/services/${service.id}?impact=1`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error())))
      .then((data: { impact: Impact }) => { if (alive) setImpact(data.impact) })
      .catch(() => { if (alive) setError(fa ? 'اطلاعات نوبت‌های این خدمت دریافت نشد؛ دوباره تلاش کنید.' : 'Could not check this service’s bookings.') })
    return () => { alive = false }
  }, [service.id, fa])

  async function remove() {
    setBusy('delete')
    setError('')
    const response = await fetch(`/api/appointments/services/${service.id}`, { method: 'DELETE' }).catch(() => null)
    const data = await response?.json().catch(() => ({})) as { error?: string; upcoming?: number } | undefined
    setBusy(null)
    if (response?.ok) { onDeleted(service.id); return }
    if (data?.error === 'HAS_UPCOMING') {
      setImpact((value) => ({ total: value?.total ?? 0, upcoming: data.upcoming ?? 1 }))
      return
    }
    setError(fa ? 'حذف انجام نشد؛ دوباره تلاش کنید.' : 'Delete failed. Try again.')
  }

  async function pause() {
    if (!onPause) return
    setBusy('pause')
    try { await onPause() } finally { setBusy(null) }
  }

  const blocked = Boolean(impact?.upcoming)

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-red-500/10 text-red-600"><Trash2 className="h-5 w-5" /></span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-[var(--text-primary)]">{fa ? `حذف «${service.name}»` : `Delete “${service.name}”`}</p>
          <p className="mt-1 text-[13px] leading-6 text-[var(--text-secondary)]">
            {fa ? 'ایجنت دیگر این خدمت را معرفی نمی‌کند و برایش نوبت نمی‌دهد. این کار برگشت‌پذیر نیست.' : 'The agent stops offering it. This cannot be undone.'}
          </p>
        </div>
      </div>

      {!impact && !error && (
        <p className="flex items-center gap-2 rounded-2xl bg-[var(--bg-subtle)] px-3.5 py-3 text-xs text-[var(--text-muted)]"><Loader2 className="h-3.5 w-3.5 animate-spin" />{fa ? 'بررسی نوبت‌های این خدمت…' : 'Checking bookings…'}</p>
      )}

      {impact && blocked && (
        <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-amber-500/25 bg-amber-500/[0.08] px-3.5 py-3 text-[13px] leading-6 text-amber-900">
          <AlertTriangle className="mt-1 h-4 w-4 shrink-0" />
          <p>
            {fa
              ? <><b>{num(impact.upcoming, true)} نوبت آینده</b> برای این خدمت ثبت شده و مشتری‌ها منتظرش هستند. اول آن نوبت‌ها را از «برنامه» لغو یا جابه‌جا کنید؛ یا خدمت را غیرفعال کنید تا نوبت تازه‌ای ثبت نشود.</>
              : <><b>{impact.upcoming} upcoming bookings</b> still use this service. Cancel or move them first, or pause the service.</>}
          </p>
        </div>
      )}

      {impact && !blocked && (
        <p className="rounded-2xl bg-[var(--bg-subtle)] px-3.5 py-3 text-[13px] leading-6 text-[var(--text-secondary)]">
          {impact.total
            ? (fa ? `سابقه ${num(impact.total, true)} نوبت گذشته یا لغوشده این خدمت هم پاک می‌شود.` : `Its ${impact.total} past or cancelled bookings are removed too.`)
            : (fa ? 'این خدمت هیچ نوبتی ندارد.' : 'This service has no bookings.')}
          {' '}
          {fa ? 'اگر فقط می‌خواهید موقتاً نوبت نگیرد، غیرفعالش کنید.' : 'To stop it temporarily, pause it instead.'}
        </p>
      )}

      {error && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2.5 text-xs font-medium text-red-700">{error}</p>}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
        <button type="button" onClick={onCancel} className="min-h-11 rounded-xl border border-[var(--border-default)] bg-white px-4 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]">
          {fa ? 'انصراف' : 'Cancel'}
        </button>
        <span className="hidden flex-1 sm:block" aria-hidden />
        {onPause && service.active && (
          <button type="button" disabled={busy !== null} onClick={() => void pause()} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-default)] bg-white px-4 text-sm font-bold text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)] disabled:opacity-50">
            {busy === 'pause' ? <Loader2 className="h-4 w-4 animate-spin" /> : <PauseCircle className="h-4 w-4" />}
            {fa ? 'فقط غیرفعال شود' : 'Just pause it'}
          </button>
        )}
        <button
          type="button"
          data-dialog-initial-focus={blocked ? undefined : true}
          disabled={!impact || blocked || busy !== null}
          onClick={() => void remove()}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {fa ? 'حذف برای همیشه' : 'Delete forever'}
        </button>
      </div>
    </div>
  )
}

export function DeleteServiceDialog(props: Parameters<typeof DeleteServicePanel>[0]) {
  const fa = props.locale === 'fa'
  return (
    <DialogShell compact title={fa ? 'حذف خدمت' : 'Delete service'} onClose={props.onCancel}>
      <DeleteServicePanel {...props} />
    </DialogShell>
  )
}
