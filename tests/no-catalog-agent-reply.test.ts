/**
 * A business with no product catalog must never answer «دسترسی این ایجنت به
 * کاتالوگ محصولات غیرفعال است». The only evidence for that canned reply was
 * the regex plan's «show me products» guess, which fires on ordinary support
 * messages; real customers got it for the three messages below (2026-10).
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { buildDeterministicTurnReply } from '@/lib/agent/turn/deterministic'
import { planProductRequest } from '@/lib/ai/conversation'
import type { ChatAgent } from '@/lib/ai/chat-types'

const supportAgent: ChatAgent = {
  id: 'a', systemPrompt: '', language: 'fa', model: null, temperature: 0.5, maxTokens: 700, fallbackMessage: null,
  handoffEnabled: true, handoffMessage: null, handoffKeywords: [], promptConfig: null, roleTemplate: null,
  requireCustomerInfo: false, customerInfoPrompt: null, productAccessEnabled: false, orderTrackingEnabled: false,
  orderCaptureEnabled: false, restockAlertsEnabled: true,
}

describe('an agent without a catalog leaves product-looking turns to the reply model', () => {
  it.each([
    'عکس ازین طریق ارسال نمیشه',
    'میتوانید داخل روبیکا یک ویدیو دابراتون بفرستم',
    'میتونی لیکن واتساپ روارسال کنید',
    'محصولاتتون رو نشونم بدید',
  ])('«%s» gets no canned catalog reply', async (message) => {
    const reply = await buildDeterministicTurnReply({
      workspaceId: 'w',
      agent: supportAgent,
      channel: 'WEB_WIDGET',
      catalogProducts: [],
      productRequest: planProductRequest(message, []),
      canBypass: true,
      closingReply: null,
      lang: 'fa',
    })
    expect(reply).toBeNull()
  })
})
