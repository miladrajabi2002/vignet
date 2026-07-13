'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Ban,
  CalendarCheck2,
  CalendarDays,
  CalendarOff,
  Check,
  Clock3,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Settings2,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MaterialSelect } from '@/components/ui/material-select'

interface WeeklyRule {
  id: string
  weekday: number
  startMinute: number
  endMinute: number
  capacity: number | null
  active: boolean
}

interface DateException {
  id: string
  date: string
  closed: boolean
  startMinute: number | null
  endMinute: number | null
  capacity: number | null
  note: string | null
}

interface BookingService {
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
  weeklyRules: WeeklyRule[]
  exceptions: DateException[]
  _count: { appointments: number }
}

type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW'

interface AppointmentItem {
  id: string
  customerName: string
  customerPhone: string | null
  startsAt: string
  endsAt: string
  timezone: string
  partySize: number
  status: AppointmentStatus
  notes: string | null
  cancellationReason: string | null
  service: { id: string; name: string; timezone: string; location: string | null }
  contact: { id: string; name: string | null; phone: string | null } | null
}

interface SlotItem {
  startMinute: number
  startsAt: string
  endsAt: string
  capacity: number
  remainingCapacity: number
}

interface Props {
  locale: 'fa' | 'en'
  today: string
  initialServices: BookingService[]
  initialAppointments: AppointmentItem[]
}

const WEEKDAYS_FA = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه']
const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEKDAY_ORDER_FA = [6, 0, 1, 2, 3, 4, 5]
const WEEKDAY_ORDER_EN = [0, 1, 2, 3, 4, 5, 6]

function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days, 12))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function dateFromKey(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00.000Z`)
}

function timeToMinute(value: string): number {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

function minuteToTime(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

function normalizeService(service: BookingService): BookingService {
  return {
    ...service,
    exceptions: service.exceptions.map((exception) => ({
      ...exception,
      date: exception.date.slice(0, 10),
    })),
  }
}

export function BookingManager({
  locale,
  today,
  initialServices,
  initialAppointments,
}: Props) {
  const fa = locale === 'fa'
  const [services, setServices] = useState(initialServices.map(normalizeService))
  const [appointments, setAppointments] = useState(initialAppointments)
  const [selectedDate, setSelectedDate] = useState(today)
  const [loadingAppointments, setLoadingAppointments] = useState(false)
  const [showServiceForm, setShowServiceForm] = useState(initialServices.length === 0)
  const [serviceBusy, setServiceBusy] = useState(false)
  const [serviceMessage, setServiceMessage] = useState('')

  const [serviceName, setServiceName] = useState('')
  const [serviceDescription, setServiceDescription] = useState('')
  const [duration, setDuration] = useState('60')
  const [capacity, setCapacity] = useState('1')
  const [workdays, setWorkdays] = useState<number[]>([6, 0, 1, 2, 3, 4])
  const [workStart, setWorkStart] = useState('09:00')
  const [workEnd, setWorkEnd] = useState('17:00')

  const firstActiveService = services.find((service) => service.active)
  const [bookingServiceId, setBookingServiceId] = useState(firstActiveService?.id ?? '')
  const [bookingDate, setBookingDate] = useState(today)
  const [partySize, setPartySize] = useState('1')
  const [slots, setSlots] = useState<SlotItem[]>([])
  const [slotsBusy, setSlotsBusy] = useState(false)
  const [slotMinute, setSlotMinute] = useState<number | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [bookingNotes, setBookingNotes] = useState('')
  const [bookingBusy, setBookingBusy] = useState(false)
  const [bookingMessage, setBookingMessage] = useState('')
  const idempotencyKey = useRef<string | null>(null)

  const [manageServiceId, setManageServiceId] = useState<string | null>(null)
  const [manageDays, setManageDays] = useState<number[]>([])
  const [manageStart, setManageStart] = useState('09:00')
  const [manageEnd, setManageEnd] = useState('17:00')
  const [blackoutDate, setBlackoutDate] = useState('')
  const [manageBusy, setManageBusy] = useState(false)
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  const weekdays = fa ? WEEKDAYS_FA : WEEKDAYS_EN
  const weekdayOrder = fa ? WEEKDAY_ORDER_FA : WEEKDAY_ORDER_EN
  const numberLocale = fa ? 'fa-IR' : 'en-US'
  const dateLocale = fa ? 'fa-IR-u-ca-persian' : 'en-US'

  const copy = fa
    ? {
        eyebrow: 'تقویم عملیاتی', title: 'رزرو و نوبت‌دهی', subtitle: 'زمان آزاد، ظرفیت و مشتری‌ها در یک نمای دقیق؛ بدون تداخل و مناسب ایجنت.',
        newService: 'خدمت جدید', services: 'خدمات فعال', today: 'امروز', appointments: 'رزرو این روز', empty: 'برای این روز رزروی ثبت نشده است.',
        newBooking: 'ثبت رزرو', customer: 'نام مشتری', phone: 'شماره موبایل', notes: 'یادداشت (اختیاری)', service: 'خدمت', date: 'تاریخ', party: 'تعداد نفر', slots: 'زمان‌های آزاد', noSlots: 'برای این روز زمان آزادی وجود ندارد.',
        create: 'ثبت قطعی رزرو', creating: 'در حال ثبت…', created: 'رزرو با موفقیت ثبت شد.', cancel: 'لغو رزرو', confirmCancel: 'تأیید لغو', cancelReason: 'دلیل لغو', cancelled: 'رزرو لغو شد.',
        serviceName: 'نام خدمت', description: 'توضیح کوتاه', duration: 'مدت (دقیقه)', capacity: 'ظرفیت هم‌زمان', workingDays: 'روزهای کاری', hours: 'ساعت کاری', saveService: 'ساخت خدمت',
        schedule: 'برنامه و تعطیلی‌ها', saveSchedule: 'ذخیره برنامه هفتگی', blackout: 'افزودن روز تعطیل', noService: 'اول یک خدمت با برنامه کاری بسازید تا رزرو فعال شود.',
        error: 'عملیات انجام نشد؛ اطلاعات را بررسی و دوباره تلاش کنید.', active: 'فعال', archived: 'غیرفعال', person: 'نفر', minutes: 'دقیقه', refresh: 'تازه‌سازی', close: 'بستن',
      }
    : {
        eyebrow: 'Operations calendar', title: 'Appointments & booking', subtitle: 'Availability, capacity and customers in one precise, conflict-free agent-ready view.',
        newService: 'New service', services: 'Active services', today: 'Today', appointments: 'Appointments for this day', empty: 'No appointments are booked for this day.',
        newBooking: 'Book appointment', customer: 'Customer name', phone: 'Mobile number', notes: 'Notes (optional)', service: 'Service', date: 'Date', party: 'Party size', slots: 'Available times', noSlots: 'No available time on this day.',
        create: 'Confirm booking', creating: 'Booking…', created: 'Appointment booked successfully.', cancel: 'Cancel appointment', confirmCancel: 'Confirm cancellation', cancelReason: 'Cancellation reason', cancelled: 'Appointment cancelled.',
        serviceName: 'Service name', description: 'Short description', duration: 'Duration (minutes)', capacity: 'Concurrent capacity', workingDays: 'Working days', hours: 'Working hours', saveService: 'Create service',
        schedule: 'Schedule & blackouts', saveSchedule: 'Save weekly schedule', blackout: 'Add blackout day', noService: 'Create a service and working schedule to start accepting bookings.',
        error: 'The operation failed. Check the details and try again.', active: 'Active', archived: 'Inactive', person: 'people', minutes: 'minutes', refresh: 'Refresh', close: 'Close',
      }

  const dateStrip = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(today, index)),
    [today],
  )

  const activeAppointments = appointments.filter((item) => item.status !== 'CANCELLED')
  const todayCount = selectedDate === today ? activeAppointments.length : 0
  const confirmedCount = appointments.filter((item) => item.status === 'CONFIRMED').length

  function formatDay(dateKey: string, options?: Intl.DateTimeFormatOptions) {
    return new Intl.DateTimeFormat(dateLocale, {
      timeZone: 'UTC',
      ...options,
    }).format(dateFromKey(dateKey))
  }

  function formatAppointmentTime(item: AppointmentItem) {
    return new Intl.DateTimeFormat(fa ? 'fa-IR' : 'en-US', {
      timeZone: item.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(item.startsAt))
  }

  async function loadAppointments(date: string) {
    setLoadingAppointments(true)
    try {
      const response = await fetch(`/api/appointments?date=${encodeURIComponent(date)}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('load failed')
      const data = (await response.json()) as { appointments: AppointmentItem[] }
      setAppointments(data.appointments)
    } catch {
      // Keep the previous list visible; the refresh button remains available.
    } finally {
      setLoadingAppointments(false)
    }
  }

  async function reloadServices() {
    const response = await fetch('/api/appointments/services', { cache: 'no-store' })
    if (!response.ok) throw new Error('load failed')
    const data = (await response.json()) as { services: BookingService[] }
    setServices(data.services.map(normalizeService))
  }

  useEffect(() => {
    if (!bookingServiceId || !bookingDate) {
      setSlots([])
      return
    }
    const controller = new AbortController()
    setSlotsBusy(true)
    setSlotMinute(null)
    fetch(
      `/api/appointments/slots?serviceId=${encodeURIComponent(bookingServiceId)}&date=${encodeURIComponent(bookingDate)}&partySize=${encodeURIComponent(partySize || '1')}`,
      { cache: 'no-store', signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error('slot load failed')
        const data = (await response.json()) as { slots: SlotItem[] }
        setSlots(data.slots)
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setSlots([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setSlotsBusy(false)
      })
    return () => controller.abort()
  }, [bookingServiceId, bookingDate, partySize])

  async function createService(event: React.FormEvent) {
    event.preventDefault()
    setServiceBusy(true)
    setServiceMessage('')
    try {
      const response = await fetch('/api/appointments/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: serviceName,
          description: serviceDescription || undefined,
          durationMinutes: Number(duration),
          slotIntervalMinutes: 30,
          capacity: Number(capacity),
          timezone: 'Asia/Tehran',
          weeklyRules: workdays.map((weekday) => ({
            weekday,
            startMinute: timeToMinute(workStart),
            endMinute: timeToMinute(workEnd),
          })),
        }),
      })
      if (!response.ok) throw new Error('create failed')
      const data = (await response.json()) as { service: BookingService }
      setServices((current) => [...current, normalizeService(data.service)])
      setBookingServiceId(data.service.id)
      setServiceName('')
      setServiceDescription('')
      setShowServiceForm(false)
      setServiceMessage(fa ? 'خدمت و برنامه کاری ساخته شد.' : 'Service and schedule created.')
    } catch {
      setServiceMessage(copy.error)
    } finally {
      setServiceBusy(false)
    }
  }

  function openSchedule(service: BookingService) {
    const firstRule = service.weeklyRules.find((rule) => rule.active)
    setManageServiceId(service.id)
    setManageDays(Array.from(new Set(service.weeklyRules.filter((rule) => rule.active).map((rule) => rule.weekday))))
    setManageStart(firstRule ? minuteToTime(firstRule.startMinute) : '09:00')
    setManageEnd(firstRule ? minuteToTime(firstRule.endMinute) : '17:00')
    setBlackoutDate('')
    setServiceMessage('')
  }

  async function patchService(serviceId: string, body: unknown) {
    setManageBusy(true)
    setServiceMessage('')
    try {
      const response = await fetch(`/api/appointments/services/${serviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error('patch failed')
      const data = (await response.json()) as { service: BookingService }
      setServices((current) => current.map((service) =>
        service.id === serviceId ? normalizeService(data.service) : service,
      ))
      setServiceMessage(fa ? 'تنظیمات خدمت ذخیره شد.' : 'Service settings saved.')
      return true
    } catch {
      setServiceMessage(copy.error)
      return false
    } finally {
      setManageBusy(false)
    }
  }

  async function createBooking(event: React.FormEvent) {
    event.preventDefault()
    if (slotMinute === null) {
      setBookingMessage(fa ? 'یک زمان آزاد را انتخاب کنید.' : 'Select an available time.')
      return
    }
    setBookingBusy(true)
    setBookingMessage('')
    idempotencyKey.current ??= `dashboard-${crypto.randomUUID()}`
    try {
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: bookingServiceId,
          localDate: bookingDate,
          startMinute: slotMinute,
          partySize: Number(partySize),
          customerName,
          customerPhone,
          notes: bookingNotes || undefined,
          source: 'dashboard',
          idempotencyKey: idempotencyKey.current,
        }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        if (data.error === 'CAPACITY_EXCEEDED') {
          throw new Error(fa ? 'این زمان همین حالا پر شد؛ زمان دیگری را انتخاب کنید.' : 'That slot just filled up. Choose another time.')
        }
        throw new Error(copy.error)
      }
      idempotencyKey.current = null
      setCustomerName('')
      setCustomerPhone('')
      setBookingNotes('')
      setSlotMinute(null)
      setBookingMessage(copy.created)
      if (selectedDate !== bookingDate) setSelectedDate(bookingDate)
      await loadAppointments(bookingDate)
      setSlots((current) => current.filter((slot) => slot.startMinute !== slotMinute))
    } catch (error) {
      setBookingMessage(error instanceof Error ? error.message : copy.error)
    } finally {
      setBookingBusy(false)
    }
  }

  async function cancelAppointment(id: string) {
    if (!cancelReason.trim()) return
    setBookingBusy(true)
    try {
      const response = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED', cancellationReason: cancelReason }),
      })
      if (!response.ok) throw new Error('cancel failed')
      setConfirmCancelId(null)
      setCancelReason('')
      setBookingMessage(copy.cancelled)
      await loadAppointments(selectedDate)
    } catch {
      setBookingMessage(copy.error)
    } finally {
      setBookingBusy(false)
    }
  }

  const managedService = services.find((service) => service.id === manageServiceId) ?? null

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">{copy.eyebrow}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-4xl">{copy.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] sm:text-base">{copy.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowServiceForm((value) => !value)}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-white transition-[opacity,transform] hover:-translate-y-0.5 motion-reduce:transform-none"
        >
          {showServiceForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showServiceForm ? copy.close : copy.newService}
        </button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: copy.services, value: services.filter((service) => service.active).length, icon: Settings2 },
          { label: copy.appointments, value: confirmedCount, icon: CalendarCheck2 },
          { label: copy.today, value: todayCount, icon: Clock3 },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-[var(--border-default)] bg-white p-4 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">{label}</span>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Icon className="h-4 w-4" /></span>
            </div>
            <strong className="mt-4 block text-2xl font-semibold tabular-nums text-[var(--text-primary)]">{value.toLocaleString(numberLocale)}</strong>
          </div>
        ))}
      </div>

      {showServiceForm && (
        <form onSubmit={createService} className="rounded-3xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[var(--accent-strong)]"><Plus className="h-5 w-5" /></span>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">{copy.newService}</h2>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="lg:col-span-2 text-sm font-medium text-[var(--text-primary)]">
              {copy.serviceName}
              <input required minLength={2} value={serviceName} onChange={(event) => setServiceName(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-[var(--border-default)] bg-white px-3 text-base outline-none focus:border-[var(--accent-border)] focus:ring-2 focus:ring-white" />
            </label>
            <label className="text-sm font-medium text-[var(--text-primary)]">
              {copy.duration}
              <input required type="number" min="10" max="480" value={duration} onChange={(event) => setDuration(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-[var(--border-default)] bg-white px-3 text-base outline-none focus:border-[var(--accent-border)]" />
            </label>
            <label className="text-sm font-medium text-[var(--text-primary)]">
              {copy.capacity}
              <input required type="number" min="1" max="100" value={capacity} onChange={(event) => setCapacity(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-[var(--border-default)] bg-white px-3 text-base outline-none focus:border-[var(--accent-border)]" />
            </label>
            <label className="sm:col-span-2 lg:col-span-4 text-sm font-medium text-[var(--text-primary)]">
              {copy.description}
              <input value={serviceDescription} onChange={(event) => setServiceDescription(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-[var(--border-default)] bg-white px-3 text-base outline-none focus:border-[var(--accent-border)]" />
            </label>
          </div>
          <fieldset className="mt-5">
            <legend className="text-sm font-medium text-[var(--text-primary)]">{copy.workingDays}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {weekdayOrder.map((day) => (
                <button key={day} type="button" aria-pressed={workdays.includes(day)} onClick={() => setWorkdays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day])} className={cn('min-h-11 rounded-xl border px-3 text-sm transition-colors', workdays.includes(day) ? 'border-[var(--accent-border)] bg-white font-medium text-[var(--accent-foreground)]' : 'border-transparent bg-white/50 text-[var(--text-secondary)]')}>
                  {weekdays[day]}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex gap-3">
              <label className="text-sm font-medium text-[var(--text-primary)]">{copy.hours}<input type="time" value={workStart} onChange={(event) => setWorkStart(event.target.value)} className="mt-2 block min-h-11 rounded-xl border border-[var(--border-default)] bg-white px-3 text-base" /></label>
              <label className="text-sm font-medium text-[var(--text-primary)]"><span className="sr-only">{copy.hours}</span><input type="time" value={workEnd} onChange={(event) => setWorkEnd(event.target.value)} className="mt-7 block min-h-11 rounded-xl border border-[var(--border-default)] bg-white px-3 text-base" /></label>
            </div>
            <button disabled={serviceBusy || !workdays.length} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {serviceBusy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Check className="h-4 w-4" />}{copy.saveService}
            </button>
          </div>
        </form>
      )}

      <p aria-live="polite" className="text-sm text-[var(--text-secondary)]">{serviceMessage}</p>

      {services.length > 0 && (
        <section className="rounded-3xl border border-[var(--border-default)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="text-lg font-semibold text-[var(--text-primary)]">{copy.services}</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">Asia/Tehran · UTC storage</p></div>
            <button type="button" onClick={() => reloadServices().catch(() => setServiceMessage(copy.error))} aria-label={copy.refresh} className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"><RefreshCw className="h-4 w-4" /></button>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {services.map((service) => (
              <article key={service.id} className={cn('rounded-2xl border p-4', service.active ? 'border-[var(--border-default)] bg-[var(--bg-base)]' : 'border-[var(--border-subtle)] bg-[var(--bg-base)] opacity-65')}>
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="font-semibold text-[var(--text-primary)]">{service.name}</h3><p className="mt-1 text-xs text-[var(--text-secondary)]">{service.durationMinutes.toLocaleString(numberLocale)} {copy.minutes} · {service.capacity.toLocaleString(numberLocale)} {copy.person}</p></div>
                  <span className={cn('rounded-full px-2.5 py-1 text-xs', service.active ? 'bg-success/10 text-success' : 'bg-[var(--bg-hover)] text-[var(--text-muted)]')}>{service.active ? copy.active : copy.archived}</span>
                </div>
                {service.location && <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"><MapPin className="h-3.5 w-3.5" />{service.location}</p>}
                <button type="button" onClick={() => openSchedule(service)} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--border-strong)]"><Settings2 className="h-4 w-4" />{copy.schedule}</button>
              </article>
            ))}
          </div>
        </section>
      )}

      {managedService && (
        <section className="rounded-3xl border border-[var(--accent-border)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
          <div className="flex items-center justify-between"><div><p className="text-xs font-semibold text-[var(--accent-strong)]">{copy.schedule}</p><h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{managedService.name}</h2></div><button type="button" onClick={() => setManageServiceId(null)} aria-label={copy.close} className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--border-default)]"><X className="h-4 w-4" /></button></div>
          <div className="mt-5 flex flex-wrap gap-2">{weekdayOrder.map((day) => <button key={day} type="button" aria-pressed={manageDays.includes(day)} onClick={() => setManageDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day])} className={cn('min-h-11 rounded-xl border px-3 text-sm', manageDays.includes(day) ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-foreground)]' : 'border-[var(--border-default)] text-[var(--text-secondary)]')}>{weekdays[day]}</button>)}</div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"><label className="text-sm text-[var(--text-secondary)]">{copy.hours}<input type="time" value={manageStart} onChange={(event) => setManageStart(event.target.value)} className="mt-2 block min-h-11 rounded-xl border border-[var(--border-default)] px-3 text-base" /></label><label className="text-sm text-[var(--text-secondary)]"><span className="sr-only">{copy.hours}</span><input type="time" value={manageEnd} onChange={(event) => setManageEnd(event.target.value)} className="mt-7 block min-h-11 rounded-xl border border-[var(--border-default)] px-3 text-base" /></label><button type="button" disabled={manageBusy || !manageDays.length} onClick={() => patchService(managedService.id, { weeklyRules: manageDays.map((weekday) => ({ weekday, startMinute: timeToMinute(manageStart), endMinute: timeToMinute(manageEnd) })) })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-50">{manageBusy && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}{copy.saveSchedule}</button></div>
          <div className="mt-6 border-t border-[var(--border-subtle)] pt-5"><h3 className="text-sm font-semibold text-[var(--text-primary)]">{copy.blackout}</h3><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input type="date" min={today} value={blackoutDate} onChange={(event) => setBlackoutDate(event.target.value)} className="min-h-11 rounded-xl border border-[var(--border-default)] px-3 text-base" /><button type="button" disabled={!blackoutDate || manageBusy} onClick={async () => { if (await patchService(managedService.id, { exception: { date: blackoutDate, closed: true } })) setBlackoutDate('') }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] px-4 text-sm font-medium text-[var(--text-primary)] disabled:opacity-50"><CalendarOff className="h-4 w-4" />{copy.blackout}</button></div>
            {managedService.exceptions.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{managedService.exceptions.map((exception) => <span key={exception.id} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-xs text-[var(--text-secondary)]"><Ban className="h-3.5 w-3.5" />{formatDay(exception.date, { month: 'short', day: 'numeric' })}<button type="button" aria-label={copy.close} onClick={() => patchService(managedService.id, { removeExceptionDate: exception.date })} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white"><X className="h-3.5 w-3.5" /></button></span>)}</div>}
          </div>
        </section>
      )}

      {services.some((service) => service.active) ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]">
          <section className="min-w-0 rounded-3xl border border-[var(--border-default)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold text-[var(--text-primary)]">{copy.appointments}</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">{formatDay(selectedDate, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p></div><div className="flex gap-2"><input aria-label={copy.date} type="date" value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); loadAppointments(event.target.value) }} className="min-h-11 rounded-xl border border-[var(--border-default)] px-3 text-base" /><button type="button" onClick={() => loadAppointments(selectedDate)} aria-label={copy.refresh} className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--border-default)]">{loadingAppointments ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <RefreshCw className="h-4 w-4" />}</button></div></div>
            <div className="mt-5 flex gap-2 overflow-x-auto pb-2">{dateStrip.map((date) => <button key={date} type="button" aria-pressed={selectedDate === date} onClick={() => { setSelectedDate(date); loadAppointments(date) }} className={cn('min-h-20 min-w-20 rounded-2xl border px-3 text-center transition-colors', selectedDate === date ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-foreground)]' : 'border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]')}><span className="block text-xs">{formatDay(date, { weekday: 'short' })}</span><strong className="mt-1 block text-lg tabular-nums">{formatDay(date, { day: 'numeric' })}</strong></button>)}</div>
            <div className="mt-5 space-y-3">{appointments.length === 0 ? <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-base)] px-5 py-12 text-center"><CalendarDays className="mx-auto h-7 w-7 text-[var(--text-muted)]" /><p className="mt-3 text-sm text-[var(--text-secondary)]">{copy.empty}</p></div> : appointments.map((item) => <article key={item.id} className={cn('rounded-2xl border p-4', item.status === 'CANCELLED' ? 'border-[var(--border-subtle)] bg-[var(--bg-base)] opacity-65' : 'border-[var(--border-default)] bg-white')}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] font-semibold tabular-nums text-[var(--accent-foreground)]">{formatAppointmentTime(item)}</span><div><h3 className="font-semibold text-[var(--text-primary)]">{item.customerName}</h3><p className="mt-1 text-sm text-[var(--text-secondary)]">{item.service.name} · {item.partySize.toLocaleString(numberLocale)} {copy.person}</p>{item.customerPhone && <p className="mt-1 text-xs text-[var(--text-muted)]" dir="ltr">{item.customerPhone}</p>}</div></div><span className={cn('self-start rounded-full px-2.5 py-1 text-xs', item.status === 'CONFIRMED' ? 'bg-success/10 text-success' : item.status === 'CANCELLED' ? 'bg-danger/10 text-danger' : 'bg-[var(--bg-hover)] text-[var(--text-secondary)]')}>{item.status}</span></div>{item.notes && <p className="mt-3 rounded-xl bg-[var(--bg-base)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">{item.notes}</p>}{item.status !== 'CANCELLED' && item.status !== 'COMPLETED' && <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">{confirmCancelId === item.id ? <div className="flex flex-col gap-2 sm:flex-row"><input autoFocus value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder={copy.cancelReason} className="min-h-11 min-w-0 flex-1 rounded-xl border border-danger/30 px-3 text-base outline-none focus:ring-2 focus:ring-danger/10" /><button type="button" disabled={!cancelReason.trim() || bookingBusy} onClick={() => cancelAppointment(item.id)} className="min-h-11 rounded-xl bg-danger px-4 text-sm font-medium text-white disabled:opacity-50">{copy.confirmCancel}</button><button type="button" onClick={() => { setConfirmCancelId(null); setCancelReason('') }} className="min-h-11 rounded-xl border border-[var(--border-default)] px-4 text-sm">{copy.close}</button></div> : <button type="button" onClick={() => setConfirmCancelId(item.id)} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-danger hover:bg-danger/5"><Ban className="h-4 w-4" />{copy.cancel}</button>}</div>}</article>)}</div>
          </section>

          <form onSubmit={createBooking} className="self-start rounded-3xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-5 shadow-[var(--shadow-soft)] sm:p-6 xl:sticky xl:top-24">
            <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[var(--accent-strong)]"><CalendarCheck2 className="h-5 w-5" /></span><div><h2 className="font-semibold text-[var(--text-primary)]">{copy.newBooking}</h2><p className="mt-0.5 text-xs text-[var(--text-secondary)]">Asia/Tehran</p></div></div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-1"><label className="text-sm font-medium text-[var(--text-primary)]">{copy.service}<MaterialSelect value={bookingServiceId} onValueChange={setBookingServiceId} ariaLabel={copy.service} className="mt-2" options={services.filter((service) => service.active).map((service) => ({ value: service.id, label: service.name }))} /></label><label className="text-sm font-medium text-[var(--text-primary)]">{copy.date}<input required type="date" min={today} value={bookingDate} onChange={(event) => setBookingDate(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-[var(--border-default)] bg-white px-3 text-base outline-none focus:border-[var(--accent-border)]" /></label><label className="text-sm font-medium text-[var(--text-primary)]">{copy.party}<input required type="number" min="1" max="100" value={partySize} onChange={(event) => setPartySize(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-[var(--border-default)] bg-white px-3 text-base outline-none focus:border-[var(--accent-border)]" /></label></div>
            <fieldset className="mt-5"><legend className="text-sm font-medium text-[var(--text-primary)]">{copy.slots}</legend><div className="mt-2 grid grid-cols-3 gap-2">{slotsBusy ? <div className="col-span-3 flex min-h-20 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--accent-strong)] motion-reduce:animate-none" /></div> : slots.length ? slots.map((slot) => <button key={slot.startMinute} type="button" aria-pressed={slotMinute === slot.startMinute} onClick={() => setSlotMinute(slot.startMinute)} className={cn('min-h-11 rounded-xl border text-sm font-medium tabular-nums transition-colors', slotMinute === slot.startMinute ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border-default)] bg-white text-[var(--text-primary)] hover:border-[var(--accent-border)]')}>{minuteToTime(slot.startMinute)}</button>) : <p className="col-span-3 rounded-xl border border-dashed border-[var(--border-default)] bg-white/60 px-3 py-5 text-center text-xs leading-5 text-[var(--text-secondary)]">{copy.noSlots}</p>}</div></fieldset>
            <div className="mt-5 space-y-4"><label className="block text-sm font-medium text-[var(--text-primary)]">{copy.customer}<div className="relative mt-2"><UserRound className="pointer-events-none absolute start-3 top-3.5 h-4 w-4 text-[var(--text-muted)]" /><input required minLength={2} value={customerName} onChange={(event) => setCustomerName(event.target.value)} className="min-h-12 w-full rounded-xl border border-[var(--border-default)] bg-white ps-10 pe-3 text-base outline-none focus:border-[var(--accent-border)]" /></div></label><label className="block text-sm font-medium text-[var(--text-primary)]">{copy.phone}<div className="relative mt-2"><Users className="pointer-events-none absolute start-3 top-3.5 h-4 w-4 text-[var(--text-muted)]" /><input required inputMode="tel" dir="ltr" placeholder="09123456789" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} className="min-h-12 w-full rounded-xl border border-[var(--border-default)] bg-white ps-10 pe-3 text-base outline-none focus:border-[var(--accent-border)]" /></div></label><label className="block text-sm font-medium text-[var(--text-primary)]">{copy.notes}<textarea rows={3} value={bookingNotes} onChange={(event) => setBookingNotes(event.target.value)} className="mt-2 w-full resize-y rounded-xl border border-[var(--border-default)] bg-white px-3 py-3 text-base outline-none focus:border-[var(--accent-border)]" /></label></div>
            <p aria-live="polite" className="mt-4 text-sm text-[var(--text-secondary)]">{bookingMessage}</p>
            <button disabled={bookingBusy || slotMinute === null} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50">{bookingBusy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Check className="h-4 w-4" />}{bookingBusy ? copy.creating : copy.create}</button>
          </form>
        </div>
      ) : (
        <section className="rounded-3xl border border-dashed border-[var(--border-default)] bg-white px-6 py-16 text-center"><CalendarOff className="mx-auto h-9 w-9 text-[var(--text-muted)]" /><h2 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">{copy.noService}</h2><button type="button" onClick={() => setShowServiceForm(true)} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-white"><Plus className="h-4 w-4" />{copy.newService}</button></section>
      )}
    </div>
  )
}
