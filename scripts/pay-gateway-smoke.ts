/**
 * End-to-end smoke of the payment gateway against a real database:
 * card → payment → forwarded bank SMS → paid; plus the review and expiry paths.
 * Run: tsx -r dotenv/config scripts/pay-gateway-smoke.ts   (never against production)
 */
import assert from 'node:assert/strict'
import { prisma } from '@/lib/prisma'
import { groupDigits } from '@/lib/payments/card/amount'
import { deviceTokenFields, findDeviceByPhone, findDeviceByToken, ingestBankSms, newDeviceToken, resolveBankSms } from '@/lib/payments/card/ingest'
import { addPayCard, claimCardPayment, createCardPayment, rejectCardPayment, sweepCardPayments } from '@/lib/payments/card/service'

async function main() {
  if (!/paydev|test/.test(process.env.DATABASE_URL ?? '')) throw new Error('Refusing to run outside a test database')
  const stamp = Date.now()
  const workspace = await prisma.workspace.create({ data: { name: 'فروشگاه آزمایشی', slug: `pay-smoke-${stamp}`, payGatewayEnabled: true } })
  const wid = workspace.id
  try {
    // 6104337712345675 is a Luhn-valid Mellat test number.
    const card = await addPayCard(wid, { pan: '6104 3377 1234 5675', holderName: 'نگار رضایی' })
    assert.equal(card.bankKey, 'mellat')
    const token = newDeviceToken()
    const phone = `0912${String(stamp).slice(-7)}`
    const device = await prisma.payDevice.create({ data: { workspaceId: wid, name: 'گوشی فروشگاه', phone, method: 'SMS', ...deviceTokenFields(token) } })
    assert.equal((await findDeviceByToken(token))?.id, device.id)
    assert.equal((await findDeviceByPhone(`+98${phone.slice(1)}`))?.id, device.id)
    assert.equal(await findDeviceByPhone('09120000001'), null)

    // 1) exact transfer → paid automatically
    const a = await createCardPayment({ workspaceId: wid, baseAmount: 1_250_000, source: 'LINK', reference: 'A1' })
    assert(a.ok)
    const b = await createCardPayment({ workspaceId: wid, baseAmount: 1_250_000, source: 'LINK', reference: 'B1' })
    assert(b.ok)
    assert.notEqual(a.payment.payAmount, b.payment.payAmount)
    assert(a.payment.payAmount > 1_250_000 && a.payment.payAmount <= 1_250_999)
    const smsA = `حساب8907027623\nواریز${groupDigits(a.payment.payAmount * 10)}\nمانده452,963,014\n05/07/15-11:33`
    const hit = await ingestBankSms(device, 'SMS', smsA)
    assert.deepEqual(hit, { status: 'matched', paymentId: a.payment.id })
    assert.equal((await prisma.cardPayment.findUnique({ where: { id: a.payment.id } }))?.status, 'PAID')
    assert.equal((await prisma.cardPayment.findUnique({ where: { id: b.payment.id } }))?.status, 'PENDING')
    assert.deepEqual(await ingestBankSms(device, 'SMS', smsA), { status: 'ignored', reason: 'duplicate' })
    const stored = await prisma.bankSms.findFirst({ where: { paymentId: a.payment.id } })
    assert(stored && !stored.text.includes('452,963,014'), 'balance must not be stored')

    // 2) rounded transfer → unmatched, owner attaches it
    const round = await ingestBankSms(device, 'URL', `انتقال اينترنت:‎+${groupDigits(12_500_000)}‎\nحساب:152601422685\nمانده:136,553,207\n0721-15:38`)
    assert.equal(round.status, 'unmatched')
    assert(round.status === 'unmatched' && (await resolveBankSms(wid, round.smsId, b.payment.id)))
    assert.equal((await prisma.cardPayment.findUnique({ where: { id: b.payment.id } }))?.confirmedBy, 'OWNER')

    // 3) password and withdrawal are dropped
    assert.deepEqual(await ingestBankSms(device, 'SMS', 'خرید\nمبلغ 12,503,470 ریال\nرمز 482913'), { status: 'ignored', reason: 'secret' })
    assert.deepEqual(await ingestBankSms(device, 'SMS', 'حساب9876543210\nبرداشت12,503,470\nمانده1'), { status: 'ignored', reason: 'not-deposit' })
    assert.equal(await prisma.bankSms.count({ where: { workspaceId: wid } }), 2)

    // 4) «پرداخت کردم» → review → rejected
    const c = await createCardPayment({ workspaceId: wid, baseAmount: 480_000, source: 'LINK', reference: 'C1' })
    assert(c.ok)
    assert((await claimCardPayment(c.payment.id)).changed)
    assert.equal((await prisma.cardPayment.findUnique({ where: { id: c.payment.id } }))?.status, 'CLAIMED')
    assert((await rejectCardPayment(c.payment.id)).changed)

    // 5) deadline → expired, a late SMS inside the grace window still confirms
    const d = await createCardPayment({ workspaceId: wid, baseAmount: 990_000, source: 'LINK', reference: 'D1' })
    assert(d.ok)
    const later = new Date(d.payment.expiresAt.getTime() + 60_000)
    assert.equal((await sweepCardPayments(later)).expired, 1)
    const late = await ingestBankSms(device, 'SMS', `واریز: +${groupDigits(d.payment.payAmount * 10)}\nمانده: 20,000,000`, later)
    assert.equal(late.status, 'matched')

    // 6) a switched-off gateway issues nothing
    await prisma.workspace.update({ where: { id: wid }, data: { payGatewayEnabled: false } })
    assert.deepEqual(await createCardPayment({ workspaceId: wid, baseAmount: 100_000, source: 'LINK', reference: 'E1' }), { ok: false, error: 'DISABLED' })
    console.log('payment gateway smoke: all 6 paths passed')
  } finally {
    await prisma.workspace.delete({ where: { id: wid } })
  }
}

main().then(() => process.exit(0), (error) => { console.error(error); process.exit(1) })
