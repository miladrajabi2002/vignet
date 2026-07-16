'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Bot,
  CalendarCheck2,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Settings2,
  Sparkles,
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

const STATUS_COPY: Record<AppointmentStatus, { fa: string; en: string; tone: string }> = {
  PENDING: { fa: 'در انتظار تأیید', en: 'Pending', tone: 'bg-amber-500/10 text-amber-600 ring-amber-500/15' },
  CONFIRMED: { fa: 'تأییدشده', en: 'Confirmed', tone: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/15' },
  CANCELLED: { fa: 'لغوشده', en: 'Cancelled', tone: 'bg-red-500/10 text-red-600 ring-red-500/15' },
  COMPLETED: { fa: 'انجام‌شده', en: 'Completed', tone: 'bg-blue-500/10 text-blue-700 ring-blue-500/15' },
  NO_SHOW: { fa: 'عدم حضور', en: 'No show', tone: 'bg-zinc-500/10 text-zinc-600 ring-zinc-500/15' },
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

  const days = useMemo(
    () => Array.from({ length: 14 }, (_, index) => shiftDateKey(initialDate, index)),
    [initialDate],
  )
  const activeServices = services.filter((service) => service.active)
  const activeToday = appointments.filter((item) => ['PENDING', 'CONFIRMED'].includes(item.status))
  const usedCapacity = activeToday.reduce((sum, item) => sum + item.partySize, 0)

  // Fetch appointment counts for the whole 14-day window so each day chip can
  // show a density indicator (empty / some / busy). Runs on mount and whenever
  // the service filter changes.
  useEffect(() => {
    let cancelled = false
    Promise.all(
      days.map(async (date) => {
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
      setDayCounts(Object.fromEntries(entries))
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceFilter, initialDate])

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
        {/* ── Daily schedule — main panel ── */}
        <div className="spatial-surface min-w-0 rounded-[1.5rem] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold tracking-tight text-[var(--text-primary)]">{fa ? 'برنامه روزانه' : 'Daily schedule'}</h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{fa ? 'زمان‌ها با منطقه زمانی تهران نمایش داده می‌شوند.' : 'Times are shown in the service timezone.'}</p>
            </div>
            <MaterialSelect value={serviceFilter} onValueChange={(value) => { setServiceFilter(value); void loadDay(selectedDate, value) }} ariaLabel={fa ? 'فیلتر خدمات' : 'Filter services'} className="min-w-48" options={[{ value: '', label: fa ? 'همه خدمات' : 'All services' }, ...services.map((service) => ({ value: service.id, label: service.name }))]} />
          </div>

          {/* ── Day selector — horizontal strip ── */}
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2" role="list" aria-label={fa ? 'انتخاب روز' : 'Choose a day'}>
            {days.map((date, index) => {
              const isSelected = selectedDate === date
              const count = dayCounts[date] ?? 0
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => void loadDay(date)}
                  aria-pressed={isSelected}
                  className={cn(
                    'group relative flex min-w-[72px] shrink-0 flex-col items-center rounded-2xl border px-2.5 py-2.5 text-center transition-[border-color,background-color,transform] hover:-translate-y-0.5 motion-reduce:transform-none',
                    isSelected
                      ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-base)] shadow-[var(--shadow-control)]'
                      : 'border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]',
                  )}
                >
                  <span className={cn('block text-[10px] font-medium uppercase tracking-wide', isSelected ? 'text-[var(--bg-base)]/60' : 'text-[var(--text-muted)]')}>
                    {new Intl.DateTimeFormat(fa ? 'fa-IR-u-ca-persian' : 'en-US', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))}
                  </span>
                  <span className="mt-0.5 block text-lg font-bold tabular-nums">
                    {new Intl.DateTimeFormat(fa ? 'fa-IR-u-ca-persian' : 'en-US', { day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))}
                  </span>
                  {index === 0 && (
                    <span className={cn('mt-0.5 block text-[10px] font-semibold', isSelected ? 'text-[var(--bg-base)]/80' : 'text-emerald-600')}>{fa ? 'امروز' : 'Today'}</span>
                  )}
                  {/* Density dots */}
                  <span className="mt-1 flex items-center justify-center gap-0.5">
                    {count === 0 ? (
                      <span className={cn('h-1 w-1 rounded-full', isSelected ? 'bg-[var(--bg-base)]/30' : 'bg-[var(--border-strong)] opacity-50')} />
                    ) : (
                      Array.from({ length: Math.min(3, Math.ceil(count / 2)) }).map((_, i) => (
                        <span key={i} className={cn('h-1 w-1 rounded-full', isSelected ? 'bg-[var(--bg-base)]' : 'bg-[var(--text-secondary)]')} />
                      ))
                    )}
                  </span>
                </button>
              )
            })}
          </div>

          {error && <p role="alert" className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-600">{error}</p>}

          {/* ── Appointment list — timeline style ── */}
          <div className="relative mt-4 min-h-48">
            {loadingDay && <div className="absolute inset-0 z-10 grid place-items-center rounded-2xl bg-[var(--bg-surface)]/80"><Loader2 className="h-5 w-5 animate-spin text-[var(--text-primary)]" /></div>}
            {appointments.length === 0 ? (
              <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-base)] p-8 text-center">
                <div><CalendarClock className="mx-auto h-8 w-8 text-[var(--text-muted)]" /><p className="mt-3 text-sm font-medium text-[var(--text-primary)]">{fa ? 'برای این روز نوبتی ثبت نشده' : 'No appointments for this day'}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{fa ? 'می‌توانید دستی ثبت کنید یا ایجنت از گفتگو رزرو کند.' : 'Create one here or let the agent book from a conversation.'}</p></div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* Vertical timeline line */}
                <div className="pointer-events-none absolute bottom-2 start-[26px] top-2 w-px bg-[var(--border-subtle)] sm:start-[30px]" aria-hidden />
                {appointments.map((appointment) => (
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
            <div className="mt-3 space-y-2">{activeServices.slice(0, 4).map((service) => <div key={service.id} className="rounded-xl bg-[var(--bg-base)] p-3"><p className="truncate text-xs font-medium text-[var(--text-primary)]">{service.name}</p><p className="mt-1 text-[11px] text-[var(--text-muted)]">{service.durationMinutes.toLocaleString(fa ? 'fa-IR' : 'en-US')} {fa ? 'دقیقه' : 'min'} · {fa ? 'ظرفیت' : 'capacity'} {service.capacity.toLocaleString(fa ? 'fa-IR' : 'en-US')}</p></div>)}</div>
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
  const time = new Intl.DateTimeFormat(fa ? 'fa-IR' : 'en-US', { timeZone: appointment.timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(appointment.startsAt))
  const terminal = ['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(appointment.status)
  const copy = STATUS_COPY[appointment.status]
  return (
    <article className="relative flex gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] p-3.5 transition-colors hover:border-[var(--border-strong)] sm:gap-4 sm:p-4">
      {/* Timeline dot — sits on the vertical line */}
      <div className="relative z-10 flex shrink-0 flex-col items-center">
        <div className="flex h-12 w-12 flex-col items-center justify-center rounded-2xl bg-[var(--bg-surface)] ring-1 ring-[var(--border-default)] sm:h-14 sm:w-14">
          <Clock3 className="h-3 w-3 text-[var(--text-muted)]" />
          <span dir="ltr" className="mt-0.5 text-xs font-bold tabular-nums text-[var(--text-primary)] sm:text-sm">{time}</span>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">{appointment.customerName}</h3>
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] ring-1', copy.tone)}>{fa ? copy.fa : copy.en}</span>
          {appointment.source === 'agent' && <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] text-violet-600"><Sparkles className="h-3 w-3" />{fa ? 'رزرو ایجنت' : 'Agent booked'}</span>}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1"><CalendarCheck2 className="h-3.5 w-3.5" />{appointment.serviceName}</span>
          {appointment.customerPhone && <span dir="ltr" className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{appointment.customerPhone}</span>}
          <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{appointment.partySize.toLocaleString(fa ? 'fa-IR' : 'en-US')}</span>
          {appointment.serviceLocation && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{appointment.serviceLocation}</span>}
        </div>
        {appointment.notes && <p className="mt-2 line-clamp-2 rounded-lg bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-muted)]">{appointment.notes}</p>}
      </div>
      {!terminal && !cancelling && (
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <button type="button" disabled={busy} onClick={() => onStatus('COMPLETED')} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-emerald-500/20 px-3 text-xs text-emerald-700 transition-colors hover:bg-emerald-50"><CheckCircle2 className="h-3.5 w-3.5" />{fa ? 'انجام شد' : 'Complete'}</button>
          <button type="button" disabled={busy} onClick={() => onStatus('NO_SHOW')} className="min-h-10 rounded-xl border border-[var(--border-default)] px-3 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]">{fa ? 'عدم حضور' : 'No show'}</button>
          <button type="button" disabled={busy} onClick={onStartCancel} className="grid min-h-10 min-w-10 place-items-center rounded-xl border border-red-500/20 text-red-500 transition-colors hover:bg-red-50" aria-label={fa ? 'لغو نوبت' : 'Cancel appointment'}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}</button>
        </div>
      )}
      {cancelling && (
        <div className="absolute inset-x-3 bottom-3 flex flex-col gap-2 rounded-xl border border-red-500/20 bg-red-50/50 p-3 sm:flex-row sm:items-center sm:inset-x-4 sm:bottom-4">
          <input autoFocus value={cancellationReason} onChange={(event) => onCancellationReason(event.target.value)} placeholder={fa ? 'دلیل لغو را بنویسید…' : 'Cancellation reason…'} className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--border-default)] bg-white px-3 text-sm outline-none focus:border-red-500/30" />
          <div className="flex gap-2">
            <button type="button" onClick={() => onStatus('CANCELLED', cancellationReason.trim())} disabled={cancellationReason.trim().length < 2 || busy} className="min-h-11 rounded-xl bg-red-500 px-4 text-sm font-medium text-white disabled:opacity-50">{fa ? 'تأیید لغو' : 'Confirm cancel'}</button>
            <button type="button" onClick={onStopCancel} className="min-h-11 rounded-xl border border-[var(--border-default)] bg-white px-4 text-sm text-[var(--text-secondary)]">{fa ? 'انصراف' : 'Back'}</button>
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
