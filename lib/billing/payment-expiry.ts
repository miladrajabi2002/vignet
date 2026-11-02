import type { PaymentGateway, PaymentStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * Plan / AI-credit checkouts that never come back.
 *
 * A gateway only reports on a payment the customer actually started. Someone
 * who opens the NowPayments invoice and closes it without picking a coin, or
 * leaves the bank page, produces no callback at all — so without this sweep
 * the row stayed «در انتظار» forever. Crypto gets a whole day because a
 * transfer can sit in the mempool for hours before the IPN arrives.
 *
 * EXPIRED is not final: a gateway that later proves the money arrived still
 * activates the payment (see CLAIMABLE_PAYMENT_STATUSES).
 */
export const PAYMENT_PENDING_TTL_MS: Record<PaymentGateway, number> = {
  NOWPAYMENTS: 24 * 60 * 60_000,
  VIGENTPAY: 60 * 60_000,
  ZARINPAY: 60 * 60_000,
}

/** Statuses a verified gateway confirmation may still turn into PAID. */
export const CLAIMABLE_PAYMENT_STATUSES: PaymentStatus[] = ['PENDING', 'EXPIRED']

export async function sweepStalePayments(now = new Date()): Promise<{ expired: number }> {
  let expired = 0
  for (const [gateway, ttl] of Object.entries(PAYMENT_PENDING_TTL_MS) as [PaymentGateway, number][]) {
    const result = await prisma.payment.updateMany({
      where: { gateway, status: 'PENDING', createdAt: { lt: new Date(now.getTime() - ttl) } },
      data: { status: 'EXPIRED' },
    })
    expired += result.count
  }
  return { expired }
}

/**
 * The customer pressed «cancel» on the NowPayments page. The payment is closed
 * right away instead of waiting a day; a coin sent anyway still activates it.
 */
export async function expireCancelledPayment(workspaceId: string, paymentId: string): Promise<boolean> {
  const result = await prisma.payment.updateMany({
    where: { id: paymentId, workspaceId, gateway: 'NOWPAYMENTS', status: 'PENDING' },
    data: { status: 'EXPIRED' },
  })
  return result.count === 1
}
