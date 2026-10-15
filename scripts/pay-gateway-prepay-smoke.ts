/**
 * Smoke of the gateway's newer paths against a real database: advance payment
 * for a booking and a course seat (held → paid → confirmed; held → expired →
 * released), the manager bot's payment screens and the admin loaders.
 * Run: tsx -r dotenv/config scripts/pay-gateway-prepay-smoke.ts   (never against production)
 */
import assert from 'node:assert/strict'
import { prisma } from '@/lib/prisma'
import { groupDigits } from '@/lib/payments/card/amount'
import { deviceTokenFields, ingestBankSms, newDeviceToken } from '@/lib/payments/card/ingest'
import { addPayCard, cardPayAvailability, sweepCardPayments } from '@/lib/payments/card/service'
import { takeCardPayAttachment } from '@/lib/payments/card/prepay-service'
import { executeBookingAgentTool } from '@/lib/bookings/agent-tools'
import { executeCourseAgentTool } from '@/lib/courses/agent-tools'
import { dateKeyInTimeZone } from '@/lib/bookings/time'
import { shiftDateKey } from '@/components/bookings/booking-model'
import {
  payHomeScreen, paymentConfirmScreen, paymentListScreen, paymentScreen, payLinkCreatedScreen, smsListScreen, smsScreen,
} from '@/lib/channels/operator-bot-pay'
import { dailyReportScreen, homeScreen } from '@/lib/channels/operator-bot-screens'
import { loadGatewayBusinesses, loadGatewaySummary } from '@/lib/admin/payment-gateway'

const callbacks = (screen: { keyboard: { inline_keyboard: Array<Array<{ callback_data?: string }>> } }) =>
  screen.keyboard.inline_keyboard.flat().map((button) => button.callback_data).filter(Boolean) as string[]

async function main() {
  if (!/paydev|test/.test(process.env.DATABASE_URL ?? '')) throw new Error('Refusing to run outside a test database')
  const stamp = Date.now()
  const workspace = await prisma.workspace.create({ data: { name: 'سالن آزمایشی', slug: `prepay-smoke-${stamp}`, payGatewayEnabled: true } })
  const wid = workspace.id
  try {
    await addPayCard(wid, { pan: '6104 3377 1234 5675', holderName: 'نگار رضایی' })
    const device = await prisma.payDevice.create({ data: { workspaceId: wid, name: 'گوشی سالن', phone: `0935${String(stamp).slice(-7)}`, method: 'SMS', connectedAt: new Date(), ...deviceTokenFields(newDeviceToken()) } })
    const deposit = (toman: number) => `حساب8907027623\nواریز${groupDigits(toman * 10)}\nمانده452,963,014\n05/07/15-11:33`

    // ── 1) booking with a 30% deposit → held, paid, confirmed ──────────────
    const service = await prisma.service.create({
      data: {
        workspaceId: wid, slug: `cut-${stamp}`, name: 'کوتاهی مو', durationMinutes: 60, price: 900_000, prepayMode: 'PERCENT', prepayValue: 30,
        weeklyRules: { create: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinute: 540, endMinute: 1260 })) },
      },
    })
    const tomorrow = shiftDateKey(dateKeyInTimeZone(new Date(), 'Asia/Tehran'), 1)
    const book = async (startMinute: number, conversationId: string) => (await executeBookingAgentTool({
      workspaceId: wid, conversationId, name: 'create_appointment', isFa: true,
      arguments: { serviceId: service.id, localDate: tomorrow, startMinute, partySize: 1, customerName: 'سارا محمدی', customerPhone: '09121234567', idempotencyKey: `smoke-${stamp}-${startMinute}` },
    })) as Record<string, unknown>
    const booked = await book(600, `conv-${stamp}-1`)
    const bookingCard = takeCardPayAttachment(booked)
    assert.equal(booked.status, 'AWAITING_PAYMENT')
    assert(bookingCard && bookingCard.title?.includes('بیعانهٔ نوبت کوتاهی مو'), 'the deposit card names the booking')
    assert(!JSON.stringify(booked).includes(bookingCard.pan), 'the model never sees the card number')
    const bookingPayment = await prisma.cardPayment.findFirstOrThrow({ where: { workspaceId: wid, purpose: 'BOOKING' }, orderBy: { createdAt: 'asc' } })
    assert.equal(bookingPayment.baseAmount, 270_000)
    assert.equal((await prisma.appointment.findUniqueOrThrow({ where: { id: bookingPayment.appointmentId! } })).status, 'PENDING')
    // Repeating the request shows the same card, not a second payment.
    const again = await book(600, `conv-${stamp}-1`)
    assert.equal(takeCardPayAttachment(again)?.authority, bookingCard.authority)
    assert.equal((await ingestBankSms(device, 'SMS', deposit(bookingPayment.payAmount))).status, 'matched')
    assert.equal((await prisma.appointment.findUniqueOrThrow({ where: { id: bookingPayment.appointmentId! } })).status, 'CONFIRMED')

    // ── 2) booking left unpaid → released at the deadline ──────────────────
    const held = await book(720, `conv-${stamp}-2`)
    assert.equal(held.status, 'AWAITING_PAYMENT')
    const heldPayment = await prisma.cardPayment.findFirstOrThrow({ where: { workspaceId: wid, purpose: 'BOOKING', status: 'PENDING' } })
    await sweepCardPayments(new Date(heldPayment.expiresAt.getTime() + 60_000))
    const released = await prisma.appointment.findUniqueOrThrow({ where: { id: heldPayment.appointmentId! } })
    assert.equal(released.status, 'CANCELLED')
    assert.equal(released.cancellationReason, 'پیش‌پرداخت در مهلت انجام نشد')

    // ── 3) course seat with a fixed deposit → held, paid, confirmed ────────
    const course = await prisma.course.create({
      data: {
        workspaceId: wid, slug: `photo-${stamp}`, title: 'عکاسی با موبایل', price: 2_000_000, prepayMode: 'FIXED', prepayValue: 500_000, capacity: 10, status: 'PUBLISHED',
        sessions: { create: [{ startsAt: new Date(Date.now() + 7 * 86_400_000), endsAt: new Date(Date.now() + 7 * 86_400_000 + 5_400_000) }] },
      },
    })
    const enroll = async (phone: string, conversationId: string) => executeCourseAgentTool({
      workspaceId: wid, conversationId, name: 'enroll_in_course', isFa: true, idempotencyKey: `smoke-${stamp}-${phone}`,
      arguments: { courseId: course.id, customerName: 'رضا کریمی', customerPhone: phone },
    })
    const seat = await enroll('09121112233', `conv-${stamp}-3`)
    const seatCard = takeCardPayAttachment(seat)
    assert.equal(seat.status, 'AWAITING_PAYMENT')
    assert(seatCard?.title?.includes('عکاسی با موبایل'))
    const seatPayment = await prisma.cardPayment.findFirstOrThrow({ where: { workspaceId: wid, purpose: 'COURSE' } })
    assert.equal(seatPayment.baseAmount, 500_000)
    assert.equal((await ingestBankSms(device, 'SMS', deposit(seatPayment.payAmount))).status, 'matched')
    assert.equal((await prisma.courseEnrollment.findUniqueOrThrow({ where: { id: seatPayment.enrollmentId! } })).status, 'CONFIRMED')

    // ── 4) course seat left unpaid → released ───────────────────────────────
    await enroll('09121112244', `conv-${stamp}-4`)
    const seatHeld = await prisma.cardPayment.findFirstOrThrow({ where: { workspaceId: wid, purpose: 'COURSE', status: 'PENDING' } })
    await sweepCardPayments(new Date(seatHeld.expiresAt.getTime() + 60_000))
    assert.equal((await prisma.courseEnrollment.findUniqueOrThrow({ where: { id: seatHeld.enrollmentId! } })).status, 'CANCELLED')

    // ── 5) manager bot payment screens ──────────────────────────────────────
    const unmatched = await ingestBankSms(device, 'SMS', deposit(333_000))
    assert.equal(unmatched.status, 'unmatched')
    const home = await payHomeScreen(wid)
    assert(home.text.includes('درگاه پرداخت') && home.text.includes('۷۷۰٬۰۰۰'), 'today’s received total is shown')
    assert(callbacks(home).includes('ps:l') && callbacks(home).includes('pn:new'))
    const list = await paymentListScreen(wid, 'p', 0)
    assert.equal(callbacks(list).filter((data) => data.startsWith('py:v:')).length, 2)
    assert((await paymentScreen(wid, bookingPayment.id))!.text.includes('خودکار از روی پیامک بانک'))
    assert((await paymentConfirmScreen(wid, heldPayment.id, 'confirm'))!.text.includes('تأیید شود'))
    assert((await smsListScreen(wid)).text.includes('۳۳۳٬۰۰۰'))
    assert(unmatched.status === 'unmatched' && (await smsScreen(wid, unmatched.smsId))!.text.includes('واریز'))
    const link = await payLinkCreatedScreen(wid, { amount: 250_000, description: 'سفارش تلفنی' })
    assert(link.text.includes('6104337712345675') && link.text.includes('/pay/'))
    const controlCenter = await homeScreen({ id: 'op', workspaceId: wid, active: true, prefs: {} })
    assert(callbacks(controlCenter).includes('m:pay') && controlCenter.text.includes('دریافتی درگاه'))
    assert((await dailyReportScreen({ id: 'op', workspaceId: wid, active: true, prefs: {} })).text.length > 0)

    // ── 6) admin: the business is listed live; suspension and cap override bite ──
    const row = (await loadGatewayBusinesses()).find((item) => item.workspaceId === wid)
    assert.equal(row?.state, 'live')
    assert.equal(row?.unmatched, 1)
    assert.equal((await loadGatewaySummary()).series.length, 30)
    await prisma.workspace.update({ where: { id: wid }, data: { payGatewayCapOverride: 0 } })
    assert.equal((await cardPayAvailability(wid, true)).reason, 'CAP_REACHED')
    await prisma.workspace.update({ where: { id: wid }, data: { payGatewayCapOverride: -1, payGatewaySuspendedAt: new Date() } })
    assert.equal((await cardPayAvailability(wid, true)).reason, 'SUSPENDED')
    // A suspended gateway books without a deposit instead of failing.
    const noDeposit = await book(840, `conv-${stamp}-5`)
    assert.equal(noDeposit.status, 'CONFIRMED')
    console.log('payment gateway prepay/bot/admin smoke: all 6 paths passed')
  } finally {
    await prisma.workspace.delete({ where: { id: wid } })
  }
}

main().then(() => process.exit(0), (error) => { console.error(error); process.exit(1) })
