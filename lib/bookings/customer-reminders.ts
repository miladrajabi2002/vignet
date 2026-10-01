/**
 * Booking reminders to the customer, inside their own conversation: one a
 * day ahead and one two hours ahead. They reach the person where they
 * booked (the conversation the agent booked in, else the contact's latest
 * conversation), through the same delivery path as order and checkout
 * notices. Replying there ("cancel", "move it to 5") lands with the agent,
 * which already has the booking tools.
 *
 * Instagram and WhatsApp only accept business messages within 24 hours of
 * the customer's last message; outside that window the reminder is skipped
 * and the reason is recorded, so the bookings screen can say so.
 *
 * Every attempt is written to Appointment.metadata.reminders[stage], which
 * is also what the bookings screen reads.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'
import { captureError } from '@/lib/errors/capture'
import { dateKeyInTimeZone } from '@/lib/bookings/time'
import { findNoticeTarget, latestContactConversation, sendCustomerNotice } from '@/lib/conversations/customer-notice'

export type ReminderStage = 'h24' | 'h2'
export type ReminderStatus = 'sent' | 'stored' | 'skipped_window' | 'no_conversation' | 'failed'
export interface ReminderRecord { status: ReminderStatus; at: string; channel?: string }
export type ReminderLog = Partial<Record<ReminderStage, ReminderRecord>>

const HOUR_MS = 3_600_000

/**
 * Which reminder is due now, if any. A reminder only makes sense when the
 * booking was made well before it: someone who booked this morning for this
 * afternoon needs no "see you tomorrow".
 */
export function dueReminderStage(params: {
  startsAt: Date
  createdAt: Date
  now: Date
  log: ReminderLog
}): ReminderStage | null {
  const left = params.startsAt.getTime() - params.now.getTime()
  const lead = params.startsAt.getTime() - params.createdAt.getTime()
  if (left <= 15 * 60_000) return null
  if (left <= 2 * HOUR_MS) return !params.log.h2 && lead >= 4 * HOUR_MS ? 'h2' : null
  if (left <= 24 * HOUR_MS) return !params.log.h24 && lead >= 30 * HOUR_MS && left > 4 * HOUR_MS ? 'h24' : null
  return null
}

export function readReminderLog(metadata: unknown): ReminderLog {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {}
  const raw = (metadata as Record<string, unknown>).reminders
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const log: ReminderLog = {}
  for (const stage of ['h24', 'h2'] as const) {
    const item = (raw as Record<string, unknown>)[stage]
    if (item && typeof item === 'object' && typeof (item as ReminderRecord).status === 'string') log[stage] = item as ReminderRecord
  }
  return log
}

export function composeBookingReminder(params: {
  stage: ReminderStage
  lang: 'fa' | 'en'
  serviceName: string
  startsAt: Date
  timezone: string
  location: string | null
  now: Date
}): string {
  const fa = params.lang === 'fa'
  const time = new Intl.DateTimeFormat(fa ? 'fa-IR' : 'en-US', { timeZone: params.timezone, hour: '2-digit', minute: '2-digit', hour12: !fa }).format(params.startsAt)
  const today = dateKeyInTimeZone(params.now, params.timezone)
  const tomorrow = dateKeyInTimeZone(new Date(params.now.getTime() + 24 * HOUR_MS), params.timezone)
  const day = dateKeyInTimeZone(params.startsAt, params.timezone)
  const dayLabel = day === today
    ? (fa ? 'امروز' : 'today')
    : day === tomorrow
      ? (fa ? 'فردا' : 'tomorrow')
      : new Intl.DateTimeFormat(fa ? 'fa-IR-u-ca-persian' : 'en-US', { timeZone: params.timezone, weekday: 'long', month: 'long', day: 'numeric' }).format(params.startsAt)
  const place = params.location?.trim()
  if (fa) {
    return params.stage === 'h2'
      ? `یادآوری: نوبت «${params.serviceName}» ${dayLabel} ساعت ${time} است${place ? `، در ${place}` : ''}. منتظرتان هستیم 🌿`
      : `یادآوری نوبت: ${dayLabel} ساعت ${time} نوبت «${params.serviceName}» را دارید${place ? `، در ${place}` : ''}.\nاگر نمی‌توانید بیایید، همین‌جا بگویید تا لغو یا جابه‌جایش کنیم.`
  }
  return params.stage === 'h2'
    ? `Reminder: your “${params.serviceName}” appointment is ${dayLabel} at ${time}${place ? `, at ${place}` : ''}. See you soon.`
    : `Appointment reminder: ${dayLabel} at ${time} you have “${params.serviceName}”${place ? `, at ${place}` : ''}.\nIf you can’t make it, just reply here and we’ll cancel or move it.`
}

async function resolveConversation(appointment: {
  workspaceId: string
  contactId: string | null
  metadata: unknown
}) {
  const bookedIn = appointment.metadata && typeof appointment.metadata === 'object' && !Array.isArray(appointment.metadata)
    ? (appointment.metadata as Record<string, unknown>).conversationId
    : null
  return (typeof bookedIn === 'string' ? await findNoticeTarget(appointment.workspaceId, bookedIn) : null)
    ?? latestContactConversation(appointment.workspaceId, appointment.contactId)
}

async function record(appointmentId: string, metadata: unknown, stage: ReminderStage, entry: ReminderRecord) {
  const base = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata as Record<string, unknown> : {}
  const reminders = { ...readReminderLog(metadata), [stage]: entry }
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { metadata: { ...base, reminders } as unknown as Prisma.InputJsonValue },
  })
}

export async function sweepCustomerBookingReminders(now = new Date()): Promise<{ sent: number; skipped: number }> {
  const appointments = await prisma.appointment.findMany({
    where: {
      startsAt: { gt: new Date(now.getTime() + 15 * 60_000), lte: new Date(now.getTime() + 24 * HOUR_MS) },
      status: { in: ['PENDING', 'CONFIRMED'] },
      workspace: { bookingRemindersEnabled: true },
    },
    orderBy: { startsAt: 'asc' },
    take: 500,
    select: {
      id: true,
      workspaceId: true,
      contactId: true,
      startsAt: true,
      createdAt: true,
      timezone: true,
      metadata: true,
      service: { select: { name: true, location: true } },
    },
  })
  let sent = 0
  let skipped = 0
  const redis = getRedis()
  for (const appointment of appointments) {
    const stage = dueReminderStage({ startsAt: appointment.startsAt, createdAt: appointment.createdAt, now, log: readReminderLog(appointment.metadata) })
    if (!stage) continue
    // A second worker (or an overlapping sweep) must not send it twice.
    const claimed = await redis.set(`booking_customer_reminder:${appointment.id}:${stage}`, '1', 'EX', 2 * 86_400, 'NX')
    if (claimed !== 'OK') continue
    try {
      const conversation = await resolveConversation(appointment)
      const result = await sendCustomerNotice(
        conversation,
        (lang) => composeBookingReminder({
          stage,
          lang,
          serviceName: appointment.service.name,
          startsAt: appointment.startsAt,
          timezone: appointment.timezone,
          location: appointment.service.location,
          now,
        }),
        { bookingReminder: stage, appointmentId: appointment.id },
        now,
      )
      await record(appointment.id, appointment.metadata, stage, {
        status: result,
        at: now.toISOString(),
        ...(conversation ? { channel: conversation.channel } : {}),
      })
      if (result === 'sent' || result === 'stored') sent++
      else skipped++
    } catch (error) {
      captureError('bookings:customer-reminder', error, { workspaceId: appointment.workspaceId, metadata: { appointmentId: appointment.id, stage } })
    }
  }
  return { sent, skipped }
}
