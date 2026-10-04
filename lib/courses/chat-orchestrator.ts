import { prisma } from '@/lib/prisma'
import { chatCompletion, type ChatMessage, type ChatTool, type ChatUsage } from '@/lib/ai/openrouter'
import type { ConversationReceipt } from '@/lib/conversations/activity'
import { combinedUsage, safeToolError, stableTextHash } from '@/lib/bookings/chat-orchestrator'
import { COURSE_AGENT_TOOLS, courseToolInstruction, executeCourseAgentTool } from '@/lib/courses/agent-tools'

// list → (confirm) → enroll → reply, with room for one correction.
const MAX_TOOL_ROUNDS = 5

export interface CourseChatResult {
  content: string
  usage: ChatUsage
  receipts: ConversationReceipt[]
}

// A fresh claim («ثبت‌نام شد», "you're enrolled") — not «ثبت‌نام کرده‌اید».
const ENROLLED_CLAIM = /ثبت[‌ ]?نام(?:\s*شما)?\s*(?:انجام\s*)?شد(?![هن])|به\s*فهرست\s*انتظار\s*اضافه\s*شد(?![هن])|(?:you(?:'re| are)|has been)\s+(?:now\s+)?(?:enrolled|signed up|added to the waitlist)/i
const CANCELLED_CLAIM = /(?:انصراف|لغو)[^.\n]{0,20}(?:ثبت\s*)?شد(?![هن])|enrol(?:l)?ment (?:has been )?cancell?ed/i

function appendReceipt(receipts: ConversationReceipt[], kind: ConversationReceipt['kind']) {
  if (!receipts.some((receipt) => receipt.kind === kind)) receipts.push({ kind })
}

export function enrollmentClaimWithoutAction(content: string, receipts: ConversationReceipt[]): 'enrolled' | 'cancelled' | null {
  if (CANCELLED_CLAIM.test(content) && !receipts.some((receipt) => receipt.kind === 'enrollment_cancelled')) return 'cancelled'
  if (ENROLLED_CLAIM.test(content) && !receipts.some((receipt) => receipt.kind === 'course_enrolled' || receipt.kind === 'course_waitlisted')) return 'enrolled'
  return null
}

/**
 * The course-enrollment workflow for one customer turn. Runs only when the
 * courses capability is on (the skill plan decides) and the workspace has a
 * published course; otherwise the ordinary reply path answers.
 */
export async function maybeRunCourseAgentTurn(params: {
  workspaceId: string
  conversationId: string
  contactId?: string | null
  model: string
  messages: ChatMessage[]
  temperature: number
  maxTokens: number
  /** What the understanding layer read («ثبت‌نام دوره کاشت ناخن»), a hint for the tool loop. */
  hint?: string
}): Promise<CourseChatResult | null> {
  const published = await prisma.course.count({ where: { workspaceId: params.workspaceId, status: { in: ['PUBLISHED', 'CLOSED'] } } }).catch(() => 0)
  if (published === 0) return null

  const latestUserText = [...params.messages].reverse()
    .find((message) => message.role === 'user' && typeof message.content === 'string')?.content ?? ''
  const isFa = /[؀-ۿ]/.test(latestUserText) || params.messages.some(
    (message) => message.role === 'system' && typeof message.content === 'string' && /فارسی|Persian/i.test(message.content),
  )
  const messages: ChatMessage[] = params.messages.map((message, index) => (
    index === 0 && message.role === 'system'
      ? { ...message, content: `${message.content ?? ''}\n\n${courseToolInstruction(isFa)}${params.hint?.trim() ? (isFa ? `\nبرداشت سیستم از درخواست این نوبت: «${params.hint.trim().slice(0, 160)}» (فقط راهنما).` : `\nThe system read this turn as: “${params.hint.trim().slice(0, 160)}” (a hint only).`) : ''}` }
      : message
  ))
  const tools = COURSE_AGENT_TOOLS.map((tool) => ({
    type: tool.type,
    function: { name: tool.function.name, description: tool.function.description, parameters: tool.function.parameters as Record<string, unknown> },
  })) satisfies ChatTool[]
  const usages: ChatUsage[] = []
  const receipts: ConversationReceipt[] = []
  const fingerprint = stableTextHash(latestUserText)

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let result: Awaited<ReturnType<typeof chatCompletion>>
    try {
      result = await chatCompletion({
        model: params.model,
        messages,
        temperature: Math.min(params.temperature, 0.4),
        maxTokens: params.maxTokens,
        tools,
        toolChoice: 'auto',
      })
    } catch {
      // Models without tool calling fall back to the ordinary path, as long
      // as nothing has been written yet.
      if (receipts.length === 0) return null
      return {
        content: isFa ? 'درخواست شما ثبت شد؛ جزئیات را همین‌جا برایتان می‌فرستیم.' : 'Your request is recorded; details will follow here.',
        usage: combinedUsage(usages),
        receipts,
      }
    }
    usages.push(result.usage)

    if (result.toolCalls.length === 0) {
      const content = result.content.trim()
      const unverified = enrollmentClaimWithoutAction(content, receipts)
      if (unverified && round < MAX_TOOL_ROUNDS - 1) {
        messages.push({ role: 'assistant', content })
        messages.push({
          role: 'user',
          content: isFa
            ? `[پیام سیستم، نه مشتری] در این نوبت هیچ ابزاری ${unverified === 'cancelled' ? 'انصراف' : 'ثبت‌نام'} را انجام نداده است. اگر مشتری تأیید کرده، همین حالا ابزار مربوط را صدا بزن؛ وگرنه پاسخ را بدون ادعای انجام‌شدن بازنویسی کن.`
            : `[System note, not the customer] No tool has ${unverified === 'cancelled' ? 'cancelled' : 'enrolled'} anything this turn. If the customer confirmed, call the tool now; otherwise rewrite without claiming it is done.`,
        })
        continue
      }
      if (unverified) {
        return {
          content: isFa ? 'ثبت‌نام هنوز انجام نشده است. لطفاً یک‌بار دیگر تأیید کنید تا همین حالا ثبتش کنم.' : 'The sign-up is not done yet. Please confirm once more and I will do it right away.',
          usage: combinedUsage(usages),
          receipts,
        }
      }
      return { content, usage: combinedUsage(usages), receipts }
    }

    const calls = result.toolCalls.slice(0, 3)
    messages.push({ role: 'assistant', content: result.content || null, tool_calls: calls })
    for (const call of calls) {
      let output: unknown
      try {
        const args = JSON.parse(call.function.arguments) as Record<string, unknown>
        output = await executeCourseAgentTool({
          workspaceId: params.workspaceId,
          contactId: params.contactId,
          conversationId: params.conversationId,
          name: call.function.name,
          arguments: args,
          isFa,
          idempotencyKey: call.function.name === 'enroll_in_course'
            ? ['agent', params.conversationId, String(args.courseId ?? ''), fingerprint].join(':').slice(0, 128)
            : undefined,
        })
        const out = output as Record<string, unknown>
        if (call.function.name === 'enroll_in_course' && out.ok === true) {
          appendReceipt(receipts, out.status === 'WAITLISTED' ? 'course_waitlisted' : 'course_enrolled')
        }
        if (call.function.name === 'cancel_enrollment' && out.cancelled === true) appendReceipt(receipts, 'enrollment_cancelled')
      } catch (error) {
        output = { ok: false, error: safeToolError(error) }
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(output) })
    }
  }

  return {
    content: isFa
      ? 'برای تکمیل ثبت‌نام به اطلاعات بیشتری نیاز دارم. لطفاً نام دوره، نام و شماره موبایلتان را بفرستید.'
      : 'I need a little more to finish the sign-up. Please send the course, your name and mobile number.',
    usage: combinedUsage(usages),
    receipts,
  }
}
