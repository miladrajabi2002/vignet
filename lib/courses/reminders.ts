/**
 * Course session reminders: a day before each session, everyone holding a
 * seat hears it in their own conversation (the one they enrolled in, else
 * their latest). Same switch as booking reminders
 * (Workspace.bookingRemindersEnabled) and the same 24-hour messaging-window
 * rule for Instagram and WhatsApp.
 */
import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'
import { captureError } from '@/lib/errors/capture'
import { findNoticeTarget, latestContactConversation, sendCustomerNotice } from '@/lib/conversations/customer-notice'
import { dateKeyInTimeZone } from '@/lib/bookings/time'

const HOUR_MS = 3_600_000

export function composeSessionReminder(params: {
  lang: 'fa' | 'en'
  courseTitle: string
  sessionTitle: string | null
  sessionNumber: number
  sessionCount: number
  startsAt: Date
  timezone: string
  location: string | null
  now: Date
}): string {
  const fa = params.lang === 'fa'
  const time = new Intl.DateTimeFormat(fa ? 'fa-IR' : 'en-US', { timeZone: params.timezone, hour: '2-digit', minute: '2-digit', hour12: !fa }).format(params.startsAt)
  const tomorrow = dateKeyInTimeZone(new Date(params.now.getTime() + 24 * HOUR_MS), params.timezone)
  const today = dateKeyInTimeZone(params.now, params.timezone)
  const day = dateKeyInTimeZone(params.startsAt, params.timezone)
  const dayLabel = day === today ? (fa ? 'امروز' : 'today') : day === tomorrow ? (fa ? 'فردا' : 'tomorrow') : ''
  const which = params.sessionCount > 1
    ? (fa ? `جلسه ${params.sessionNumber.toLocaleString('fa-IR')} از ${params.sessionCount.toLocaleString('fa-IR')}` : `session ${params.sessionNumber} of ${params.sessionCount}`)
    : (fa ? 'جلسه' : 'session')
  const place = params.location?.trim()
  return fa
    ? `یادآوری کلاس: ${dayLabel ? `${dayLabel} ` : ''}ساعت ${time} ${which} دوره «${params.courseTitle}»${params.sessionTitle ? ` (${params.sessionTitle})` : ''} است${place ? `، در ${place}` : ''}.`
    : `Class reminder: ${which} of “${params.courseTitle}”${params.sessionTitle ? ` (${params.sessionTitle})` : ''} is ${dayLabel ? `${dayLabel} ` : ''}at ${time}${place ? `, at ${place}` : ''}.`
}

export async function sweepCourseReminders(now = new Date()): Promise<{ sent: number }> {
  // Sessions starting 3–24 h from now: late enough to be "tomorrow",
  // early enough to be useful. Each (enrollment, session) pair sends once.
  const sessions = await prisma.courseSession.findMany({
    where: {
      startsAt: { gt: new Date(now.getTime() + 3 * HOUR_MS), lte: new Date(now.getTime() + 24 * HOUR_MS) },
      course: { status: { in: ['PUBLISHED', 'CLOSED'] }, workspace: { bookingRemindersEnabled: true } },
    },
    take: 200,
    select: {
      id: true,
      title: true,
      startsAt: true,
      position: true,
      course: {
        select: {
          id: true,
          workspaceId: true,
          title: true,
          location: true,
          timezone: true,
          _count: { select: { sessions: true } },
          enrollments: {
            where: { status: { in: ['PENDING', 'CONFIRMED'] } },
            select: { id: true, contactId: true, conversationId: true, createdAt: true },
          },
        },
      },
    },
  })
  const redis = getRedis()
  let sent = 0
  for (const session of sessions) {
    const course = session.course
    for (const enrollment of course.enrollments) {
      // Signed up within the last few hours: they know already.
      if (session.startsAt.getTime() - enrollment.createdAt.getTime() < 30 * HOUR_MS) continue
      const claimed = await redis.set(`course_session_reminder:${enrollment.id}:${session.id}`, '1', 'EX', 3 * 86_400, 'NX')
      if (claimed !== 'OK') continue
      try {
        const target = (await findNoticeTarget(course.workspaceId, enrollment.conversationId))
          ?? (await latestContactConversation(course.workspaceId, enrollment.contactId))
        const result = await sendCustomerNotice(target, (lang) => composeSessionReminder({
          lang,
          courseTitle: course.title,
          sessionTitle: session.title,
          sessionNumber: session.position + 1,
          sessionCount: course._count.sessions,
          startsAt: session.startsAt,
          timezone: course.timezone,
          location: course.location,
          now,
        }), { courseSessionReminder: session.id, enrollmentId: enrollment.id }, now)
        if (result === 'sent' || result === 'stored') sent++
      } catch (error) {
        captureError('courses:session-reminder', error, { workspaceId: course.workspaceId, metadata: { enrollmentId: enrollment.id } })
      }
    }
  }
  return { sent }
}
