import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  chatCompletion,
  type ChatMessage,
  type ChatTool,
  type ChatUsage,
} from '@/lib/ai/openrouter'
import {
  BOOKING_AGENT_TOOLS,
  bookingServiceDirectory,
  bookingToolInstruction,
  executeBookingAgentTool,
} from '@/lib/bookings/agent-tools'
import type { ConversationReceipt } from '@/lib/conversations/activity'
import { hasBookingIntent } from '@/lib/bookings/intent'

// services → slots (+ nearest date) → confirm/book → final reply, with room
// for one retry after a slot fills up between listing and booking.
const MAX_TOOL_ROUNDS = 6

export interface BookingChatResult {
  content: string
  usage: ChatUsage
  receipts: ConversationReceipt[]
}

export function combinedUsage(items: ChatUsage[]): ChatUsage {
  return items.reduce<ChatUsage>((sum, item) => ({
    promptTokens: sum.promptTokens + item.promptTokens,
    completionTokens: sum.completionTokens + item.completionTokens,
    reasoningTokens: sum.reasoningTokens + item.reasoningTokens,
    cachedTokens: sum.cachedTokens + item.cachedTokens,
    costUSD:
      sum.costUSD === null && item.costUSD === null
        ? null
        : (sum.costUSD ?? 0) + (item.costUSD ?? 0),
    // Multi-call turns do not have one canonical provider request id.
    providerRequestId: items.length === 1 ? item.providerRequestId : null,
  }), {
    promptTokens: 0,
    completionTokens: 0,
    reasoningTokens: 0,
    cachedTokens: 0,
    costUSD: null,
    providerRequestId: null,
  })
}

export function safeToolError(error: unknown): string {
  if (error instanceof z.ZodError) return 'INVALID_ARGUMENTS'
  if (error instanceof SyntaxError) return 'INVALID_JSON_ARGUMENTS'
  if (error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)) return error.message
  return 'TOOL_FAILED'
}

function appendReceipt(
  receipts: ConversationReceipt[],
  kind: ConversationReceipt['kind'],
) {
  if (!receipts.some((receipt) => receipt.kind === kind)) receipts.push({ kind })
}

export function stableTextHash(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

// A fresh action claim («ثبت شد», «لغو شد», "booked") — not the state form
// «ثبت شده» that can describe an earlier turn's booking.
const BOOKED_CLAIM = /(?:ثبت|رزرو|جابه[\u200c ]?جا|منتقل)\s*شد(?![هن])|has been (?:booked|scheduled|moved)|\bis booked\b/i
const CANCELLED_CLAIM = /(?:لغو|کنسل)\s*شد(?![هن])|has been cancell?ed/i
const CONFIRMATION = /^\s*(?:بله|آره|اره|باشه|حتما|حتماً|تایید|تأیید|اوکی|درسته|ok|okay|yes|sure)(?:[\s،,.!]|$)|تأیید می[\u200c ]?کنم|تایید می[\u200c ]?کنم|ثبت کن|لغو کن|ببرید|انجام بده/i
const ASKED_TO_CONFIRM = /(?:تأیید|تایید)\s*می[\u200c ]?(?:کنید|کنی)|(?:ثبت|رزرو|لغو|انجام|جابه[\u200c ]?جا|منتقل)\s*(?:کنم|بدم)|(?:ببرم|منتقلش کنم)|confirm\?|shall i (?:book|move|cancel)/i

export function claimWithoutAction(content: string, receipts: ConversationReceipt[]): 'booked' | 'cancelled' | null {
  if (CANCELLED_CLAIM.test(content) && !receipts.some((receipt) => receipt.kind === 'appointment_cancelled')) return 'cancelled'
  if (BOOKED_CLAIM.test(content) && !receipts.some((receipt) => receipt.kind === 'appointment_booked')) return 'booked'
  return null
}

function safeCompletionAfterTools(
  receipts: ConversationReceipt[],
  isFa: boolean,
): string {
  if (receipts.some((receipt) => receipt.kind === 'appointment_booked')) {
    return isFa
      ? 'نوبت شما با موفقیت تأیید و در تقویم ثبت شد.'
      : 'Your appointment was confirmed and added to the calendar.'
  }
  if (receipts.some((receipt) => receipt.kind === 'appointment_cancelled')) {
    return isFa
      ? 'لغو نوبت با موفقیت در تقویم ثبت شد.'
      : 'The appointment cancellation was recorded successfully.'
  }
  return isFa
    ? 'زمان‌های آزاد بررسی شد، اما نمایش پاسخ کامل نشد. لطفاً تاریخ موردنظرتان را یک‌بار دیگر بفرستید.'
    : 'Availability was checked, but the full reply could not be shown. Please send your preferred date once more.'
}

/**
 * Run the booking tools only when the recent conversation has booking intent
 * and this workspace has an active service. Ordinary support/sales turns keep
 * the cheaper single-completion path.
 */
export async function maybeRunBookingAgentTurn(params: {
  workspaceId: string
  conversationId: string
  contactId?: string | null
  model: string
  messages: ChatMessage[]
  temperature: number
  maxTokens: number
}): Promise<BookingChatResult | null> {
  if (!hasBookingIntent(params.messages)) return null

  const hasActiveService = await prisma.service.count({
    where: { workspaceId: params.workspaceId, active: true },
  })
  if (hasActiveService === 0) return null

  const latestUserText = [...params.messages]
    .reverse()
    .find((message) => message.role === 'user' && typeof message.content === 'string')
    ?.content ?? ''
  // The customer's own script decides the calendar language; the agent prompt
  // is the fallback for script-less turns such as "10:30".
  const isFa = /[\u0600-\u06FF]/.test(latestUserText) || params.messages.some(
    (message) => message.role === 'system' && typeof message.content === 'string' && /فارسی|Persian/i.test(message.content),
  )
  const now = new Date()
  const previousAssistant = [...params.messages]
    .reverse()
    .find((message) => message.role === 'assistant' && typeof message.content === 'string')
    ?.content ?? ''
  // The customer just said "yes" to the summary the agent asked about. Cheap
  // models tend to re-ask; tell them the confirmation is already given.
  const confirmationTurn = typeof latestUserText === 'string'
    && CONFIRMATION.test(latestUserText)
    && typeof previousAssistant === 'string'
    && ASKED_TO_CONFIRM.test(previousAssistant)
  const confirmationNote = !confirmationTurn
    ? ''
    : isFa
      ? '\nمشتری همین حالا خلاصهٔ پیام قبلی تو را صریحاً تأیید کرد. دوباره نپرس؛ همین حالا ابزار مربوط را اجرا کن (create_appointment، یا برای جابه‌جایی/لغو اول list_my_appointments و بعد reschedule_appointment یا cancel_appointment).'
      : '\nThe customer just explicitly confirmed your previous summary. Do not ask again; call the matching tool now (create_appointment, or list_my_appointments then reschedule_appointment / cancel_appointment).'
  const directory = await bookingServiceDirectory(params.workspaceId, isFa)
  const bookingInstruction = `${bookingToolInstruction({ isFa, now })}\n${directory}${confirmationNote}`
  const messages: ChatMessage[] = params.messages.map((message, index) => {
    if (index !== 0 || message.role !== 'system') return message
    return {
      ...message,
      content: `${message.content ?? ''}\n\n${bookingInstruction}`,
    }
  })
  const usages: ChatUsage[] = []
  const receipts: ConversationReceipt[] = []
  const requestFingerprint = stableTextHash(latestUserText)
  const tools = BOOKING_AGENT_TOOLS.map((tool) => ({
    type: tool.type,
    function: {
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters as Record<string, unknown>,
    },
  })) satisfies ChatTool[]

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
      // Some economical provider models may not expose tool calling. Fall back
      // to the ordinary grounded chat path before any action has happened.
      if (receipts.length === 0) return null
      return {
        content: safeCompletionAfterTools(receipts, isFa),
        usage: combinedUsage(usages),
        receipts,
      }
    }
    usages.push(result.usage)

    if (result.toolCalls.length === 0) {
      const content = result.content.trim()
      // Never let the reply claim a booking/cancellation that no tool made.
      const unverified = claimWithoutAction(content, receipts)
      if (unverified && round < MAX_TOOL_ROUNDS - 1) {
        messages.push({ role: 'assistant', content })
        messages.push({
          role: 'user',
          content: isFa
            ? `[پیام سیستم، نه مشتری] در این نوبت هیچ ابزاری ${unverified === 'cancelled' ? 'لغو' : 'ثبت یا جابه‌جایی'} را انجام نداده است. اگر مشتری تأیید کرده، همین حالا ابزار مربوط را صدا بزن؛ در غیر این صورت پاسخ را بدون ادعای انجام‌شدن بازنویسی کن.`
            : `[System note, not the customer] No tool has ${unverified === 'cancelled' ? 'cancelled' : 'booked or moved'} anything this turn. If the customer confirmed, call the tool now; otherwise rewrite the reply without claiming it is done.`,
        })
        continue
      }
      if (unverified) {
        return {
          content: isFa
            ? 'این درخواست هنوز در تقویم انجام نشده است. لطفاً یک‌بار دیگر تأیید کنید تا همین حالا انجامش بدهم.'
            : 'That has not been applied to the calendar yet. Please confirm once more and I will do it right away.',
          usage: combinedUsage(usages),
          receipts,
        }
      }
      return {
        content: content || (receipts.length ? safeCompletionAfterTools(receipts, isFa) : ''),
        usage: combinedUsage(usages),
        receipts,
      }
    }

    const calls = result.toolCalls.slice(0, 3)
    messages.push({
      role: 'assistant',
      content: result.content || null,
      tool_calls: calls,
    })

    for (const call of calls) {
      let output: unknown
      try {
        const parsedArguments = JSON.parse(call.function.arguments) as Record<string, unknown>
        if (call.function.name === 'create_appointment') {
          parsedArguments.idempotencyKey = [
            'agent',
            params.conversationId,
            String(parsedArguments.serviceId ?? ''),
            String(parsedArguments.localDate ?? ''),
            String(parsedArguments.startMinute ?? ''),
            requestFingerprint,
          ].join(':').slice(0, 128)
        }
        output = await executeBookingAgentTool({
          workspaceId: params.workspaceId,
          contactId: params.contactId,
          conversationId: params.conversationId,
          name: call.function.name,
          arguments: parsedArguments,
          isFa,
          now,
        })

        const succeeded = typeof output === 'object' && output !== null && 'ok' in output && output.ok === true
        if (
          call.function.name === 'list_available_slots' ||
          call.function.name === 'find_next_available_slots'
        ) appendReceipt(receipts, 'slots_checked')
        if (
          (call.function.name === 'create_appointment' || call.function.name === 'reschedule_appointment') &&
          succeeded
        ) appendReceipt(receipts, 'appointment_booked')
        if (
          call.function.name === 'cancel_appointment' &&
          typeof output === 'object' &&
          output !== null &&
          'cancelled' in output &&
          output.cancelled === true
        ) appendReceipt(receipts, 'appointment_cancelled')
      } catch (error) {
        output = { ok: false, error: safeToolError(error) }
      }

      if (process.env.BOOKING_TOOL_DEBUG === '1') {
        console.info('[booking-tool]', call.function.name, call.function.arguments.slice(0, 300), JSON.stringify(output).slice(0, 300))
      }
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(output),
      })
    }
  }

  return {
    content: isFa
      ? 'برای تکمیل رزرو به اطلاعات بیشتری نیاز دارم. لطفاً خدمت، تاریخ و ساعت موردنظرتان را دوباره بفرستید.'
      : 'I need a little more information. Please send the service, date, and preferred time again.',
    usage: combinedUsage(usages),
    receipts,
  }
}
