'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, CalendarCheck2, CalendarDays, Loader2, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DialogShell } from '@/components/ui/dialog-shell'
import { LocalizedDatePicker } from '@/components/ui/localized-date-picker'
import { dateKeyInTimeZone } from '@/lib/bookings/time'
import { dateLocaleTag, formatDateKey } from '@/lib/localized-date'
import { Stepper } from '@/components/bookings/service-editor'
import { formatClock } from '@/components/ui/time-picker'
import {
  DAY_PARTS,
  bookingErrorMessage,
  dayPartOfMinute,
  durationLabel,
  num,
  shiftDateKey,
  weekdayOf,
  type AppointmentRow,
  type DayPart,
  type Locale,
  type ServiceRow,
  type SlotRow,
} from '@/components/bookings/booking-model'

/** Persian/Arabic-Indic digits → ASCII, so «۰۹۱۲…» counts as a phone number. */
function latinDigits(value: string): string {
  return value.replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
}

function serviceOpenOn(service: ServiceRow | undefined, dateKey: string): boolean {
  if (!service) return false
  const exception = service.exceptions.find((item) => item.date === dateKey)
  if (exception) return !exception.closed
  const weekday = weekdayOf(dateKey)
  return service.weeklyRules.some((rule) => rule.active && rule.weekday === weekday)
}

export function BookingDialog({
  locale,
  services,
  initialDate,
  initialServiceId,
  reschedule,
  onClose,
  onDone,
}: {
  locale: Locale
  services: ServiceRow[]
  initialDate: string
  initialServiceId?: string
  /** When set, the dialog moves this appointment instead of creating one. */
  reschedule?: AppointmentRow | null
  onClose: () => void
  onDone: (date: string) => void
}) {
  const fa = locale === 'fa'
  const [serviceId, setServiceId] = useState(
    reschedule?.serviceId
      ?? (initialServiceId && services.some((item) => item.id === initialServiceId) ? initialServiceId : services[0]?.id)
      ?? '',
  )
  const service = services.find((item) => item.id === serviceId)
  const timezone = service?.timezone ?? 'Asia/Tehran'
  const today = dateKeyInTimeZone(new Date(), timezone)
  // Open on a day that can actually be booked: if the requested day is closed
  // for this service, start on its next open day within the two-week strip.
  const [date, setDate] = useState(() => {
    const wanted = initialDate < today ? today : initialDate
    if (reschedule || serviceOpenOn(service, wanted)) return wanted
    for (let index = 0; index < 14; index++) {
      const key = shiftDateKey(today, index)
      if (key >= wanted && serviceOpenOn(service, key)) return key
    }
    return wanted
  })
  const [partySize, setPartySize] = useState(reschedule?.partySize ?? 1)
  const [slots, setSlots] = useState<SlotRow[]>([])
  const [slot, setSlot] = useState<number | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const strip = useMemo(() => Array.from({ length: 14 }, (_, index) => shiftDateKey(today, index)), [today])

  // Switching to a service that is closed on the chosen day moves to its next open day.
  function chooseService(id: string) {
    setServiceId(id)
    const next = services.find((item) => item.id === id)
    if (!next || serviceOpenOn(next, date)) return
    const open = strip.find((key) => key >= date && serviceOpenOn(next, key)) ?? strip.find((key) => serviceOpenOn(next, key))
    if (open) setDate(open)
  }

  useEffect(() => {
    if (!serviceId || !date) return
    const controller = new AbortController()
    setLoadingSlots(true)
    setSlot(null)
    setError('')
    fetch(`/api/appointments/slots?${new URLSearchParams({ serviceId, date, partySize: String(partySize) })}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { slots?: SlotRow[] }
        if (!response.ok || !data.slots) throw new Error()
        setSlots(data.slots)
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setSlots([])
        setError(fa ? 'زمان‌های آزاد دریافت نشد.' : 'Could not load available times.')
      })
      .finally(() => { if (!controller.signal.aborted) setLoadingSlots(false) })
    return () => controller.abort()
  }, [serviceId, date, partySize, fa, refreshKey])

  const grouped = useMemo(() => {
    const groups: Record<DayPart, SlotRow[]> = { morning: [], afternoon: [], evening: [] }
    for (const item of slots) groups[dayPartOfMinute(item.startMinute)].push(item)
    return (Object.keys(groups) as DayPart[]).filter((key) => groups[key].length).map((key) => ({ key, items: groups[key] }))
  }, [slots])

  const customerValid = reschedule ? true : name.trim().length >= 2 && latinDigits(phone).replace(/\D/g, '').length >= 10
  const canSubmit = !saving && slot !== null && customerValid

  async function submit() {
    if (!canSubmit || slot === null) return
    setSaving(true)
    setError('')
    try {
      const response = reschedule
        ? await fetch(`/api/appointments/${reschedule.id}/reschedule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ localDate: date, startMinute: slot }),
          })
        : await fetch('/api/appointments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              serviceId,
              localDate: date,
              startMinute: slot,
              partySize,
              customerName: name.trim(),
              customerPhone: phone.trim(),
              notes: notes.trim() || undefined,
              source: 'dashboard',
              idempotencyKey: `dashboard:${crypto.randomUUID()}`,
            }),
          })
      const data = await response.json().catch(() => ({})) as { error?: string; issues?: { fieldErrors?: Record<string, string[]> } }
      if (!response.ok) {
        if (data.issues?.fieldErrors?.customerPhone) throw new Error('PHONE')
        throw new Error(data.error ?? 'FAILED')
      }
      onDone(date)
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : undefined
      setError(code === 'PHONE'
        ? (fa ? 'شماره موبایل معتبر نیست (مثلاً ۰۹۱۲۱۲۳۴۵۶۷).' : 'Enter a valid mobile number.')
        : bookingErrorMessage(code, fa))
      if (code === 'CAPACITY_EXCEEDED' || code === 'SLOT_IN_PAST') {
        // Refresh the grid so the taken time disappears.
        setRefreshKey((value) => value + 1)
      }
    } finally {
      setSaving(false)
    }
  }

  const chosenLabel = slot !== null
    ? `${formatDateKey(date, locale, { weekday: 'long', day: 'numeric', month: 'long' })} · ${formatClock(slot, fa)}`
    : null

  return (
    <DialogShell
      wide
      title={reschedule ? (fa ? 'جابه‌جایی نوبت' : 'Reschedule appointment') : (fa ? 'ثبت نوبت جدید' : 'New appointment')}
      subtitle={reschedule
        ? (fa ? `${reschedule.customerName} · ${reschedule.serviceName}؛ نوبت قبلی بعد از ثبت زمان جدید آزاد می‌شود.` : `${reschedule.customerName} · ${reschedule.serviceName}. The old time frees up once the new one is saved.`)
        : (fa ? 'فقط زمان‌هایی که واقعاً ظرفیت دارند نمایش داده می‌شوند.' : 'Only times with real remaining capacity are shown.')}
      onClose={onClose}
    >
      <div className="space-y-6">
        {!reschedule && services.length > 1 && (
          <div>
            <StepLabel index={1} text={fa ? 'خدمت' : 'Service'} />
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
              {services.map((item) => {
                const active = item.id === serviceId
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => chooseService(item.id)}
                    aria-pressed={active}
                    className={cn(
                      'spatial-press flex shrink-0 items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-start transition-colors',
                      active ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white' : 'border-[var(--border-default)] bg-white hover:border-[var(--border-strong)]',
                    )}
                  >
                    <span>
                      <span className="block text-[13px] font-bold">{item.name}</span>
                      <span className={cn('block text-[12px]', active ? 'text-white/70' : 'text-[var(--text-muted)]')}>{durationLabel(item.durationMinutes, fa)}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {service?.location && (
          <p className="-mt-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><MapPin className="h-3.5 w-3.5" />{service.location}</p>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <StepLabel index={reschedule || services.length <= 1 ? 1 : 2} text={fa ? 'روز' : 'Day'} inline />
            <button type="button" onClick={() => setPickerOpen((value) => !value)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
              <CalendarDays className="h-3.5 w-3.5" />{fa ? 'تاریخ دیگر' : 'Other date'}
            </button>
          </div>
          {pickerOpen && (
            <div className="mb-2">
              <LocalizedDatePicker value={date} onValueChange={(value) => { setDate(value); setPickerOpen(false) }} locale={locale} min={today} timeZone={timezone} ariaLabel={fa ? 'انتخاب تاریخ نوبت' : 'Choose date'} />
            </div>
          )}
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            {strip.map((key) => {
              const open = serviceOpenOn(service, key)
              const active = key === date
              const dateObj = new Date(`${key}T12:00:00Z`)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDate(key)}
                  disabled={!open && !active}
                  aria-pressed={active}
                  className={cn(
                    'flex w-[3.6rem] shrink-0 flex-col items-center rounded-2xl border py-2 transition-colors',
                    active
                      ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white'
                      : open
                        ? 'border-[var(--border-default)] bg-white text-[var(--text-primary)] hover:border-[var(--border-strong)]'
                        : 'cursor-not-allowed border-transparent bg-black/[0.04] text-[var(--text-hint)]',
                  )}
                >
                  <span className={cn('text-[12px] font-medium', active ? 'text-white/70' : open ? 'text-[var(--text-muted)]' : 'text-[var(--text-hint)]')}>
                    {key === today ? (fa ? 'امروز' : 'Today') : new Intl.DateTimeFormat(dateLocaleTag(locale), { weekday: 'short', timeZone: 'UTC' }).format(dateObj)}
                  </span>
                  <span className="text-base font-bold tabular-nums">{new Intl.DateTimeFormat(dateLocaleTag(locale), { day: 'numeric', timeZone: 'UTC' }).format(dateObj)}</span>
                  {open
                    ? <span className={cn('mt-0.5 h-1 w-1 rounded-full', active ? 'bg-white' : 'bg-emerald-500')} />
                    : <span className="text-[12px] leading-4">{fa ? 'تعطیل' : 'Closed'}</span>}
                </button>
              )
            })}
          </div>
          {!strip.includes(date) && (
            <p className="mt-2 text-xs font-medium text-[var(--text-primary)]">{formatDateKey(date, locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          )}
        </div>

        <div>
          <StepLabel index={reschedule || services.length <= 1 ? 2 : 3} text={fa ? 'ساعت' : 'Time'} />
          <div className="min-h-24 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
            {loadingSlots ? (
              <div className="grid min-h-20 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" /></div>
            ) : grouped.length ? (
              <div className="space-y-3">
                {grouped.map((group) => {
                  const part = DAY_PARTS[group.key]
                  return (
                    <div key={group.key}>
                      <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold text-[var(--text-muted)]"><part.Icon className="h-3.5 w-3.5" />{fa ? part.fa : part.en}</p>
                      <div className="flex flex-wrap gap-1.5" dir="ltr">
                        {group.items.map((item) => {
                          const active = slot === item.startMinute
                          const low = service && service.capacity > 1 && item.remainingCapacity <= Math.max(1, Math.floor(service.capacity / 4))
                          return (
                            <button
                              key={item.startMinute}
                              type="button"
                              onClick={() => setSlot(item.startMinute)}
                              aria-pressed={active}
                              title={service && service.capacity > 1 ? (fa ? `${num(item.remainingCapacity, true)} جای خالی` : `${item.remainingCapacity} left`) : undefined}
                              className={cn(
                                'spatial-press relative min-h-10 min-w-[4.25rem] rounded-xl border px-3 text-[13px] font-bold tabular-nums transition-colors',
                                active
                                  ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white'
                                  : 'border-[var(--border-default)] bg-white text-[var(--text-primary)] hover:border-[var(--text-primary)]',
                              )}
                            >
                              {formatClock(item.startMinute, fa)}
                              {low && !active && <span className="absolute -end-1 -top-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="grid min-h-20 place-items-center text-center">
                <p className="text-xs text-[var(--text-muted)]">
                  {serviceOpenOn(service, date)
                    ? (fa ? 'همه زمان‌های این روز پر شده یا گذشته است.' : 'Every time on this day is full or has passed.')
                    : (fa ? 'این خدمت در این روز تعطیل است.' : 'This service is closed on this day.')}
                </p>
              </div>
            )}
          </div>
        </div>

        {!reschedule && (
          <div>
            <StepLabel index={services.length <= 1 ? 3 : 4} text={fa ? 'مشتری' : 'Customer'} />
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} className="input min-h-12 w-full" placeholder={fa ? 'نام و نام خانوادگی' : 'Full name'} aria-label={fa ? 'نام مشتری' : 'Customer name'} />
              <input dir="ltr" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={20} placeholder="09xx xxx xxxx" className="input min-h-12 w-full text-left tabular-nums" aria-label={fa ? 'شماره موبایل' : 'Mobile'} />
              <input value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} className="input min-h-12 w-full sm:col-span-2" placeholder={fa ? 'یادداشت برای تیم (اختیاری)' : 'Note for the team (optional)'} aria-label={fa ? 'یادداشت' : 'Note'} />
            </div>
            {service && service.capacity > 1 && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2.5">
                <span className="text-sm font-medium text-[var(--text-secondary)]">{fa ? 'تعداد نفرات' : 'Party size'}</span>
                <Stepper value={partySize} min={1} max={service.capacity} onChange={setPartySize} fa={fa} />
              </div>
            )}
          </div>
        )}

        {error && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2.5 text-xs font-medium text-red-700">{error}</p>}

        <div className="sticky bottom-0 -mx-4 -mb-4 border-t border-[var(--border-subtle)] bg-white/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:-mb-5 sm:px-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <p className="min-w-0 flex-1 truncate text-xs text-[var(--text-muted)]">
              {chosenLabel ? <><span className="font-bold text-[var(--text-primary)]">{chosenLabel}</span>{service ? ` · ${service.name}` : ''}</> : (fa ? 'یک زمان آزاد انتخاب کنید.' : 'Pick a free time.')}
            </p>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!canSubmit}
              className="spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--text-primary)] px-6 text-sm font-bold text-white shadow-[var(--shadow-control)] transition-opacity hover:opacity-90 disabled:opacity-45"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : reschedule ? <ArrowLeftRight className="h-4 w-4" /> : <CalendarCheck2 className="h-4 w-4" />}
              {reschedule ? (fa ? 'انتقال به این زمان' : 'Move to this time') : (fa ? 'ثبت در تقویم' : 'Add to calendar')}
            </button>
          </div>
        </div>
      </div>
    </DialogShell>
  )
}

function StepLabel({ index, text, inline = false }: { index: number; text: string; inline?: boolean }) {
  return (
    <p className={cn('flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)]', !inline && 'mb-2')}>
      <span className="grid h-5 w-5 place-items-center rounded-full bg-black/[0.06] text-[12px] text-[var(--text-primary)]">{num(index, true)}</span>
      {text}
    </p>
  )
}
