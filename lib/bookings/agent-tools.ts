import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  createAppointment,
  listAvailableSlots,
  listBookingServices,
  notifyAppointmentCancellation,
} from '@/lib/bookings/service'
import { appointmentCreateSchema } from '@/lib/bookings/validation'
import { formatMinuteOfDay } from '@/lib/bookings/time'

/** Provider-neutral OpenAI-compatible tool declarations for future chat wiring. */
export const BOOKING_AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'list_booking_services',
      description: 'List active services that this business accepts appointments for.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_available_slots',
      description: 'Return real, capacity-checked available times for one service and local date.',
      parameters: {
        type: 'object',
        properties: {
          serviceId: { type: 'string' },
          date: { type: 'string', description: 'Local Gregorian date in YYYY-MM-DD.' },
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
      name: 'create_appointment',
      description: 'Create a conflict-free booking only after the customer confirms service, date and time.',
      parameters: {
        type: 'object',
        properties: {
          serviceId: { type: 'string' },
          localDate: { type: 'string', description: 'Local Gregorian date in YYYY-MM-DD.' },
          startMinute: { type: 'integer', minimum: 0, maximum: 1439 },
          partySize: { type: 'integer', minimum: 1, maximum: 100 },
          customerName: { type: 'string' },
          customerPhone: { type: 'string' },
          notes: { type: 'string' },
          idempotencyKey: { type: 'string', description: 'Stable key for this confirmed customer request.' },
        },
        required: ['serviceId', 'localDate', 'startMinute', 'customerName', 'customerPhone', 'idempotencyKey'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'cancel_appointment',
      description: 'Cancel an appointment only after the customer explicitly confirms cancellation.',
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

export const BOOKING_TOOL_SYSTEM_INSTRUCTION = `
برای رزرو هرگز زمان را حدس نزن. ابتدا خدمت را با list_booking_services پیدا کن،
سپس زمان‌های واقعی را با list_available_slots بگیر. قبل از create_appointment
نام، شماره تماس، خدمت، تاریخ و ساعت را یک‌بار خلاصه و از مشتری تأیید بگیر.
لغو فقط پس از تأیید صریح مشتری مجاز است. نتیجه ابزار منبع حقیقت است.
`.trim()

const slotsSchema = z.object({
  serviceId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  partySize: z.number().int().min(1).max(100).default(1),
})

const cancelSchema = z.object({
  appointmentId: z.string().min(1),
  reason: z.string().trim().min(2).max(500),
  confirmedByCustomer: z.literal(true),
})

export async function executeBookingAgentTool(params: {
  workspaceId: string
  contactId?: string | null
  name: string
  arguments: unknown
}): Promise<unknown> {
  if (params.name === 'list_booking_services') {
    const services = await listBookingServices(params.workspaceId)
    return services
      .filter((service) => service.active)
      .map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        durationMinutes: service.durationMinutes,
        capacity: service.capacity,
        timezone: service.timezone,
      }))
  }

  if (params.name === 'list_available_slots') {
    const input = slotsSchema.parse(params.arguments)
    const result = await listAvailableSlots({
      workspaceId: params.workspaceId,
      serviceId: input.serviceId,
      dateKey: input.date,
      partySize: input.partySize,
    })
    return {
      service: result.service,
      date: input.date,
      slots: result.slots.map((slot) => ({
        startMinute: slot.startMinute,
        localTime: formatMinuteOfDay(slot.startMinute),
        startsAt: slot.startsAt.toISOString(),
        remainingCapacity: slot.remainingCapacity,
      })),
    }
  }

  if (params.name === 'create_appointment') {
    const input = appointmentCreateSchema.parse({
      ...(params.arguments as Record<string, unknown>),
      contactId: params.contactId ?? undefined,
      source: 'agent',
    })
    const result = await createAppointment(params.workspaceId, input)
    return {
      created: result.created,
      appointmentId: result.appointment.id,
      service: result.appointment.service.name,
      startsAt: result.appointment.startsAt.toISOString(),
      timezone: result.appointment.timezone,
      status: result.appointment.status,
    }
  }

  if (params.name === 'cancel_appointment') {
    const input = cancelSchema.parse(params.arguments)
    // A public-facing agent may only cancel a booking attached to the same CRM
    // contact. Dashboard operators use the authenticated appointment API.
    if (!params.contactId) return { cancelled: false, reason: 'CONTACT_REQUIRED' }
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: input.appointmentId,
        workspaceId: params.workspaceId,
        contactId: params.contactId,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      include: { service: { select: { name: true } } },
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
    return { cancelled: true, appointmentId: updated.id }
  }

  throw new Error('UNKNOWN_BOOKING_TOOL')
}
