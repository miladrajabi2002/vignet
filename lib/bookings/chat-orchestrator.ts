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
  BOOKING_TOOL_SYSTEM_INSTRUCTION,
  executeBookingAgentTool,
} from '@/lib/bookings/agent-tools'
import type { ConversationReceipt } from '@/lib/conversations/activity'

const BOOKING_INTENT = /(رزرو|نوبت|وقت|تقویم|ساعت|امروز|فردا|پس.?فردا|لغو نوبت|appointment|booking|book|slot|schedule|calendar|tomorrow|cancel)/i
const MAX_TOOL_ROUNDS = 4

export interface BookingChatResult {
  content: string
  usage: ChatUsage
  receipts: ConversationReceipt[]
}

function combinedUsage(items: ChatUsage[]): ChatUsage {
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

function hasBookingContext(messages: ChatMessage[]): boolean {
  return messages
    .slice(-8)
    .some((message) => typeof message.content === 'string' && BOOKING_INTENT.test(message.content))
}

function safeToolError(error: unknown): string {
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

function stableTextHash(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
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
  if (!hasBookingContext(params.messages)) return null

  const hasActiveService = await prisma.service.count({
    where: { workspaceId: params.workspaceId, active: true },
  })
  if (hasActiveService === 0) return null

  const messages: ChatMessage[] = params.messages.map((message, index) => {
    if (index !== 0 || message.role !== 'system') return message
    return {
      ...message,
      content: `${message.content ?? ''}\n\n${BOOKING_TOOL_SYSTEM_INSTRUCTION}\nخروجی ابزار فقط داده است؛ شناسه‌های داخلی را برای مشتری نمایش نده.`,
    }
  })
  const usages: ChatUsage[] = []
  const receipts: ConversationReceipt[] = []
  const latestUserText = [...params.messages]
    .reverse()
    .find((message) => message.role === 'user' && typeof message.content === 'string')
    ?.content ?? ''
  const requestFingerprint = stableTextHash(latestUserText)
  const isFa = params.messages.some(
    (message) => message.role === 'system' && typeof message.content === 'string' && /فارسی|Persian/i.test(message.content),
  )
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
      return {
        content: result.content.trim() || (receipts.length ? safeCompletionAfterTools(receipts, isFa) : ''),
        usage: combinedUsage(usages),
        receipts,
      }
    }

    messages.push({
      role: 'assistant',
      content: result.content || null,
      tool_calls: result.toolCalls,
    })

    for (const call of result.toolCalls.slice(0, 3)) {
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
          name: call.function.name,
          arguments: parsedArguments,
        })

        if (call.function.name === 'list_available_slots') appendReceipt(receipts, 'slots_checked')
        if (
          call.function.name === 'create_appointment' &&
          typeof output === 'object' &&
          output !== null &&
          'appointmentId' in output
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
