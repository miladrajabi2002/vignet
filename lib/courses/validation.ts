import { z } from 'zod'
import { phoneSchema } from '@/lib/phone'
import { assertDateKey } from '@/lib/bookings/time'

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  try {
    assertDateKey(value)
    return true
  } catch {
    return false
  }
}, 'INVALID_DATE')

/** One session in the course's local time. */
export const courseSessionInputSchema = z.object({
  localDate: dateKeySchema,
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1439),
  title: z.string().trim().max(120).nullable().optional(),
}).refine((value) => value.endMinute > value.startMinute, { message: 'END_MUST_FOLLOW_START', path: ['endMinute'] })

export const COURSE_STATUSES = ['DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED'] as const
export const COURSE_FORMATS = ['IN_PERSON', 'ONLINE', 'HYBRID'] as const
export const ENROLLMENT_STATUSES = ['PENDING', 'CONFIRMED', 'WAITLISTED', 'CANCELLED'] as const

export const courseInputSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(4000).nullable().optional(),
  instructor: z.string().trim().max(120).nullable().optional(),
  format: z.enum(COURSE_FORMATS).default('IN_PERSON'),
  location: z.string().trim().max(200).nullable().optional(),
  // Toman; null = not published.
  price: z.number().nonnegative().max(10_000_000_000).nullable().optional(),
  capacity: z.number().int().min(1).max(10_000),
  status: z.enum(COURSE_STATUSES).default('DRAFT'),
  waitlistEnabled: z.boolean().default(true),
  enrollmentDeadline: z.string().datetime().nullable().optional(),
  timezone: z.string().min(1).max(80).default('Asia/Tehran'),
  sessions: z.array(courseSessionInputSchema).max(200).default([]),
})

export const courseUpdateSchema = courseInputSchema.partial()

export const enrollmentInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: phoneSchema.nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  contactId: z.string().min(1).max(64).nullable().optional(),
  /** Staff may place someone directly as confirmed. */
  status: z.enum(['PENDING', 'CONFIRMED']).optional(),
})

export type CourseInput = z.infer<typeof courseInputSchema>
export type CourseSessionInput = z.infer<typeof courseSessionInputSchema>
export type EnrollmentInput = z.infer<typeof enrollmentInputSchema>
