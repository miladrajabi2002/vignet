import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  buildAvailableSlots,
  inspectRequestedSlot,
} from '@/lib/bookings/availability'
import {
  addMinutes,
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
      | 'TRANSACTION_CONFLICT',
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
  tx: Prisma.TransactionClient,
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

async function bookInTransaction(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  input: AppointmentCreateInput,
  customerLimit: number,
): Promise<BookResult> {
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

  const roughRange = localDateRangeUtc(input.localDate, service.timezone)
  const appointments = await tx.appointment.findMany({
    where: {
      workspaceId,
      serviceId: service.id,
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
    },
    select: { id: true },
  })
  return {
    appointment: await findAppointmentWithRelations(tx, created.id),
    created: true,
  }
}

export async function createAppointment(
  workspaceId: string,
  input: AppointmentCreateInput,
): Promise<BookResult> {
  const { limit: customerLimit } = await getWorkspaceResourceLimit(workspaceId, 'customers')
  let result: BookResult | undefined
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      result = await prisma.$transaction(
        (tx) => bookInTransaction(tx, workspaceId, input, customerLimit),
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
      title: `رزرو جدید برای ${appointment.service.name}`,
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
