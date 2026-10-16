/**
 * The gateway's second line against a real database: a short deposit keeps
 * the payment open for the rest, a larger one records the extra, a customer
 * with too many unbacked «پرداخت کردم» stops reaching the owner, and a
 * blocked customer is not offered the card, and a person can still confirm
 * an expired or withdrawn payment with everything a paid one does.
 * Run: tsx -r dotenv/config scripts/pay-gateway-advanced-smoke.ts   (never against production)
 */
import assert from 'node:assert/strict'
import { prisma } from '@/lib/prisma'
import { groupDigits } from '@/lib/payments/card/amount'
import { depositFit, deviceTokenFields, ingestBankSms, newDeviceToken, resolveBankSms } from '@/lib/payments/card/ingest'
import { composeCardPayNotice, composeCardPayRemainder, parseCardPayDirective, type CardPayView } from '@/lib/payments/card/pay-card'
import {
  addPayCard,
  CLAIM_LIMIT_PER_DAY,
  cancelOpenCardPayments,
  claimCardPayment,
  confirmCardPayment,
  createCardPayment,
  loadCardPayContextForAgent,
  setCardPayBlockForPayment,
} from '@/lib/payments/card/service'

const sms = (toman: number) => `حساب8907027623\nواریز${groupDigits(toman * 10)}\nمانده452,963,014\n05/07/15-${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`

async function main() {
  if (!/paydev|test/.test(process.env.DATABASE_URL ?? '')) throw new Error('Refusing to run outside a test database')

  // Pure: how a deposit lands on what is due.
  assert.deepEqual(depositFit(450_000, 480_237), { kind: 'SHORT', rest: 30_237 })
  assert.deepEqual(depositFit(480_000, 480_237), { kind: 'FULL', extra: 0 }, 'a shortfall under 1,000 is forgiven')
  assert.deepEqual(depositFit(500_000, 480_237), { kind: 'FULL', extra: 19_763 })
  assert.deepEqual(depositFit(null, 480_237), { kind: 'FULL', extra: 0 })
  assert.match(composeCardPayNotice({ status: 'PAID', code: 'A1', amount: 480_000, lang: 'fa', extra: 19_763 }) ?? '', /۱۹٬۷۶۳ تومان بیشتر/)
  assert.doesNotMatch(composeCardPayNotice({ status: 'PAID', code: 'A1', amount: 480_000, lang: 'fa', extra: null }) ?? '', /بیشتر/)

  const stamp = Date.now()
  const workspace = await prisma.workspace.create({ data: { name: 'فروشگاه آزمایشی', slug: `pay-adv-${stamp}`, payGatewayEnabled: true } })
  const wid = workspace.id
  try {
    await addPayCard(wid, { pan: '6104 3377 1234 5675', holderName: 'نگار رضایی' })
    const device = await prisma.payDevice.create({ data: { workspaceId: wid, name: 'گوشی', phone: `0913${String(stamp).slice(-7)}`, method: 'SMS', ...deviceTokenFields(newDeviceToken()) } })
    const agent = await prisma.agent.create({ data: { workspaceId: wid, name: 'ایجنت', systemPrompt: '-', orderCaptureEnabled: true, cardPayEnabled: true } })
    const contact = await prisma.contact.create({ data: { workspaceId: wid, name: 'سارا', phone: '09121234567' } })
    const conversation = await prisma.conversation.create({ data: { workspaceId: wid, agentId: agent.id, contactId: contact.id, channel: 'WEB_WIDGET', externalId: `c-${stamp}` } })
    const other = await prisma.conversation.create({ data: { workspaceId: wid, agentId: agent.id, contactId: contact.id, channel: 'WEB_WIDGET', externalId: `d-${stamp}` } })

    // 1) short deposit → owner attaches it → open for the exact rest → the rest's SMS confirms
    const a = await createCardPayment({ workspaceId: wid, baseAmount: 480_000, source: 'CHAT', reference: 'A1', conversationId: conversation.id })
    assert(a.ok)
    const short = await ingestBankSms(device, 'SMS', sms(450_000))
    assert.equal(short.status, 'unmatched')
    assert(short.status === 'unmatched' && (await resolveBankSms(wid, short.smsId, a.payment.id)))
    const reopened = await prisma.cardPayment.findUniqueOrThrow({ where: { id: a.payment.id } })
    assert.equal(reopened.status, 'PENDING')
    assert.equal(reopened.partialAmount, 450_000)
    assert.equal(reopened.payAmount, a.payment.payAmount - 450_000, 'the rest itself when free')
    assert.equal(reopened.baseAmount, 480_000)
    assert(reopened.expiresAt > new Date())
    const notice = await prisma.message.findFirst({ where: { conversationId: conversation.id }, orderBy: { createdAt: 'desc' } })
    const parsed = parseCardPayDirective(notice?.content ?? '')
    assert.equal(parsed.cardPay?.amount, reopened.payAmount, 'the customer gets the card with the rest')
    assert.match(parsed.text, /۴۵۰٬۰۰۰ تومان رسید/)
    const rest = await ingestBankSms(device, 'SMS', sms(reopened.payAmount))
    assert.deepEqual(rest, { status: 'matched', paymentId: a.payment.id })
    assert.equal((await prisma.cardPayment.findUniqueOrThrow({ where: { id: a.payment.id } })).status, 'PAID')

    // 2) the rest is taken by another open payment → a fresh identifier on top of it
    const b = await createCardPayment({ workspaceId: wid, baseAmount: 900_000, source: 'LINK', reference: 'B1' })
    const blocker = await createCardPayment({ workspaceId: wid, baseAmount: 50_000, source: 'LINK', reference: 'B2' })
    assert(b.ok && blocker.ok)
    const expectedRest = b.payment.payAmount - 600_000
    await prisma.cardPayment.update({ where: { id: blocker.payment.id }, data: { payAmount: expectedRest } })
    const shortB = await ingestBankSms(device, 'SMS', sms(600_000))
    assert(shortB.status === 'unmatched' && (await resolveBankSms(wid, shortB.smsId, b.payment.id)))
    const restB = (await prisma.cardPayment.findUniqueOrThrow({ where: { id: b.payment.id } })).payAmount
    assert(restB > expectedRest && restB <= expectedRest + 999, `rest ${restB} must avoid ${expectedRest}`)

    // 3) larger deposit → paid, the extra recorded and told
    const c = await createCardPayment({ workspaceId: wid, baseAmount: 480_000, source: 'CHAT', reference: 'C1', conversationId: other.id })
    assert(c.ok)
    const big = await ingestBankSms(device, 'SMS', sms(c.payment.payAmount + 19_763))
    assert(big.status === 'unmatched' && (await resolveBankSms(wid, big.smsId, c.payment.id)))
    const paidC = await prisma.cardPayment.findUniqueOrThrow({ where: { id: c.payment.id } })
    assert.equal(paidC.status, 'PAID')
    assert.equal(paidC.overpaidAmount, 19_763)
    const paidNotice = await prisma.message.findFirst({ where: { conversationId: other.id }, orderBy: { createdAt: 'desc' } })
    assert.match(paidNotice?.content ?? '', /۱۹٬۷۶۳ تومان بیشتر/)

    // 4) a shortfall under 1,000 → confirmed as is
    const d = await createCardPayment({ workspaceId: wid, baseAmount: 700_000, source: 'LINK', reference: 'D1' })
    assert(d.ok)
    const round = await ingestBankSms(device, 'SMS', sms(700_000))
    assert(round.status === 'unmatched' && (await resolveBankSms(wid, round.smsId, d.payment.id)))
    const paidD = await prisma.cardPayment.findUniqueOrThrow({ where: { id: d.payment.id } })
    assert.equal(paidD.status, 'PAID')
    assert.equal(paidD.overpaidAmount, null)

    // 5) claim cap: three unbacked claims across the customer's conversations, the fourth waits for the SMS
    const claims = []
    for (let i = 0; i < CLAIM_LIMIT_PER_DAY + 1; i++) {
      const p = await createCardPayment({ workspaceId: wid, baseAmount: 200_000 + i * 1_000, source: 'CHAT', reference: `K${i}`, conversationId: i % 2 ? other.id : conversation.id })
      assert(p.ok)
      claims.push(await claimCardPayment(p.payment.id))
    }
    assert.deepEqual(claims.map((row) => row.changed), [true, true, true, false])
    assert.equal(claims[3].limited, true)
    assert.equal(claims[3].payment?.status, 'PENDING')
    const fourthSms = await ingestBankSms(device, 'SMS', sms(claims[3].payment!.payAmount))
    assert.equal(fourthSms.status, 'matched', 'a real transfer still confirms on its own')
    // A stranger is not limited by Sara's claims.
    const e = await createCardPayment({ workspaceId: wid, baseAmount: 300_000, source: 'LINK', reference: 'E1', customerPhone: '09350000000' })
    assert(e.ok && (await claimCardPayment(e.payment.id)).changed)

    // 6) blocklist: no card for the blocked customer, everyone else unchanged
    assert(await loadCardPayContextForAgent(wid, agent.id, contact.id), 'available before the block')
    assert.equal(await setCardPayBlockForPayment(wid, a.payment.id, true), true)
    assert.equal(await loadCardPayContextForAgent(wid, agent.id, contact.id), null, 'blocked customer gets no card')
    assert(await loadCardPayContextForAgent(wid, agent.id, null), 'others still do')
    assert.equal(await setCardPayBlockForPayment(wid, e.payment.id, true), false, 'a payment with no conversation has no customer to block')
    assert.equal(await setCardPayBlockForPayment(wid, a.payment.id, false), true)
    assert(await loadCardPayContextForAgent(wid, agent.id, contact.id), 'allowed again')

    // 7) late confirm by hand: withdrawn and expired payments, never by the SMS
    const w = await createCardPayment({ workspaceId: wid, baseAmount: 330_000, source: 'CHAT', reference: 'W1', conversationId: conversation.id, callbackUrl: 'http://127.0.0.1:9/cb' })
    assert(w.ok)
    assert.equal(await cancelOpenCardPayments({ id: w.payment.id }), 1)
    assert.equal((await confirmCardPayment(w.payment.id, 'AUTO')).changed, false, 'the SMS never confirms a withdrawn payment')
    await prisma.cardPayment.update({ where: { id: w.payment.id }, data: { callbackDoneAt: new Date(), callbackTries: 1 } })
    assert.equal((await confirmCardPayment(w.payment.id, 'OWNER')).changed, true)
    const paidW = await prisma.cardPayment.findUniqueOrThrow({ where: { id: w.payment.id } })
    assert.equal(paidW.status, 'PAID')
    assert.equal(paidW.confirmedBy, 'OWNER')
    assert.equal(paidW.callbackDoneAt, null, 'the site is told «paid» afresh')
    assert.equal(paidW.notifiedStatus, 'PAID')
    const lateNotice = await prisma.message.findFirst({ where: { conversationId: conversation.id }, orderBy: { createdAt: 'desc' } })
    assert.match(lateNotice?.content ?? '', /پرداختتون رسید/)
    assert.equal((await confirmCardPayment(w.payment.id, 'OWNER')).changed, false, 'once only')

    const x = await createCardPayment({ workspaceId: wid, baseAmount: 340_000, source: 'LINK', reference: 'X1' })
    assert(x.ok)
    await prisma.cardPayment.update({ where: { id: x.payment.id }, data: { status: 'EXPIRED', resolvedAt: new Date(), holdUntil: new Date(Date.now() - 60_000) } })
    assert.equal((await confirmCardPayment(x.payment.id, 'AUTO')).changed, false, 'a late SMS past the hold does not confirm')
    assert.equal((await confirmCardPayment(x.payment.id, 'OWNER')).changed, true)

    // An order the customer cancelled, its payment confirmed by hand: the order is paid, a newer card for it withdrawn.
    const draft = await prisma.orderDraft.create({
      data: {
        workspaceId: wid, agentId: agent.id, conversationId: other.id, channel: 'WEB_WIDGET', code: `Y${String(stamp).slice(-5)}`, status: 'CANCELLED', checkoutMode: 'CARD_TRANSFER',
        items: [{ productId: null, variationId: null, name: 'کیف', variant: null, quantity: 1, unitPrice: 350_000, url: null, maxQuantity: null }],
      },
    })
    const y1 = await createCardPayment({ workspaceId: wid, baseAmount: 350_000, source: 'CHAT', reference: draft.code, orderDraftId: draft.id, conversationId: other.id })
    assert(y1.ok)
    await cancelOpenCardPayments({ id: y1.payment.id })
    const y2 = await createCardPayment({ workspaceId: wid, baseAmount: 350_000, source: 'CHAT', reference: draft.code, orderDraftId: draft.id, conversationId: other.id })
    assert(y2.ok)
    assert.equal((await confirmCardPayment(y1.payment.id, 'OWNER')).changed, true)
    assert.equal((await prisma.orderDraft.findUniqueOrThrow({ where: { id: draft.id } })).status, 'PAID', 'the cancelled order is taken back')
    assert.equal((await prisma.cardPayment.findUniqueOrThrow({ where: { id: y2.payment.id } })).status, 'CANCELLED', 'no second payment for the same order')

    // Remainder text shape (pure).
    const view: CardPayView = { code: 'A1', authority: 'P1', url: 'https://vigent.ir/pay/P1', bankKey: 'mellat', pan: '6104337712345675', holder: null, amount: 30_237, expiresAt: new Date(Date.now() + 60_000).toISOString(), claim: true, status: 'PENDING', lang: 'en' }
    assert.match(composeCardPayRemainder(view, 450_000), /^450,000 Toman arrived.*30,237 Toman is still due/)

    console.log('payment gateway advanced smoke: all 7 paths passed')
  } finally {
    await prisma.workspace.delete({ where: { id: wid } })
  }
}

main().then(() => process.exit(0), (error) => { console.error(error); process.exit(1) })
