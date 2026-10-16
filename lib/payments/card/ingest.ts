/**
 * Bank SMS ingest. Two doors, one reader:
 *   • SMS line  — the owner's phone forwards the bank SMS to the platform's
 *                 SMS line; the SMS panel calls /api/pay/sms/inbound and the
 *                 SENDER'S NUMBER identifies the registered phone;
 *   • URL       — a forwarder app calls /api/pay/sms/<token>; the token does.
 * A message from a number or token that is not registered is dropped without
 * being stored.
 */
import crypto from 'node:crypto'
import type { PayDevice } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { decrypt, encrypt } from '@/lib/crypto'
import { normalizeIranianMobile } from '@/lib/phone'
import { captureError } from '@/lib/errors/capture'
import { notifyWorkspace } from '@/lib/notifications/create'
import { rialToToman } from '@/lib/payments/card/amount'
import { payToman } from '@/lib/payments/card/pay-card'
import { parseBankSms } from '@/lib/payments/card/sms-parse'
import { confirmCardPayment, MIN_PAY_AMOUNT, OPEN_PAYMENT_STATUSES, recordPartialDeposit } from '@/lib/payments/card/service'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir').replace(/\/$/, '')

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

// ─── Devices ────────────────────────────────────────────────────────────────

export function newDeviceToken(): string {
  return `dv_${crypto.randomBytes(24).toString('base64url')}`
}

export function deviceTokenFields(token: string): { tokenHash: string; tokenEncrypted: string } {
  return { tokenHash: sha256(token), tokenEncrypted: encrypt(token) }
}

export function deviceUrl(device: Pick<PayDevice, 'tokenEncrypted'>): string {
  return `${APP_URL}/api/pay/sms/${decrypt(device.tokenEncrypted)}`
}

export async function findDeviceByToken(token: string): Promise<PayDevice | null> {
  if (!/^dv_[\w-]{20,}$/.test(token)) return null
  const device = await prisma.payDevice.findUnique({ where: { tokenHash: sha256(token) } })
  return device?.active ? device : null
}

export async function findDeviceByPhone(from: string): Promise<PayDevice | null> {
  const phone = normalizeIranianMobile(from)
  if (!phone) return null
  const device = await prisma.payDevice.findUnique({ where: { phone } })
  return device?.active ? device : null
}

// ─── Ingest ─────────────────────────────────────────────────────────────────

export type IngestOutcome =
  | { status: 'matched'; paymentId: string }
  | { status: 'unmatched'; smsId: string }
  | { status: 'ignored'; reason: 'secret' | 'not-deposit' | 'duplicate' | 'empty' }

/**
 * Read one forwarded message from a registered phone. A deposit whose amount
 * equals exactly one open payment of that business confirms it; any other
 * deposit is kept for the owner as «واریز بدون سفارش».
 */
export async function ingestBankSms(device: PayDevice, via: 'SMS' | 'URL', rawText: string, now = new Date()): Promise<IngestOutcome> {
  const text = rawText.trim().slice(0, 1200)
  // Any message proves the phone is forwarding.
  await prisma.payDevice.update({
    where: { id: device.id },
    data: { lastSmsAt: now, connectedAt: device.connectedAt ?? now, silentClaims: 0 },
  }).catch(() => {})
  if (!text) return { status: 'ignored', reason: 'empty' }

  const parsed = parseBankSms(text)
  if (parsed.kind === 'secret') return { status: 'ignored', reason: 'secret' }
  if (parsed.kind !== 'deposit' || !parsed.candidates.length) return { status: 'ignored', reason: 'not-deposit' }

  const dedupeHash = sha256(`${device.id}\n${text}`)
  // The same message forwarded twice (some apps retry).
  if (await prisma.bankSms.findUnique({ where: { dedupeHash }, select: { id: true } })) return { status: 'ignored', reason: 'duplicate' }
  const amounts = parsed.candidates.map(rialToToman).filter((value): value is number => value != null)
  const candidates = amounts.length
    ? await prisma.cardPayment.findMany({
        where: {
          workspaceId: device.workspaceId,
          payAmount: { in: amounts },
          OR: [{ status: { in: OPEN_PAYMENT_STATUSES } }, { status: 'EXPIRED', holdUntil: { gt: now } }],
        },
        orderBy: { createdAt: 'desc' },
      })
    : []
  // Best-ranked amount first; one SMS confirms one payment.
  const hit = amounts.map((amount) => candidates.filter((payment) => payment.payAmount === amount)).find((group) => group.length === 1)?.[0] ?? null
  const amount = hit?.payAmount ?? (parsed.amountRial != null ? Math.floor(parsed.amountRial / 10) : null)

  let smsId: string
  try {
    const row = await prisma.bankSms.create({
      data: {
        workspaceId: device.workspaceId,
        deviceId: device.id,
        via,
        text: parsed.redacted.slice(0, 1200),
        kind: 'DEPOSIT',
        amount,
        status: hit ? 'MATCHED' : 'UNMATCHED',
        dedupeHash,
        paymentId: hit?.id ?? null,
        receivedAt: now,
      },
      select: { id: true },
    })
    smsId = row.id
  } catch (error) {
    // Two deliveries of one message racing each other (unique dedupeHash).
    if ((error as { code?: string }).code === 'P2002') return { status: 'ignored', reason: 'duplicate' }
    throw error
  }

  if (hit) {
    await prisma.payDevice.updateMany({ where: { id: device.id, verifiedAt: null }, data: { verifiedAt: now } }).catch(() => {})
    await confirmCardPayment(hit.id, 'AUTO', now)
    return { status: 'matched', paymentId: hit.id }
  }

  await notifyWorkspace({
    workspaceId: device.workspaceId,
    type: 'SYSTEM',
    title: 'واریز بدون سفارش',
    body: amount != null
      ? `${payToman(amount, 'fa')} واریز شد ولی هیچ پرداخت بازی با این مبلغ دقیق نیست. از «درگاه پرداخت» به سفارش درست وصلش کنید.`
      : 'یک پیامک واریز رسید که مبلغش خوانده نشد.',
    link: '/payments',
    operatorTelegram: 'payments',
    operatorButtons: [[{ text: '🔗 وصل کردن به پرداخت', callback_data: `ps:v:${smsId}` }]],
  }).catch((error) => captureError('cardpay:unmatched', error, { workspaceId: device.workspaceId }))
  return { status: 'unmatched', smsId }
}

/** Open payments the owner may attach an unmatched deposit to, closest amount first. */
export async function suggestPaymentsForSms(workspaceId: string, amount: number | null, now = new Date()) {
  const open = await prisma.cardPayment.findMany({
    where: { workspaceId, OR: [{ status: { in: OPEN_PAYMENT_STATUSES } }, { status: 'EXPIRED', holdUntil: { gt: now } }] },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { id: true, reference: true, baseAmount: true, payAmount: true, status: true, customerName: true, createdAt: true },
  })
  if (amount == null) return open.slice(0, 5)
  return open
    .map((payment) => ({ payment, distance: Math.min(Math.abs(payment.payAmount - amount), Math.abs(payment.baseAmount - amount)) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5)
    .map((row) => row.payment)
}

/**
 * How an unmatched deposit lands on a payment: SHORT keeps it open and asks
 * for the rest, FULL confirms it, with `extra` tomans beyond what was due.
 * A shortfall under the smallest transfer is forgiven (FULL).
 */
export function depositFit(deposit: number | null, due: number): { kind: 'SHORT'; rest: number } | { kind: 'FULL'; extra: number } {
  if (deposit == null) return { kind: 'FULL', extra: 0 }
  if (due - deposit >= MIN_PAY_AMOUNT) return { kind: 'SHORT', rest: due - deposit }
  return { kind: 'FULL', extra: Math.max(0, deposit - due) }
}

/**
 * The owner attaches an unmatched deposit to a payment or dismisses it.
 * A deposit short of what is due keeps the payment open for the rest; a
 * larger one confirms it and records the extra.
 */
export async function resolveBankSms(workspaceId: string, smsId: string, paymentId: string | null, by: 'OWNER' | 'OPERATOR' | 'ADMIN' = 'OWNER'): Promise<boolean> {
  const sms = await prisma.bankSms.findFirst({ where: { id: smsId, workspaceId, status: 'UNMATCHED' } })
  if (!sms) return false
  if (paymentId) {
    const payment = await prisma.cardPayment.findFirst({ where: { id: paymentId, workspaceId } })
    if (!payment) return false
    const fit = depositFit(sms.amount, payment.payAmount)
    const result = fit.kind === 'SHORT' && sms.amount != null
      ? await recordPartialDeposit(payment.id, sms.amount)
      : await confirmCardPayment(payment.id, by, new Date(), { overpaid: fit.kind === 'FULL' ? fit.extra : null })
    if (!result.changed) return false
  }
  await prisma.bankSms.update({ where: { id: smsId }, data: { status: 'RESOLVED', paymentId } })
  return true
}
