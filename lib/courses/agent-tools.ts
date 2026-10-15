import { z } from 'zod'
import { phoneSchema } from '@/lib/phone'
import { recordConfirmedCustomer } from '@/lib/crm/confirmed-customer'
import { captureError } from '@/lib/errors/capture'
import {
  CourseError,
  enrollInCourse,
  enrollmentOpen,
  listCustomerEnrollments,
  listOpenCoursesForAgent,
  setEnrollmentStatus,
} from '@/lib/courses/service'
import { prisma } from '@/lib/prisma'
import { prepayAmount } from '@/lib/payments/card/prepay'
import { CARD_PAY_ATTACHMENT, coursePrepayDue, issueCoursePrepay, type PrepayIssued } from '@/lib/payments/card/prepay-service'
import { cancelOpenCardPayments } from '@/lib/payments/card/service'

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
    ? '=== ثبت‌نام دوره ===\nبرای معرفی دوره‌ها و ثبت‌نام فقط از ابزارها استفاده کن: list_courses برای اطلاعات واقعی (قیمت، تاریخ جلسات، ظرفیت باقی‌مانده)، enroll_in_course فقط بعد از اینکه مشتری دوره، نام و شماره موبایل را صریحاً تأیید کرد. قبل از ثبت یک خلاصهٔ کوتاه بگو و تأیید بگیر. اگر دوره پر است و فهرست انتظار دارد، صادقانه بگو و بپرس می‌خواهد در فهرست انتظار باشد. هرگز بدون نتیجهٔ موفق ابزار نگو «ثبت‌نام شد». قیمت یا تاریخی را که در ابزار نیست حدس نزن. پرداخت را همکار هماهنگ می‌کند؛ لینک پرداخت نساز. اگر دوره advancePayment دارد، قبل از تأیید بگو برای قطعی شدن جا این مبلغ لازم است؛ اگر خروجی enroll_in_course وضعیت AWAITING_PAYMENT داشت، بگو جا تا پایان مهلت نگه داشته شده و با رسیدن واریز خودکار قطعی می‌شود. کارت و مبلغ دقیق خودکار زیر پیامت می‌آید؛ شماره کارت یا مبلغ را خودت ننویس. برای انصراف اول list_my_enrollments و بعد از تأیید صریح cancel_enrollment.'
    : '=== Course enrollment ===\nUse only the tools for course facts and sign-ups: list_courses for real data (price, session dates, seats left); enroll_in_course only after the customer explicitly confirms the course, their name and mobile. Summarise briefly and get a yes before enrolling. If a course is full but has a waitlist, say so honestly and ask whether to join it. Never say someone is enrolled without a successful tool result. Never guess a price or date the tools do not give. A colleague arranges payment; never create payment links. If a course has advancePayment, say before confirming that this amount secures the seat; when enroll_in_course returns status AWAITING_PAYMENT, say the seat is held until the deadline and confirmed automatically once the transfer arrives. The card and exact amount appear under your message by themselves; never write a card number or amount yourself. To withdraw: list_my_enrollments, then cancel_enrollment after an explicit yes.'
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
          advancePayment: prepayAmount(course.prepayMode, course.prepayValue, course.price),
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
    // Never blocks a sign-up: any failure here enrolls the usual way.
    const deposit = await (async () => {
      const priced = await prisma.course.findFirst({ where: { id: args.courseId, workspaceId }, select: { prepayMode: true, prepayValue: true, price: true } })
      return priced ? coursePrepayDue(workspaceId, priced) : null
    })().catch(() => null)
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
      // The name and phone the customer enrolled with go to their CRM
      // profile, and a chat that had no profile yet is attached to it.
      await recordConfirmedCustomer({
        workspaceId,
        conversationId: params.conversationId,
        contactId: params.contactId ?? null,
        name: args.customerName,
        phone: args.customerPhone,
        source: 'course',
      }).catch((error) => captureError('courses:customer-profile-sync', error, { workspaceId }))
      const base = {
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
      if (deposit != null && result.enrollment.status === 'PENDING') {
        const card = await courseDepositCard({
          workspaceId,
          enrollmentId: result.enrollment.id,
          amount: deposit,
          description: result.course.title,
          conversationId: params.conversationId,
          customerName: args.customerName,
          customerPhone: args.customerPhone,
          lang: isFa ? 'fa' : 'en',
        })
        if (card) {
          return {
            ...base,
            status: 'AWAITING_PAYMENT',
            note: 'Seat held until the deadline; confirmed automatically once the transfer arrives.',
            advancePayment: { amount: deposit, minutesToPay: card.minutes, shownAutomatically: true },
            [CARD_PAY_ATTACHMENT]: card.view,
          }
        }
      }
      return base
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
    await cancelOpenCardPayments({ enrollmentId: args.enrollmentId }).catch(() => 0)
    return { ok: true, cancelled: true }
  }

  return { ok: false, error: 'UNKNOWN_TOOL' }
}

/** The seat's open deposit card when the customer repeats the sign-up, else a new one. */
async function courseDepositCard(params: Parameters<typeof issueCoursePrepay>[0]): Promise<PrepayIssued | null> {
  const open = await prisma.cardPayment.findFirst({
    where: { enrollmentId: params.enrollmentId, workspaceId: params.workspaceId, status: { in: ['PENDING', 'CLAIMED'] } },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })
  if (open) {
    const { loadCardPayView } = await import('@/lib/payments/card/service')
    const view = await loadCardPayView(open.id, params.lang)
    if (view) return { view, amount: params.amount, minutes: Math.max(1, Math.ceil((new Date(view.expiresAt).getTime() - Date.now()) / 60_000)) }
  }
  return issueCoursePrepay(params)
}
