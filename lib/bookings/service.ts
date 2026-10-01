import { prisma, type Tx } from '@/lib/prisma'
import {
  buildAvailableSlots,
  inspectRequestedSlot,
} from '@/lib/bookings/availability'
import {
  addMinutes,
  dateKeyInTimeZone,
  dateKeyToDatabaseDate,
  localDateRangeUtc,
} from '@/lib/bookings/time'
import type { AppointmentCreateInput } from '@/lib/bookings/validation'
import { notifyWorkspace } from '@/lib/notifications/create'
import {
  assertWorkspaceResourceCapacity,
  getWorkspaceResourceLimit,
  WorkspaceResourceLimitError,
} from '@/lib/billing/entitlements'

const ACTIVE_APPOINTMENT_STATUSES = ['PENDING', 'CONFIRMED'] as const

export class BookingError extends Error {
  constructor(
    public readonly code:
      | 'SERVICE_NOT_FOUND'
      | 'SERVICE_INACTIVE'
      | 'CONTACT_NOT_FOUND'
      | 'CUSTOMER_LIMIT'
      | 'SLOT_IN_PAST'
      | 'SLOT_TOO_FAR'
      | 'OUTSIDE_AVAILABILITY'
      | 'CAPACITY_EXCEEDED'
      | 'TRANSACTION_CONFLICT'
      | 'APPOINTMENT_NOT_FOUND'
      | 'APPOINTMENT_NOT_ACTIVE',
  ) {
    super(code)
    this.name = 'BookingError'
  }
}

export function serviceSlug(name: string): string {
  const normalized = name
    .normalize('NFKC')
    .toLocaleLowerCase('fa')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return normalized || `service-${crypto.randomUUID().slice(0, 8)}`
}

export async function listBookingServices(workspaceId: string) {
  return prisma.service.findMany({
    where: { workspaceId },
    orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
    include: {
      weeklyRules: { orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] },
      exceptions: { orderBy: { date: 'asc' } },
      _count: { select: { appointments: true } },
    },
  })
}

export async function listAppointmentsForDate(params: {
  workspaceId: string
  dateKey: string
  serviceId?: string
  status?: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW'
  timeZone?: string
}) {
  const range = localDateRangeUtc(params.dateKey, params.timeZone ?? 'Asia/Tehran')
  return prisma.appointment.findMany({
    where: {
      workspaceId: params.workspaceId,
      serviceId: params.serviceId,
      status: params.status,
      startsAt: { gte: range.start, lt: range.end },
    },
    orderBy: { startsAt: 'asc' },
    include: {
      service: { select: { id: true, name: true, timezone: true, location: true } },
      contact: { select: { id: true, name: true, phone: true } },
    },
  })
}

export async function listAvailableSlots(params: {
  workspaceId: string
  serviceId: string
  dateKey: string
  partySize?: number
  now?: Date
}) {
  const exceptionDate = dateKeyToDatabaseDate(params.dateKey)
  const service = await prisma.service.findFirst({
    where: { id: params.serviceId, workspaceId: params.workspaceId, active: true },
    include: {
      weeklyRules: true,
      exceptions: { where: { date: exceptionDate }, take: 1 },
    },
  })
  if (!service) throw new BookingError('SERVICE_NOT_FOUND')

  const range = localDateRangeUtc(params.dateKey, service.timezone)
  const appointments = await prisma.appointment.findMany({
    where: {
      workspaceId: params.workspaceId,
      serviceId: service.id,
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
      startsAt: { lt: addMinutes(range.end, service.bufferAfterMinutes) },
      endsAt: { gt: addMinutes(range.start, -service.bufferBeforeMinutes) },
    },
    select: { startsAt: true, endsAt: true, partySize: true },
  })

  return {
    service: {
      id: service.id,
      name: service.name,
      durationMinutes: service.durationMinutes,
      capacity: service.capacity,
      timezone: service.timezone,
    },
    slots: buildAvailableSlots({
      dateKey: params.dateKey,
      timeZone: service.timezone,
      durationMinutes: service.durationMinutes,
      slotIntervalMinutes: service.slotIntervalMinutes,
      bufferBeforeMinutes: service.bufferBeforeMinutes,
      bufferAfterMinutes: service.bufferAfterMinutes,
      defaultCapacity: service.capacity,
      partySize: params.partySize,
      weeklyRules: service.weeklyRules,
      exception: service.exceptions[0] ?? null,
      appointments,
      now: params.now ?? new Date(),
    }),
  }
}

interface BookResult {
  appointment: Awaited<ReturnType<typeof findAppointmentWithRelations>>
  created: boolean
}

async function findAppointmentWithRelations(
  tx: Tx,
  id: string,
) {
  return tx.appointment.findUniqueOrThrow({
    where: { id },
    include: {
      service: { select: { id: true, name: true, timezone: true, location: true } },
      contact: { select: { id: true, name: true, phone: true } },
    },
  })
}

interface RescheduleSource {
  id: string
  reason: string
}

export interface BookingOptions {
  /** Atomically cancel this appointment once the new one is booked. */
  replace?: RescheduleSource
  /** Conversation that booked it — scopes later agent lookups/cancels. */
  conversationId?: string
}

async function bookInTransaction(
  tx: Tx,
  workspaceId: string,
  input: AppointmentCreateInput,
  customerLimit: number,
  options: BookingOptions = {},
): Promise<BookResult> {
  const replace = options.replace
  if (input.idempotencyKey) {
    const duplicate = await tx.appointment.findFirst({
      where: { workspaceId, idempotencyKey: input.idempotencyKey },
      select: { id: true },
    })
    if (duplicate) {
      return {
        appointment: await findAppointmentWithRelations(tx, duplicate.id),
        created: false,
      }
    }
  }

  const exceptionDate = dateKeyToDatabaseDate(input.localDate)
  const service = await tx.service.findFirst({
    where: { id: input.serviceId, workspaceId },
    include: {
      weeklyRules: true,
      exceptions: { where: { date: exceptionDate }, take: 1 },
    },
  })
  if (!service) throw new BookingError('SERVICE_NOT_FOUND')
  if (!service.active) throw new BookingError('SERVICE_INACTIVE')

  // Serialize all bookings for this service/local date. Locking the date (not
  // only the exact start) protects partially-overlapping slots and capacity >1.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`booking:${service.id}:${input.localDate}`}))`

  // Re-check after acquiring the date lock. Two retries can both miss the
  // optimistic lookup above; this second lookup closes that race before the
  // unique idempotency index is reached.
  if (input.idempotencyKey) {
    const duplicate = await tx.appointment.findFirst({
      where: { workspaceId, idempotencyKey: input.idempotencyKey },
      select: { id: true },
    })
    if (duplicate) {
      return {
        appointment: await findAppointmentWithRelations(tx, duplicate.id),
        created: false,
      }
    }
  }

  if (replace) {
    const current = await tx.appointment.findFirst({
      where: { id: replace.id, workspaceId },
      select: { status: true },
    })
    if (!current) throw new BookingError('APPOINTMENT_NOT_FOUND')
    if (!ACTIVE_APPOINTMENT_STATUSES.includes(current.status as typeof ACTIVE_APPOINTMENT_STATUSES[number])) {
      throw new BookingError('APPOINTMENT_NOT_ACTIVE')
    }
  }

  const roughRange = localDateRangeUtc(input.localDate, service.timezone)
  const appointments = await tx.appointment.findMany({
    where: {
      workspaceId,
      serviceId: service.id,
      // A moved appointment must not block its own new time (e.g. 30 min later
      // on a capacity-1 service); it is cancelled in this same transaction.
      ...(replace ? { id: { not: replace.id } } : {}),
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
      startsAt: { lt: addMinutes(roughRange.end, service.bufferAfterMinutes) },
      endsAt: { gt: addMinutes(roughRange.start, -service.bufferBeforeMinutes) },
    },
    select: { startsAt: true, endsAt: true, partySize: true },
  })

  const inspected = inspectRequestedSlot({
    dateKey: input.localDate,
    startMinute: input.startMinute,
    timeZone: service.timezone,
    durationMinutes: service.durationMinutes,
    slotIntervalMinutes: service.slotIntervalMinutes,
    bufferBeforeMinutes: service.bufferBeforeMinutes,
    bufferAfterMinutes: service.bufferAfterMinutes,
    defaultCapacity: service.capacity,
    partySize: input.partySize,
    weeklyRules: service.weeklyRules,
    exception: service.exceptions[0] ?? null,
    appointments,
  })
  if (!inspected.allowed) throw new BookingError(inspected.reason!)

  const now = Date.now()
  if (inspected.startsAt.getTime() <= now) throw new BookingError('SLOT_IN_PAST')
  if (inspected.startsAt.getTime() > now + 370 * 24 * 60 * 60_000) {
    throw new BookingError('SLOT_TOO_FAR')
  }

  let contactId = input.contactId ?? null
  if (contactId) {
    const owned = await tx.contact.findFirst({
      where: { id: contactId, workspaceId },
      select: { id: true },
    })
    if (!owned) throw new BookingError('CONTACT_NOT_FOUND')
  } else if (input.customerPhone) {
    const existing = await tx.contact.findFirst({
      where: { workspaceId, phone: input.customerPhone },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    })
    if (existing) {
      contactId = existing.id
      if (!existing.name) {
        await tx.contact.update({
          where: { id: existing.id },
          data: { name: input.customerName },
        })
      }
    } else {
      try {
        await assertWorkspaceResourceCapacity(tx, workspaceId, 'customers', customerLimit)
      } catch (error) {
        if (error instanceof WorkspaceResourceLimitError) throw new BookingError('CUSTOMER_LIMIT')
        throw error
      }
      const created = await tx.contact.create({
        data: {
          workspaceId,
          name: input.customerName,
          phone: input.customerPhone,
          tags: ['appointment'],
        },
        select: { id: true },
      })
      contactId = created.id
    }
  }

  const created = await tx.appointment.create({
    data: {
      workspaceId,
      serviceId: service.id,
      contactId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      startsAt: inspected.startsAt,
      endsAt: inspected.endsAt,
      timezone: service.timezone,
      partySize: input.partySize,
      source: input.source,
      idempotencyKey: input.idempotencyKey,
      notes: input.notes,
      ...(replace || options.conversationId
        ? {
            metadata: {
              ...(replace ? { rescheduledFrom: replace.id } : {}),
              ...(options.conversationId ? { conversationId: options.conversationId } : {}),
            },
          }
        : {}),
    },
    select: { id: true },
  })
  if (replace) {
    await tx.appointment.update({
      where: { id: replace.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: replace.reason,
        metadata: { rescheduledTo: created.id },
      },
    })
  }
  return {
    appointment: await findAppointmentWithRelations(tx, created.id),
    created: true,
  }
}

export async function createAppointment(
  workspaceId: string,
  input: AppointmentCreateInput,
  options: BookingOptions = {},
): Promise<BookResult> {
  const replace = options.replace
  const { limit: customerLimit } = await getWorkspaceResourceLimit(workspaceId, 'customers')
  let result: BookResult | undefined
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      result = await prisma.$transaction(
        (tx) => bookInTransaction(tx, workspaceId, input, customerLimit, options),
        { isolationLevel: 'Serializable' },
      )
      break
    } catch (error) {
      const retryable =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2034'
      if (!retryable || attempt === 1) {
        if (retryable) throw new BookingError('TRANSACTION_CONFLICT')
        throw error
      }
    }
  }
  if (!result) throw new BookingError('TRANSACTION_CONFLICT')

  if (result.created) {
    const appointment = result.appointment
    const when = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      timeZone: appointment.timezone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(appointment.startsAt)
    await notifyWorkspace({
      workspaceId,
      type: 'APPOINTMENT',
      title: replace
        ? `نوبت ${appointment.service.name} جابه‌جا شد`
        : `رزرو جدید برای ${appointment.service.name}`,
      body: `${appointment.customerName} · ${when}`,
      link: '/appointments',
      operatorTelegram: true,
    })
  }
  return result
}

export async function notifyAppointmentCancellation(params: {
  workspaceId: string
  appointment: {
    customerName: string
    startsAt: Date
    timezone: string
    service: { name: string }
  }
}) {
  const when = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    timeZone: params.appointment.timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(params.appointment.startsAt)
  await notifyWorkspace({
    workspaceId: params.workspaceId,
    type: 'APPOINTMENT',
    title: `رزرو ${params.appointment.service.name} لغو شد`,
    body: `${params.appointment.customerName} · ${when}`,
    link: '/appointments',
    operatorTelegram: true,
  })
}

/**
 * Move an active appointment to a new time atomically: the new booking is
 * capacity-checked without counting the old one, and the old one is cancelled
 * in the same transaction. A failure leaves the original appointment intact.
 */
export async function rescheduleAppointment(params: {
  workspaceId: string
  appointmentId: string
  localDate: string
  startMinute: number
  source: 'dashboard' | 'agent' | 'api'
  /** Restrict to one CRM contact (public agent). */
  contactScope?: { contactId: string | null; conversationId: string }
}) {
  const existing = await prisma.appointment.findFirst({
    where: {
      id: params.appointmentId,
      workspaceId: params.workspaceId,
      ...(params.contactScope ? agentAppointmentScope(params.contactScope) : {}),
    },
  })
  if (!existing) throw new BookingError('APPOINTMENT_NOT_FOUND')
  if (!ACTIVE_APPOINTMENT_STATUSES.includes(existing.status as typeof ACTIVE_APPOINTMENT_STATUSES[number])) {
    throw new BookingError('APPOINTMENT_NOT_ACTIVE')
  }
  return createAppointment(params.workspaceId, {
    serviceId: existing.serviceId,
    localDate: params.localDate,
    startMinute: params.startMinute,
    partySize: existing.partySize,
    contactId: existing.contactId ?? undefined,
    customerName: existing.customerName,
    customerPhone: existing.customerPhone ?? undefined,
    notes: existing.notes ?? undefined,
    source: params.source,
    idempotencyKey: `reschedule:${existing.id}:${params.localDate}:${params.startMinute}`,
  }, {
    replace: { id: existing.id, reason: 'جابه‌جایی نوبت به زمان جدید' },
    conversationId: params.contactScope?.conversationId,
  })
}

/**
 * Appointments a public agent may see or change: the ones attached to the
 * conversation's CRM contact, or booked inside this same conversation (the
 * customer may not be linked to a contact yet when they book).
 */
export function agentAppointmentScope(scope: { contactId: string | null; conversationId: string }) {
  return {
    OR: [
      ...(scope.contactId ? [{ contactId: scope.contactId }] : []),
      { idempotencyKey: { startsWith: `agent:${scope.conversationId}:` } },
      { metadata: { path: ['conversationId'], equals: scope.conversationId } },
    ],
  }
}

/**
 * Earliest bookable times across the next `days` local dates, computed from one
 * service load and one appointment query (not one round-trip per day).
 */
export async function findNextAvailableSlots(params: {
  workspaceId: string
  serviceId: string
  fromDateKey: string
  partySize?: number
  days?: number
  maxDates?: number
  now?: Date
}) {
  const days = Math.min(Math.max(params.days ?? 14, 1), 60)
  const dateKeys = Array.from({ length: days }, (_, index) => shiftKey(params.fromDateKey, index))
  const service = await prisma.service.findFirst({
    where: { id: params.serviceId, workspaceId: params.workspaceId, active: true },
    include: {
      weeklyRules: true,
      exceptions: {
        where: {
          date: {
            gte: dateKeyToDatabaseDate(dateKeys[0]),
            lte: dateKeyToDatabaseDate(dateKeys[dateKeys.length - 1]),
          },
        },
      },
    },
  })
  if (!service) throw new BookingError('SERVICE_NOT_FOUND')

  const first = localDateRangeUtc(dateKeys[0], service.timezone)
  const last = localDateRangeUtc(dateKeys[dateKeys.length - 1], service.timezone)
  const appointments = await prisma.appointment.findMany({
    where: {
      workspaceId: params.workspaceId,
      serviceId: service.id,
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
      startsAt: { lt: addMinutes(last.end, service.bufferAfterMinutes) },
      endsAt: { gt: addMinutes(first.start, -service.bufferBeforeMinutes) },
    },
    select: { startsAt: true, endsAt: true, partySize: true },
  })

  const exceptionByDate = new Map(
    service.exceptions.map((exception) => [exception.date.toISOString().slice(0, 10), exception]),
  )
  const found: Array<{ date: string; slots: ReturnType<typeof buildAvailableSlots> }> = []
  for (const dateKey of dateKeys) {
    const slots = buildAvailableSlots({
      dateKey,
      timeZone: service.timezone,
      durationMinutes: service.durationMinutes,
      slotIntervalMinutes: service.slotIntervalMinutes,
      bufferBeforeMinutes: service.bufferBeforeMinutes,
      bufferAfterMinutes: service.bufferAfterMinutes,
      defaultCapacity: service.capacity,
      partySize: params.partySize,
      weeklyRules: service.weeklyRules,
      exception: exceptionByDate.get(dateKey) ?? null,
      appointments,
      now: params.now ?? new Date(),
    })
    if (slots.length) found.push({ date: dateKey, slots })
    if (found.length >= (params.maxDates ?? 3)) break
  }
  return {
    service: { id: service.id, name: service.name, durationMinutes: service.durationMinutes, timezone: service.timezone },
    dates: found,
  }
}

/** Why a date has no slots — lets the agent explain instead of saying "full". */
export async function explainUnavailableDate(params: {
  workspaceId: string
  serviceId: string
  dateKey: string
}): Promise<'CLOSED_DATE' | 'NOT_A_WORKING_DAY' | 'FULLY_BOOKED_OR_PAST'> {
  const service = await prisma.service.findFirst({
    where: { id: params.serviceId, workspaceId: params.workspaceId },
    include: {
      weeklyRules: { where: { active: true } },
      exceptions: { where: { date: dateKeyToDatabaseDate(params.dateKey) }, take: 1 },
    },
  })
  const exception = service?.exceptions[0]
  if (exception?.closed) return 'CLOSED_DATE'
  if (exception && exception.startMinute !== null) return 'FULLY_BOOKED_OR_PAST'
  const weekday = new Date(`${params.dateKey}T12:00:00.000Z`).getUTCDay()
  if (!service?.weeklyRules.some((rule) => rule.weekday === weekday)) return 'NOT_A_WORKING_DAY'
  return 'FULLY_BOOKED_OR_PAST'
}

/** Per-local-day booking counts for a date window (dashboard week strip). */
export async function appointmentDaySummary(params: {
  workspaceId: string
  fromDateKey: string
  days: number
  serviceId?: string
  timeZone?: string
}) {
  const timeZone = params.timeZone ?? 'Asia/Tehran'
  const days = Math.min(Math.max(params.days, 1), 62)
  const dateKeys = Array.from({ length: days }, (_, index) => shiftKey(params.fromDateKey, index))
  const start = localDateRangeUtc(dateKeys[0], timeZone).start
  const end = localDateRangeUtc(dateKeys[dateKeys.length - 1], timeZone).end
  const rows = await prisma.appointment.findMany({
    where: {
      workspaceId: params.workspaceId,
      serviceId: params.serviceId,
      startsAt: { gte: start, lt: end },
    },
    select: { startsAt: true, status: true, partySize: true },
  })
  const summary: Record<string, { total: number; active: number; pending: number; people: number }> =
    Object.fromEntries(dateKeys.map((key) => [key, { total: 0, active: 0, pending: 0, people: 0 }]))
  for (const row of rows) {
    const key = dateKeyInTimeZone(row.startsAt, timeZone)
    const bucket = summary[key]
    if (!bucket) continue
    bucket.total += 1
    if (row.status === 'PENDING' || row.status === 'CONFIRMED') {
      bucket.active += 1
      bucket.people += row.partySize
    }
    if (row.status === 'PENDING') bucket.pending += 1
  }
  return summary
}

function shiftKey(dateKey: string, amount: number): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

/**
 * What deleting a service would take with it. Upcoming active bookings block
 * the delete: those customers are still expecting to show up, so the manager
 * has to cancel or move them first (or just pause the service).
 */
export async function serviceDeletionImpact(workspaceId: string, serviceId: string, now = new Date()) {
  const service = await prisma.service.findFirst({ where: { id: serviceId, workspaceId }, select: { id: true } })
  if (!service) return null
  const [total, upcoming] = await Promise.all([
    prisma.appointment.count({ where: { serviceId } }),
    prisma.appointment.count({
      where: { serviceId, status: { in: [...ACTIVE_APPOINTMENT_STATUSES] }, endsAt: { gt: now } },
    }),
  ])
  return { total, upcoming }
}

/** Hard-deletes a service with its rules, closures and booking history. */
export async function deleteService(workspaceId: string, serviceId: string, now = new Date()) {
  try {
    return await deleteServiceOnce(workspaceId, serviceId, now)
  } catch (error) {
    // A booking landed between the check and the delete (FK restrict): treat
    // it as the upcoming booking it is instead of a server error.
    if ((error as { code?: string })?.code === 'P2003') return { ok: false as const, error: 'HAS_UPCOMING' as const, upcoming: 1 }
    throw error
  }
}

async function deleteServiceOnce(workspaceId: string, serviceId: string, now: Date) {
  return prisma.$transaction(async (tx) => {
    const service = await tx.service.findFirst({ where: { id: serviceId, workspaceId }, select: { id: true } })
    if (!service) return { ok: false as const, error: 'NOT_FOUND' as const }
    const upcoming = await tx.appointment.count({
      where: { serviceId, status: { in: [...ACTIVE_APPOINTMENT_STATUSES] }, endsAt: { gt: now } },
    })
    if (upcoming) return { ok: false as const, error: 'HAS_UPCOMING' as const, upcoming }
    const removed = await tx.appointment.deleteMany({ where: { serviceId } })
    await tx.service.delete({ where: { id: serviceId } })
    return { ok: true as const, appointments: removed.count }
  })
}
