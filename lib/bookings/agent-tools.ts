import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  agentAppointmentScope,
  createAppointment,
  explainUnavailableDate,
  findNextAvailableSlots,
  listAvailableSlots,
  listBookingServices,
  notifyAppointmentCancellation,
  rescheduleAppointment,
} from '@/lib/bookings/service'
import { appointmentCreateSchema } from '@/lib/bookings/validation'
import { dateKeyInTimeZone, formatMinuteOfDay } from '@/lib/bookings/time'
import {
  bookingCalendarContext,
  bookingDateLabel,
  shiftDateKey,
  summarizeWeeklyHours,
} from '@/lib/bookings/calendar-context'

const dateParam = { type: 'string', description: 'Local Gregorian date YYYY-MM-DD, taken from the reference calendar table.' }

/** Provider-neutral OpenAI-compatible tool declarations. */
export const BOOKING_AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'list_booking_services',
      description: 'List bookable services with duration, price (Toman, null = not published), location, weekly opening hours and upcoming closed dates.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_available_slots',
      description: 'Real, capacity-checked free times for one service on one local date. If the date has none, the result explains why and suggests the nearest free date.',
      parameters: {
        type: 'object',
        properties: {
          serviceId: { type: 'string' },
          date: dateParam,
          partySize: { type: 'integer', minimum: 1, maximum: 100 },
        },
        required: ['serviceId', 'date'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'find_next_available_slots',
      description: 'Earliest free times for a service across the next two weeks. Use for "first available", "soonest" or "this week" requests.',
      parameters: {
        type: 'object',
        properties: {
          serviceId: { type: 'string' },
          fromDate: { ...dateParam, description: 'Optional start date YYYY-MM-DD (defaults to today).' },
          partySize: { type: 'integer', minimum: 1, maximum: 100 },
        },
        required: ['serviceId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_appointment',
      description: 'Create a conflict-free booking only after the customer confirms service, date, time, name and phone.',
      parameters: {
        type: 'object',
        properties: {
          serviceId: { type: 'string' },
          localDate: dateParam,
          startMinute: { type: 'integer', minimum: 0, maximum: 1439, description: 'Minutes after local midnight, copied from a returned slot.' },
          partySize: { type: 'integer', minimum: 1, maximum: 100 },
          customerName: { type: 'string' },
          customerPhone: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['serviceId', 'localDate', 'startMinute', 'customerName', 'customerPhone'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_my_appointments',
      description: 'Upcoming active appointments of this customer (needed before cancelling or moving one).',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'reschedule_appointment',
      description: 'Move one of this customer’s appointments to a new free time, only after the customer confirms the new time.',
      parameters: {
        type: 'object',
        properties: {
          appointmentId: { type: 'string' },
          localDate: dateParam,
          startMinute: { type: 'integer', minimum: 0, maximum: 1439 },
          confirmedByCustomer: { type: 'boolean', const: true },
        },
        required: ['appointmentId', 'localDate', 'startMinute', 'confirmedByCustomer'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'cancel_appointment',
      description: 'Cancel one of this customer’s appointments only after the customer explicitly confirms cancellation.',
      parameters: {
        type: 'object',
        properties: {
          appointmentId: { type: 'string' },
          reason: { type: 'string' },
          confirmedByCustomer: { type: 'boolean', const: true },
        },
        required: ['appointmentId', 'reason', 'confirmedByCustomer'],
        additionalProperties: false,
      },
    },
  },
] as const

export function bookingToolInstruction(params: { isFa: boolean; now?: Date }): string {
  const rules = params.isFa
    ? `
قواعد رزرو:
- هرگز زمان یا تاریخ را حدس نزن؛ خدمت را با list_booking_services و زمان آزاد را با list_available_slots یا find_next_available_slots بگیر.
- اگر مشتری تاریخ نگفت یا «اولین وقت خالی» خواست، find_next_available_slots را صدا بزن.
- حداکثر ۶ زمان پیشنهاد بده و تاریخ را با برچسب شمسیِ خروجی ابزار (dateLabel) بگو، نه تاریخ میلادی.
- اگر ابزار گفت روز تعطیل یا پر است، دلیل را کوتاه بگو و نزدیک‌ترین زمان آزاد (nextAvailable) را پیشنهاد کن.
- قبل از create_appointment، خدمت، روز، ساعت، نام و شماره تماس را در یک جمله خلاصه کن و تأیید صریح بگیر. در هر پیام فقط یک سؤال بپرس.
- برای لغو یا جابه‌جایی اول list_my_appointments را صدا بزن و بعد از تأیید صریح مشتری اقدام کن.
- فقط وقتی بگو «ثبت شد» که ابزار created=true یا ok=true برگردانده باشد. خروجی ابزار منبع حقیقت است و شناسه‌های داخلی را نشان نده.`
    : `
Booking rules:
- Never guess times or dates; get services with list_booking_services and free times with list_available_slots or find_next_available_slots.
- If the customer gives no date or asks for the soonest time, call find_next_available_slots.
- Offer at most 6 times and name dates with the tool's dateLabel.
- If a tool says the day is closed or full, say why in one short line and offer nextAvailable.
- Before create_appointment, summarize service, day, time, name and phone in one sentence and get explicit confirmation. Ask one question per message.
- To cancel or move, call list_my_appointments first and act only after explicit confirmation.
- Say "booked" only when a tool returned created=true or ok=true. Tool output is the source of truth; never show internal ids.`
  return `${bookingCalendarContext({ now: params.now, isFa: params.isFa })}\n${rules.trim()}`
}

/** @deprecated kept for callers that only need the static rules. */
export const BOOKING_TOOL_SYSTEM_INSTRUCTION = bookingToolInstruction({ isFa: true })

const slotsSchema = z.object({
  serviceId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  partySize: z.number().int().min(1).max(100).default(1),
})

const nextSchema = z.object({
  serviceId: z.string().min(1),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  partySize: z.number().int().min(1).max(100).default(1),
})

const cancelSchema = z.object({
  appointmentId: z.string().min(1),
  reason: z.string().trim().min(2).max(500),
  confirmedByCustomer: z.literal(true),
})

const rescheduleSchema = z.object({
  appointmentId: z.string().min(1),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startMinute: z.number().int().min(0).max(1439),
  confirmedByCustomer: z.literal(true),
})

const MAX_SLOTS_PER_DATE = 16

const REASON_TEXT: Record<string, { fa: string; en: string }> = {
  CLOSED_DATE: { fa: 'این تاریخ تعطیل است.', en: 'Closed on this date.' },
  NOT_A_WORKING_DAY: { fa: 'این روز هفته تعطیل است.', en: 'Closed on this weekday.' },
  FULLY_BOOKED_OR_PAST: { fa: 'همه زمان‌های این روز پر شده یا گذشته است.', en: 'Every time on this day is taken or past.' },
}

function normalizeName(value: string): string {
  return value.normalize('NFKC').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[\s\u200c]+/g, ' ').trim().toLowerCase()
}

/**
 * Models sometimes pass the service name or "1" instead of the id. Resolve an
 * exact id first, then an exact name, then the only active service.
 */
async function resolveServiceId(workspaceId: string, raw: unknown): Promise<string> {
  const value = typeof raw === 'string' ? raw.trim() : String(raw ?? '')
  const services = await prisma.service.findMany({
    where: { workspaceId, active: true },
    select: { id: true, name: true },
  })
  if (services.some((service) => service.id === value)) return value
  const byName = services.filter((service) => normalizeName(service.name) === normalizeName(value))
  if (byName.length === 1) return byName[0].id
  if (services.length === 1) return services[0].id
  return value
}

/** Compact service directory for the prompt, so the first tool call is right. */
export async function bookingServiceDirectory(workspaceId: string, isFa: boolean): Promise<string> {
  const services = await prisma.service.findMany({
    where: { workspaceId, active: true },
    orderBy: { createdAt: 'asc' },
    take: 20,
    select: { id: true, name: true, durationMinutes: true },
  })
  if (!services.length) return ''
  const rows = services.map((service) => `- serviceId=${service.id} → ${service.name} (${service.durationMinutes} ${isFa ? 'دقیقه' : 'min'})`)
  return [isFa ? 'خدمات قابل رزرو (برای serviceId دقیقاً همین شناسه‌ها را بفرست):' : 'Bookable services (use these exact serviceId values):', ...rows].join('\n')
}

function slotView(slot: { startMinute: number; remainingCapacity: number }) {
  return {
    startMinute: slot.startMinute,
    localTime: formatMinuteOfDay(slot.startMinute),
    remainingCapacity: slot.remainingCapacity,
  }
}

function localTimeOf(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)
}

export async function executeBookingAgentTool(params: {
  workspaceId: string
  contactId?: string | null
  conversationId?: string
  name: string
  arguments: unknown
  isFa?: boolean
  now?: Date
}): Promise<unknown> {
  const isFa = params.isFa ?? true
  const now = params.now ?? new Date()
  const scope = params.conversationId
    ? agentAppointmentScope({ contactId: params.contactId ?? null, conversationId: params.conversationId })
    : params.contactId
      ? { contactId: params.contactId }
      : null

  if (params.name === 'list_booking_services') {
    const services = await listBookingServices(params.workspaceId)
    return services
      .filter((service) => service.active)
      .map((service) => {
        const today = dateKeyInTimeZone(now, service.timezone)
        const horizon = shiftDateKey(today, 30)
        return {
          id: service.id,
          name: service.name,
          description: service.description,
          durationMinutes: service.durationMinutes,
          capacity: service.capacity,
          location: service.location,
          price: service.price,
          weeklyHours: summarizeWeeklyHours(service.weeklyRules, isFa),
          upcomingClosedDates: service.exceptions
            .map((exception) => ({ key: exception.date.toISOString().slice(0, 10), closed: exception.closed }))
            .filter((item) => item.closed && item.key >= today && item.key <= horizon)
            .map((item) => bookingDateLabel(item.key, isFa)),
        }
      })
  }

  const args = (params.arguments ?? {}) as Record<string, unknown>
  if ('serviceId' in args) args.serviceId = await resolveServiceId(params.workspaceId, args.serviceId)

  if (params.name === 'list_available_slots') {
    const input = slotsSchema.parse(args)
    const result = await listAvailableSlots({
      workspaceId: params.workspaceId,
      serviceId: input.serviceId,
      dateKey: input.date,
      partySize: input.partySize,
      now,
    })
    const base = {
      service: { name: result.service.name, durationMinutes: result.service.durationMinutes },
      date: input.date,
      dateLabel: bookingDateLabel(input.date, isFa),
    }
    if (result.slots.length) {
      return {
        ...base,
        totalFreeSlots: result.slots.length,
        slots: result.slots.slice(0, MAX_SLOTS_PER_DATE).map(slotView),
      }
    }
    const reason = await explainUnavailableDate({
      workspaceId: params.workspaceId,
      serviceId: input.serviceId,
      dateKey: input.date,
    })
    const next = await findNextAvailableSlots({
      workspaceId: params.workspaceId,
      serviceId: input.serviceId,
      fromDateKey: shiftDateKey(input.date, 1),
      partySize: input.partySize,
      days: 21,
      maxDates: 1,
      now,
    })
    const nearest = next.dates[0]
    return {
      ...base,
      slots: [],
      reason,
      reasonText: isFa ? REASON_TEXT[reason].fa : REASON_TEXT[reason].en,
      nextAvailable: nearest
        ? {
            date: nearest.date,
            dateLabel: bookingDateLabel(nearest.date, isFa),
            slots: nearest.slots.slice(0, 6).map(slotView),
          }
        : null,
    }
  }

  if (params.name === 'find_next_available_slots') {
    const input = nextSchema.parse(args)
    const today = dateKeyInTimeZone(now)
    const from = input.fromDate && input.fromDate > today ? input.fromDate : today
    const result = await findNextAvailableSlots({
      workspaceId: params.workspaceId,
      serviceId: input.serviceId,
      fromDateKey: from,
      partySize: input.partySize,
      days: 21,
      maxDates: 3,
      now,
    })
    return {
      service: { name: result.service.name, durationMinutes: result.service.durationMinutes },
      dates: result.dates.map((item) => ({
        date: item.date,
        dateLabel: bookingDateLabel(item.date, isFa),
        slots: item.slots.slice(0, 8).map(slotView),
      })),
      ...(result.dates.length ? {} : { reason: 'NO_AVAILABILITY_IN_NEXT_3_WEEKS' }),
    }
  }

  if (params.name === 'create_appointment') {
    const input = appointmentCreateSchema.parse({
      ...args,
      contactId: params.contactId ?? undefined,
      source: 'agent',
    })
    const result = await createAppointment(params.workspaceId, input, {
      conversationId: params.conversationId,
    })
    const appointment = result.appointment
    return {
      ok: true,
      created: result.created,
      service: appointment.service.name,
      date: input.localDate,
      dateLabel: bookingDateLabel(input.localDate, isFa),
      localTime: localTimeOf(appointment.startsAt, appointment.timezone),
      location: appointment.service.location,
      status: appointment.status,
    }
  }

  if (params.name === 'list_my_appointments') {
    if (!scope) return { appointments: [], reason: 'CUSTOMER_NOT_IDENTIFIED' }
    const rows = await prisma.appointment.findMany({
      where: {
        workspaceId: params.workspaceId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        startsAt: { gt: now },
        ...scope,
      },
      orderBy: { startsAt: 'asc' },
      take: 5,
      include: { service: { select: { name: true, location: true } } },
    })
    return {
      appointments: rows.map((row) => {
        const dateKey = dateKeyInTimeZone(row.startsAt, row.timezone)
        return {
          appointmentId: row.id,
          service: row.service.name,
          date: dateKey,
          dateLabel: bookingDateLabel(dateKey, isFa),
          localTime: localTimeOf(row.startsAt, row.timezone),
          partySize: row.partySize,
          status: row.status,
        }
      }),
    }
  }

  if (params.name === 'reschedule_appointment') {
    const input = rescheduleSchema.parse(params.arguments)
    if (!params.conversationId) return { ok: false, reason: 'CUSTOMER_NOT_IDENTIFIED' }
    const result = await rescheduleAppointment({
      workspaceId: params.workspaceId,
      appointmentId: input.appointmentId,
      localDate: input.localDate,
      startMinute: input.startMinute,
      source: 'agent',
      contactScope: { contactId: params.contactId ?? null, conversationId: params.conversationId },
    })
    return {
      ok: true,
      rescheduled: true,
      service: result.appointment.service.name,
      date: input.localDate,
      dateLabel: bookingDateLabel(input.localDate, isFa),
      localTime: localTimeOf(result.appointment.startsAt, result.appointment.timezone),
    }
  }

  if (params.name === 'cancel_appointment') {
    const input = cancelSchema.parse(params.arguments)
    // A public-facing agent may only cancel a booking that belongs to this
    // customer. Dashboard operators use the authenticated appointment API.
    if (!scope) return { cancelled: false, reason: 'CUSTOMER_NOT_IDENTIFIED' }
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: input.appointmentId,
        workspaceId: params.workspaceId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        ...scope,
      },
      select: { id: true },
    })
    if (!appointment) return { cancelled: false, reason: 'NOT_FOUND_OR_NOT_ACTIVE' }
    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: input.reason,
      },
      include: { service: { select: { name: true } } },
    })
    await notifyAppointmentCancellation({
      workspaceId: params.workspaceId,
      appointment: updated,
    })
    return { ok: true, cancelled: true }
  }

  throw new Error('UNKNOWN_BOOKING_TOOL')
}
