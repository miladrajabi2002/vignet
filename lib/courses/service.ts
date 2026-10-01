/**
 * Courses & enrollment. A course has a seat limit and a schedule of
 * sessions; one enrollment covers every session. Seats are PENDING +
 * CONFIRMED enrollments. Past the limit, new sign-ups join the waitlist
 * (when enabled), and the first in line is promoted — and told in their own
 * conversation — as soon as a seat frees up.
 *
 * Enrollment runs under a per-course advisory lock, so two people can never
 * both take the last seat.
 */
import type { CourseStatus, EnrollmentStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { notifyWorkspace } from '@/lib/notifications/create'
import { captureError } from '@/lib/errors/capture'
import { localDateTimeToUtc } from '@/lib/bookings/time'
import { findNoticeTarget, latestContactConversation, sendCustomerNotice } from '@/lib/conversations/customer-notice'
import type { CourseInput, CourseSessionInput, EnrollmentInput } from '@/lib/courses/validation'
import {
  assertWorkspaceResourceCapacity,
  getWorkspaceResourceLimit,
  WorkspaceResourceLimitError,
} from '@/lib/billing/entitlements'

export const SEAT_STATUSES: readonly EnrollmentStatus[] = ['PENDING', 'CONFIRMED']
export const ACTIVE_STATUSES: readonly EnrollmentStatus[] = ['PENDING', 'CONFIRMED', 'WAITLISTED']

export class CourseError extends Error {
  constructor(public readonly code:
    | 'NOT_FOUND'
    | 'NOT_OPEN'
    | 'DEADLINE_PASSED'
    | 'FULL'
    | 'CONTACT_NOT_FOUND'
    | 'CUSTOMER_LIMIT'
    | 'HAS_ACTIVE_ENROLLMENTS'
    | 'INVALID_SESSIONS') {
    super(code)
  }
}

export interface SeatSummary {
  capacity: number
  taken: number
  waitlisted: number
  left: number
}

export function seatSummary(capacity: number, counts: Partial<Record<EnrollmentStatus, number>>): SeatSummary {
  const taken = (counts.PENDING ?? 0) + (counts.CONFIRMED ?? 0)
  return { capacity, taken, waitlisted: counts.WAITLISTED ?? 0, left: Math.max(0, capacity - taken) }
}

/** Status a new sign-up gets, or null when it cannot be taken at all. */
export function placementFor(params: {
  seatsLeft: number
  waitlistEnabled: boolean
  requested?: 'PENDING' | 'CONFIRMED'
}): EnrollmentStatus | null {
  if (params.seatsLeft > 0) return params.requested ?? 'PENDING'
  return params.waitlistEnabled ? 'WAITLISTED' : null
}

/** Whether sign-ups are still accepted right now. */
export function enrollmentOpen(course: { status: CourseStatus; enrollmentDeadline: Date | null; firstSessionAt: Date | null }, now = new Date()): 'open' | 'not_open' | 'deadline' {
  if (course.status !== 'PUBLISHED') return 'not_open'
  const closesAt = course.enrollmentDeadline ?? course.firstSessionAt
  if (closesAt && closesAt.getTime() <= now.getTime()) return 'deadline'
  return 'open'
}

function sessionRows(timezone: string, sessions: readonly CourseSessionInput[]) {
  const rows = sessions.map((session) => ({
    title: session.title?.trim() || null,
    startsAt: localDateTimeToUtc(session.localDate, session.startMinute, timezone),
    endsAt: localDateTimeToUtc(session.localDate, session.endMinute, timezone),
  }))
  rows.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  return rows.map((row, position) => ({ ...row, position }))
}

function newSlug() {
  return `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

const courseInclude = {
  sessions: { orderBy: { startsAt: 'asc' } },
} satisfies Prisma.CourseInclude

async function countsByCourse(courseIds: string[]) {
  if (!courseIds.length) return new Map<string, Partial<Record<EnrollmentStatus, number>>>()
  const rows = await prisma.courseEnrollment.groupBy({
    by: ['courseId', 'status'],
    where: { courseId: { in: courseIds } },
    _count: { _all: true },
  })
  const map = new Map<string, Partial<Record<EnrollmentStatus, number>>>()
  for (const row of rows) {
    const entry = map.get(row.courseId) ?? {}
    entry[row.status] = row._count._all
    map.set(row.courseId, entry)
  }
  return map
}

export async function listCourses(workspaceId: string, opts: { statuses?: CourseStatus[] } = {}) {
  const courses = await prisma.course.findMany({
    where: { workspaceId, ...(opts.statuses ? { status: { in: opts.statuses } } : {}) },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: courseInclude,
  })
  const counts = await countsByCourse(courses.map((course) => course.id))
  return courses.map((course) => ({ ...course, seats: seatSummary(course.capacity, counts.get(course.id) ?? {}) }))
}

export async function getCourse(workspaceId: string, courseId: string) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, workspaceId },
    include: {
      ...courseInclude,
      enrollments: { orderBy: [{ createdAt: 'asc' }] },
    },
  })
  if (!course) return null
  const counts: Partial<Record<EnrollmentStatus, number>> = {}
  for (const enrollment of course.enrollments) counts[enrollment.status] = (counts[enrollment.status] ?? 0) + 1
  return { ...course, seats: seatSummary(course.capacity, counts) }
}

export async function createCourse(workspaceId: string, input: CourseInput) {
  return prisma.course.create({
    data: {
      workspaceId,
      slug: newSlug(),
      title: input.title,
      description: input.description ?? null,
      instructor: input.instructor ?? null,
      format: input.format,
      location: input.location ?? null,
      price: input.price ?? null,
      capacity: input.capacity,
      status: input.status,
      waitlistEnabled: input.waitlistEnabled,
      enrollmentDeadline: input.enrollmentDeadline ? new Date(input.enrollmentDeadline) : null,
      timezone: input.timezone,
      sessions: { create: sessionRows(input.timezone, input.sessions) },
    },
    include: courseInclude,
  })
}

export async function updateCourse(workspaceId: string, courseId: string, input: Partial<CourseInput>) {
  const existing = await prisma.course.findFirst({ where: { id: courseId, workspaceId }, select: { id: true, timezone: true, capacity: true } })
  if (!existing) throw new CourseError('NOT_FOUND')
  const timezone = input.timezone ?? existing.timezone
  const updated = await prisma.$transaction(async (tx) => {
    if (input.sessions) {
      await tx.courseSession.deleteMany({ where: { courseId } })
      if (input.sessions.length) {
        await tx.courseSession.createMany({ data: sessionRows(timezone, input.sessions).map((row) => ({ ...row, courseId })) })
      }
    }
    return tx.course.update({
      where: { id: courseId },
      data: {
        title: input.title,
        description: input.description,
        instructor: input.instructor,
        format: input.format,
        location: input.location,
        price: input.price,
        capacity: input.capacity,
        status: input.status,
        waitlistEnabled: input.waitlistEnabled,
        enrollmentDeadline: input.enrollmentDeadline === undefined ? undefined : input.enrollmentDeadline ? new Date(input.enrollmentDeadline) : null,
        timezone: input.timezone,
      },
      include: courseInclude,
    })
  })
  // More seats → the waitlist moves up.
  if (input.capacity !== undefined && input.capacity > existing.capacity) await promoteWaitlist(workspaceId, courseId)
  return updated
}

/** What deleting a course would remove; active sign-ups block it. */
export async function courseDeleteImpact(workspaceId: string, courseId: string) {
  const course = await prisma.course.findFirst({ where: { id: courseId, workspaceId }, select: { id: true } })
  if (!course) return null
  const [active, total] = await Promise.all([
    prisma.courseEnrollment.count({ where: { courseId, status: { in: [...ACTIVE_STATUSES] } } }),
    prisma.courseEnrollment.count({ where: { courseId } }),
  ])
  return { active, total }
}

export async function deleteCourse(workspaceId: string, courseId: string) {
  const impact = await courseDeleteImpact(workspaceId, courseId)
  if (!impact) throw new CourseError('NOT_FOUND')
  if (impact.active > 0) return { ok: false as const, active: impact.active }
  await prisma.course.delete({ where: { id: courseId } })
  return { ok: true as const }
}

type EnrollOptions = {
  source: 'dashboard' | 'agent'
  conversationId?: string | null
  idempotencyKey?: string | null
  /** Agent sign-ups only land in a published, still-open course. */
  requireOpen?: boolean
}

export interface EnrollResult {
  enrollment: { id: string; status: EnrollmentStatus; name: string; phone: string | null; createdAt: Date }
  created: boolean
  seats: SeatSummary
  course: { id: string; title: string; price: number | null }
  waitlistPosition: number | null
}

export async function enrollInCourse(workspaceId: string, courseId: string, input: EnrollmentInput, options: EnrollOptions): Promise<EnrollResult> {
  const { limit: customerLimit } = await getWorkspaceResourceLimit(workspaceId, 'customers')
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`course:${courseId}`}))`
    const course = await tx.course.findFirst({
      where: { id: courseId, workspaceId },
      select: {
        id: true, title: true, price: true, capacity: true, status: true, waitlistEnabled: true, enrollmentDeadline: true,
        sessions: { orderBy: { startsAt: 'asc' }, take: 1, select: { startsAt: true } },
      },
    })
    if (!course) throw new CourseError('NOT_FOUND')
    if (options.requireOpen) {
      const open = enrollmentOpen({ status: course.status, enrollmentDeadline: course.enrollmentDeadline, firstSessionAt: course.sessions[0]?.startsAt ?? null })
      if (open === 'not_open') throw new CourseError('NOT_OPEN')
      if (open === 'deadline') throw new CourseError('DEADLINE_PASSED')
    } else if (course.status === 'ARCHIVED') {
      throw new CourseError('NOT_OPEN')
    }

    if (options.idempotencyKey) {
      const replay = await tx.courseEnrollment.findFirst({ where: { workspaceId, idempotencyKey: options.idempotencyKey } })
      if (replay) return { course, enrollment: replay, created: false }
    }

    let contactId = input.contactId ?? null
    if (contactId) {
      const owned = await tx.contact.findFirst({ where: { id: contactId, workspaceId }, select: { id: true } })
      if (!owned) throw new CourseError('CONTACT_NOT_FOUND')
    } else if (input.phone) {
      const existing = await tx.contact.findFirst({ where: { workspaceId, phone: input.phone }, orderBy: { createdAt: 'asc' }, select: { id: true } })
      if (existing) {
        contactId = existing.id
      } else {
        try {
          await assertWorkspaceResourceCapacity(tx, workspaceId, 'customers', customerLimit)
        } catch (error) {
          if (error instanceof WorkspaceResourceLimitError) throw new CourseError('CUSTOMER_LIMIT')
          throw error
        }
        contactId = (await tx.contact.create({ data: { workspaceId, name: input.name, phone: input.phone, tags: ['course'] }, select: { id: true } })).id
      }
    }

    // Already signed up (same person, still active): hand back that record.
    const duplicate = contactId || input.phone
      ? await tx.courseEnrollment.findFirst({
          where: {
            courseId,
            status: { in: [...ACTIVE_STATUSES] },
            OR: [
              ...(contactId ? [{ contactId }] : []),
              ...(input.phone ? [{ phone: input.phone }] : []),
            ],
          },
        })
      : null
    if (duplicate) return { course, enrollment: duplicate, created: false }

    const taken = await tx.courseEnrollment.count({ where: { courseId, status: { in: [...SEAT_STATUSES] } } })
    const status = placementFor({ seatsLeft: course.capacity - taken, waitlistEnabled: course.waitlistEnabled, requested: input.status })
    if (!status) throw new CourseError('FULL')

    const enrollment = await tx.courseEnrollment.create({
      data: {
        workspaceId,
        courseId,
        contactId,
        conversationId: options.conversationId ?? null,
        name: input.name,
        phone: input.phone ?? null,
        note: input.note ?? null,
        status,
        source: options.source,
        idempotencyKey: options.idempotencyKey ?? null,
      },
    })
    return { course, enrollment, created: true }
  })

  const counts = await countsByCourse([courseId])
  const seats = seatSummary(result.course.capacity, counts.get(courseId) ?? {})
  const waitlistPosition = result.enrollment.status === 'WAITLISTED'
    ? await prisma.courseEnrollment.count({ where: { courseId, status: 'WAITLISTED', createdAt: { lte: result.enrollment.createdAt } } })
    : null

  if (result.created) {
    const waitlisted = result.enrollment.status === 'WAITLISTED'
    await notifyWorkspace({
      workspaceId,
      type: 'APPOINTMENT',
      title: waitlisted ? `فهرست انتظار «${result.course.title}»` : `ثبت‌نام تازه در «${result.course.title}»`,
      body: `${result.enrollment.name}${result.enrollment.phone ? ` · ${result.enrollment.phone}` : ''} · ${waitlisted ? `نفر ${waitlistPosition?.toLocaleString('fa-IR')} در انتظار` : `${seats.left.toLocaleString('fa-IR')} جای خالی مانده`}`,
      link: `/courses?course=${courseId}`,
      operatorTelegram: 'bookings',
    })
  }
  return {
    enrollment: result.enrollment,
    created: result.created,
    seats,
    course: { id: result.course.id, title: result.course.title, price: result.course.price },
    waitlistPosition,
  }
}

/**
 * Change an enrollment's status. Freeing a seat (cancel) promotes the
 * waitlist; confirming from the waitlist is refused when no seat is free.
 */
export async function setEnrollmentStatus(workspaceId: string, enrollmentId: string, status: EnrollmentStatus) {
  const enrollment = await prisma.courseEnrollment.findFirst({ where: { id: enrollmentId, workspaceId }, select: { id: true, courseId: true, status: true } })
  if (!enrollment) throw new CourseError('NOT_FOUND')
  const updated = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`course:${enrollment.courseId}`}))`
    if (!SEAT_STATUSES.includes(enrollment.status) && SEAT_STATUSES.includes(status)) {
      const course = await tx.course.findUniqueOrThrow({ where: { id: enrollment.courseId }, select: { capacity: true } })
      const taken = await tx.courseEnrollment.count({ where: { courseId: enrollment.courseId, status: { in: [...SEAT_STATUSES] } } })
      if (taken >= course.capacity) throw new CourseError('FULL')
    }
    return tx.courseEnrollment.update({
      where: { id: enrollment.id },
      data: { status, cancelledAt: status === 'CANCELLED' ? new Date() : null },
    })
  })
  if (SEAT_STATUSES.includes(enrollment.status) && !SEAT_STATUSES.includes(status)) {
    await promoteWaitlist(workspaceId, enrollment.courseId)
  }
  return updated
}

export function composeSeatFreedNotice(lang: 'fa' | 'en', title: string): string {
  return lang === 'fa'
    ? `خبر خوب: در دوره «${title}» جا باز شد و ثبت‌نام شما از فهرست انتظار قطعی شد ✅\nاگر دیگر نمی‌خواهید شرکت کنید، همین‌جا بگویید تا جا را به نفر بعدی بدهیم.`
    : `Good news: a seat opened in “${title}” and you have moved off the waitlist ✅\nIf you can no longer attend, just reply here and we’ll offer the seat to the next person.`
}

/** Move people up from the waitlist into free seats, oldest first. */
export async function promoteWaitlist(workspaceId: string, courseId: string): Promise<number> {
  const promoted = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`course:${courseId}`}))`
    const course = await tx.course.findFirst({ where: { id: courseId, workspaceId }, select: { capacity: true, title: true, status: true } })
    if (!course || course.status === 'ARCHIVED') return { course: null, rows: [] as Array<{ id: string; name: string; contactId: string | null; conversationId: string | null }> }
    const taken = await tx.courseEnrollment.count({ where: { courseId, status: { in: [...SEAT_STATUSES] } } })
    const free = course.capacity - taken
    if (free <= 0) return { course, rows: [] }
    const rows = await tx.courseEnrollment.findMany({
      where: { courseId, status: 'WAITLISTED' },
      orderBy: { createdAt: 'asc' },
      take: free,
      select: { id: true, name: true, contactId: true, conversationId: true },
    })
    if (rows.length) await tx.courseEnrollment.updateMany({ where: { id: { in: rows.map((row) => row.id) } }, data: { status: 'PENDING' } })
    return { course, rows }
  })
  if (!promoted.course || !promoted.rows.length) return 0
  for (const row of promoted.rows) {
    try {
      const target = (await findNoticeTarget(workspaceId, row.conversationId)) ?? (await latestContactConversation(workspaceId, row.contactId))
      await sendCustomerNotice(target, (lang) => composeSeatFreedNotice(lang, promoted.course!.title), { courseSeatFreed: courseId, enrollmentId: row.id })
    } catch (error) {
      captureError('courses:waitlist-notice', error, { workspaceId, metadata: { enrollmentId: row.id } })
    }
  }
  await notifyWorkspace({
    workspaceId,
    type: 'APPOINTMENT',
    title: `${promoted.rows.length.toLocaleString('fa-IR')} نفر از فهرست انتظار «${promoted.course.title}» جا گرفتند`,
    body: promoted.rows.map((row) => row.name).join('، '),
    link: `/courses?course=${courseId}`,
    operatorTelegram: 'bookings',
  })
  return promoted.rows.length
}

/** Upcoming or unfinished courses for the agent (published only). */
export async function listOpenCoursesForAgent(workspaceId: string) {
  const courses = await listCourses(workspaceId, { statuses: ['PUBLISHED', 'CLOSED'] })
  const now = Date.now()
  return courses.filter((course) => {
    const last = course.sessions[course.sessions.length - 1]
    return !last || last.endsAt.getTime() > now
  })
}

/** This customer's active enrollments (for "am I signed up?" and cancelling). */
export async function listCustomerEnrollments(workspaceId: string, scope: { contactId: string | null; conversationId: string }) {
  return prisma.courseEnrollment.findMany({
    where: {
      workspaceId,
      status: { in: [...ACTIVE_STATUSES] },
      OR: [
        { conversationId: scope.conversationId },
        ...(scope.contactId ? [{ contactId: scope.contactId }] : []),
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { course: { select: { id: true, title: true, sessions: { orderBy: { startsAt: 'asc' }, take: 1, select: { startsAt: true } } } } },
  })
}
