import { z } from 'zod'
import { phoneSchema } from '@/lib/phone'
import {
  CourseError,
  enrollInCourse,
  enrollmentOpen,
  listCustomerEnrollments,
  listOpenCoursesForAgent,
  setEnrollmentStatus,
} from '@/lib/courses/service'

/** Provider-neutral OpenAI-compatible tool declarations. */
export const COURSE_AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'list_courses',
      description: 'Courses, classes and workshops with price (Toman, null = not published), format, location, instructor, session dates, seats left, waitlist and whether sign-up is open.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'enroll_in_course',
      description: 'Sign the customer up for one course only after they confirm the course, their name and mobile. When the course is full and has a waitlist, this puts them on it.',
      parameters: {
        type: 'object',
        properties: {
          courseId: { type: 'string' },
          customerName: { type: 'string' },
          customerPhone: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['courseId', 'customerName', 'customerPhone'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_my_enrollments',
      description: 'This customer’s active course sign-ups and waitlist places (needed before cancelling one).',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'cancel_enrollment',
      description: 'Withdraw one of this customer’s sign-ups only after they explicitly confirm.',
      parameters: {
        type: 'object',
        properties: {
          enrollmentId: { type: 'string' },
          confirmedByCustomer: { type: 'boolean', const: true },
        },
        required: ['enrollmentId', 'confirmedByCustomer'],
        additionalProperties: false,
      },
    },
  },
]

const enrollArgs = z.object({
  courseId: z.string().min(1),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: phoneSchema,
  note: z.string().trim().max(500).optional(),
})
const cancelArgs = z.object({ enrollmentId: z.string().min(1), confirmedByCustomer: z.literal(true) })

function localTime(date: Date, timezone: string, isFa: boolean) {
  return new Intl.DateTimeFormat(isFa ? 'fa-IR-u-ca-persian' : 'en-US', {
    timeZone: timezone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

export function courseToolInstruction(isFa: boolean): string {
  return isFa
    ? '=== ثبت‌نام دوره ===\nبرای معرفی دوره‌ها و ثبت‌نام فقط از ابزارها استفاده کن: list_courses برای اطلاعات واقعی (قیمت، تاریخ جلسات، ظرفیت باقی‌مانده)، enroll_in_course فقط بعد از اینکه مشتری دوره، نام و شماره موبایل را صریحاً تأیید کرد. قبل از ثبت یک خلاصهٔ کوتاه بگو و تأیید بگیر. اگر دوره پر است و فهرست انتظار دارد، صادقانه بگو و بپرس می‌خواهد در فهرست انتظار باشد. هرگز بدون نتیجهٔ موفق ابزار نگو «ثبت‌نام شد». قیمت یا تاریخی را که در ابزار نیست حدس نزن. پرداخت را همکار هماهنگ می‌کند؛ لینک پرداخت نساز. برای انصراف اول list_my_enrollments و بعد از تأیید صریح cancel_enrollment.'
    : '=== Course enrollment ===\nUse only the tools for course facts and sign-ups: list_courses for real data (price, session dates, seats left); enroll_in_course only after the customer explicitly confirms the course, their name and mobile. Summarise briefly and get a yes before enrolling. If a course is full but has a waitlist, say so honestly and ask whether to join it. Never say someone is enrolled without a successful tool result. Never guess a price or date the tools do not give. A colleague arranges payment; never create payment links. To withdraw: list_my_enrollments, then cancel_enrollment after an explicit yes.'
}

export async function executeCourseAgentTool(params: {
  workspaceId: string
  contactId?: string | null
  conversationId: string
  name: string
  arguments: Record<string, unknown>
  isFa: boolean
  idempotencyKey?: string
}): Promise<Record<string, unknown>> {
  const { workspaceId, isFa } = params
  if (params.name === 'list_courses') {
    const courses = await listOpenCoursesForAgent(workspaceId)
    return {
      ok: true,
      courses: courses.map((course) => {
        const open = enrollmentOpen({ status: course.status, enrollmentDeadline: course.enrollmentDeadline, firstSessionAt: course.sessions[0]?.startsAt ?? null })
        return {
          id: course.id,
          title: course.title,
          description: course.description?.slice(0, 600) ?? null,
          instructor: course.instructor,
          format: course.format,
          location: course.location,
          priceToman: course.price,
          seatsLeft: course.seats.left,
          capacity: course.capacity,
          waitlist: course.waitlistEnabled ? course.seats.waitlisted : null,
          signUp: open === 'open' ? (course.seats.left > 0 ? 'open' : course.waitlistEnabled ? 'waitlist_only' : 'full') : open === 'deadline' ? 'closed_deadline_passed' : 'closed',
          enrollmentDeadline: course.enrollmentDeadline ? localTime(course.enrollmentDeadline, course.timezone, isFa) : null,
          sessionCount: course.sessions.length,
          sessions: course.sessions.slice(0, 8).map((session) => ({
            title: session.title,
            starts: localTime(session.startsAt, course.timezone, isFa),
            minutes: Math.round((session.endsAt.getTime() - session.startsAt.getTime()) / 60_000),
          })),
        }
      }),
    }
  }

  if (params.name === 'enroll_in_course') {
    const args = enrollArgs.parse(params.arguments)
    try {
      const result = await enrollInCourse(workspaceId, args.courseId, {
        name: args.customerName,
        phone: args.customerPhone,
        note: args.note ?? null,
        contactId: params.contactId ?? null,
      }, {
        source: 'agent',
        conversationId: params.conversationId,
        idempotencyKey: params.idempotencyKey ?? null,
        requireOpen: true,
      })
      return {
        ok: true,
        created: result.created,
        alreadyEnrolled: !result.created,
        status: result.enrollment.status,
        waitlistPosition: result.waitlistPosition,
        course: result.course.title,
        seatsLeft: result.seats.left,
        note: result.enrollment.status === 'WAITLISTED'
          ? 'On the waitlist: they are told here automatically when a seat opens.'
          : 'Seat held; the business confirms it (and arranges payment if any).',
      }
    } catch (error) {
      if (error instanceof CourseError) return { ok: false, error: error.code }
      throw error
    }
  }

  if (params.name === 'list_my_enrollments') {
    const rows = await listCustomerEnrollments(workspaceId, { contactId: params.contactId ?? null, conversationId: params.conversationId })
    return {
      ok: true,
      enrollments: rows.map((row) => ({
        id: row.id,
        course: row.course.title,
        status: row.status,
        firstSession: row.course.sessions[0] ? localTime(row.course.sessions[0].startsAt, 'Asia/Tehran', isFa) : null,
      })),
    }
  }

  if (params.name === 'cancel_enrollment') {
    const args = cancelArgs.parse(params.arguments)
    const mine = await listCustomerEnrollments(workspaceId, { contactId: params.contactId ?? null, conversationId: params.conversationId })
    if (!mine.some((row) => row.id === args.enrollmentId)) return { ok: false, error: 'NOT_YOUR_ENROLLMENT' }
    await setEnrollmentStatus(workspaceId, args.enrollmentId, 'CANCELLED')
    return { ok: true, cancelled: true }
  }

  return { ok: false, error: 'UNKNOWN_TOOL' }
}
