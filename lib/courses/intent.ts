import type { ChatMessage } from '@/lib/ai/openrouter'

// Courses, classes and workshops, and signing up for one. "جلسه" (session)
// is left to bookings: on its own it usually means a one-off appointment.
const COURSE_INTENT = /(دوره|کلاس|کارگاه|ورکشاپ|ترم|سرفصل|ظرفیت|ثبت[\s‌]*نام|انصراف|course|class|workshop|cohort|enrol|enroll|sign[\s-]?up|waitlist)/i

export function hasCourseIntent(messages: ChatMessage[]): boolean {
  return messages
    .slice(-8)
    .some((message) => typeof message.content === 'string' && COURSE_INTENT.test(message.content))
}
