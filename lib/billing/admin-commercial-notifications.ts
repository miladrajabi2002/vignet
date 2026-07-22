import { ADMIN_OWNER_PHONE } from '@/lib/admin/owner'
import { captureError } from '@/lib/errors/capture'
import { normalizePhone } from '@/lib/phone'
import { prisma } from '@/lib/prisma'
import { sendSms } from '@/lib/sms/ippanel'

export type AdminCommercialEventKind =
  | 'SUBSCRIPTION_PURCHASED'
  | 'SUBSCRIPTION_RENEWED'
  | 'AI_CREDIT_TOPPED_UP'

export type AdminCommercialEvent = {
  kind: AdminCommercialEventKind
  paymentId: string
  workspaceId: string
}

function adminCommercialSmsPhone(): string | null {
  const configured = process.env.ADMIN_COMMERCIAL_SMS_PHONE?.trim() || ADMIN_OWNER_PHONE || ''
  return normalizePhone(configured)
}

function compact(value: string | null | undefined, fallback = 'نامشخص'): string {
  const normalized = value?.replace(/\s+/g, ' ').trim()
  if (!normalized) return fallback
  return normalized.length > 48 ? `${normalized.slice(0, 47)}…` : normalized
}

function planLabelFa(plan: string | null): string {
  switch (plan) {
    case 'STARTER':
      return 'استارتر'
    case 'PRO':
      return 'حرفه‌ای'
    case 'BUSINESS':
      return 'بیزینس'
    default:
      return plan ?? 'نامشخص'
  }
}

function gatewayLabelFa(gateway: string): string {
  switch (gateway) {
    case 'ZARINPAY':
      return 'زرین‌پی'
    case 'NOWPAYMENTS':
      return 'NOWPayments'
    default:
      return gateway
  }
}

function captureAdminCommercialSmsError(
  event: AdminCommercialEvent,
  error: unknown,
): void {
  captureError('billing:admin-commercial-sms', error, {
    workspaceId: event.workspaceId,
    metadata: { paymentId: event.paymentId, eventKind: event.kind },
  })
}

function formatAmount(amount: number, currency: string): string {
  if (currency === 'IRR') {
    return `${Math.round(amount / 10).toLocaleString('fa-IR')} تومان`
  }
  if (currency === 'USD') {
    return `${amount.toLocaleString('fa-IR', { maximumFractionDigits: 2 })} دلار`
  }
  return `${amount.toLocaleString('fa-IR', { maximumFractionDigits: 2 })} ${currency}`
}

function formatPaidAt(date: Date): string {
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: process.env.DASHBOARD_TZ || 'Asia/Tehran',
    }).format(date)
  } catch {
    return date.toISOString()
  }
}

/**
 * Notify the platform owner after a commercial payment has been durably claimed.
 *
 * Payment/workspace details are loaded from the database instead of trusting a
 * callback payload. The PAID/kind checks are a defense-in-depth guard: initiated,
 * failed or mismatched payments never generate an admin SMS. This helper never
 * throws, so an SMS outage cannot turn a successful payment into a failed request.
 */
export async function notifyAdminCommercialEvent(
  event: AdminCommercialEvent,
): Promise<boolean> {
  const mobile = adminCommercialSmsPhone()
  if (!mobile) {
    captureAdminCommercialSmsError(event, new Error('ADMIN_COMMERCIAL_SMS_PHONE_INVALID'))
    return false
  }

  try {
    const payment = await prisma.payment.findUnique({
      where: { id: event.paymentId },
      select: {
        id: true,
        workspaceId: true,
        gateway: true,
        kind: true,
        status: true,
        plan: true,
        amount: true,
        currency: true,
        externalId: true,
        paidAt: true,
        workspace: {
          select: {
            name: true,
            slug: true,
            aiCreditBalanceIRR: true,
            owner: { select: { name: true, phone: true } },
          },
        },
      },
    })

    const expectsCredit = event.kind === 'AI_CREDIT_TOPPED_UP'
    if (
      !payment ||
      payment.workspaceId !== event.workspaceId ||
      payment.status !== 'PAID' ||
      !payment.paidAt ||
      (expectsCredit ? payment.kind !== 'AI_CREDIT' : payment.kind !== 'SUBSCRIPTION')
    ) {
      return false
    }

    const title = event.kind === 'SUBSCRIPTION_RENEWED'
      ? 'تمدید اشتراک'
      : event.kind === 'SUBSCRIPTION_PURCHASED'
        ? 'خرید اشتراک'
        : 'شارژ اعتبار'
    const workspace = `${compact(payment.workspace.name)} (${compact(payment.workspace.slug)})`
    const owner = `${compact(payment.workspace.owner?.name)} | ${compact(payment.workspace.owner?.phone)}`
    const commercialDetail = expectsCredit
      ? [
          `مبلغ شارژ: ${formatAmount(payment.amount, payment.currency)}`,
          `موجودی جدید: ${formatAmount(payment.workspace.aiCreditBalanceIRR, 'IRR')}`,
        ]
      : [
          `پلن: ${planLabelFa(payment.plan)}`,
          `مبلغ: ${formatAmount(payment.amount, payment.currency)}`,
        ]

    const message = [
      `ویجنت | ${title}`,
      `کسب‌وکار: ${workspace}`,
      `کاربر: ${owner}`,
      ...commercialDetail,
      `درگاه: ${gatewayLabelFa(payment.gateway)}`,
      `شناسه تراکنش درگاه: ${compact(payment.externalId)}`,
      `شناسه پرداخت: ${payment.id}`,
      `زمان: ${formatPaidAt(payment.paidAt)}`,
    ].join('\n')

    const delivered = await sendSms(mobile, message)
    if (!delivered) {
      captureAdminCommercialSmsError(event, new Error('SMS_DELIVERY_FAILED'))
    }
    return delivered
  } catch (error) {
    captureAdminCommercialSmsError(event, error)
    return false
  }
}
