/**
 * The payment gateway inside the order flow, against a real database:
 * confirmed cart → card in chat → «پرداخت کردم» → owner review → bank SMS → paid.
 * Run: tsx -r dotenv/config scripts/pay-gateway-chat-smoke.ts   (never against production)
 */
import assert from 'node:assert/strict'
import { prisma } from '@/lib/prisma'
import { resolveOrderCaptureTurn, type OrderCaptureTurnParams } from '@/lib/commerce/order-service'
import { emptyOrderSignals, type OrderTurnSignals } from '@/lib/commerce/order-signals'
import { groupDigits } from '@/lib/payments/card/amount'
import { deviceTokenFields, ingestBankSms, newDeviceToken } from '@/lib/payments/card/ingest'
import { parseCardPayDirective } from '@/lib/payments/card/pay-card'
import { addPayCard, loadCardPayContextForAgent } from '@/lib/payments/card/service'

const signals = (patch: Partial<OrderTurnSignals>): OrderTurnSignals => ({ ...emptyOrderSignals(), ...patch })

async function main() {
  if (!/paydev|test/.test(process.env.DATABASE_URL ?? '')) throw new Error('Refusing to run outside a test database')
  const stamp = Date.now()
  const workspace = await prisma.workspace.create({ data: { name: 'فروشگاه نگار', slug: `pay-chat-${stamp}`, payGatewayEnabled: true } })
  const wid = workspace.id
  try {
    const agent = await prisma.agent.create({ data: { workspaceId: wid, name: 'ایجنت', systemPrompt: '-', orderCaptureEnabled: true, cardPayEnabled: false } })
    assert.equal(await loadCardPayContextForAgent(wid, agent.id), null, 'agent switch is off')
    await prisma.agent.update({ where: { id: agent.id }, data: { cardPayEnabled: true } })
    assert.equal(await loadCardPayContextForAgent(wid, agent.id), null, 'no card yet')
    await addPayCard(wid, { pan: '6104337712345675', holderName: 'نگار رضایی' })
    const ctx = await loadCardPayContextForAgent(wid, agent.id)
    assert(ctx, 'gateway is available')
    const device = await prisma.payDevice.create({ data: { workspaceId: wid, name: 'گوشی', phone: `0935${String(stamp).slice(-7)}`, ...deviceTokenFields(newDeviceToken()) } })
    const conversation = await prisma.conversation.create({ data: { workspaceId: wid, agentId: agent.id, channel: 'WEB_WIDGET', externalId: `c-${stamp}` } })
    const draft = await prisma.orderDraft.create({
      data: {
        workspaceId: wid, agentId: agent.id, conversationId: conversation.id, channel: 'WEB_WIDGET', code: `T${String(stamp).slice(-5)}`,
        status: 'AWAITING_CONFIRM', expecting: 'confirm',
        items: [{ productId: 'p1', variationId: null, name: 'کفش کتانی', variant: null, quantity: 1, unitPrice: 1_250_000, url: null, maxQuantity: null }],
        customerName: 'سارا احمدی', customerPhone: '09121234567', city: 'تهران', address: 'تهران، خیابان ولیعصر، پلاک ۱۲',
      },
    })
    const base: OrderCaptureTurnParams = {
      enabled: true, workspaceId: wid, agentId: agent.id, conversationId: conversation.id, contactId: null, channel: 'WEB_WIDGET',
      message: 'تأیید', lang: 'fa', catalogProducts: [], recentCardIds: [], activeEntityId: null, variantHint: null, lastAssistantText: null,
      prefill: { name: null, phone: null, city: null, address: null }, restockEnabled: false, checkout: null, cardPay: ctx, signals: signals({ confirm: true }),
    }

    // 1) confirm → the reply carries the card
    const confirmed = await resolveOrderCaptureTurn(base)
    assert.equal(confirmed.kind, 'reply')
    const first = parseCardPayDirective(confirmed.kind === 'reply' ? confirmed.text : '')
    assert(first.cardPay, 'reply carries a card')
    assert.equal(first.cardPay.pan, '6104337712345675')
    assert(first.cardPay.amount > 1_250_000 && first.cardPay.amount <= 1_250_999)
    assert(!first.text.includes('[['), 'no marker in the visible text')
    assert.equal((await prisma.orderDraft.findUnique({ where: { id: draft.id } }))?.status, 'AWAITING_TRANSFER')
    console.log('1 ok  card issued:', first.cardPay.amount, '·', first.text.split('\n')[0])

    // 2) «دوباره کارت رو بفرست» → the same card, same amount
    const again = await resolveOrderCaptureTurn({ ...base, message: 'شماره کارت رو دوباره بفرست', signals: signals({ linkRequest: true }) })
    assert.equal(parseCardPayDirective(again.kind === 'reply' ? again.text : '').cardPay?.amount, first.cardPay.amount)

    // 3) a question mid-payment is answered by the model with the real state
    const question = await resolveOrderCaptureTurn({ ...base, message: 'ارسال چند روزه؟', signals: signals({ question: true }) })
    assert.equal(question.kind, 'instruct')

    // 4) «واریز کردم» with no SMS → owner review, never «paid»
    const claimed = await resolveOrderCaptureTurn({ ...base, message: 'واریز کردم', signals: signals({ paymentClaim: true }) })
    assert(claimed.kind === 'reply' && /بررسی/.test(claimed.text) && !/رسید ✅/.test(claimed.text))
    assert.equal((await prisma.orderDraft.findUnique({ where: { id: draft.id } }))?.status, 'PAYMENT_REVIEW')
    assert.equal(await prisma.notification.count({ where: { workspaceId: wid, type: 'HANDOFF' } }), 1)

    // 5) the bank SMS arrives → paid, the customer is told in the conversation
    const sms = await ingestBankSms(device, 'SMS', `حساب8907027623\nواریز${groupDigits(first.cardPay.amount * 10)}\nمانده452,963,014\n05/07/15-11:33`)
    assert.equal(sms.status, 'matched')
    const paid = await prisma.orderDraft.findUnique({ where: { id: draft.id } })
    assert.equal(paid?.status, 'PAID')
    assert.equal(paid?.paymentMethodTitle, 'کارت‌به‌کارت')
    const notice = await prisma.message.findFirst({ where: { conversationId: conversation.id, role: 'ASSISTANT' }, orderBy: { createdAt: 'desc' } })
    assert(notice && /پرداختتون رسید/.test(notice.content), 'customer notice stored in the conversation')
    console.log('5 ok  paid:', notice.content)

    // 6) a cart change while a card is out re-opens the cart and frees the customer from the old amount
    const second = await prisma.orderDraft.create({
      data: { ...({ workspaceId: wid, agentId: agent.id, conversationId: conversation.id, channel: 'WEB_WIDGET' as const }), code: `U${String(stamp).slice(-5)}`, status: 'AWAITING_CONFIRM', expecting: 'confirm',
        items: [{ productId: 'p2', variationId: null, name: 'کرم آبرسان', variant: null, quantity: 2, unitPrice: 480_000, url: null, maxQuantity: null }],
        customerName: 'سارا احمدی', customerPhone: '09121234567', city: 'تهران', address: 'تهران، خیابان ولیعصر، پلاک ۱۲' },
    })
    const issued = await resolveOrderCaptureTurn(base)
    const card2 = parseCardPayDirective(issued.kind === 'reply' ? issued.text : '').cardPay
    assert(card2 && card2.amount > 960_000 && card2.amount <= 960_999)
    const cancelAsk = await resolveOrderCaptureTurn({ ...base, message: 'لغوش کن', signals: signals({ cancel: true }) })
    assert.equal(cancelAsk.kind, 'reply')
    const cancelled = await resolveOrderCaptureTurn({ ...base, message: 'آره', signals: signals({ confirm: true }) })
    assert.equal(cancelled.kind, 'reply')
    assert.equal((await prisma.orderDraft.findUnique({ where: { id: second.id } }))?.status, 'CANCELLED')
    assert.equal((await prisma.cardPayment.findFirst({ where: { orderDraftId: second.id } }))?.status, 'CANCELLED')
    console.log('payment gateway chat smoke: all 6 steps passed')
  } finally {
    await prisma.workspace.delete({ where: { id: wid } })
  }
}

main().then(() => process.exit(0), (error) => { console.error(error); process.exit(1) })
