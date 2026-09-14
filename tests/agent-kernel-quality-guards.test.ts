import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '@/lib/ai/openrouter'
import { planProductRequest } from '@/lib/ai/conversation'
import { conversationFlowInstruction } from '@/lib/agent-kernel/skills/conversation-flow'
import { enforceActionCapabilities } from '@/lib/agent-kernel/skills/action-capabilities'

const user = (content: string): ChatMessage => ({ role: 'user', content })
const assistant = (content: string): ChatMessage => ({ role: 'assistant', content })

/**
 * Regression guards for the production quality failures observed in real
 * conversations (September 2026):
 *  1. The model "confirmed" orders that were never placed («سفارش شما ثبت شد
 *     … کالا از انبار ارسال می‌شود») after a bare «بله» acceptance, then the
 *     customer asked for the payment link and the deterministic showcase
 *     replied with a random «related» product — a lost sale.
 *  2. «الان این مدل چه رنگ هایی موجوده؟» re-asked «which model?» even though
 *     the target product was already in the turn's catalog context.
 *  3. Link/payment follow-ups («ارسال کنید لینک را») fired the catalog-wide
 *     vitrine instead of answering about the product under discussion.
 */

describe('agent kernel quality guards — fabricated order confirmations', () => {
  const hallucinatedConfirm =
    'سفارش شما برای **ست خانگی خرسی 0634** در رنگ قهوه‌ای ثبت شد. مبلغ نهایی **898,000 تومان** است و کالا از انبار ارسال می‌شود.\n\nبرای تکمیل خرید، لطفاً از طریق همین گفتگو ادامه دهید تا لینک پرداخت را برایتان ارسال کنم'

  it('replaces a fabricated completed-order claim after a bare «بله» acceptance', () => {
    const guarded = enforceActionCapabilities({
      reply: hallucinatedConfirm,
      userMessage: 'بله',
      isFa: true,
    })
    expect(guarded).toContain('امکان ثبت یا نهایی‌کردن سفارش داخل این گفتگو فعال نیست')
    expect(guarded).not.toContain('ثبت شد')
    expect(guarded).not.toContain('از انبار ارسال می‌شود')
  })

  it('routes the customer to the trusted product link when catalog rows exist', () => {
    const guarded = enforceActionCapabilities({
      reply: hallucinatedConfirm,
      userMessage: 'بله',
      isFa: true,
      orderUrl: 'https://store.example.com/product/0634',
    })
    expect(guarded).toContain('https://store.example.com/product/0634')
    expect(guarded).not.toContain('ثبت شد')
  })

  it('keeps grounded order-tracking status when a verified order block exists', () => {
    const trackingReply = 'سفارش شما ثبت شده و در حال پردازش است؛ کد رهگیری ۱۲۳۴۵ را در پیام بعدی می‌فرستم.'
    expect(
      enforceActionCapabilities({
        reply: trackingReply,
        userMessage: 'وضعیت سفارشم چیه؟',
        isFa: true,
        hasGroundedOrder: true,
      }),
    ).toBe(trackingReply)
  })

  it('strips the checkout data-collection promise («نام و شماره … تا ثبت کنم»)', () => {
    const guarded = enforceActionCapabilities({
      reply: 'لطفاً نام و شماره‌ای که موقع ثبت سفارش وارد کردید را بفرمایید تا سفارش رنگ قهوه‌ای را برایتان ثبت کنم',
      userMessage: 'بله',
      isFa: true,
    })
    expect(guarded).toContain('امکان ثبت یا نهایی‌کردن سفارش داخل این گفتگو فعال نیست')
    expect(guarded).not.toContain('برایتان ثبت کنم')
  })

  it('keeps grounded product facts in a normal consultation reply', () => {
    const reply = 'رنگ آبیِ «ست خانگی خرسی 0634» موجود است؛ قیمت آن 898,000 تومان است.'
    expect(
      enforceActionCapabilities({ reply, userMessage: 'رنگ آبی هست؟', isFa: true }),
    ).toBe(reply)
  })
})

describe('agent kernel quality guards — link/payment follow-up routing', () => {
  const productHistory = [
    user('0634'),
    assistant('۲ رنگ موجودِ «ست خانگی خرسی 0634» را برایتان فرستادم؛ عکس، قیمت و موجودی هر رنگ روی کارت خودش هست. کدام رنگ را می‌خواهید؟'),
    user('آبی'),
    assistant('رنگ آبیِ «ست خانگی خرسی 0634» موجود است؛ قیمت آن 898,000 تومان است.'),
  ]

  it('keeps «لینک پرداخت رو برام ارسال کنید» anchored to the discussed product', () => {
    const plan = planProductRequest('لینک پرداخت رو لطفاً برام ارسال کنید', productHistory)
    expect(plan.isProductTurn).toBe(true)
    expect(plan.searchTerms).toContain('0634')
    // Must NOT fire the catalog-wide deterministic vitrine.
    expect(plan.explicitShowcase).toBe(false)
  })

  it('keeps «ارسال کنید لینک را» anchored to the discussed product without a showcase', () => {
    const plan = planProductRequest('ارسال کنید لینک را', productHistory)
    expect(plan.isProductTurn).toBe(true)
    expect(plan.searchTerms).toContain('0634')
    expect(plan.explicitShowcase).toBe(false)
  })

  it('treats a payment-link request with no product context as a non-product turn', () => {
    const plan = planProductRequest('لینک پرداخت رو بفرست', [])
    expect(plan.isProductTurn).toBe(false)
  })

  it('resolves «این مدل چه رنگ هایی موجوده؟» to the discussed product variants', () => {
    const plan = planProductRequest('الان این مدل چه رنگ هایی موجوده؟', productHistory)
    expect(plan.variantBrowse).toBe(true)
    expect(plan.variantTargetRefs.length).toBeGreaterThan(0)
    expect(plan.isProductTurn).toBe(true)
  })
})

describe('agent kernel quality guards — history-dependent references in the flow skill', () => {
  it('marks «این مدل» as a history-dependent reference so the model resolves it', () => {
    const instruction = conversationFlowInstruction({
      isFa: true,
      history: [user('ست خانگی خرسی 0634 رو دارید؟'), assistant('بله، موجود است.')],
      userMessage: 'الان این مدل چه رنگ هایی موجوده؟',
    })
    expect(instruction).toContain('مرجع')
    expect(instruction).toContain('دوباره نام گزینه‌ها را نپرس')
  })

  it('marks «لینکش رو بفرست» as a history-dependent reference', () => {
    const instruction = conversationFlowInstruction({
      isFa: true,
      history: [user('0634'), assistant('قیمتش 898,000 تومان است.')],
      userMessage: 'لینکش رو بفرست',
    })
    expect(instruction).toContain('مرجع')
  })
})
