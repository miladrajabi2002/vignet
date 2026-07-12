import { z } from 'zod'
import { normalizePhone } from '@/lib/phone'
import { assertDateKey } from '@/lib/bookings/time'

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  try {
    assertDateKey(value)
    return true
  } catch {
    return false
  }
}, 'INVALID_DATE')

const timezoneSchema = z.string().min(1).max(80).refine((value) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date())
    return true
  } catch {
    return false
  }
}, 'INVALID_TIMEZONE')

export const availabilityRuleSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
  capacity: z.number().int().min(1).max(100).nullable().optional(),
  active: z.boolean().optional(),
}).refine((value) => value.endMinute > value.startMinute, {
  message: 'END_MUST_FOLLOW_START',
  path: ['endMinute'],
})

const weeklyRulesSchema = z.array(availabilityRuleSchema).max(28).superRefine((rules, ctx) => {
  for (let index = 0; index < rules.length; index++) {
    const current = rules[index]
    if (current.active === false) continue
    const overlaps = rules.slice(0, index).some(
      (previous) =>
        previous.active !== false &&
        previous.weekday === current.weekday &&
        previous.startMinute < current.endMinute &&
        previous.endMinute > current.startMinute,
    )
    if (overlaps) {
      ctx.addIssue({
        code: 'custom',
        message: 'OVERLAPPING_AVAILABILITY_RULES',
        path: [index],
      })
    }
  }
})

export const dateExceptionSchema = z.object({
  date: dateKeySchema,
  closed: z.boolean().default(true),
  startMinute: z.number().int().min(0).max(1439).nullable().optional(),
  endMinute: z.number().int().min(1).max(1440).nullable().optional(),
  capacity: z.number().int().min(1).max(100).nullable().optional(),
  note: z.string().trim().max(250).nullable().optional(),
}).superRefine((value, ctx) => {
  const hasStart = value.startMinute !== null && value.startMinute !== undefined
  const hasEnd = value.endMinute !== null && value.endMinute !== undefined
  if (hasStart !== hasEnd) {
    ctx.addIssue({ code: 'custom', message: 'START_AND_END_REQUIRED', path: ['endMinute'] })
  }
  if (hasStart && hasEnd && value.endMinute! <= value.startMinute!) {
    ctx.addIssue({ code: 'custom', message: 'END_MUST_FOLLOW_START', path: ['endMinute'] })
  }
})

export const serviceCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  durationMinutes: z.number().int().min(10).max(480).default(60),
  slotIntervalMinutes: z.number().int().min(5).max(240).default(30),
  bufferBeforeMinutes: z.number().int().min(0).max(180).default(0),
  bufferAfterMinutes: z.number().int().min(0).max(180).default(0),
  capacity: z.number().int().min(1).max(100).default(1),
  timezone: timezoneSchema.default('Asia/Tehran'),
  location: z.string().trim().max(250).optional(),
  weeklyRules: weeklyRulesSchema.default([]),
})

export const serviceUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  durationMinutes: z.number().int().min(10).max(480).optional(),
  slotIntervalMinutes: z.number().int().min(5).max(240).optional(),
  bufferBeforeMinutes: z.number().int().min(0).max(180).optional(),
  bufferAfterMinutes: z.number().int().min(0).max(180).optional(),
  capacity: z.number().int().min(1).max(100).optional(),
  timezone: timezoneSchema.optional(),
  location: z.string().trim().max(250).nullable().optional(),
  active: z.boolean().optional(),
  weeklyRules: weeklyRulesSchema.optional(),
  exception: dateExceptionSchema.optional(),
  removeExceptionDate: dateKeySchema.optional(),
})

export const appointmentCreateSchema = z.object({
  serviceId: z.string().min(1).max(80),
  localDate: dateKeySchema,
  startMinute: z.number().int().min(0).max(1439),
  partySize: z.number().int().min(1).max(100).default(1),
  contactId: z.string().min(1).max(80).optional(),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().max(40).optional().transform((value, ctx) => {
    if (!value) return undefined
    const normalized = normalizePhone(value)
    if (!normalized) {
      ctx.addIssue({ code: 'custom', message: 'INVALID_PHONE' })
      return z.NEVER
    }
    return normalized
  }),
  notes: z.string().trim().max(2000).optional(),
  source: z.enum(['dashboard', 'agent', 'api']).default('dashboard'),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
})

export const appointmentUpdateSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']),
  cancellationReason: z.string().trim().max(500).optional(),
}).superRefine((value, ctx) => {
  if (value.status === 'CANCELLED' && !value.cancellationReason?.trim()) {
    ctx.addIssue({
      code: 'custom',
      message: 'CANCELLATION_REASON_REQUIRED',
      path: ['cancellationReason'],
    })
  }
})

export const appointmentListQuerySchema = z.object({
  date: dateKeySchema.optional(),
  serviceId: z.string().min(1).max(80).optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']).optional(),
})

export const slotQuerySchema = z.object({
  serviceId: z.string().min(1).max(80),
  date: dateKeySchema,
  partySize: z.coerce.number().int().min(1).max(100).default(1),
})

export type AppointmentCreateInput = z.infer<typeof appointmentCreateSchema>
