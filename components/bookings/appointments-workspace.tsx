'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Bot,
  CalendarCheck2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coffee,
  Loader2,
  MapPin,
  Moon,
  Pencil,
  Plus,
  Settings2,
  Sparkles,
  Sun,
  UserRound,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MaterialSelect } from '@/components/ui/material-select'
import { dateKeyInTimeZone } from '@/lib/bookings/time'

type Locale = 'fa' | 'en'
type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW'

interface ServiceRow {
  id: string
  name: string
  description: string | null
  durationMinutes: number
  slotIntervalMinutes: number
  bufferBeforeMinutes: number
  bufferAfterMinutes: number
  capacity: number
  timezone: string
  location: string | null
  active: boolean
  appointmentCount: number
  weeklyRules: Array<{
    weekday: number
    startMinute: number
    endMinute: number
    capacity: number | null
    active: boolean
  }>
}

interface AppointmentRow {
  id: string
  serviceId: string
  serviceName: string
  serviceLocation: string | null
  customerName: string
  customerPhone: string | null
  startsAt: string
  endsAt: string
  timezone: string
  partySize: number
  status: AppointmentStatus
  source: string
  notes: string | null
}

interface SlotRow {
  startMinute: number
  startsAt: string
  endsAt: string
  remainingCapacity: number
}

const STATUS_COPY: Record<AppointmentStatus, { fa: string; en: string; tone: string; dot: string }> = {
  PENDING: { fa: 'در انتظار تأیید', en: 'Pending', tone: 'bg-amber-500/10 text-amber-700 ring-amber-500/20', dot: 'bg-amber-500' },
  CONFIRMED: { fa: 'تأییدشده', en: 'Confirmed', tone: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20', dot: 'bg-emerald-500' },
  CANCELLED: { fa: 'لغوشده', en: 'Cancelled', tone: 'bg-red-500/10 text-red-600 ring-red-500/20', dot: 'bg-red-400' },
  COMPLETED: { fa: 'انجام‌شده', en: 'Completed', tone: 'bg-blue-500/10 text-blue-700 ring-blue-500/20', dot: 'bg-blue-500' },
  NO_SHOW: { fa: 'عدم حضور', en: 'No show', tone: 'bg-zinc-500/10 text-zinc-600 ring-zinc-500/20', dot: 'bg-zinc-400' },
}

const WEEKDAYS = [
  { value: 6, fa: 'ش', en: 'Sat' },
  { value: 0, fa: 'ی', en: 'Sun' },
  { value: 1, fa: 'د', en: 'Mon' },
  { value: 2, fa: 'س', en: 'Tue' },
  { value: 3, fa: 'چ', en: 'Wed' },
  { value: 4, fa: 'پ', en: 'Thu' },
  { value: 5, fa: 'ج', en: 'Fri' },
]

// Deterministic accent color per service — keeps the schedule visually scannable
// without requiring the user to read every service name. Hue derived from a
// stable hash of the service id so a given service always renders the same
// accent across days and reloads.
const SERVICE_ACCENTS = [
  { ring: 'ring-black/15', bar: 'bg-[var(--text-primary)]', chip: 'bg-[var(--text-primary)]/5 text-[var(--text-primary)]' },
  { ring: 'ring-emerald-500/25', bar: 'bg-emerald-500', chip: 'bg-emerald-500/10 text-emerald-700' },
  { ring: 'ring-blue-500/25', bar: 'bg-blue-500', chip: 'bg-blue-500/10 text-blue-700' },
  { ring: 'ring-amber-500/25', bar: 'bg-amber-500', chip: 'bg-amber-500/10 text-amber-700' },
  { ring: 'ring-violet-500/25', bar: 'bg-violet-500', chip: 'bg-violet-500/10 text-violet-700' },
  { ring: 'ring-rose-500/25', bar: 'bg-rose-500', chip: 'bg-rose-500/10 text-rose-700' },
  { ring: 'ring-teal-500/25', bar: 'bg-teal-500', chip: 'bg-teal-500/10 text-teal-700' },
]

function serviceAccent(serviceId: string) {
  let hash = 0
  for (let i = 0; i < serviceId.length; i++) {
    hash = (hash * 31 + serviceId.charCodeAt(i)) >>> 0
  }
  return SERVICE_ACCENTS[hash % SERVICE_ACCENTS.length]
}

function shiftDateKey(dateKey: string, amount: number): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

function minuteLabel(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

function timeToMinute(value: string): number {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

function appointmentFromApi(value: Record<string, unknown>): AppointmentRow {
  const service = (value.service ?? {}) as Record<string, unknown>
  return {
    id: String(value.id),
    serviceId: String(value.serviceId),
    serviceName: String(service.name ?? ''),
    serviceLocation: typeof service.location === 'string' ? service.location : null,
    customerName: String(value.customerName ?? ''),
    customerPhone: typeof value.customerPhone === 'string' ? value.customerPhone : null,
    startsAt: String(value.startsAt),
    endsAt: String(value.endsAt),
    timezone: String(value.timezone ?? 'Asia/Tehran'),
    partySize: Number(value.partySize) || 1,
    status: value.status as AppointmentStatus,
    source: String(value.source ?? 'dashboard'),
    notes: typeof value.notes === 'string' ? value.notes : null,
  }
}

function serviceFromApi(raw: Record<string, unknown>): ServiceRow {
  const count = (raw._count ?? {}) as Record<string, unknown>
  return {
    id: String(raw.id),
    name: String(raw.name),
    description: typeof raw.description === 'string' ? raw.description : null,
    durationMinutes: Number(raw.durationMinutes),
    slotIntervalMinutes: Number(raw.slotIntervalMinutes),
    bufferBeforeMinutes: Number(raw.bufferBeforeMinutes),
    bufferAfterMinutes: Number(raw.bufferAfterMinutes),
    capacity: Number(raw.capacity),
    timezone: String(raw.timezone),
    location: typeof raw.location === 'string' ? raw.location : null,
    active: Boolean(raw.active),
    appointmentCount: Number(count.appointments) || 0,
    weeklyRules: (raw.weeklyRules as ServiceRow['weeklyRules']) ?? [],
  }
}

type TimeSlotKey = 'morning' | 'afternoon' | 'evening'

/** Group appointments into morning / afternoon / evening buckets by start hour. */
function groupByTimeSlot(items: AppointmentRow[]): Array<{ key: TimeSlotKey; items: AppointmentRow[] }> {
  const morning: AppointmentRow[] = []
  const afternoon: AppointmentRow[] = []
  const evening: AppointmentRow[] = []
  for (const item of items) {
    const hour = new Date(item.startsAt).toLocaleString('en-US', { timeZone: item.timezone, hour: '2-digit', hour12: false })
    const h = Number(hour)
    if (h < 12) morning.push(item)
    else if (h < 17) afternoon.push(item)
    else evening.push(item)
  }
  const groups: Array<{ key: TimeSlotKey; items: AppointmentRow[] }> = [
    { key: 'morning', items: morning },
    { key: 'afternoon', items: afternoon },
    { key: 'evening', items: evening },
  ]
  return groups.filter((group) => group.items.length > 0)
}

const TIME_SLOT_COPY: Record<TimeSlotKey, { fa: string; en: string; Icon: typeof Sun }> = {
  morning: { fa: 'صبح', en: 'Morning', Icon: Sun },
  afternoon: { fa: 'بعدازظهر', en: 'Afternoon', Icon: Coffee },
  evening: { fa: 'شب', en: 'Evening', Icon: Moon },
}

export function AppointmentsWorkspace({
  locale,
  initialDate,
  initialStats,
  initialServices,
  initialAppointments,
}: {
  locale: Locale
  initialDate: string
  initialStats: { upcomingCount: number; pendingCount: number }
  initialServices: ServiceRow[]
  initialAppointments: AppointmentRow[]
}) {
  const fa = locale === 'fa'
  const [services, setServices] = useState(initialServices)
  const [appointments, setAppointments] = useState(initialAppointments)
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [serviceFilter, setServiceFilter] = useState('')
  const [loadingDay, setLoadingDay] = useState(false)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [servicesOpen, setServicesOpen] = useState(initialServices.length === 0)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [actionId, setActionId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [dayCounts, setDayCounts] = useState<Record<string, number>>({})
  // Week navigation — start of the 7-day window currently in view. Defaults to
  // today so the first paint shows the current week.
  const [weekStart, setWeekStart] = useState(initialDate)

  const todayKey = useMemo(() => dateKeyInTimeZone(new Date(), 'Asia/Tehran'), [])
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => shiftDateKey(weekStart, index)),
    [weekStart],
  )
  const activeServices = services.filter((service) => service.active)
  const activeToday = appointments.filter((item) => ['PENDING', 'CONFIRMED'].includes(item.status))
  const usedCapacity = activeToday.reduce((sum, item) => sum + item.partySize, 0)

  // Daily summary for the currently selected day — shown above the list so the
  // manager can see the shape of the day at a glance.
  const daySummary = useMemo(() => {
    const pending = appointments.filter((item) => item.status === 'PENDING').length
    const confirmed = appointments.filter((item) => item.status === 'CONFIRMED').length
    const completed = appointments.filter((item) => item.status === 'COMPLETED').length
    const cancelled = appointments.filter((item) => ['CANCELLED', 'NO_SHOW'].includes(item.status)).length
    return { total: appointments.length, pending, confirmed, completed, cancelled }
  }, [appointments])

  // Fetch appointment counts for the whole 14-day window (current + next week)
  // so each day chip can show a numeric badge. Runs on mount, week navigation,
  // and whenever the service filter changes.
  useEffect(() => {
    let cancelled = false
    const windowDays = Array.from({ length: 14 }, (_, index) => shiftDateKey(weekStart, index))
    Promise.all(
      windowDays.map(async (date) => {
        try {
          const query = new URLSearchParams({ date })
          if (serviceFilter) query.set('serviceId', serviceFilter)
          const response = await fetch(`/api/appointments?${query.toString()}`)
          const data = (await response.json()) as { appointments?: unknown[] }
          return [date, (data.appointments ?? []).length] as const
        } catch {
          return [date, 0] as const
        }
      }),
    ).then((entries) => {
      if (cancelled) return
      setDayCounts((prev) => ({ ...prev, ...Object.fromEntries(entries) }))
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceFilter, weekStart])

  async function loadDay(date: string, nextService = serviceFilter) {
    setLoadingDay(true)
    setError('')
    try {
      const query = new URLSearchParams({ date })
      if (nextService) query.set('serviceId', nextService)
      const response = await fetch(`/api/appointments?${query.toString()}`)
      const data = await response.json() as { appointments?: Array<Record<string, unknown>> }
      if (!response.ok || !data.appointments) throw new Error('load failed')
      setAppointments(data.appointments.map(appointmentFromApi))
      setSelectedDate(date)
    } catch {
      setError(fa ? 'بارگذاری تقویم انجام نشد.' : 'Could not load the calendar.')
    } finally {
      setLoadingDay(false)
    }
  }

  async function updateStatus(id: string, status: AppointmentStatus, reason?: string) {
    setActionId(id)
    setError('')
    try {
      const response = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...(reason ? { cancellationReason: reason } : {}) }),
      })
      if (!response.ok) throw new Error('update failed')
      setCancelId(null)
      setCancelReason('')
      await loadDay(selectedDate)
    } catch {
      setError(fa ? 'تغییر وضعیت ذخیره نشد.' : 'The status could not be updated.')
    } finally {
      setActionId(null)
    }
  }

  function goPrevWeek() {
    setWeekStart((current) => shiftDateKey(current, -7))
  }
  function goNextWeek() {
    setWeekStart((current) => shiftDateKey(current, 7))
  }
  function goToday() {
    setWeekStart(todayKey)
    void loadDay(todayKey)
  }

  // Human-friendly month label for the current week window, e.g. "تیر ۱۴۰۴"
  // or spans two months when the week straddles a boundary.
  const weekMonthLabel = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(fa ? 'fa-IR-u-ca-persian' : 'en-US', { month: 'long', timeZone: 'UTC' })
    const first = new Date(`${weekDays[0]}T12:00:00Z`)
    const last = new Date(`${weekDays[6]}T12:00:00Z`)
    const m1 = fmt.format(first)
    const m2 = fmt.format(last)
    const yearFmt = new Intl.DateTimeFormat(fa ? 'fa-IR-u-ca-persian' : 'en-US', { year: 'numeric', timeZone: 'UTC' })
    const year = yearFmt.format(last)
    if (m1 === m2) return `${m1} ${year}`
    return `${m1} – ${m2} ${year}`
  }, [weekDays, fa])

  const selectedDateLabel = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(fa ? 'fa-IR-u-ca-persian' : 'en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    })
    return fmt.format(new Date(`${selectedDate}T12:00:00Z`))
  }, [selectedDate, fa])

  const groupedAppointments = useMemo(() => groupByTimeSlot(appointments), [appointments])

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* ── Page header — unified with all other dashboard tabs ── */}
      <header className="dashboard-page-header spatial-surface overflow-hidden rounded-[1.5rem] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--text-primary)] text-[var(--bg-base)] shadow-[var(--shadow-control)]">
              <CalendarCheck2 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                {fa ? 'رزرو و نوبت‌دهی' : 'Appointments'}
              </h1>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)]">
                {fa
                  ? 'ایجنت زمان آزاد را می‌خواند، اطلاعات مشتری را می‌گیرد، بدون تداخل رزرو می‌کند و همان لحظه اعلان می‌دهد.'
                  : 'The agent reads live availability, captures customer details, books without conflicts, and alerts the manager immediately.'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => setServicesOpen(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-white px-4 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
              <Settings2 className="h-4 w-4" />{fa ? 'مدیریت خدمات' : 'Manage services'}
            </button>
            <button type="button" onClick={() => setBookingOpen(true)} disabled={activeServices.length === 0} className="spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-sm font-bold text-[var(--bg-base)] shadow-[var(--shadow-control)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
              <Plus className="h-4 w-4" />{fa ? 'ثبت نوبت' : 'New appointment'}
            </button>
          </div>
        </div>
      </header>

      {/* ── Stat cards row — 4 compact spatial-surface tiles ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={CalendarCheck2} label={fa ? 'هفت روز آینده' : 'Next 7 days'} value={initialStats.upcomingCount} locale={locale} />
        <StatCard icon={AlertCircle} label={fa ? 'نیازمند تأیید' : 'Pending'} value={initialStats.pendingCount} locale={locale} tone="amber" />
        <StatCard icon={Clock3} label={fa ? 'امروز' : 'Today'} value={activeToday.length} locale={locale} />
        <StatCard icon={Users} label={fa ? 'ظرفیت امروز' : 'Capacity today'} value={usedCapacity} locale={locale} />
      </div>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        {/* ── Daily schedule — main panel (redesigned) ── */}
        <div className="spatial-surface min-w-0 rounded-[1.5rem] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight text-[var(--text-primary)]">{fa ? 'برنامه روزانه' : 'Daily schedule'}</h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{fa ? 'زمان‌ها با منطقه زمانی تهران نمایش داده می‌شوند.' : 'Times are shown in the service timezone.'}</p>
            </div>
            <MaterialSelect value={serviceFilter} onValueChange={(value) => { setServiceFilter(value); void loadDay(selectedDate, value) }} ariaLabel={fa ? 'فیلتر خدمات' : 'Filter services'} className="min-w-48" options={[{ value: '', label: fa ? 'همه خدمات' : 'All services' }, ...services.map((service) => ({ value: service.id, label: service.name }))]} />
          </div>

          {/* ── Week navigator — month label + prev/next/today ── */}
          <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2">
            <button
              type="button"
              onClick={goPrevWeek}
              disabled={loadingDay}
              aria-label={fa ? 'هفته قبل' : 'Previous week'}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
              <span className="truncate text-sm font-bold text-[var(--text-primary)]">{weekMonthLabel}</span>
              <button
                type="button"
                onClick={goToday}
                disabled={weekStart === todayKey && selectedDate === todayKey}
                className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] shadow-sm transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:cursor-default disabled:opacity-40 disabled:hover:border-[var(--border-default)] disabled:hover:bg-[var(--bg-base)] disabled:hover:text-[var(--text-secondary)]"
                aria-label={fa ? 'رفتن به امروز' : 'Jump to today'}
              >
                <CalendarCheck2 className="h-3 w-3" />
                {fa ? 'رفتن به امروز' : 'Today'}
              </button>
            </div>
            <button
              type="button"
              onClick={goNextWeek}
              disabled={loadingDay}
              aria-label={fa ? 'هفته بعد' : 'Next week'}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          {/* ── Day selector — 7-day grid (no horizontal scroll) ── */}
          <div className="mt-3 grid grid-cols-7 gap-1.5 sm:gap-2" role="list" aria-label={fa ? 'انتخاب روز' : 'Choose a day'}>
            {weekDays.map((date) => {
              const isSelected = selectedDate === date
              const isToday = date === todayKey
              const count = dayCounts[date] ?? 0
              const dateObj = new Date(`${date}T12:00:00Z`)
              const weekdayShort = new Intl.DateTimeFormat(fa ? 'fa-IR-u-ca-persian' : 'en-US', { weekday: 'short', timeZone: 'UTC' }).format(dateObj)
              const dayNum = new Intl.DateTimeFormat(fa ? 'fa-IR-u-ca-persian' : 'en-US', { day: 'numeric', timeZone: 'UTC' }).format(dateObj)
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => void loadDay(date)}
                  aria-pressed={isSelected}
                  aria-label={`${weekdayShort} ${dayNum}${count > 0 ? ` — ${count} ${fa ? 'نوبت' : 'appointments'}` : ''}`}
                  className={cn(
                    'group relative flex flex-col items-center rounded-2xl border px-1 py-2.5 text-center transition-[border-color,background-color,transform] hover:-translate-y-0.5 motion-reduce:transform-none sm:px-2',
                    isSelected
                      ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-base)] shadow-[var(--shadow-control)]'
                      : isToday
                        ? 'border-emerald-500/40 bg-emerald-500/5 text-[var(--text-primary)]'
                        : 'border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]',
                  )}
                >
                  <span className={cn('block text-[10px] font-medium uppercase tracking-wide sm:text-[11px]', isSelected ? 'text-[var(--bg-base)]/70' : 'text-[var(--text-muted)]')}>
                    {weekdayShort}
                  </span>
                  <span className="mt-0.5 block text-base font-bold tabular-nums sm:text-lg">
                    {dayNum}
                  </span>
                  {/* Count badge — replaces the ambiguous density dots */}
                  <span className="mt-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums">
                    {count > 0 ? (
                      <span className={cn(
                        'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1',
                        isSelected ? 'bg-[var(--bg-base)]/20 text-[var(--bg-base)]' : 'bg-[var(--text-primary)]/8 text-[var(--text-primary)]',
                      )}>
                        {count.toLocaleString(fa ? 'fa-IR' : 'en-US')}
                      </span>
                    ) : (
                      <span className={cn('h-1 w-1 rounded-full', isSelected ? 'bg-[var(--bg-base)]/30' : 'bg-[var(--border-strong)] opacity-50')} />
                    )}
                  </span>
                </button>
              )
            })}
          </div>

          {/* ── Selected day label + inline summary chips ── */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--bg-base)] px-3.5 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <CalendarCheck2 className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
              <span className="truncate text-sm font-bold text-[var(--text-primary)]">{selectedDateLabel}</span>
            </div>
            {daySummary.total > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <SummaryChip count={daySummary.total} label={fa ? 'کل' : 'Total'} tone="neutral" fa={fa} />
                {daySummary.pending > 0 && <SummaryChip count={daySummary.pending} label={fa ? 'در انتظار' : 'Pending'} tone="amber" fa={fa} />}
                {daySummary.confirmed > 0 && <SummaryChip count={daySummary.confirmed} label={fa ? 'تأییدشده' : 'Confirmed'} tone="emerald" fa={fa} />}
                {daySummary.completed > 0 && <SummaryChip count={daySummary.completed} label={fa ? 'انجام‌شده' : 'Done'} tone="blue" fa={fa} />}
              </div>
            )}
          </div>

          {error && <p role="alert" className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-600">{error}</p>}

          {/* ── Appointment list — grouped by time slot (morning/afternoon/evening) ── */}
          <div className="relative mt-4 min-h-48">
            {loadingDay && (
              <div className="absolute inset-0 z-10 grid place-items-center rounded-2xl bg-[var(--bg-surface)]/80 backdrop-blur-sm">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--text-primary)]" />
              </div>
            )}
            {appointments.length === 0 ? (
              <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-base)] p-8 text-center">
                <div>
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--bg-surface)] ring-1 ring-[var(--border-subtle)]">
                    <CalendarClock className="h-6 w-6 text-[var(--text-muted)]" />
                  </span>
                  <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">{fa ? 'برای این روز نوبتی ثبت نشده' : 'No appointments for this day'}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{fa ? 'می‌توانید دستی ثبت کنید یا ایجنت از گفتگو رزرو کند.' : 'Create one here or let the agent book from a conversation.'}</p>
                  {activeServices.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setBookingOpen(true)}
                      className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-xs font-bold text-[var(--bg-base)] transition-opacity hover:opacity-90"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {fa ? 'ثبت اولین نوبت' : 'Book first appointment'}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {groupedAppointments.map((group) => {
                  const slotCopy = TIME_SLOT_COPY[group.key]
                  const Icon = slotCopy.Icon
                  return (
                    <div key={group.key}>
                      {/* Time-slot header */}
                      <div className="mb-2 flex items-center gap-2">
                        <span className="grid h-6 w-6 place-items-center rounded-lg bg-[var(--bg-base)] ring-1 ring-[var(--border-subtle)]">
                          <Icon className="h-3 w-3 text-[var(--text-secondary)]" />
                        </span>
                        <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                          {fa ? slotCopy.fa : slotCopy.en}
                        </h3>
                        <span className="rounded-full bg-[var(--bg-base)] px-2 py-0.5 text-[10px] font-bold tabular-nums text-[var(--text-muted)] ring-1 ring-[var(--border-subtle)]">
                          {group.items.length.toLocaleString(fa ? 'fa-IR' : 'en-US')}
                        </span>
                        <div className="ms-2 h-px flex-1 bg-[var(--border-subtle)]" aria-hidden />
                      </div>
                      {/* Vertical timeline line for this slot */}
                      <div className="relative space-y-2">
                        <div className="pointer-events-none absolute bottom-2 start-[26px] top-2 w-px bg-[var(--border-subtle)] sm:start-[30px]" aria-hidden />
                        {group.items.map((appointment) => (
                          <AppointmentCard
                            key={appointment.id}
                            appointment={appointment}
                            locale={locale}
                            busy={actionId === appointment.id}
                            cancelling={cancelId === appointment.id}
                            cancellationReason={cancelReason}
                            onCancellationReason={setCancelReason}
                            onStartCancel={() => setCancelId(appointment.id)}
                            onStopCancel={() => { setCancelId(null); setCancelReason('') }}
                            onStatus={(status, reason) => void updateStatus(appointment.id, status, reason)}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Sidebar — agent info + active services ── */}
        <aside className="space-y-4">
          <div className="spatial-surface rounded-[1.5rem] p-5">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-black text-white shadow-[var(--shadow-control)]"><Bot className="h-5 w-5" /></span>
            <h2 className="mt-4 text-sm font-bold text-[var(--text-primary)]">{fa ? 'ایجنت رزرو آماده است' : 'Booking agent is ready'}</h2>
            <p className="mt-2 text-xs leading-6 text-[var(--text-secondary)]">{fa ? 'چهار ابزار امن برای دیدن خدمات، بررسی ظرفیت، ثبت و لغو نوبت به موتور گفتگو وصل است.' : 'Four safe tools connect service lookup, live capacity, booking, and cancellation to chat.'}</p>
            <ul className="mt-4 space-y-2 text-xs text-[var(--text-secondary)]">
              {[fa ? 'تأیید صریح قبل از ثبت' : 'Explicit confirmation before booking', fa ? 'جلوگیری اتمیک از تداخل' : 'Atomic conflict protection', fa ? 'اعلان پنل و ربات مدیر' : 'Dashboard and manager-bot alerts'].map((item) => <li key={item} className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" />{item}</li>)}
            </ul>
          </div>
          <div className="spatial-surface rounded-[1.5rem] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--text-primary)]">{fa ? 'خدمات فعال' : 'Active services'}</h2>
              <span className="rounded-full bg-[var(--bg-muted)] px-2.5 py-1 text-xs font-bold tabular-nums text-[var(--text-secondary)]">{activeServices.length.toLocaleString(fa ? 'fa-IR' : 'en-US')}</span>
            </div>
            <div className="mt-3 space-y-2">{activeServices.slice(0, 4).map((service) => {
              const accent = serviceAccent(service.id)
              return (
                <div key={service.id} className="flex items-center gap-2.5 rounded-xl bg-[var(--bg-base)] p-3">
                  <span className={cn('h-8 w-1 shrink-0 rounded-full', accent.bar)} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-[var(--text-primary)]">{service.name}</p>
                    <p className="mt-1 text-[11px] text-[var(--text-muted)]">{service.durationMinutes.toLocaleString(fa ? 'fa-IR' : 'en-US')} {fa ? 'دقیقه' : 'min'} · {fa ? 'ظرفیت' : 'capacity'} {service.capacity.toLocaleString(fa ? 'fa-IR' : 'en-US')}</p>
                  </div>
                </div>
              )
            })}</div>
          </div>
        </aside>
      </section>

      {bookingOpen && (
        <BookingDialog
          locale={locale}
          services={activeServices}
          initialDate={selectedDate}
          onClose={() => setBookingOpen(false)}
          onCreated={(date) => {
            setBookingOpen(false)
            setServiceFilter('')
            void loadDay(date, '')
          }}
        />
      )}
      {servicesOpen && (
        <ServicesDialog
          locale={locale}
          services={services}
          onClose={() => setServicesOpen(false)}
          onChange={setServices}
        />
      )}
    </div>
  )
}

/** Compact summary chip shown next to the selected-day label. */
function SummaryChip({ count, label, tone, fa }: { count: number; label: string; tone: 'neutral' | 'amber' | 'emerald' | 'blue'; fa: boolean }) {
  const tones: Record<typeof tone, string> = {
    neutral: 'bg-[var(--bg-surface)] text-[var(--text-secondary)] ring-[var(--border-subtle)]',
    amber: 'bg-amber-500/10 text-amber-700 ring-amber-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-700 ring-blue-500/20',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ring-1', tones[tone])}>
      {count.toLocaleString(fa ? 'fa-IR' : 'en-US')}
      <span className="font-medium opacity-80">{label}</span>
    </span>
  )
}

function StatCard({ icon: Icon, label, value, locale, tone }: { icon: typeof CalendarCheck2; label: string; value: number; locale: Locale; tone?: 'amber' }) {
  return (
    <div className="spatial-surface flex items-center gap-3 rounded-[1.5rem] p-4">
      <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', tone === 'amber' ? 'bg-amber-500/10 text-amber-600' : 'bg-black text-white')}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xl font-bold tabular-nums text-[var(--text-primary)]">
          {value.toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')}
        </p>
        <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">{label}</p>
      </div>
    </div>
  )
}

function AppointmentCard({ appointment, locale, busy, cancelling, cancellationReason, onCancellationReason, onStartCancel, onStopCancel, onStatus }: { appointment: AppointmentRow; locale: Locale; busy: boolean; cancelling: boolean; cancellationReason: string; onCancellationReason: (value: string) => void; onStartCancel: () => void; onStopCancel: () => void; onStatus: (status: AppointmentStatus, reason?: string) => void }) {
  const fa = locale === 'fa'
  const timeFmt = useMemo(
    () => new Intl.DateTimeFormat(fa ? 'fa-IR' : 'en-US', { timeZone: appointment.timezone, hour: '2-digit', minute: '2-digit' }),
    [appointment.timezone, fa],
  )
  const start = timeFmt.format(new Date(appointment.startsAt))
  const end = timeFmt.format(new Date(appointment.endsAt))
  const terminal = ['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(appointment.status)
  const copy = STATUS_COPY[appointment.status]
  const accent = serviceAccent(appointment.serviceId)
  const dimmed = terminal
  return (
    <article className={cn(
      'relative flex gap-3 rounded-2xl border bg-[var(--bg-base)] p-3.5 transition-colors hover:border-[var(--border-strong)] sm:gap-4 sm:p-4',
      'border-[var(--border-default)]',
      dimmed && 'opacity-65',
    )}>
      {/* Service accent bar — left edge, replaces the abstract timeline dot */}
      <div className={cn('absolute inset-y-3 start-0 w-1 rounded-e-full', accent.bar)} aria-hidden />

      {/* Time block — start + end on one card */}
      <div className="relative z-10 flex shrink-0 flex-col items-center justify-center">
        <div className={cn(
          'flex h-14 w-14 flex-col items-center justify-center rounded-2xl ring-1 sm:h-16 sm:w-16',
          terminal ? 'bg-[var(--bg-surface)] ring-[var(--border-subtle)]' : 'bg-[var(--bg-surface)] ' + accent.ring,
        )}>
          <span dir="ltr" className="text-xs font-bold tabular-nums text-[var(--text-primary)] sm:text-sm">{start}</span>
          <span dir="ltr" className="mt-0.5 text-[9px] font-medium tabular-nums text-[var(--text-muted)] sm:text-[10px]">
            {fa ? 'تا' : 'to'} {end}
          </span>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        {/* Row 1 — customer name + status + source badge */}
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">{appointment.customerName}</h3>
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1', copy.tone)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', copy.dot)} aria-hidden />
            {fa ? copy.fa : copy.en}
          </span>
          {appointment.source === 'agent' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] text-violet-600">
              <Sparkles className="h-3 w-3" />{fa ? 'رزرو ایجنت' : 'Agent booked'}
            </span>
          )}
        </div>

        {/* Row 2 — service chip (colored) + meta line */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[var(--text-secondary)]">
          <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium', accent.chip)}>
            <CalendarCheck2 className="h-3 w-3" />
            {appointment.serviceName}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {appointment.partySize.toLocaleString(fa ? 'fa-IR' : 'en-US')} {fa ? 'نفر' : 'ppl'}
          </span>
          {appointment.customerPhone && (
            <span dir="ltr" className="inline-flex items-center gap-1">
              <UserRound className="h-3.5 w-3.5" />
              {appointment.customerPhone}
            </span>
          )}
          {appointment.serviceLocation && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {appointment.serviceLocation}
            </span>
          )}
        </div>

        {/* Row 3 — notes (if any) */}
        {appointment.notes && (
          <p className="mt-2 line-clamp-2 rounded-lg bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-muted)]">
            {appointment.notes}
          </p>
        )}
      </div>

      {/* Actions — only for non-terminal appointments */}
      {!terminal && !cancelling && (
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatus('COMPLETED')}
            className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-emerald-500/20 px-2.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{fa ? 'انجام شد' : 'Done'}</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatus('NO_SHOW')}
            aria-label={fa ? 'عدم حضور' : 'No show'}
            className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-[var(--border-default)] px-2.5 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
          >
            <XCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{fa ? 'حاضر نشد' : 'No-show'}</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onStartCancel}
            className="grid min-h-9 min-w-9 place-items-center rounded-xl border border-red-500/20 text-red-500 transition-colors hover:bg-red-50"
            aria-label={fa ? 'لغو نوبت' : 'Cancel appointment'}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
          </button>
        </div>
      )}
      {cancelling && (
        <div className="absolute inset-x-3 bottom-3 flex flex-col gap-2 rounded-xl border border-red-500/20 bg-red-50/50 p-3 sm:flex-row sm:items-center sm:inset-x-4 sm:bottom-4">
          <input
            autoFocus
            value={cancellationReason}
            onChange={(event) => onCancellationReason(event.target.value)}
            placeholder={fa ? 'دلیل لغو را بنویسید…' : 'Cancellation reason…'}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--border-default)] bg-white px-3 text-sm outline-none focus:border-red-500/30"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onStatus('CANCELLED', cancellationReason.trim())}
              disabled={cancellationReason.trim().length < 2 || busy}
              className="min-h-11 rounded-xl bg-red-500 px-4 text-sm font-medium text-white disabled:opacity-50"
            >
              {fa ? 'تأیید لغو' : 'Confirm cancel'}
            </button>
            <button
              type="button"
              onClick={onStopCancel}
              className="min-h-11 rounded-xl border border-[var(--border-default)] bg-white px-4 text-sm text-[var(--text-secondary)]"
            >
              {fa ? 'انصراف' : 'Back'}
            </button>
          </div>
        </div>
      )}
    </article>
  )
}

function DialogShell({ title, subtitle, onClose, children, wide = false }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const panel = panelRef.current
    const focusables = () => Array.from(panel?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]') ?? [])
    focusables()[0]?.focus()
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab') return
      const items = focusables()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="appointment-dialog-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div ref={panelRef} className={cn('spatial-surface max-h-[92vh] w-full overflow-y-auto rounded-[1.5rem]', wide ? 'max-w-4xl' : 'max-w-2xl')}>
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] bg-white/95 p-5 backdrop-blur">
          <div>
            <h2 id="appointment-dialog-title" className="text-base font-bold tracking-tight text-[var(--text-primary)]">{title}</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]" aria-label="بستن">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function BookingDialog({ locale, services, initialDate, onClose, onCreated }: { locale: Locale; services: ServiceRow[]; initialDate: string; onClose: () => void; onCreated: (date: string) => void }) {
  const fa = locale === 'fa'
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '')
  const [date, setDate] = useState(initialDate)
  const [partySize, setPartySize] = useState(1)
  const [slots, setSlots] = useState<SlotRow[]>([])
  const [slot, setSlot] = useState<number | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const selectedService = services.find((service) => service.id === serviceId)
  const minimumDate = dateKeyInTimeZone(new Date(), selectedService?.timezone ?? 'Asia/Tehran')

  useEffect(() => {
    if (!serviceId || !date) return
    const controller = new AbortController()
    setLoadingSlots(true); setSlot(null); setError('')
    fetch(`/api/appointments/slots?${new URLSearchParams({ serviceId, date, partySize: String(partySize) })}`, { signal: controller.signal })
      .then(async (response) => { const data = await response.json() as { slots?: SlotRow[] }; if (!response.ok || !data.slots) throw new Error(); setSlots(data.slots) })
      .catch((reason) => { if (reason instanceof DOMException && reason.name === 'AbortError') return; setSlots([]); setError(fa ? 'زمان‌های آزاد دریافت نشد.' : 'Could not load available times.') })
      .finally(() => setLoadingSlots(false))
    return () => controller.abort()
  }, [serviceId, date, partySize, fa])

  async function submit() {
    if (slot === null || name.trim().length < 2 || phone.trim().length < 7) return
    setSaving(true); setError('')
    try {
      const response = await fetch('/api/appointments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serviceId, localDate: date, startMinute: slot, partySize, customerName: name.trim(), customerPhone: phone.trim(), notes: notes.trim() || undefined, source: 'dashboard', idempotencyKey: `dashboard:${crypto.randomUUID()}` }) })
      const data = await response.json() as { error?: string }
      if (!response.ok) throw new Error(data.error ?? 'FAILED')
      onCreated(date)
    } catch (reason) {
      setError(reason instanceof Error && reason.message === 'CAPACITY_EXCEEDED' ? (fa ? 'این زمان همین حالا پر شد؛ زمان دیگری را انتخاب کنید.' : 'That time just filled up. Choose another slot.') : (fa ? 'ثبت نوبت انجام نشد؛ اطلاعات را بررسی کنید.' : 'The appointment could not be created.'))
    } finally { setSaving(false) }
  }

  return (
    <DialogShell title={fa ? 'ثبت نوبت جدید' : 'New appointment'} subtitle={fa ? 'زمان‌های قابل انتخاب مستقیماً از ظرفیت واقعی محاسبه می‌شوند.' : 'Selectable times come directly from live capacity.'} onClose={onClose}>
      <div className="space-y-5">
        {/* ── Service + date + party size ── */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={fa ? 'خدمت' : 'Service'}>
            <MaterialSelect value={serviceId} onValueChange={setServiceId} ariaLabel={fa ? 'انتخاب خدمت' : 'Select service'} options={services.map((service) => ({ value: service.id, label: service.name }))} />
          </Field>
          <Field label={fa ? 'تاریخ' : 'Date'}>
            <input type="date" min={minimumDate} value={date} onChange={(event) => setDate(event.target.value)} className="input min-h-11 w-full" />
          </Field>
          <Field label={fa ? 'تعداد نفرات' : 'Party size'}>
            <input type="number" min={1} max={100} value={partySize} onChange={(event) => setPartySize(Math.max(1, Number(event.target.value) || 1))} className="input min-h-11 w-full" />
          </Field>
        </div>

        {/* ── Customer info ── */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={fa ? 'نام مشتری' : 'Customer name'}>
            <input value={name} onChange={(event) => setName(event.target.value)} className="input min-h-11 w-full" placeholder={fa ? 'نام و نام خانوادگی' : 'Full name'} />
          </Field>
          <Field label={fa ? 'شماره تماس' : 'Phone'}>
            <input dir="ltr" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="09…" className="input min-h-11 w-full text-left" />
          </Field>
        </div>
        <Field label={fa ? 'یادداشت' : 'Notes'}>
          <input value={notes} onChange={(event) => setNotes(event.target.value)} className="input min-h-11 w-full" placeholder={fa ? 'توضیح اختیاری…' : 'Optional note…'} />
        </Field>

        {/* ── Available slots ── */}
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] p-4">
          <p className="text-sm font-bold text-[var(--text-primary)]">{fa ? 'زمان آزاد' : 'Available time'}</p>
          <div className="mt-3 flex min-h-16 flex-wrap gap-2">
            {loadingSlots ? (
              <Loader2 className="m-auto h-5 w-5 animate-spin text-[var(--text-primary)]" />
            ) : slots.length ? (
              slots.map((item) => (
                <button
                  key={item.startMinute}
                  type="button"
                  onClick={() => setSlot(item.startMinute)}
                  className={cn(
                    'spatial-press inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm transition-colors',
                    slot === item.startMinute
                      ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-base)]'
                      : 'border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                  )}
                >
                  <span dir="ltr" className="font-semibold">{minuteLabel(item.startMinute)}</span>
                  <span className={cn('text-[11px]', slot === item.startMinute ? 'text-[var(--bg-base)]/60' : 'text-[var(--text-muted)]')}>
                    {fa ? `${item.remainingCapacity.toLocaleString('fa-IR')} ظرفیت` : `${item.remainingCapacity} left`}
                  </span>
                </button>
              ))
            ) : (
              <p className="m-auto text-xs text-[var(--text-muted)]">{fa ? 'برای این روز زمان آزادی باقی نمانده است.' : 'No availability remains for this day.'}</p>
            )}
          </div>
        </div>

        {error && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-600">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={saving || slot === null || name.trim().length < 2 || phone.trim().length < 7}
          className="spatial-press inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-5 text-sm font-bold text-[var(--bg-base)] shadow-[var(--shadow-control)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck2 className="h-4 w-4" />}
          {fa ? 'تأیید و ثبت در تقویم' : 'Confirm and add to calendar'}
        </button>
      </div>
    </DialogShell>
  )
}

function ServicesDialog({ locale, services, onClose, onChange }: { locale: Locale; services: ServiceRow[]; onClose: () => void; onChange: (services: ServiceRow[]) => void }) {
  const fa = locale === 'fa'
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState(60)
  const [interval, setInterval] = useState(30)
  const [capacity, setCapacity] = useState(1)
  const [location, setLocation] = useState('')
  const [days, setDays] = useState<Set<number>>(() => new Set([6, 0, 1, 2, 3, 4]))
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  function resetForm() {
    setEditingId(null)
    setName('')
    setDescription('')
    setDuration(60)
    setInterval(30)
    setCapacity(1)
    setLocation('')
    setDays(new Set([6, 0, 1, 2, 3, 4]))
    setStartTime('09:00')
    setEndTime('17:00')
    setError('')
  }

  function editService(service: ServiceRow) {
    const rules = service.weeklyRules.filter((rule) => rule.active)
    setEditingId(service.id)
    setName(service.name)
    setDescription(service.description ?? '')
    setDuration(service.durationMinutes)
    setInterval(service.slotIntervalMinutes)
    setCapacity(service.capacity)
    setLocation(service.location ?? '')
    setDays(new Set(rules.map((rule) => rule.weekday)))
    setStartTime(minuteLabel(rules[0]?.startMinute ?? 9 * 60))
    setEndTime(minuteLabel(rules[0]?.endMinute ?? 17 * 60))
    setError('')
  }

  async function saveService() {
    if (name.trim().length < 2 || days.size === 0 || timeToMinute(endTime) <= timeToMinute(startTime)) return
    setSaving(true); setError('')
    try {
      const response = await fetch(
        editingId ? `/api/appointments/services/${editingId}` : '/api/appointments/services',
        { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), description: description.trim() || (editingId ? null : undefined), durationMinutes: duration, slotIntervalMinutes: interval, capacity, timezone: 'Asia/Tehran', location: location.trim() || (editingId ? null : undefined), weeklyRules: [...days].map((weekday) => ({ weekday, startMinute: timeToMinute(startTime), endMinute: timeToMinute(endTime), active: true })) }) },
      )
      const data = await response.json() as { service?: Record<string, unknown> }
      if (!response.ok || !data.service) throw new Error()
      const next = serviceFromApi(data.service)
      onChange(editingId
        ? services.map((service) => service.id === editingId ? next : service)
        : [...services, next])
      resetForm()
    } catch { setError(fa ? 'خدمت ساخته نشد؛ اطلاعات را بررسی کنید.' : 'The service could not be created.') } finally { setSaving(false) }
  }

  async function toggle(service: ServiceRow) {
    const response = await fetch(`/api/appointments/services/${service.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !service.active }) })
    if (response.ok) onChange(services.map((item) => item.id === service.id ? { ...item, active: !item.active } : item))
  }

  return (
    <DialogShell wide title={fa ? 'خدمات و ظرفیت رزرو' : 'Booking services and capacity'} subtitle={fa ? 'هر خدمت تقویم، مدت، فاصله زمانی و ظرفیت مستقل دارد.' : 'Each service has its own calendar, duration, interval, and capacity.'} onClose={onClose}>
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        {/* ── Left: services list ── */}
        <div>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">{fa ? 'خدمات فعلی' : 'Current services'}</h3>
          <div className="mt-3 space-y-2">
            {services.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border-default)] p-6 text-center text-xs text-[var(--text-muted)]">{fa ? 'هنوز خدمتی تعریف نشده است.' : 'No services yet.'}</div>
            ) : services.map((service) => (
              <article key={service.id} className={cn('flex items-center gap-3 rounded-2xl border bg-[var(--bg-base)] p-3 transition-colors', editingId === service.id ? 'border-[var(--text-primary)]' : 'border-[var(--border-default)]')}>
                <span className={cn('grid h-10 w-10 place-items-center rounded-xl', service.active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-zinc-500/10 text-zinc-500')}><CalendarClock className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">{service.name}</p>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">{service.durationMinutes.toLocaleString(fa ? 'fa-IR' : 'en-US')} {fa ? 'دقیقه' : 'min'} · {service.appointmentCount.toLocaleString(fa ? 'fa-IR' : 'en-US')} {fa ? 'رزرو' : 'bookings'}</p>
                </div>
                <button type="button" onClick={() => editService(service)} className="grid min-h-10 min-w-10 place-items-center rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]" aria-label={fa ? 'ویرایش خدمت' : 'Edit service'}><Pencil className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => void toggle(service)} className={cn('min-h-10 rounded-xl border px-3 text-xs transition-colors', service.active ? 'border-emerald-500/20 text-emerald-700 hover:bg-emerald-50' : 'border-[var(--border-default)] text-[var(--text-secondary)]')}>{service.active ? (fa ? 'فعال' : 'Active') : (fa ? 'آرشیو' : 'Archived')}</button>
              </article>
            ))}
          </div>
        </div>
        {/* ── Right: form ── */}
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">{editingId ? <Pencil className="h-4 w-4 text-[var(--text-primary)]" /> : <Plus className="h-4 w-4 text-[var(--text-primary)]" />}{editingId ? (fa ? 'ویرایش خدمت' : 'Edit service') : (fa ? 'خدمت جدید' : 'New service')}</h3>
            {editingId && <button type="button" onClick={resetForm} className="min-h-9 rounded-lg px-2 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-hover)]">{fa ? 'انصراف' : 'Cancel'}</button>}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label={fa ? 'نام خدمت' : 'Service name'}><input value={name} onChange={(event) => setName(event.target.value)} className="input min-h-11 w-full" /></Field>
            <Field label={fa ? 'محل یا لینک' : 'Location or link'}><input value={location} onChange={(event) => setLocation(event.target.value)} className="input min-h-11 w-full" /></Field>
            <Field label={fa ? 'مدت (دقیقه)' : 'Duration (min)'}><input type="number" min={10} max={480} value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="input min-h-11 w-full" /></Field>
            <Field label={fa ? 'فاصله شروع‌ها' : 'Slot interval'}><input type="number" min={5} max={240} value={interval} onChange={(event) => setInterval(Number(event.target.value))} className="input min-h-11 w-full" /></Field>
            <Field label={fa ? 'ظرفیت هم‌زمان' : 'Concurrent capacity'}><input type="number" min={1} max={100} value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} className="input min-h-11 w-full" /></Field>
            <Field label={fa ? 'توضیح کوتاه' : 'Short description'}><input value={description} onChange={(event) => setDescription(event.target.value)} className="input min-h-11 w-full" /></Field>
          </div>
          <div className="mt-4">
            <p className="text-xs font-medium text-[var(--text-primary)]">{fa ? 'روزهای کاری' : 'Working days'}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => (
                <button key={day.value} type="button" aria-pressed={days.has(day.value)} onClick={() => setDays((current) => { const next = new Set(current); if (next.has(day.value)) next.delete(day.value); else next.add(day.value); return next })} className={cn('min-h-10 min-w-10 rounded-xl border px-2 text-xs transition-colors', days.has(day.value) ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-base)]' : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]')}>{fa ? day.fa : day.en}</button>
              ))}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label={fa ? 'شروع' : 'Starts'}><input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="input min-h-11 w-full" /></Field>
            <Field label={fa ? 'پایان' : 'Ends'}><input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="input min-h-11 w-full" /></Field>
          </div>
          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
          <button type="button" onClick={saveService} disabled={saving || name.trim().length < 2 || days.size === 0 || timeToMinute(endTime) <= timeToMinute(startTime)} className="spatial-press mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-sm font-bold text-[var(--bg-base)] shadow-[var(--shadow-control)] transition-opacity hover:opacity-90 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingId ? (fa ? 'ذخیره تغییرات خدمت' : 'Save service changes') : (fa ? 'ساخت خدمت و فعال‌سازی رزرو' : 'Create service and enable booking')}
          </button>
        </div>
      </div>
    </DialogShell>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">{label}</span>{children}</label>
}
