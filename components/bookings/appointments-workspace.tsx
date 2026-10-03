'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeftRight,
  Bot,
  CalendarCheck2,
  CalendarClock,
  CalendarOff,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Loader2,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  Sparkles,
  UserX,
  Users,
  Trash2,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/dashboard/page-header'
import { MaterialSelect } from '@/components/ui/material-select'
import { StatusChip } from '@/components/ui/status-chip'
import { dateKeyInTimeZone } from '@/lib/bookings/time'
import { dateLocaleTag, formatDateKey } from '@/lib/localized-date'
import { displayPhone } from '@/lib/phone'
import { BookingMotion } from '@/components/bookings/booking-motion'
import { formatClock } from '@/components/ui/time-picker'
import { BookingDialog } from '@/components/bookings/booking-dialog'
import { SERVICE_TEMPLATES, ServiceEditor, type ServiceTemplate } from '@/components/bookings/service-editor'
import { ServicesBoard } from '@/components/bookings/services-board'
import { DeleteServiceDialog } from '@/components/bookings/delete-service'
import { ReminderSettingsCard, ReminderStatusLine } from '@/components/bookings/reminder-settings'
import {
  DAY_PARTS,
  STATUS_META,
  appointmentFromApi,
  dayPartOfMinute,
  isClosedDate,
  localMinuteOf,
  num,
  serviceAccent,
  shiftDateKey,
  type AppointmentRow,
  type AppointmentStatus,
  type DayPart,
  type DaySummary,
  type Locale,
  type ServiceRow,
} from '@/components/bookings/booking-model'

type Tab = 'schedule' | 'services'
const TZ = 'Asia/Tehran'

export function AppointmentsWorkspace({
  locale,
  title,
  initialTab = 'schedule',
  initialDate,
  initialServices,
  initialAppointments,
  initialEditId,
  remindersEnabled = true,
}: {
  locale: Locale
  title: string
  /** Workspace switch: customer reminders 24 h / 2 h before, in-chat. */
  remindersEnabled?: boolean
  initialTab?: Tab
  /** Opens this service's editor on arrival (hand-off from /services). */
  initialEditId?: string
  initialDate: string
  initialServices: ServiceRow[]
  initialAppointments: AppointmentRow[]
}) {
  const fa = locale === 'fa'
  const todayKey = useMemo(() => dateKeyInTimeZone(new Date(), TZ), [])
  const [tab, setTab] = useState<Tab>(initialTab)
  const [services, setServices] = useState(initialServices)
  const [appointments, setAppointments] = useState(initialAppointments)
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [weekStart, setWeekStart] = useState(initialDate)
  const [serviceFilter, setServiceFilter] = useState('')
  const [loadingDay, setLoadingDay] = useState(false)
  const [error, setError] = useState('')
  const [week, setWeek] = useState<Record<string, DaySummary>>({})
  const [stats, setStats] = useState<Record<string, DaySummary>>({})
  const [booking, setBooking] = useState<{ open: boolean; reschedule?: AppointmentRow | null; serviceId?: string }>({ open: false })
  const [editor, setEditor] = useState<{ open: boolean; service?: ServiceRow | null; template?: ServiceTemplate | null }>(() => {
    const service = initialEditId ? initialServices.find((item) => item.id === initialEditId) : undefined
    return service ? { open: true, service } : { open: false }
  })
  const [deleting, setDeleting] = useState<ServiceRow | null>(null)
  const dayRequest = useRef(0)

  const activeServices = useMemo(() => services.filter((service) => service.active), [services])
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => shiftDateKey(weekStart, index)), [weekStart])

  const switchTab = useCallback((next: Tab) => {
    setTab(next)
    try {
      const url = new URL(window.location.href)
      if (next === 'schedule') url.searchParams.delete('tab')
      else url.searchParams.set('tab', next)
      window.history.replaceState(window.history.state, '', url)
    } catch { /* URL sync is a convenience only */ }
  }, [])

  const loadWeek = useCallback(async (start: string, filter: string) => {
    try {
      const query = new URLSearchParams({ from: start, days: '7' })
      if (filter) query.set('serviceId', filter)
      const response = await fetch(`/api/appointments/summary?${query}`)
      const data = await response.json() as { days?: Record<string, DaySummary> }
      if (response.ok && data.days) setWeek(data.days)
    } catch { /* strip keeps its last known counts */ }
  }, [])

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch(`/api/appointments/summary?${new URLSearchParams({ from: todayKey, days: '7' })}`)
      const data = await response.json() as { days?: Record<string, DaySummary> }
      if (response.ok && data.days) setStats(data.days)
    } catch { /* keep last stats */ }
  }, [todayKey])

  useEffect(() => { void loadWeek(weekStart, serviceFilter) }, [loadWeek, weekStart, serviceFilter])
  useEffect(() => { void loadStats() }, [loadStats])

  const loadDay = useCallback(async (date: string, filter: string) => {
    const request = ++dayRequest.current
    setLoadingDay(true)
    setError('')
    setSelectedDate(date)
    try {
      const query = new URLSearchParams({ date })
      if (filter) query.set('serviceId', filter)
      const response = await fetch(`/api/appointments?${query}`)
      const data = await response.json() as { appointments?: Array<Record<string, unknown>> }
      if (!response.ok || !data.appointments) throw new Error()
      if (request === dayRequest.current) setAppointments(data.appointments.map(appointmentFromApi))
    } catch {
      if (request === dayRequest.current) setError(fa ? 'بارگذاری برنامه این روز انجام نشد. دوباره تلاش کنید.' : 'Could not load this day. Try again.')
    } finally {
      if (request === dayRequest.current) setLoadingDay(false)
    }
  }, [fa])

  const refreshAll = useCallback(async (date = selectedDate) => {
    await Promise.all([loadDay(date, serviceFilter), loadWeek(weekStart, serviceFilter), loadStats()])
  }, [loadDay, loadStats, loadWeek, selectedDate, serviceFilter, weekStart])

  function selectDate(date: string) {
    void loadDay(date, serviceFilter)
  }

  function moveWeek(amount: number) {
    const nextStart = shiftDateKey(weekStart, amount)
    setWeekStart(nextStart)
    void loadDay(nextStart, serviceFilter)
  }

  function goToday() {
    setWeekStart(todayKey)
    void loadDay(todayKey, serviceFilter)
  }

  function changeFilter(value: string) {
    setServiceFilter(value)
    void loadDay(selectedDate, value)
  }

  async function updateStatus(id: string, status: AppointmentStatus, reason?: string): Promise<boolean> {
    setError('')
    // Optimistic: the row flips immediately and rolls back on failure.
    const previous = appointments
    setAppointments((rows) => rows.map((row) => (row.id === id ? { ...row, status } : row)))
    try {
      const response = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...(reason ? { cancellationReason: reason } : {}) }),
      })
      if (!response.ok) throw new Error()
      void loadWeek(weekStart, serviceFilter)
      void loadStats()
      return true
    } catch {
      setAppointments(previous)
      setError(fa ? 'تغییر وضعیت ذخیره نشد.' : 'The status could not be updated.')
      return false
    }
  }

  async function toggleService(service: ServiceRow, active: boolean) {
    const response = await fetch(`/api/appointments/services/${service.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    })
    if (response.ok) setServices((rows) => rows.map((row) => (row.id === service.id ? { ...row, active } : row)))
  }

  function serviceDeleted(serviceId: string) {
    setServices((rows) => rows.filter((row) => row.id !== serviceId))
    setAppointments((rows) => rows.filter((row) => row.serviceId !== serviceId))
    setEditor({ open: false })
    setDeleting(null)
    if (serviceFilter === serviceId) changeFilter('')
    void loadWeek(weekStart, serviceFilter === serviceId ? '' : serviceFilter)
    void loadStats()
  }

  async function deleteAppointment(id: string): Promise<boolean> {
    setError('')
    const previous = appointments
    setAppointments((rows) => rows.filter((row) => row.id !== id))
    const response = await fetch(`/api/appointments/${id}`, { method: 'DELETE' }).catch(() => null)
    if (!response?.ok && response?.status !== 404) {
      setAppointments(previous)
      setError(fa ? 'حذف نوبت انجام نشد؛ دوباره تلاش کنید.' : 'The booking could not be deleted.')
      return false
    }
    setServices((rows) => rows.map((row) => {
      const removed = previous.find((item) => item.id === id)
      return removed && row.id === removed.serviceId ? { ...row, appointmentCount: Math.max(0, row.appointmentCount - 1) } : row
    }))
    void loadWeek(weekStart, serviceFilter)
    void loadStats()
    return true
  }

  const selectedLabel = formatDateKey(selectedDate, locale, { weekday: 'long', day: 'numeric', month: 'long' })
  const monthLabel = useMemo(() => {
    const month = new Intl.DateTimeFormat(dateLocaleTag(locale), { month: 'long', timeZone: 'UTC' })
    const year = new Intl.DateTimeFormat(dateLocaleTag(locale), { year: 'numeric', timeZone: 'UTC' })
    const first = new Date(`${weekDays[0]}T12:00:00Z`)
    const last = new Date(`${weekDays[6]}T12:00:00Z`)
    const a = month.format(first)
    const b = month.format(last)
    return a === b ? `${a} ${year.format(last)}` : `${a} – ${b} ${year.format(last)}`
  }, [weekDays, locale])

  const statTotals = useMemo(() => {
    const values = Object.values(stats)
    return {
      today: stats[todayKey]?.active ?? 0,
      week: values.reduce((sum, day) => sum + day.active, 0),
      pending: values.reduce((sum, day) => sum + day.pending, 0),
      people: stats[todayKey]?.people ?? 0,
    }
  }, [stats, todayKey])

  const dayCounts = useMemo(() => ({
    active: appointments.filter((row) => row.status === 'PENDING' || row.status === 'CONFIRMED').length,
    pending: appointments.filter((row) => row.status === 'PENDING').length,
    done: appointments.filter((row) => row.status === 'COMPLETED').length,
    people: appointments.filter((row) => row.status === 'PENDING' || row.status === 'CONFIRMED').reduce((sum, row) => sum + row.partySize, 0),
  }), [appointments])

  const maxWeek = Math.max(3, ...weekDays.map((key) => week[key]?.active ?? 0))
  const selectedClosed = isClosedDate(services, selectedDate)
  const noServices = services.length === 0

  const openCreate = (template?: ServiceTemplate | null) => setEditor({ open: true, service: null, template: template ?? null })

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* ── Header ── */}
      <PageHeader
        icon={CalendarCheck2}
        title={title}
        subtitle={fa
          ? 'خدمت و ساعت کاری را تعریف کنید؛ ایجنت در گفتگو زمان آزاد واقعی را پیشنهاد می‌دهد، بدون تداخل رزرو می‌کند و به شما خبر می‌دهد.'
          : 'Define services and hours; the agent offers real free times in chat, books without conflicts and alerts you.'}
        actions={noServices ? undefined : (
          <>
            <button type="button" onClick={() => openCreate()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-default)] bg-white px-4 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]">
              <Plus className="h-4 w-4" />{fa ? 'خدمت جدید' : 'New service'}
            </button>
            <button type="button" onClick={() => setBooking({ open: true })} disabled={!activeServices.length} className="spatial-press inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-sm font-bold text-white shadow-[var(--shadow-control)] transition-opacity hover:opacity-90 disabled:opacity-45">
              <CalendarCheck2 className="h-4 w-4" />{fa ? 'ثبت نوبت' : 'Book'}
            </button>
          </>
        )}
      />

      {noServices ? (
        <Onboarding fa={fa} onCreate={openCreate} />
      ) : (
        <>
          {/* ── Tabs + KPIs ── */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="ui-seg w-full grid-cols-2 lg:w-[22rem]" role="tablist" aria-label={fa ? 'بخش‌ها' : 'Sections'}>
              <button type="button" role="tab" aria-selected={tab === 'schedule'} onClick={() => switchTab('schedule')} className="ui-seg-tab text-sm">
                <CalendarClock className="h-4 w-4" />{fa ? 'برنامه نوبت‌ها' : 'Schedule'}
              </button>
              <button type="button" role="tab" aria-selected={tab === 'services'} onClick={() => switchTab('services')} className="ui-seg-tab text-sm">
                <LayoutGrid className="h-4 w-4" />{fa ? 'خدمات' : 'Services'}
                <span className="rounded-full bg-black/[0.07] px-1.5 text-[12px] tabular-nums">{num(services.length, fa)}</span>
              </button>
            </div>
            <dl className="grid grid-cols-4 divide-x divide-[var(--border-subtle)] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white/80 rtl:divide-x-reverse lg:min-w-[30rem]">
              <Kpi label={fa ? 'امروز' : 'Today'} value={statTotals.today} fa={fa} />
              <Kpi label={fa ? '۷ روز آینده' : 'Next 7 days'} value={statTotals.week} fa={fa} />
              <Kpi label={fa ? 'در انتظار تأیید' : 'Pending'} value={statTotals.pending} fa={fa} tone={statTotals.pending ? 'warn' : undefined} />
              <Kpi label={fa ? 'نفر امروز' : 'People today'} value={statTotals.people} fa={fa} />
            </dl>
          </div>

          {tab === 'services' ? (
            <ServicesBoard
              locale={locale}
              services={services}
              onEdit={(service) => setEditor({ open: true, service })}
              onDelete={setDeleting}
              onCreate={() => openCreate()}
              onToggle={toggleService}
            />
          ) : (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
              <section className="spatial-surface min-w-0 rounded-card p-4 sm:p-5" aria-label={fa ? 'برنامه روزانه' : 'Daily schedule'}>
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1">
                    <IconButton label={fa ? 'هفته قبل' : 'Previous week'} onClick={() => moveWeek(-7)}><ChevronRight className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" /></IconButton>
                    <IconButton label={fa ? 'هفته بعد' : 'Next week'} onClick={() => moveWeek(7)}><ChevronLeft className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" /></IconButton>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="ui-h3 truncate">{monthLabel}</p>
                  </div>
                  <button
                    type="button"
                    onClick={goToday}
                    disabled={weekStart === todayKey && selectedDate === todayKey}
                    className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border-default)] bg-white px-3 text-xs font-bold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-40"
                  >
                    {fa ? 'امروز' : 'Today'}
                  </button>
                  {services.length > 1 && (
                    <MaterialSelect
                      value={serviceFilter}
                      onValueChange={changeFilter}
                      ariaLabel={fa ? 'فیلتر خدمت' : 'Filter by service'}
                      className="w-full sm:w-48"
                      options={[{ value: '', label: fa ? 'همه خدمات' : 'All services' }, ...services.map((service) => ({ value: service.id, label: service.name }))]}
                    />
                  )}
                </div>

                {/* Week strip with load bars */}
                <div className="mt-4 grid grid-cols-7 gap-1.5 sm:gap-2" role="listbox" aria-label={fa ? 'انتخاب روز' : 'Choose a day'}>
                  {weekDays.map((key) => {
                    const active = week[key]?.active ?? 0
                    const pending = week[key]?.pending ?? 0
                    const selected = key === selectedDate
                    const isToday = key === todayKey
                    const closed = isClosedDate(services, key)
                    const dateObj = new Date(`${key}T12:00:00Z`)
                    const weekday = new Intl.DateTimeFormat(dateLocaleTag(locale), { weekday: 'short', timeZone: 'UTC' }).format(dateObj)
                    const day = new Intl.DateTimeFormat(dateLocaleTag(locale), { day: 'numeric', timeZone: 'UTC' }).format(dateObj)
                    return (
                      <button
                        key={key}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => selectDate(key)}
                        aria-label={`${formatDateKey(key, locale, { weekday: 'long', day: 'numeric', month: 'long' })} — ${closed ? (fa ? 'تعطیل' : 'closed') : `${num(active, fa)} ${fa ? 'نوبت' : 'bookings'}`}`}
                        className={cn(
                          'relative flex flex-col items-center rounded-2xl border px-1 pb-2 pt-2.5 transition-[background-color,border-color,transform] hover:-translate-y-0.5 motion-reduce:hover:translate-y-0',
                          selected
                            ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white shadow-[var(--shadow-control)]'
                            : closed
                              ? 'border-dashed border-[var(--border-default)] bg-transparent text-[var(--text-hint)]'
                              : 'border-[var(--border-default)] bg-white text-[var(--text-primary)] hover:border-[var(--border-strong)]',
                        )}
                      >
                        <span className={cn('text-[12px] font-medium', selected ? 'text-white/70' : 'text-[var(--text-muted)]')}>{weekday}</span>
                        <span className="text-lg font-bold leading-7 tabular-nums">{day}</span>
                        {closed ? (
                          <span className={cn('mt-1 text-[12px]', selected ? 'text-white/70' : 'text-[var(--text-muted)]')}>{fa ? 'تعطیل' : 'Off'}</span>
                        ) : (
                          <span className="mt-1.5 flex w-full items-center gap-1 px-1.5 sm:px-2.5" dir="ltr">
                            <span className={cn('h-1 flex-1 overflow-hidden rounded-full', selected ? 'bg-white/20' : 'bg-black/[0.06]')}>
                              <span className={cn('block h-full rounded-full transition-[width] duration-500', selected ? 'bg-white' : 'bg-[var(--text-primary)]')} style={{ width: `${Math.min(100, (active / maxWeek) * 100)}%` }} />
                            </span>
                            <span className={cn('text-[12px] font-bold tabular-nums', selected ? 'text-white' : active ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]')}>{num(active, fa)}</span>
                          </span>
                        )}
                        {isToday && <span className={cn('absolute top-1.5 h-1.5 w-1.5 rounded-full end-1.5', selected ? 'bg-white' : 'bg-[var(--signal)]')} aria-hidden />}
                        {pending > 0 && !selected && <span className="absolute -top-1 start-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" aria-hidden />}
                      </button>
                    )
                  })}
                </div>

                {/* Selected day header */}
                <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[var(--border-subtle)] pt-4">
                  <h2 className="ui-h2">{selectedDate === todayKey ? (fa ? `امروز، ${selectedLabel}` : `Today, ${selectedLabel}`) : selectedLabel}</h2>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {selectedClosed ? (
                      <StatusChip tone="neutral"><CalendarOff className="h-3 w-3" />{fa ? 'روز تعطیل' : 'Closed day'}</StatusChip>
                    ) : (
                      <>
                        <StatusChip tone="neutral">{fa ? `${num(dayCounts.active, true)} نوبت فعال` : `${dayCounts.active} active`}</StatusChip>
                        {dayCounts.pending > 0 && <StatusChip tone="warn" dot>{fa ? `${num(dayCounts.pending, true)} در انتظار` : `${dayCounts.pending} pending`}</StatusChip>}
                        {dayCounts.people > dayCounts.active && <StatusChip tone="neutral"><Users className="h-3 w-3" />{fa ? `${num(dayCounts.people, true)} نفر` : `${dayCounts.people} people`}</StatusChip>}
                        {dayCounts.done > 0 && <StatusChip tone="ok">{fa ? `${num(dayCounts.done, true)} انجام‌شده` : `${dayCounts.done} done`}</StatusChip>}
                      </>
                    )}
                  </div>
                  {!selectedClosed && selectedDate >= todayKey && (
                    <button type="button" onClick={() => setBooking({ open: true, serviceId: serviceFilter || undefined })} className="ms-auto inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]">
                      <Plus className="h-3.5 w-3.5" />{fa ? 'نوبت در این روز' : 'Book this day'}
                    </button>
                  )}
                </div>

                {error && (
                  <p role="alert" className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700">
                    {error}
                    <button type="button" onClick={() => void refreshAll()} className="min-h-8 rounded-lg px-2 font-bold underline-offset-2 hover:underline">{fa ? 'تلاش دوباره' : 'Retry'}</button>
                  </p>
                )}

                <div className="relative mt-4 min-h-40" aria-busy={loadingDay}>
                  {loadingDay && (
                    <div className="absolute inset-0 z-10 grid place-items-center rounded-2xl bg-white/70 backdrop-blur-[2px]">
                      <Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" />
                    </div>
                  )}
                  <DayTimeline
                    locale={locale}
                    appointments={appointments}
                    isToday={selectedDate === todayKey}
                    closed={selectedClosed}
                    canBook={!selectedClosed && selectedDate >= todayKey && activeServices.length > 0}
                    onBook={() => setBooking({ open: true, serviceId: serviceFilter || undefined })}
                    onStatus={updateStatus}
                    onDelete={deleteAppointment}
                    onReschedule={(appointment) => setBooking({ open: true, reschedule: appointment })}
                  />
                </div>
              </section>

              <AgentPanel fa={fa} services={activeServices} onManage={() => switchTab('services')} remindersEnabled={remindersEnabled} />
            </div>
          )}
        </>
      )}

      {booking.open && (
        <BookingDialog
          locale={locale}
          services={booking.reschedule ? services : activeServices}
          initialDate={selectedDate}
          initialServiceId={booking.serviceId}
          reschedule={booking.reschedule}
          onClose={() => setBooking({ open: false })}
          onDone={(date) => {
            setBooking({ open: false })
            setServiceFilter('')
            setWeekStart((start) => (date >= start && date < shiftDateKey(start, 7) ? start : date))
            void loadDay(date, '')
            void loadStats()
            void loadWeek(date >= weekStart && date < shiftDateKey(weekStart, 7) ? weekStart : date, '')
          }}
        />
      )}
      {editor.open && (
        <ServiceEditor
          locale={locale}
          service={editor.service}
          template={editor.template}
          onClose={() => setEditor({ open: false })}
          onDeleted={serviceDeleted}
          onSaved={(saved, created, keepOpen) => {
            setServices((rows) => (created ? [...rows, saved] : rows.map((row) => (row.id === saved.id ? saved : row))))
            if (keepOpen) return
            setEditor({ open: false })
            if (created) switchTab('services')
          }}
        />
      )}
      {deleting && (
        <DeleteServiceDialog
          locale={locale}
          service={deleting}
          onCancel={() => setDeleting(null)}
          onDeleted={serviceDeleted}
          onPause={async () => { await toggleService(deleting, false); setDeleting(null) }}
        />
      )}
    </div>
  )
}

function Kpi({ label, value, fa, tone }: { label: string; value: number; fa: boolean; tone?: 'warn' }) {
  return (
    <div className="flex min-w-0 flex-col-reverse px-2 py-2.5 text-center sm:px-3">
      <dt className="truncate text-[12px] text-[var(--text-muted)]">{label}</dt>
      <dd className={cn('text-lg font-bold tabular-nums leading-7', tone === 'warn' ? 'text-amber-700' : 'text-[var(--text-primary)]')}>{num(value, fa)}</dd>
    </div>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="grid h-10 w-10 place-items-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
      {children}
    </button>
  )
}

function DayTimeline({
  locale,
  appointments,
  isToday,
  closed,
  canBook,
  onBook,
  onStatus,
  onDelete,
  onReschedule,
}: {
  locale: Locale
  appointments: AppointmentRow[]
  isToday: boolean
  closed: boolean
  canBook: boolean
  onBook: () => void
  onStatus: (id: string, status: AppointmentStatus, reason?: string) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  onReschedule: (appointment: AppointmentRow) => void
}) {
  const fa = locale === 'fa'
  const [nowMinute, setNowMinute] = useState<number | null>(null)

  useEffect(() => {
    if (!isToday) { setNowMinute(null); return }
    const tick = () => setNowMinute(localMinuteOf(new Date().toISOString(), TZ))
    tick()
    const timer = window.setInterval(tick, 60_000)
    return () => window.clearInterval(timer)
  }, [isToday])

  const groups = useMemo(() => {
    const sorted = [...appointments].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    const map: Record<DayPart, AppointmentRow[]> = { morning: [], afternoon: [], evening: [] }
    for (const row of sorted) map[dayPartOfMinute(localMinuteOf(row.startsAt, row.timezone))].push(row)
    return (Object.keys(map) as DayPart[]).filter((key) => map[key].length).map((key) => ({ key, items: map[key] }))
  }, [appointments])
  const nextId = nowMinute === null
    ? null
    : groups.flatMap((group) => group.items).find((row) => localMinuteOf(row.startsAt, row.timezone) > nowMinute)?.id ?? null

  if (!appointments.length) {
    return (
      <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-base)] p-8 text-center">
        <div>
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white ring-1 ring-[var(--border-subtle)]">
            {closed ? <CalendarOff className="h-5 w-5 text-[var(--text-muted)]" /> : <CalendarClock className="h-5 w-5 text-[var(--text-muted)]" />}
          </span>
          <p className="mt-3 text-sm font-bold text-[var(--text-primary)]">
            {closed ? (fa ? 'این روز برای رزرو بسته است' : 'This day is closed for booking') : (fa ? 'هنوز نوبتی ثبت نشده' : 'No appointments yet')}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {closed
              ? (fa ? 'ساعت کاری یا تعطیلی را از بخش «خدمات» تغییر دهید.' : 'Change hours or closures under Services.')
              : (fa ? 'ایجنت از گفتگوها رزرو می‌کند؛ دستی هم می‌توانید ثبت کنید.' : 'The agent books from chats; you can also add one.')}
          </p>
          {canBook && (
            <button type="button" onClick={onBook} className="spatial-press mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--text-primary)] px-4 text-xs font-bold text-white">
              <Plus className="h-3.5 w-3.5" />{fa ? 'ثبت نوبت' : 'Book'}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => {
        const part = DAY_PARTS[group.key]
        return (
          <div key={group.key}>
            <p className="mb-2 flex items-center gap-2 text-[12px] font-bold text-[var(--text-muted)]">
              <part.Icon className="h-3.5 w-3.5" />{fa ? part.fa : part.en}
              <span className="h-px flex-1 bg-[var(--border-subtle)]" aria-hidden />
            </p>
            <ol className="space-y-2">
              {group.items.map((appointment) => {
                return (
                  <li key={appointment.id}>
                    {appointment.id === nextId && nowMinute !== null && <NowLine fa={fa} minute={nowMinute} />}
                    <AppointmentItem locale={locale} appointment={appointment} onStatus={onStatus} onDelete={onDelete} onReschedule={onReschedule} />
                  </li>
                )
              })}
            </ol>
          </div>
        )
      })}
    </div>
  )
}

function NowLine({ fa, minute }: { fa: boolean; minute: number }) {
  return (
    <div className="my-2 flex items-center gap-2" aria-label={fa ? 'اکنون' : 'Now'}>
      <span className="rounded-full bg-[var(--signal)] px-2 py-0.5 text-[12px] font-bold tabular-nums text-white" dir="ltr">
        {formatClock(minute, fa)}
      </span>
      <span className="h-px flex-1 bg-[color:color-mix(in_srgb,var(--signal)_50%,transparent)]" />
    </div>
  )
}

const CANCEL_REASONS_FA = ['درخواست مشتری', 'تعطیلی یا مشکل پیش‌آمده', 'رزرو تکراری']
const CANCEL_REASONS_EN = ['Customer request', 'Unexpected closure', 'Duplicate booking']

function AppointmentItem({
  locale,
  appointment,
  onStatus,
  onDelete,
  onReschedule,
}: {
  locale: Locale
  appointment: AppointmentRow
  onStatus: (id: string, status: AppointmentStatus, reason?: string) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  onReschedule: (appointment: AppointmentRow) => void
}) {
  const fa = locale === 'fa'
  const [menu, setMenu] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const timeFmt = useMemo(() => new Intl.DateTimeFormat(dateLocaleTag(locale), { timeZone: appointment.timezone, hour: '2-digit', minute: '2-digit' }), [appointment.timezone, locale])
  const terminal = appointment.status === 'CANCELLED' || appointment.status === 'COMPLETED' || appointment.status === 'NO_SHOW'
  const meta = STATUS_META[appointment.status]
  const accent = serviceAccent(appointment.serviceId)
  const past = new Date(appointment.endsAt).getTime() < Date.now()

  useEffect(() => {
    if (!menu) return
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) { if (event.key === 'Escape') setMenu(false); return }
      if (!menuRef.current?.contains(event.target as Node)) setMenu(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [menu])

  async function run(status: AppointmentStatus, cancelReason?: string) {
    setBusy(true)
    setMenu(false)
    const ok = await onStatus(appointment.id, status, cancelReason)
    setBusy(false)
    if (ok) { setCancelling(false); setReason('') }
  }

  const primary = appointment.status === 'PENDING'
    ? { status: 'CONFIRMED' as const, label: fa ? 'تأیید' : 'Confirm', Icon: CheckCircle2 }
    : appointment.status === 'CONFIRMED' && past
      ? { status: 'COMPLETED' as const, label: fa ? 'انجام شد' : 'Done', Icon: Check }
      : null

  return (
    <article className={cn(
      'relative grid grid-cols-[4.25rem_minmax(0,1fr)] gap-3 rounded-2xl border border-[var(--border-default)] bg-white p-3 transition-colors hover:border-[var(--border-strong)] sm:grid-cols-[4.75rem_minmax(0,1fr)_auto] sm:items-center sm:p-3.5',
      terminal && 'bg-[var(--bg-base)]',
    )}>
      <div className={cn('flex flex-col items-center justify-center rounded-xl py-2', terminal ? 'bg-black/[0.03]' : accent.soft)}>
        <span className={cn('text-sm font-bold tabular-nums', terminal && 'text-[var(--text-muted)] line-through decoration-black/20')} dir="ltr">{timeFmt.format(new Date(appointment.startsAt))}</span>
        <span className="text-[12px] tabular-nums text-[var(--text-muted)]" dir="ltr">{timeFmt.format(new Date(appointment.endsAt))}</span>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          {appointment.contactId ? (
            <Link href={`/contacts/${appointment.contactId}`} className={cn('truncate text-sm font-bold hover:underline', terminal ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]')}>{appointment.customerName}</Link>
          ) : (
            <span className={cn('truncate text-sm font-bold', terminal ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]')}>{appointment.customerName}</span>
          )}
          <StatusChip tone={meta.tone} dot>{fa ? meta.fa : meta.en}</StatusChip>
          {appointment.source === 'agent' && <StatusChip tone="signal"><Sparkles className="h-3 w-3" />{fa ? 'ایجنت' : 'Agent'}</StatusChip>}
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1.5"><span className={cn('h-2 w-2 rounded-full', accent.bar)} aria-hidden />{appointment.serviceName}</span>
          {appointment.partySize > 1 && <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{fa ? `${num(appointment.partySize, true)} نفر` : `${appointment.partySize} people`}</span>}
          {appointment.customerPhone && (
            <a href={`tel:${appointment.customerPhone}`} dir="ltr" className="inline-flex items-center gap-1 tabular-nums hover:text-[var(--text-primary)]"><Phone className="h-3.5 w-3.5" />{displayPhone(appointment.customerPhone)}</a>
          )}
          {appointment.serviceLocation && <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{appointment.serviceLocation}</span></span>}
        </p>
        {appointment.notes && <p className="mt-1.5 line-clamp-2 text-[12px] leading-6 text-[var(--text-secondary)]">{appointment.notes}</p>}
        {!terminal && <ReminderStatusLine fa={fa} reminders={appointment.reminders} />}
      </div>

      {!cancelling && !confirmingDelete && (
        <div className="col-span-2 flex items-center justify-end gap-1.5 sm:col-span-1">
          {!terminal && primary && (
            <button type="button" disabled={busy} onClick={() => void run(primary.status)} className="spatial-press inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--text-primary)] px-3.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <primary.Icon className="h-3.5 w-3.5" />}{primary.label}
            </button>
          )}
          {!terminal && (
            <button type="button" disabled={busy} onClick={() => onReschedule(appointment)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border-default)] px-3 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]">
              <ArrowLeftRight className="h-3.5 w-3.5" /><span className="hidden sm:inline">{fa ? 'جابه‌جایی' : 'Move'}</span>
            </button>
          )}
          <div className="relative" ref={menuRef}>
            <button type="button" onClick={() => setMenu((value) => !value)} aria-haspopup="menu" aria-expanded={menu} aria-label={fa ? 'گزینه‌های بیشتر' : 'More actions'} className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]">
              {busy && !primary ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
            </button>
            {menu && (
              <div role="menu" className="absolute end-0 top-11 z-20 w-48 overflow-hidden rounded-2xl border border-[var(--border-default)] bg-white p-1 shadow-[var(--elev-1)]">
                {!terminal && (<>
                  {appointment.status === 'CONFIRMED' && !past && (
                    <MenuItem onClick={() => void run('COMPLETED')} Icon={Check}>{fa ? 'انجام شد' : 'Mark done'}</MenuItem>
                  )}
                  <MenuItem onClick={() => void run('NO_SHOW')} Icon={UserX}>{fa ? 'مشتری حاضر نشد' : 'No-show'}</MenuItem>
                  <MenuItem danger onClick={() => { setMenu(false); setCancelling(true) }} Icon={XCircle}>{fa ? 'لغو نوبت' : 'Cancel'}</MenuItem>
                  <div className="my-1 h-px bg-[var(--border-subtle)]" role="separator" />
                </>)}
                <MenuItem danger onClick={() => { setMenu(false); setConfirmingDelete(true) }} Icon={Trash2}>{fa ? 'حذف نوبت' : 'Delete'}</MenuItem>
              </div>
            )}
          </div>
        </div>
      )}

      {confirmingDelete && (
        <div role="alertdialog" aria-label={fa ? 'حذف نوبت' : 'Delete booking'} className="col-span-full rounded-xl border border-red-500/20 bg-red-50/60 p-3">
          <p className="text-xs font-bold text-red-700">{fa ? 'این نوبت برای همیشه حذف شود؟' : 'Delete this booking for good?'}</p>
          <p className="mt-1 text-[12px] leading-6 text-red-800/80">
            {!terminal && !past
              ? (fa ? 'نوبت هنوز فعال است و مشتری از حذف باخبر نمی‌شود. اگر می‌خواهید زمان آزاد شود و سابقه بماند، «لغو نوبت» بهتر است.' : 'It is still active and the customer is not told. Cancelling frees the time and keeps the record.')
              : (fa ? 'از برنامه و سابقه مشتری پاک می‌شود و برنمی‌گردد.' : 'It disappears from the schedule and history.')}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button type="button" autoFocus disabled={busy} onClick={async () => { setBusy(true); const ok = await onDelete(appointment.id); setBusy(false); if (!ok) setConfirmingDelete(false) }} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}{fa ? 'حذف برای همیشه' : 'Delete'}
            </button>
            {!terminal && !past && (
              <button type="button" onClick={() => { setConfirmingDelete(false); setCancelling(true) }} className="min-h-11 rounded-xl border border-red-500/25 bg-white px-4 text-sm font-bold text-red-700">{fa ? 'لغو نوبت به‌جای حذف' : 'Cancel instead'}</button>
            )}
            <button type="button" onClick={() => setConfirmingDelete(false)} className="min-h-11 rounded-xl border border-[var(--border-default)] bg-white px-4 text-sm text-[var(--text-secondary)]">{fa ? 'بازگشت' : 'Back'}</button>
          </div>
        </div>
      )}

      {cancelling && (
        <div className="col-span-full rounded-xl border border-red-500/20 bg-red-50/60 p-3">
          <p className="text-xs font-bold text-red-700">{fa ? 'دلیل لغو' : 'Cancellation reason'}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(fa ? CANCEL_REASONS_FA : CANCEL_REASONS_EN).map((item) => (
              <button key={item} type="button" onClick={() => setReason(item)} aria-pressed={reason === item} className={cn('min-h-9 rounded-lg border px-2.5 text-xs transition-colors', reason === item ? 'border-red-600 bg-red-600 text-white' : 'border-red-500/20 bg-white text-red-700 hover:bg-red-50')}>{item}</button>
            ))}
          </div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input autoFocus value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder={fa ? 'یا دلیل را بنویسید…' : 'Or type a reason…'} className="input min-h-11 min-w-0 flex-1 bg-white" />
            <div className="flex gap-2">
              <button type="button" disabled={reason.trim().length < 2 || busy} onClick={() => void run('CANCELLED', reason.trim())} className="min-h-11 flex-1 rounded-xl bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-45 sm:flex-none">
                {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : (fa ? 'لغو نوبت' : 'Cancel it')}
              </button>
              <button type="button" onClick={() => { setCancelling(false); setReason('') }} className="min-h-11 rounded-xl border border-[var(--border-default)] bg-white px-4 text-sm text-[var(--text-secondary)]">{fa ? 'بازگشت' : 'Back'}</button>
            </div>
          </div>
          <p className="mt-2 text-[13px] text-red-700/80">{fa ? 'زمان آزاد می‌شود و به شما اعلان داده می‌شود.' : 'The time frees up and you get a notification.'}</p>
        </div>
      )}
    </article>
  )
}

function MenuItem({ onClick, Icon, danger = false, children }: { onClick: () => void; Icon: typeof Check; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className={cn('flex min-h-11 w-full items-center gap-2 rounded-xl px-2.5 text-start text-[13px] font-medium transition-colors', danger ? 'text-red-600 hover:bg-red-50' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]')}>
      <Icon className="h-4 w-4" />{children}
    </button>
  )
}

function AgentPanel({ fa, services, onManage, remindersEnabled }: { fa: boolean; services: ServiceRow[]; onManage: () => void; remindersEnabled: boolean }) {
  const steps = fa
    ? ['مشتری در دایرکت یا سایت وقت می‌خواهد', 'ایجنت ظرفیت واقعی را می‌خواند', 'بعد از تأیید مشتری، بدون تداخل ثبت می‌کند', 'شما در پنل و ربات تلگرام خبردار می‌شوید']
    : ['A customer asks for a time in DM or on site', 'The agent reads live capacity', 'It books conflict-free after the customer confirms', 'You get a dashboard and Telegram alert']
  return (
    <aside className="space-y-4">
      <section className="spatial-surface rounded-card p-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--text-primary)] text-white"><Bot className="h-4 w-4" /></span>
          <div className="min-w-0">
            <p className="ui-h3 leading-6">{fa ? 'ایجنت رزرو فعال است' : 'Booking agent is on'}</p>
            <p className="text-[13px] text-[var(--text-muted)]">{fa ? `${num(services.length, true)} خدمت قابل رزرو` : `${services.length} bookable services`}</p>
          </div>
          <StatusChip tone="ok" pulse className="ms-auto">{fa ? 'زنده' : 'Live'}</StatusChip>
        </div>
        <ol className="relative mt-4 space-y-3 ps-1">
          <span className="lf lf-vline absolute bottom-3 start-[0.95rem] top-3 w-0.5" aria-hidden />
          {steps.map((step, index) => (
            <li key={step} className="relative flex items-start gap-3">
              <span className={cn('relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold ring-4 ring-white', index === steps.length - 1 ? 'bg-[var(--ok)] text-white' : 'bg-[var(--signal-soft)] text-[var(--signal-strong)]')}>
                {index === steps.length - 1 ? <Check className="h-3 w-3" strokeWidth={3} /> : num(index + 1, fa)}
              </span>
              <span className="pt-0.5 text-[13px] leading-6 text-[var(--text-secondary)]">{step}</span>
            </li>
          ))}
        </ol>
      </section>
      <ReminderSettingsCard fa={fa} initialEnabled={remindersEnabled} />
      <section className="spatial-surface rounded-card p-4">
        <p className="ui-h3">{fa ? 'قوانین ایمنی رزرو' : 'Booking safeguards'}</p>
        <ul className="mt-2 space-y-1.5 text-[13px] leading-6 text-[var(--text-secondary)]">
          {(fa
            ? ['پیش از ثبت، خلاصه را از مشتری تأیید می‌گیرد', 'قفل تراکنشی: دو نفر یک زمان را نمی‌گیرند', 'لغو و جابه‌جایی فقط برای نوبت خود مشتری']
            : ['Confirms a summary with the customer first', 'Transactional lock: no double booking', 'Cancel/move only the customer’s own booking']
          ).map((item) => <li key={item} className="flex items-start gap-2"><Check className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--ok)]" />{item}</li>)}
        </ul>
        <button type="button" onClick={onManage} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--border-default)] text-xs font-bold text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]">
          <LayoutGrid className="h-3.5 w-3.5" />{fa ? 'ساعت کاری و ظرفیت خدمات' : 'Service hours & capacity'}
        </button>
      </section>
    </aside>
  )
}

function Onboarding({ fa, onCreate }: { fa: boolean; onCreate: (template?: ServiceTemplate | null) => void }) {
  return (
    <section className="spatial-surface overflow-hidden rounded-sheet p-5 sm:p-7">
      <div className="grid items-center gap-7 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="text-center lg:text-start">
          <StatusChip tone="signal" dot>{fa ? 'رزرو خودکار با ایجنت' : 'Agent-powered booking'}</StatusChip>
          <h2 className="mt-3 text-balance text-[22px] font-bold leading-10 text-[var(--text-primary)] sm:text-[28px]">
            {fa ? 'اولین خدمت را بسازید؛ بقیه‌اش با ایجنت.' : 'Create your first service. The agent does the rest.'}
          </h2>
          <p className="ui-body mt-2">
            {fa
              ? 'مدت، ظرفیت و ساعت کاری را یک‌بار تعریف کنید. از همان لحظه ایجنت در اینستاگرام، تلگرام و سایت زمان آزاد واقعی پیشنهاد می‌دهد و نوبت را بدون تداخل ثبت می‌کند.'
              : 'Set length, capacity and hours once. From then on the agent offers real free times on Instagram, Telegram and your site and books without conflicts.'}
          </p>
          <ol className="mx-auto mt-5 w-fit space-y-2.5 text-start lg:mx-0">
            {(fa
              ? ['خدمت و ساعت کاری را تعریف کنید (۱ دقیقه)', 'ایجنت زمان آزاد را به مشتری پیشنهاد می‌دهد', 'نوبت‌ها اینجا و در ربات تلگرام به شما می‌رسد']
              : ['Define a service and hours (1 minute)', 'The agent offers free times to customers', 'Bookings land here and in your Telegram bot']
            ).map((step, index) => (
              <li key={step} className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--text-primary)] text-xs font-bold text-white">{num(index + 1, fa)}</span>
                {step}
              </li>
            ))}
          </ol>
          <button type="button" onClick={() => onCreate()} className="spatial-press mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--text-primary)] px-6 text-sm sm:w-auto font-bold text-white shadow-[var(--shadow-control)] transition-opacity hover:opacity-90">
            <Plus className="h-4 w-4" />{fa ? 'ساخت اولین خدمت' : 'Create first service'}
          </button>
          <div className="mt-5">
            <p className="ui-caption mb-2">{fa ? 'یا با یک الگوی آماده شروع کنید:' : 'Or start from a template:'}</p>
            <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
              {SERVICE_TEMPLATES.map((template) => (
                <button key={template.key} type="button" onClick={() => onCreate(template)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border-default)] bg-white px-3 text-xs font-bold text-[var(--text-secondary)] transition-colors hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]">
                  {fa ? template.fa : template.en}
                  <span className="font-normal text-[var(--text-muted)]">· {fa ? template.hintFa : template.hintEn}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <BookingMotion fa={fa} />
      </div>
    </section>
  )
}
