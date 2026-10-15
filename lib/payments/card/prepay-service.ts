/**
 * Advance payments for bookings and course seats — the DB half of prepay.ts.
 *
 *   issue  → the booking/seat is held as PENDING and a CardPayment with
 *            purpose BOOKING | COURSE carries the card to the customer
 *   settle → PAID confirms the booking/seat; EXPIRED or FAILED releases it
 *
 * Called from the payment state changes in service.ts, so a deposit SMS, the
 * owner's tap in the dashboard and the manager bot all settle the same way.
 */
import crypto from 'node:crypto'
import type { CardPayment } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { captureError } from '@/lib/errors/capture'
import { notifyWorkspace } from '@/lib/notifications/create'
import { payToman, type CardPayView } from '@/lib/payments/card/pay-card'
import { prepayAmount, readPrepayMode } from '@/lib/payments/card/prepay'

export type PaymentPurpose = 'ORDER' | 'BOOKING' | 'COURSE'

export function readPurpose(value: unknown): PaymentPurpose {
  return value === 'BOOKING' || value === 'COURSE' ? value : 'ORDER'
}

/** Short public reference for a deposit («N-7KQ2M» / «C-…»): the customer and the owner quote it. */
export function prepayReference(purpose: 'BOOKING' | 'COURSE'): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.randomBytes(5)
  let code = ''
  for (const byte of bytes) code += alphabet[byte % alphabet.length]
  return `${purpose === 'BOOKING' ? 'N' : 'C'}-${code}`
}

/** «بیعانهٔ نوبت کوتاهی مو» — how a payment is named to the owner and on the card. */
export function paymentSubject(payment: Pick<CardPayment, 'purpose' | 'reference' | 'description'>, lang: 'fa' | 'en' = 'fa'): string {
  const purpose = readPurpose(payment.purpose)
  const what = payment.description?.trim()
  if (purpose === 'BOOKING') return lang === 'en' ? `Booking deposit${what ? ` · ${what}` : ''}` : `بیعانهٔ نوبت${what ? ` ${what}` : ''}`
  if (purpose === 'COURSE') return lang === 'en' ? `Course seat${what ? ` · ${what}` : ''}` : `ثبت‌نام دورهٔ${what ? ` ${what}` : ''}`
  return lang === 'en' ? `Order ${payment.reference}` : `سفارش ${payment.reference}`
}

// ─── Issue ──────────────────────────────────────────────────────────────────

/**
 * Key under which a booking/course tool result carries the issued card. The
 * orchestrator takes it out before the result reaches the model (the model
 * never sees the card number) and appends the trusted marker to the reply.
 */
export const CARD_PAY_ATTACHMENT = '__cardPay'

/** Remove the card from a tool result; returns it for the trusted reply attachment. */
export function takeCardPayAttachment(output: unknown): CardPayView | null {
  if (!output || typeof output !== 'object' || !(CARD_PAY_ATTACHMENT in output)) return null
  const record = output as Record<string, unknown>
  const view = record[CARD_PAY_ATTACHMENT] as CardPayView | undefined
  delete record[CARD_PAY_ATTACHMENT]
  return view ?? null
}

export interface PrepayIssued {
  view: CardPayView
  amount: number
  minutes: number
}

/** The card for a booking or seat that was just held. Null when the gateway cannot issue one. */
async function issue(params: {
  workspaceId: string
  purpose: 'BOOKING' | 'COURSE'
  amount: number
  description: string
  appointmentId?: string
  enrollmentId?: string
  conversationId?: string | null
  customerName?: string | null
  customerPhone?: string | null
  lang: 'fa' | 'en'
}): Promise<PrepayIssued | null> {
  const { cardPayAvailability, createCardPayment, cardPayView } = await import('@/lib/payments/card/service')
  const availability = await cardPayAvailability(params.workspaceId, true)
  if (!availability.context) return null
  const created = await createCardPayment({
    workspaceId: params.workspaceId,
    baseAmount: params.amount,
    source: 'CHAT',
    reference: prepayReference(params.purpose),
    conversationId: params.conversationId ?? null,
    description: params.description,
    customerName: params.customerName ?? null,
    customerPhone: params.customerPhone ?? null,
  })
  if (!created.ok) return null
  const payment = await prisma.cardPayment.update({
    where: { id: created.payment.id },
    data: { purpose: params.purpose, appointmentId: params.appointmentId ?? null, enrollmentId: params.enrollmentId ?? null },
  })
  const view = cardPayView(payment, created.card, availability.context.settings, params.lang)
  return { view, amount: params.amount, minutes: availability.context.settings.ttlMinutes }
}

/** Whether a service asks for a deposit the gateway can collect now (checked before booking). */
export async function bookingPrepayDue(workspaceId: string, service: { prepayMode: string; prepayValue: number | null; price: number | null }, partySize = 1): Promise<number | null> {
  const amount = prepayAmount(service.prepayMode, service.prepayValue, service.price, partySize)
  if (amount == null) return null
  const { cardPayAvailability } = await import('@/lib/payments/card/service')
  const availability = await cardPayAvailability(workspaceId, true)
  return availability.context && amount <= availability.context.maxAmount ? amount : null
}

export async function issueBookingPrepay(params: {
  workspaceId: string
  appointmentId: string
  amount: number
  description: string
  conversationId?: string | null
  customerName?: string | null
  customerPhone?: string | null
  lang: 'fa' | 'en'
}): Promise<PrepayIssued | null> {
  return issue({ ...params, purpose: 'BOOKING' })
}

export async function coursePrepayDue(workspaceId: string, course: { prepayMode: string; prepayValue: number | null; price: number | null }): Promise<number | null> {
  if (readPrepayMode(course.prepayMode) === 'NONE') return null
  return bookingPrepayDue(workspaceId, course)
}

export async function issueCoursePrepay(params: {
  workspaceId: string
  enrollmentId: string
  amount: number
  description: string
  conversationId?: string | null
  customerName?: string | null
  customerPhone?: string | null
  lang: 'fa' | 'en'
}): Promise<PrepayIssued | null> {
  return issue({ ...params, purpose: 'COURSE' })
}

// ─── Settle ─────────────────────────────────────────────────────────────────

const UNPAID_REASON = 'پیش‌پرداخت در مهلت انجام نشد'

/**
 * Carry a payment's new state to what it pays for. Idempotent: every update
 * is conditional on the booking/seat still waiting for this payment.
 */
export async function settlePaymentPurpose(payment: CardPayment, status: 'PAID' | 'EXPIRED' | 'FAILED' | 'CANCELLED', now = new Date()): Promise<void> {
  const purpose = readPurpose(payment.purpose)
  try {
    if (purpose === 'BOOKING' && payment.appointmentId) await settleBooking(payment, status, now)
    if (purpose === 'COURSE' && payment.enrollmentId) await settleSeat(payment, status)
  } catch (error) {
    captureError('cardpay:settle-purpose', error, { workspaceId: payment.workspaceId, metadata: { paymentId: payment.id, purpose } })
  }
}

async function settleBooking(payment: CardPayment, status: 'PAID' | 'EXPIRED' | 'FAILED' | 'CANCELLED', now: Date) {
  const id = payment.appointmentId!
  if (status === 'PAID') {
    const confirmed = await prisma.appointment.updateMany({ where: { id, workspaceId: payment.workspaceId, status: 'PENDING' }, data: { status: 'CONFIRMED' } })
    if (confirmed.count) {
      const appointment = await prisma.appointment.findUnique({ where: { id }, include: { service: { select: { name: true } } } })
      if (appointment) {
        const { announceAppointment } = await import('@/lib/bookings/service')
        await announceAppointment(payment.workspaceId, appointment, { paid: `بیعانه ${payToman(payment.baseAmount, 'fa')} پرداخت شد` })
      }
      return
    }
    // The SMS came after the hold was released: the time may be someone else's now.
    const row = await prisma.appointment.findUnique({ where: { id }, select: { status: true, cancellationReason: true } })
    if (row?.status === 'CANCELLED' && row.cancellationReason === UNPAID_REASON) {
      await notifyWorkspace({
        workspaceId: payment.workspaceId,
        type: 'HANDOFF',
        title: `بیعانهٔ دیررس برای نوبت آزادشده`,
        body: `${payToman(payment.baseAmount, 'fa')} برای «${payment.description ?? payment.reference}» بعد از پایان مهلت رسید. نوبت قبلاً آزاد شده بود؛ با مشتری هماهنگ کنید یا دوباره ثبتش کنید.`,
        link: '/appointments',
        operatorTelegram: 'payments',
      })
    }
    return
  }
  await prisma.appointment.updateMany({
    where: { id, workspaceId: payment.workspaceId, status: 'PENDING' },
    data: { status: 'CANCELLED', cancelledAt: now, cancellationReason: UNPAID_REASON },
  })
}

async function settleSeat(payment: CardPayment, status: 'PAID' | 'EXPIRED' | 'FAILED' | 'CANCELLED') {
  const id = payment.enrollmentId!
  const { setEnrollmentStatus } = await import('@/lib/courses/service')
  const row = await prisma.courseEnrollment.findFirst({ where: { id, workspaceId: payment.workspaceId }, select: { status: true } })
  if (!row) return
  if (status === 'PAID') {
    if (row.status === 'PENDING') await setEnrollmentStatus(payment.workspaceId, id, 'CONFIRMED')
    else if (row.status === 'CANCELLED') {
      // A late SMS: take the seat back when there is still room, else tell the owner.
      try {
        await setEnrollmentStatus(payment.workspaceId, id, 'CONFIRMED')
      } catch {
        await notifyWorkspace({
          workspaceId: payment.workspaceId,
          type: 'HANDOFF',
          title: 'پرداخت دیررس برای دورهٔ پرشده',
          body: `${payToman(payment.baseAmount, 'fa')} برای «${payment.description ?? payment.reference}» بعد از پایان مهلت رسید و دوره دیگر جا ندارد. با مشتری هماهنگ کنید.`,
          link: '/courses',
          operatorTelegram: 'payments',
        })
      }
    }
    return
  }
  if (row.status === 'PENDING') await setEnrollmentStatus(payment.workspaceId, id, 'CANCELLED')
}
