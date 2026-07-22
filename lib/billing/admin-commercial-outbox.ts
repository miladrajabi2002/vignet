import type { Prisma } from '@prisma/client'
import { captureError } from '@/lib/errors/capture'
import { prisma } from '@/lib/prisma'
import {
  notifyAdminCommercialEvent,
  type AdminCommercialEvent,
} from '@/lib/billing/admin-commercial-notifications'

const CLAIM_LEASE_MS = 5 * 60_000
const RETRY_DELAYS_MS = [
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
  6 * 60 * 60_000,
  24 * 60 * 60_000,
] as const

/** Persisted in the same transaction as the payment claim, closing the crash gap. */
export async function enqueueAdminCommercialSms(
  tx: Prisma.TransactionClient,
  event: AdminCommercialEvent,
): Promise<void> {
  await tx.adminCommercialSmsOutbox.create({
    data: {
      paymentId: event.paymentId,
      workspaceId: event.workspaceId,
      kind: event.kind,
    },
  })
}

function retryAt(attemptCount: number, now: Date): Date {
  const index = Math.max(0, Math.min(attemptCount - 1, RETRY_DELAYS_MS.length - 1))
  const delay = RETRY_DELAYS_MS[index]
  return new Date(now.getTime() + delay)
}

/**
 * Claim and deliver one durable outbox row. A short database lease prevents the
 * callback and scheduler from sending the same row concurrently. If the process
 * dies after provider acceptance but before SENT is persisted, a later retry may
 * duplicate the SMS; that is preferable to silently losing a financial alert.
 */
export async function processAdminCommercialSmsPayment(paymentId: string): Promise<boolean> {
  const claimedAt = new Date()
  const staleBefore = new Date(claimedAt.getTime() - CLAIM_LEASE_MS)

  try {
    const claimed = await prisma.adminCommercialSmsOutbox.updateMany({
      where: {
        paymentId,
        sentAt: null,
        nextAttemptAt: { lte: claimedAt },
        OR: [{ claimedAt: null }, { claimedAt: { lt: staleBefore } }],
      },
      data: {
        claimedAt,
        attemptCount: { increment: 1 },
      },
    })
    if (claimed.count !== 1) return false

    const row = await prisma.adminCommercialSmsOutbox.findUnique({
      where: { paymentId },
      select: {
        id: true,
        paymentId: true,
        workspaceId: true,
        kind: true,
        attemptCount: true,
      },
    })
    if (!row) return false

    const delivered = await notifyAdminCommercialEvent({
      kind: row.kind as AdminCommercialEvent['kind'],
      paymentId: row.paymentId,
      workspaceId: row.workspaceId,
    })

    if (delivered) {
      await prisma.adminCommercialSmsOutbox.updateMany({
        where: { id: row.id, sentAt: null, claimedAt },
        data: { sentAt: new Date(), claimedAt: null, lastError: null },
      })
      return true
    }

    await prisma.adminCommercialSmsOutbox.updateMany({
      where: { id: row.id, sentAt: null, claimedAt },
      data: {
        claimedAt: null,
        nextAttemptAt: retryAt(row.attemptCount, claimedAt),
        lastError: 'SMS_DELIVERY_FAILED',
      },
    })
    return false
  } catch (error) {
    captureError('billing:admin-commercial-sms-outbox', error, {
      metadata: { paymentId },
    })
    return false
  }
}

/** Retry due rows from the existing worker scheduler. */
export async function sweepAdminCommercialSmsOutbox(limit = 25): Promise<number> {
  const now = new Date()
  const staleBefore = new Date(now.getTime() - CLAIM_LEASE_MS)
  const due = await prisma.adminCommercialSmsOutbox.findMany({
    where: {
      sentAt: null,
      nextAttemptAt: { lte: now },
      OR: [{ claimedAt: null }, { claimedAt: { lt: staleBefore } }],
    },
    orderBy: { nextAttemptAt: 'asc' },
    take: Math.max(1, Math.min(limit, 100)),
    select: { paymentId: true },
  })

  let delivered = 0
  for (const row of due) {
    if (await processAdminCommercialSmsPayment(row.paymentId)) delivered += 1
  }
  return delivered
}
