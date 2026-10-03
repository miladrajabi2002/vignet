'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  CalendarOff,
  Check,
  ChevronDown,
  Copy,
  Eye,
  Loader2,
  Minus,
  Plus,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toEnglishDigits } from '@/lib/phone'
import { SideSheet } from '@/components/ui/side-sheet'
import { Switch } from '@/components/ui/switch'
import { LocalizedDatePicker } from '@/components/ui/localized-date-picker'
import { buildAvailableSlots } from '@/lib/bookings/availability'
import { dateKeyInTimeZone } from '@/lib/bookings/time'
import { formatDateKey } from '@/lib/localized-date'
import { TimeRangeField, formatClock } from '@/components/ui/time-picker'
import { DeleteServicePanel } from '@/components/bookings/delete-service'
import { enableBookingModule, openBookingSetup } from '@/components/services/enable-booking'
import {
  WEEKDAYS,
  durationLabel,
  num,
  serviceFromApi,
  shiftDateKey,
  weekdayOf,
  type Locale,
  type ServiceRow,
} from '@/components/bookings/booking-model'

type Range = { start: number; end: number }
type Week = Record<number, { enabled: boolean; ranges: Range[] }>

export interface ServiceTemplate {
  key: string
  fa: string
  en: string
  hintFa: string
  hintEn: string
  duration: number
  interval: number
  capacity: number
  locationFa?: string
}

export const SERVICE_TEMPLATES: ServiceTemplate[] = [
  { key: 'consult', fa: 'مشاوره آنلاین', en: 'Online consultation', hintFa: '۳۰ دقیقه · یک نفر', hintEn: '30 min · 1 person', duration: 30, interval: 30, capacity: 1, locationFa: 'آنلاین؛ لینک جلسه بعد از رزرو ارسال می‌شود' },
  { key: 'visit', fa: 'ویزیت حضوری', en: 'In-person visit', hintFa: '۶۰ دقیقه · یک نفر', hintEn: '60 min · 1 person', duration: 60, interval: 30, capacity: 1 },
  { key: 'beauty', fa: 'خدمات زیبایی', en: 'Beauty service', hintFa: '۴۵ دقیقه · دو صندلی', hintEn: '45 min · 2 chairs', duration: 45, interval: 15, capacity: 2 },
  { key: 'class', fa: 'کلاس گروهی', en: 'Group class', hintFa: '۹۰ دقیقه · ۱۲ نفر', hintEn: '90 min · 12 people', duration: 90, interval: 90, capacity: 12 },
  { key: 'table', fa: 'رزرو میز', en: 'Table booking', hintFa: '۹۰ دقیقه · ۱۰ نفر', hintEn: '90 min · 10 seats', duration: 90, interval: 30, capacity: 10 },
]

const DURATIONS = [15, 30, 45, 60, 90, 120]
const BUFFERS = [0, 5, 10, 15, 30]

function defaultWeek(): Week {
  const week: Week = {}
  for (const day of WEEKDAYS) {
    week[day.value] = day.value === 5
      ? { enabled: false, ranges: [{ start: 540, end: 1020 }] }
      : day.value === 4
        ? { enabled: true, ranges: [{ start: 540, end: 780 }] }
        : { enabled: true, ranges: [{ start: 540, end: 1020 }] }
  }
  return week
}

function weekFromService(service: ServiceRow): Week {
  const week: Week = {}
  for (const day of WEEKDAYS) {
    const rules = service.weeklyRules
      .filter((rule) => rule.active && rule.weekday === day.value)
      .sort((a, b) => a.startMinute - b.startMinute)
    week[day.value] = rules.length
      ? { enabled: true, ranges: rules.map((rule) => ({ start: rule.startMinute, end: rule.endMinute })) }
      : { enabled: false, ranges: [{ start: 540, end: 1020 }] }
  }
  return week
}

function rangeMinutes(range: Range): Range {
  return range
}

function dayIssues(day: Week[number]): string | null {
  if (!day.enabled) return null
  const ranges = day.ranges.map(rangeMinutes).sort((a, b) => a.start - b.start)
  for (const range of ranges) {
    if (!Number.isFinite(range.start) || !Number.isFinite(range.end)) return 'INVALID'
    if (range.end <= range.start) return 'ORDER'
  }
  for (let index = 1; index < ranges.length; index++) {
    if (ranges[index].start < ranges[index - 1].end) return 'OVERLAP'
  }
  return null
}

export function ServiceEditor({
  locale,
  service,
  template,
  onClose,
  onSaved,
  onDeleted,
  variant = 'booking',
  bookingEnabled = true,
}: {
  /** `catalog`: describe the service only (no hours/capacity) — used by /services. */
  variant?: 'booking' | 'catalog'
  /** Catalog only: whether the bookings section is already in the menu. */
  bookingEnabled?: boolean
  locale: Locale
  /** Existing service to edit; omitted when creating. */
  service?: ServiceRow | null
  /** Optional starting template for a new service. */
  template?: ServiceTemplate | null
  onClose: () => void
  /** `keepOpen` is set for in-place changes (closures) that must not close the sheet. */
  onSaved: (service: ServiceRow, created: boolean, keepOpen?: boolean) => void
  /** Enables the delete zone for an existing service. */
  onDeleted?: (serviceId: string) => void
}) {
  const fa = locale === 'fa'
  const editing = Boolean(service)
  const [current, setCurrent] = useState<ServiceRow | null>(service ?? null)
  const [name, setName] = useState(service?.name ?? (template ? (fa ? template.fa : template.en) : ''))
  const [description, setDescription] = useState(service?.description ?? '')
  const [location, setLocation] = useState(service?.location ?? (fa ? template?.locationFa ?? '' : ''))
  const [price, setPrice] = useState(service?.price ? String(service.price) : '')
  const [duration, setDuration] = useState(service?.durationMinutes ?? template?.duration ?? 60)
  const [interval, setIntervalMinutes] = useState(service?.slotIntervalMinutes ?? template?.interval ?? 30)
  const [capacity, setCapacity] = useState(service?.capacity ?? template?.capacity ?? 1)
  const [bufferBefore, setBufferBefore] = useState(service?.bufferBeforeMinutes ?? 0)
  const [bufferAfter, setBufferAfter] = useState(service?.bufferAfterMinutes ?? 0)
  const [week, setWeek] = useState<Week>(() => (service ? weekFromService(service) : defaultWeek()))
  const [advancedOpen, setAdvancedOpen] = useState(Boolean(service && (service.bufferBeforeMinutes || service.bufferAfterMinutes)))
  const [customDuration, setCustomDuration] = useState(!DURATIONS.includes(service?.durationMinutes ?? template?.duration ?? 60))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [touched, setTouched] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [bookingBusy, setBookingBusy] = useState(false)
  const timezone = current?.timezone ?? 'Asia/Tehran'

  const issues = useMemo(() => {
    const byDay = Object.fromEntries(WEEKDAYS.map((day) => [day.value, dayIssues(week[day.value])])) as Record<number, string | null>
    const enabledDays = WEEKDAYS.filter((day) => week[day.value].enabled)
    const longest = Math.max(0, ...enabledDays.flatMap((day) => week[day.value].ranges.map((range) => {
      const minutes = rangeMinutes(range)
      return minutes.end - minutes.start
    })))
    return {
      byDay,
      name: name.trim().length < 2,
      noDays: enabledDays.length === 0,
      anyDay: Object.values(byDay).some(Boolean),
      tooLong: enabledDays.length > 0 && duration > longest,
      duration: !Number.isInteger(duration) || duration < 10 || duration > 480,
      interval: !Number.isInteger(interval) || interval < 5 || interval > 240,
    }
  }, [week, name, duration, interval])
  const catalog = variant === 'catalog'
  const invalid = catalog
    ? issues.name || issues.duration
    : issues.name || issues.noDays || issues.anyDay || issues.tooLong || issues.duration || issues.interval

  const rules = useMemo(() => WEEKDAYS.flatMap((day) => {
    const value = week[day.value]
    if (!value.enabled) return []
    return value.ranges.map((range) => {
      const minutes = rangeMinutes(range)
      return { weekday: day.value, startMinute: minutes.start, endMinute: minutes.end, active: true }
    })
  }), [week])

  // What a customer would be offered on the next open day, with an empty
  // calendar — makes duration/interval/hours tangible before saving.
  const preview = useMemo(() => {
    if (invalid) return null
    const today = dateKeyInTimeZone(new Date(), timezone)
    for (let offset = 1; offset <= 7; offset++) {
      const dateKey = shiftDateKey(today, offset)
      if (!week[weekdayOf(dateKey)]?.enabled) continue
      try {
        const slots = buildAvailableSlots({
          dateKey,
          timeZone: timezone,
          durationMinutes: duration,
          slotIntervalMinutes: interval,
          bufferBeforeMinutes: bufferBefore,
          bufferAfterMinutes: bufferAfter,
          defaultCapacity: capacity,
          weeklyRules: rules.map((rule) => ({ ...rule, capacity: null })),
          appointments: [],
        })
        return { dateKey, slots }
      } catch {
        return null
      }
    }
    return null
  }, [invalid, timezone, week, duration, interval, bufferBefore, bufferAfter, capacity, rules])

  function applyTemplate(item: ServiceTemplate) {
    setName(fa ? item.fa : item.en)
    setDuration(item.duration)
    setIntervalMinutes(item.interval)
    setCapacity(item.capacity)
    setCustomDuration(!DURATIONS.includes(item.duration))
    if (fa && item.locationFa && !location) setLocation(item.locationFa)
  }

  function updateDay(weekday: number, next: Partial<Week[number]>) {
    setWeek((value) => ({ ...value, [weekday]: { ...value[weekday], ...next } }))
  }

  function updateRange(weekday: number, index: number, next: Range) {
    setWeek((value) => ({
      ...value,
      [weekday]: {
        ...value[weekday],
        ranges: value[weekday].ranges.map((range, position) => (position === index ? { ...range, ...next } : range)),
      },
    }))
  }

  function addRange(weekday: number) {
    setWeek((value) => {
      const ranges = value[weekday].ranges
      const last = ranges[ranges.length - 1]
      const lastEnd = last ? last.end : 9 * 60
      const start = Math.min(lastEnd + 60, 22 * 60)
      const end = Math.min(start + 3 * 60, 1440)
      return { ...value, [weekday]: { ...value[weekday], ranges: [...ranges, { start, end }] } }
    })
  }

  function removeRange(weekday: number, index: number) {
    setWeek((value) => {
      const ranges = value[weekday].ranges.filter((_, position) => position !== index)
      return { ...value, [weekday]: { enabled: ranges.length > 0 && value[weekday].enabled, ranges: ranges.length ? ranges : [{ start: 540, end: 1020 }] } }
    })
  }

  function copyToOpenDays(weekday: number) {
    setWeek((value) => {
      const source = value[weekday]
      const next: Week = { ...value }
      for (const day of WEEKDAYS) {
        if (day.value === weekday || !value[day.value].enabled) continue
        next[day.value] = { enabled: true, ranges: source.ranges.map((range) => ({ ...range })) }
      }
      return next
    })
  }

  async function save(options: { keepOpen?: boolean } = {}): Promise<ServiceRow | null> {
    setTouched(true)
    if (invalid) return null
    setSaving(true)
    setError('')
    try {
      const response = await fetch(current ? `/api/appointments/services/${current.id}` : '/api/appointments/services', {
        method: current ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || (current ? null : undefined),
          location: location.trim() || (current ? null : undefined),
          price: Number(price) > 0 ? Number(price) : (current ? null : undefined),
          durationMinutes: duration,
          // The catalog editor never touches an existing booking schedule.
          ...(catalog
            ? (current ? {} : { weeklyRules: [] })
            : {
                slotIntervalMinutes: interval,
                bufferBeforeMinutes: bufferBefore,
                bufferAfterMinutes: bufferAfter,
                capacity,
                timezone,
                weeklyRules: rules,
              }),
        }),
      })
      const data = await response.json().catch(() => ({})) as { service?: Record<string, unknown>; error?: string }
      if (!response.ok || !data.service) throw new Error(data.error ?? 'FAILED')
      const saved = serviceFromApi(data.service)
      if (options.keepOpen) setCurrent(saved)
      onSaved(saved, !current, options.keepOpen)
      return saved
    } catch (reason) {
      setError(reason instanceof Error && reason.message === 'PLAN_BLOCKED'
        ? (fa ? 'پلن فضای کاری فعال نیست؛ برای ذخیره، پلن را تمدید کنید.' : 'Your plan is inactive.')
        : (fa ? 'ذخیره نشد؛ اتصال را بررسی کنید و دوباره تلاش کنید.' : 'Could not save. Check your connection and retry.'))
    } finally {
      setSaving(false)
    }
    return null
  }

  // Catalog → bookings hand-off. What was typed is saved first; when the
  // bookings section is not in the menu yet it is switched on, then the
  // booking editor opens on this very service.
  async function goToBooking() {
    setBookingBusy(true)
    setError('')
    const saved = await save({ keepOpen: true })
    if (!saved) { setBookingBusy(false); return }
    if (!bookingEnabled && !(await enableBookingModule(locale))) {
      setBookingBusy(false)
      setError(fa ? 'رزرو آنلاین فعال نشد؛ دوباره تلاش کنید.' : 'Could not turn on bookings. Try again.')
      return
    }
    openBookingSetup(saved.id)
  }

  const footer = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="spatial-press inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--text-primary)] px-5 text-sm font-bold text-white shadow-[var(--shadow-control)] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {editing ? (fa ? 'ذخیره تغییرات' : 'Save changes') : catalog ? (fa ? 'ساخت خدمت' : 'Create service') : (fa ? 'ساخت خدمت و باز کردن رزرو' : 'Create and open booking')}
      </button>
      <button type="button" onClick={onClose} className="min-h-12 rounded-2xl border border-[var(--border-default)] px-5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]">
        {fa ? 'انصراف' : 'Cancel'}
      </button>
    </div>
  )

  return (
    <SideSheet
      title={editing ? (fa ? 'ویرایش خدمت' : 'Edit service') : (fa ? 'خدمت جدید' : 'New service')}
      subtitle={catalog
        ? (fa ? 'ایجنت این خدمت را با همین نام، توضیح و مدت به مشتری معرفی می‌کند.' : 'The agent introduces this service to customers exactly as described.')
        : (fa ? 'ایجنت دقیقاً همین ساعت‌ها و ظرفیت را به مشتری پیشنهاد می‌دهد.' : 'The agent offers customers exactly these hours and this capacity.')}
      onClose={onClose}
      footer={footer}
      closeLabel={fa ? 'بستن' : 'Close'}
    >
      <div className="space-y-7">
        {!editing && (
          <section>
            <p className="ui-caption mb-2">{fa ? 'شروع سریع با یک الگو' : 'Quick start from a template'}</p>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
              {SERVICE_TEMPLATES.map((item) => {
                const active = name === (fa ? item.fa : item.en)
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => applyTemplate(item)}
                    aria-pressed={active}
                    className={cn(
                      'spatial-press shrink-0 rounded-2xl border px-3.5 py-2.5 text-start transition-colors',
                      active ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white' : 'border-[var(--border-default)] bg-white hover:border-[var(--border-strong)]',
                    )}
                  >
                    <span className="block text-[13px] font-bold">{fa ? item.fa : item.en}</span>
                    <span className={cn('mt-0.5 block text-[12px]', active ? 'text-white/70' : 'text-[var(--text-muted)]')}>{fa ? item.hintFa : item.hintEn}</span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* 1 — basics */}
        <Section index={1} title={fa ? 'مشخصات خدمت' : 'Service details'}>
          <div className="grid gap-3">
            <Field label={fa ? 'نام خدمت' : 'Service name'} error={touched && issues.name ? (fa ? 'نام خدمت را بنویسید (حداقل ۲ حرف).' : 'Enter a name (2+ characters).') : undefined}>
              <input
                data-sheet-initial-focus
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                placeholder={fa ? 'مثلاً: مشاوره پوست، کوتاهی مو، جلسه آموزشی' : 'e.g. Skin consultation'}
                className="input min-h-12 w-full"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={fa ? 'محل یا لینک جلسه' : 'Location or link'} hint={fa ? 'اختیاری · ایجنت به مشتری می‌گوید' : 'Optional · shared by the agent'}>
                <input value={location} onChange={(event) => setLocation(event.target.value)} maxLength={250} className="input min-h-12 w-full" placeholder={fa ? 'آدرس، شعبه یا «آنلاین»' : 'Address, branch or "online"'} />
              </Field>
              <Field label={fa ? 'توضیح کوتاه' : 'Short description'} hint={fa ? 'اختیاری' : 'Optional'}>
                <input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} className="input min-h-12 w-full" placeholder={fa ? 'چه چیزی شامل می‌شود؟' : 'What is included?'} />
              </Field>
              <Field label={fa ? 'قیمت (تومان)' : 'Price (Toman)'} hint={fa ? 'اختیاری · خالی یعنی ایجنت قیمت نمی‌گوید' : 'Optional · empty means the agent won’t quote'}>
                <input
                  value={price ? Number(price).toLocaleString(fa ? 'fa-IR' : 'en-US') : ''}
                  onChange={(event) => setPrice(toEnglishDigits(event.target.value).replace(/\D/g, '').slice(0, 11))}
                  inputMode="numeric"
                  dir="ltr"
                  className="input min-h-12 w-full text-start"
                  placeholder={fa ? 'مثلاً ۵۰۰٬۰۰۰' : 'e.g. 500,000'}
                />
              </Field>
            </div>
          </div>
        </Section>

        {/* 2 — timing & capacity */}
        <Section index={2} title={catalog ? (fa ? 'مدت خدمت' : 'Duration') : (fa ? 'مدت، فاصله و ظرفیت' : 'Duration, spacing & capacity')}>
          <div className="space-y-5">
            <div>
              <Label text={fa ? 'مدت هر نوبت' : 'Appointment length'} />
              <div className="flex flex-wrap gap-2">
                {DURATIONS.map((value) => (
                  <Chip key={value} active={!customDuration && duration === value} onClick={() => { setCustomDuration(false); setDuration(value) }}>
                    {durationLabel(value, fa)}
                  </Chip>
                ))}
                <Chip active={customDuration} onClick={() => setCustomDuration(true)}>{fa ? 'دلخواه' : 'Custom'}</Chip>
                {customDuration && (
                  <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-default)] bg-white px-3">
                    <input
                      type="number"
                      min={10}
                      max={480}
                      step={5}
                      value={duration}
                      onChange={(event) => setDuration(Math.round(Number(event.target.value) || 0))}
                      className="w-16 bg-transparent text-center text-sm font-bold tabular-nums outline-none"
                      aria-label={fa ? 'مدت به دقیقه' : 'Minutes'}
                    />
                    <span className="text-xs text-[var(--text-muted)]">{fa ? 'دقیقه' : 'min'}</span>
                  </label>
                )}
              </div>
              {issues.duration && <InlineError text={fa ? 'مدت باید بین ۱۰ تا ۴۸۰ دقیقه باشد.' : 'Use 10–480 minutes.'} />}
            </div>

            {!catalog && (<>
            <div>
              <Label text={fa ? 'شروع نوبت‌ها هر چند دقیقه؟' : 'Start a slot every'} hint={fa ? 'مثلاً با مدت ۶۰ و فاصله ۳۰: ۹:۰۰، ۹:۳۰، ۱۰:۰۰…' : 'e.g. 60 min length, every 30: 9:00, 9:30, 10:00…'} />
              <div className="flex flex-wrap gap-2">
                {[...new Set([15, 30, 60, duration])].sort((a, b) => a - b).filter((value) => value >= 5 && value <= 240).map((value) => (
                  <Chip key={value} active={interval === value} onClick={() => setIntervalMinutes(value)}>
                    {value === duration ? (fa ? `پشت‌سرهم (${num(value, true)})` : `Back-to-back (${value})`) : durationLabel(value, fa)}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3.5">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[var(--text-primary)]">{fa ? 'ظرفیت هم‌ زمان' : 'Concurrent capacity'}</p>
                <p className="ui-caption">{fa ? 'چند مشتری می‌توانند در یک زمان رزرو کنند (صندلی، اتاق، نفر).' : 'How many customers can book the same time.'}</p>
              </div>
              <Stepper value={capacity} min={1} max={100} onChange={setCapacity} fa={fa} />
            </div>

            <div className="rounded-2xl border border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setAdvancedOpen((value) => !value)}
                aria-expanded={advancedOpen}
                className="flex min-h-12 w-full items-center justify-between gap-2 px-3.5 text-sm font-medium text-[var(--text-secondary)]"
              >
                <span>{fa ? 'زمان آماده‌سازی بین نوبت‌ها' : 'Prep time between appointments'}{(bufferBefore || bufferAfter) ? <span className="ui-chip ui-chip-neutral ms-2">{fa ? 'فعال' : 'On'}</span> : null}</span>
                <ChevronDown className={cn('h-4 w-4 transition-transform', advancedOpen && 'rotate-180')} />
              </button>
              {advancedOpen && (
                <div className="grid gap-4 border-t border-[var(--border-subtle)] p-3.5 sm:grid-cols-2">
                  <div>
                    <Label text={fa ? 'قبل از هر نوبت' : 'Before each'} />
                    <div className="flex flex-wrap gap-1.5">
                      {BUFFERS.map((value) => <Chip key={value} small active={bufferBefore === value} onClick={() => setBufferBefore(value)}>{value ? durationLabel(value, fa) : (fa ? 'بدون' : 'None')}</Chip>)}
                    </div>
                  </div>
                  <div>
                    <Label text={fa ? 'بعد از هر نوبت' : 'After each'} />
                    <div className="flex flex-wrap gap-1.5">
                      {BUFFERS.map((value) => <Chip key={value} small active={bufferAfter === value} onClick={() => setBufferAfter(value)}>{value ? durationLabel(value, fa) : (fa ? 'بدون' : 'None')}</Chip>)}
                    </div>
                  </div>
                </div>
              )}
            </div>
            </>)}
          </div>
        </Section>

        {catalog ? (
          <button
            type="button"
            onClick={() => void goToBooking()}
            disabled={bookingBusy || saving}
            className="group flex w-full items-center gap-3 rounded-2xl border border-[var(--signal-border)] bg-[var(--signal-soft)] p-4 text-start transition-colors hover:bg-[var(--signal-tint)] disabled:opacity-70"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[var(--signal-strong)] shadow-[var(--shadow-sm)]">
              {bookingBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <CalendarClock className="h-5 w-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold text-[var(--signal-strong)]">{fa ? 'رزرو آنلاین هم می‌خواهید؟' : 'Want online booking too?'}</span>
              <span className="block text-[12px] leading-6 text-[color:color-mix(in_srgb,var(--signal-strong)_80%,transparent)]">
                {bookingEnabled
                  ? (fa ? 'ساعت کاری و ظرفیت همین خدمت را تنظیم کنید تا ایجنت نوبت هم بدهد.' : 'Set this service’s hours and capacity so the agent can book it.')
                  : (fa ? 'با یک کلیک بخش «رزرو و نوبت‌دهی» به منوی پنل اضافه می‌شود و ساعت کاری همین خدمت را تنظیم می‌کنید.' : 'One click adds Bookings to your menu and opens this service’s hours.')}
              </span>
            </span>
            <span className="hidden shrink-0 rounded-xl bg-[var(--signal-strong)] px-3 py-2 text-xs font-bold text-white sm:inline">
              {bookingEnabled ? (fa ? 'تنظیم ساعت' : 'Set hours') : (fa ? 'فعال‌سازی رزرو' : 'Turn on')}
            </span>
          </button>
        ) : (<>
        {/* 3 — weekly hours */}
        <Section index={3} title={fa ? 'ساعات کاری هفتگی' : 'Weekly hours'} aside={fa ? 'برای استراحت ظهر، بازه دوم اضافه کنید.' : 'Add a second range for a lunch break.'}>
          <div className="divide-y divide-[var(--border-subtle)] rounded-2xl border border-[var(--border-subtle)] bg-white">
            {WEEKDAYS.map((day) => {
              const value = week[day.value]
              const issue = issues.byDay[day.value]
              return (
                <div key={day.value} className="p-3 sm:p-3.5">
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:gap-3">
                    <div className="flex items-center gap-2.5 sm:w-28 sm:shrink-0 sm:pt-2.5">
                      <Switch checked={value.enabled} onChange={(checked) => updateDay(day.value, { enabled: checked })} aria-label={fa ? day.fa : day.en} />
                      <span className={cn('text-sm font-bold', value.enabled ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]')}>{fa ? day.fa : day.en}</span>
                      {!value.enabled && <span className="ms-auto text-xs text-[var(--text-muted)] sm:hidden">{fa ? 'تعطیل' : 'Closed'}</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      {value.enabled ? (
                        <div className="space-y-2">
                          {value.ranges.map((range, index) => (
                            <TimeRangeField
                              key={index}
                              fa={fa}
                              start={range.start}
                              end={range.end}
                              invalid={range.end <= range.start || (issue === 'OVERLAP')}
                              onChange={(next) => updateRange(day.value, index, next)}
                              onRemove={value.ranges.length > 1 ? () => removeRange(day.value, index) : undefined}
                            />
                          ))}
                          <div className="flex flex-wrap gap-1.5">
                            {value.ranges.length < 4 && (
                              <button type="button" onClick={() => addRange(day.value)} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
                                <Plus className="h-3.5 w-3.5" />{fa ? 'بازه دوم (مثلاً بعد از استراحت)' : 'Add range'}
                              </button>
                            )}
                            <button type="button" onClick={() => copyToOpenDays(day.value)} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
                              <Copy className="h-3.5 w-3.5" />{fa ? 'اعمال به روزهای باز دیگر' : 'Copy to other open days'}
                            </button>
                          </div>
                          {issue && <InlineError text={issue === 'OVERLAP' ? (fa ? 'بازه‌ها هم‌پوشانی دارند.' : 'Ranges overlap.') : (fa ? 'ساعت پایان باید بعد از شروع باشد.' : 'End must be after start.')} />}
                        </div>
                      ) : (
                        <p className="hidden pt-2.5 text-sm text-[var(--text-muted)] sm:block">{fa ? 'تعطیل' : 'Closed'}</p>
                      )}
                    </div>
                  </div>
                  <DayBar ranges={value.enabled ? value.ranges.map(rangeMinutes) : []} />
                </div>
              )
            })}
          </div>
          {touched && issues.noDays && <InlineError text={fa ? 'حداقل یک روز کاری را باز کنید.' : 'Open at least one day.'} />}
          {issues.tooLong && !issues.noDays && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-700"><AlertTriangle className="h-3.5 w-3.5" />{fa ? 'مدت نوبت از طولانی‌ترین بازه کاری بیشتر است؛ هیچ زمانی ساخته نمی‌شود.' : 'Length exceeds every open range, so no slots can be offered.'}</p>
          )}
        </Section>

        {/* Live preview */}
        {preview && (
          <section className="rounded-2xl border border-[var(--signal-border)] bg-[var(--signal-soft)] p-4">
            <p className="flex items-center gap-1.5 text-[13px] font-bold text-[var(--signal-strong)]">
              <Eye className="h-4 w-4" />
              {fa ? `مشتری ${formatDateKey(preview.dateKey, locale, { weekday: 'long' })} این زمان‌ها را می‌بیند` : `On ${formatDateKey(preview.dateKey, locale, { weekday: 'long' })} customers can pick`}
            </p>
            {preview.slots.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5" dir="ltr">
                {preview.slots.slice(0, 14).map((slot) => (
                  <span key={slot.startMinute} className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold tabular-nums text-[var(--text-primary)] ring-1 ring-[var(--signal-border)]">{formatClock(slot.startMinute, fa)}</span>
                ))}
                {preview.slots.length > 14 && <span className="px-1 py-1 text-xs font-medium text-[var(--signal-strong)]">+{num(preview.slots.length - 14, fa)}</span>}
              </div>
            ) : (
              <p className="mt-2 text-xs text-[var(--signal-strong)]">{fa ? 'با این تنظیمات زمانی ساخته نمی‌شود.' : 'No times can be offered with these settings.'}</p>
            )}
            <p className="mt-2.5 text-[13px] text-[color:color-mix(in_srgb,var(--signal-strong)_80%,transparent)]">
              {fa
                ? `${num(preview.slots.length, true)} نوبت در روز · هر نوبت تا ${num(capacity, true)} نفر`
                : `${preview.slots.length} slots a day · up to ${capacity} per slot`}
            </p>
          </section>
        )}

        {/* 4 — closures (existing services only) */}
        <Section index={4} title={fa ? 'تعطیلی و ساعت ویژه' : 'Closures & special hours'}>
          {current ? (
            <ClosureManager locale={locale} service={current} onChange={(next) => { setCurrent(next); onSaved(next, false, true) }} />
          ) : (
            <p className="rounded-2xl bg-[var(--bg-subtle)] px-3.5 py-3 text-xs leading-6 text-[var(--text-muted)]">
              {fa ? 'بعد از ساخت خدمت، از همین‌جا روزهای تعطیل (با تقویم شمسی) یا ساعت کاری ویژه یک روز را ثبت کنید.' : 'After creating the service, add closed dates or special hours here.'}
            </p>
          )}
        </Section>
        </>)}

        {current && onDeleted && (
          <section className="border-t border-[var(--border-subtle)] pt-5">
            {confirmDelete ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-50/40 p-4">
                <DeleteServicePanel
                  locale={locale}
                  service={current}
                  onCancel={() => setConfirmDelete(false)}
                  onDeleted={onDeleted}
                  onPause={async () => {
                    const response = await fetch(`/api/appointments/services/${current.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ active: false }),
                    }).catch(() => null)
                    const data = await response?.json().catch(() => ({})) as { service?: Record<string, unknown> } | undefined
                    if (!response?.ok || !data?.service) return
                    const paused = serviceFromApi(data.service)
                    setCurrent(paused)
                    setConfirmDelete(false)
                    onSaved(paused, false, true)
                  }}
                />
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-red-600 transition-colors hover:bg-red-50">
                <Trash2 className="h-4 w-4" />{fa ? 'حذف این خدمت' : 'Delete this service'}
              </button>
            )}
          </section>
        )}

        {error && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2.5 text-xs font-medium text-red-700">{error}</p>}
        {touched && invalid && !error && (
          <p role="alert" className="rounded-xl bg-amber-500/10 px-3 py-2.5 text-xs font-medium text-amber-800">{fa ? 'چند مورد نیاز به اصلاح دارد؛ موارد قرمز را بررسی کنید.' : 'A few fields need attention.'}</p>
        )}
      </div>
    </SideSheet>
  )
}

function ClosureManager({ locale, service, onChange }: { locale: Locale; service: ServiceRow; onChange: (service: ServiceRow) => void }) {
  const fa = locale === 'fa'
  const [date, setDate] = useState('')
  const [mode, setMode] = useState<'closed' | 'hours'>('closed')
  const [start, setStart] = useState(600)
  const [end, setEnd] = useState(840)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const today = dateKeyInTimeZone(new Date(), service.timezone)
  const upcoming = service.exceptions.filter((item) => item.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  const hoursInvalid = mode === 'hours' && end <= start

  async function send(payload: Record<string, unknown>) {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/appointments/services/${service.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({})) as { service?: Record<string, unknown> }
      if (!response.ok || !data.service) throw new Error()
      onChange(serviceFromApi(data.service))
      setDate('')
      setNote('')
    } catch {
      setError(fa ? 'ذخیره نشد؛ دوباره تلاش کنید.' : 'Could not save. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3.5">
        <div className="ui-seg mb-3 grid-cols-2" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'closed'} onClick={() => setMode('closed')} className="ui-seg-tab text-xs">{fa ? 'تعطیل کامل' : 'Closed all day'}</button>
          <button type="button" role="tab" aria-selected={mode === 'hours'} onClick={() => setMode('hours')} className="ui-seg-tab text-xs">{fa ? 'ساعت کاری ویژه' : 'Special hours'}</button>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
          <LocalizedDatePicker value={date} onValueChange={setDate} locale={locale} min={today} timeZone={service.timezone} ariaLabel={fa ? 'انتخاب تاریخ' : 'Choose date'} />
          <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={250} placeholder={fa ? 'علت (اختیاری): تعطیل رسمی، مرخصی…' : 'Reason (optional)'} className="input min-h-11 w-full" />
        </div>
        {mode === 'hours' && (
          <TimeRangeField
            className="mt-2"
            fa={fa}
            start={start}
            end={end}
            invalid={hoursInvalid}
            onChange={(next) => { setStart(next.start); setEnd(next.end) }}
          />
        )}
        {hoursInvalid && <InlineError text={fa ? 'ساعت پایان باید بعد از شروع باشد.' : 'End must be after start.'} />}
        <button
          type="button"
          disabled={!date || busy || hoursInvalid}
          onClick={() => void send({
            exception: mode === 'closed'
              ? { date, closed: true, note: note.trim() || null }
              : { date, closed: false, startMinute: start, endMinute: end, note: note.trim() || null },
          })}
          className="spatial-press mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-white text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-45"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'closed' ? <CalendarOff className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
          {mode === 'closed' ? (fa ? 'ثبت روز تعطیل' : 'Add closed day') : (fa ? 'ثبت ساعت ویژه' : 'Add special hours')}
        </button>
        {error && <InlineError text={error} />}
      </div>

      {upcoming.length > 0 && (
        <ul className="space-y-1.5">
          {upcoming.map((item) => (
            <li key={item.id} className="flex min-h-12 items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-white px-3">
              <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', item.closed ? 'bg-red-500/10 text-red-600' : 'bg-black/[0.05] text-[var(--text-secondary)]')}>
                {item.closed ? <CalendarOff className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-[var(--text-primary)]">{formatDateKey(item.date, locale, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                <p className="truncate text-[13px] text-[var(--text-muted)]">
                  {item.closed ? (fa ? 'تعطیل' : 'Closed') : <span dir="ltr">{formatClock(item.startMinute ?? 0, fa)}–{formatClock(item.endMinute ?? 0, fa)}</span>}
                  {item.note ? ` · ${item.note}` : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void send({ removeExceptionDate: item.date })}
                aria-label={fa ? 'حذف' : 'Remove'}
                className="grid h-10 w-10 place-items-center rounded-xl text-[var(--text-hint)] transition-colors hover:bg-red-500/10 hover:text-red-600 disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** 24-hour strip showing the open ranges of one day. */
export function DayBar({ ranges, className }: { ranges: Array<{ start: number; end: number }>; className?: string }) {
  return (
    <div className={cn('relative mt-2.5 h-1.5 overflow-hidden rounded-full bg-black/[0.05]', className)} dir="ltr" aria-hidden>
      {[6, 12, 18].map((hour) => <span key={hour} className="absolute inset-y-0 w-px bg-white" style={{ left: `${(hour / 24) * 100}%` }} />)}
      {ranges.filter((range) => range.end > range.start).map((range, index) => (
        <span
          key={index}
          className="absolute inset-y-0 rounded-full bg-[var(--text-primary)] transition-[left,width] duration-300"
          style={{ left: `${(range.start / 1440) * 100}%`, width: `${((range.end - range.start) / 1440) * 100}%` }}
        />
      ))}
    </div>
  )
}

function Section({ index, title, aside, children }: { index: number; title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-2.5">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--text-primary)] text-[12px] font-bold text-white">{num(index, true)}</span>
        <h3 className="ui-h3">{title}</h3>
        {aside ? <span className="ui-caption ms-auto hidden text-end sm:block">{aside}</span> : null}
      </div>
      {children}
    </section>
  )
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-xs font-bold text-[var(--text-secondary)]">{label}</span>
        {hint ? <span className="text-[12px] text-[var(--text-muted)]">{hint}</span> : null}
      </span>
      {children}
      {error ? <InlineError text={error} /> : null}
    </label>
  )
}

function Label({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="mb-2">
      <p className="text-xs font-bold text-[var(--text-secondary)]">{text}</p>
      {hint ? <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">{hint}</p> : null}
    </div>
  )
}

function InlineError({ text }: { text: string }) {
  return <p className="mt-1.5 text-xs font-medium text-red-600">{text}</p>
}

export function Chip({ active, onClick, children, small = false }: { active: boolean; onClick: () => void; children: React.ReactNode; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'spatial-press inline-flex items-center justify-center rounded-xl border font-bold tabular-nums transition-colors',
        small ? 'min-h-9 px-2.5 text-[12px]' : 'min-h-10 px-3.5 text-[13px]',
        active
          ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white'
          : 'border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]',
      )}
    >
      {children}
    </button>
  )
}

export function Stepper({ value, min, max, onChange, fa }: { value: number; min: number; max: number; onChange: (value: number) => void; fa: boolean }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-default)] bg-white p-1" dir="ltr">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={fa ? 'کمتر' : 'Decrease'} className="grid h-9 w-9 place-items-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-35">
        <Minus className="h-4 w-4" />
      </button>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Math.min(max, Math.max(min, Math.round(Number(event.target.value) || min))))}
        className="w-11 bg-transparent text-center text-sm font-bold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        aria-label={fa ? 'تعداد' : 'Count'}
      />
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={fa ? 'بیشتر' : 'Increase'} className="grid h-9 w-9 place-items-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-35">
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}
