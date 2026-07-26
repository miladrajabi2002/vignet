import { ADMIN_OWNER_PHONE } from '@/lib/admin/owner'
import { captureError } from '@/lib/errors/capture'
import { normalizePhone } from '@/lib/phone'
import { prisma } from '@/lib/prisma'
import {
  sendAdminCreditTopupSms,
  sendAdminSubscriptionPurchasedSms,
  sendAdminSubscriptionRenewedSms,
} from '@/lib/sms/ippanel'

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

    const common = {
      workspace: compact(`${payment.workspace.name} (${payment.workspace.slug})`),
      owner: compact(payment.workspace.owner?.name),
      phone: compact(payment.workspace.owner?.phone),
      amount: formatAmount(payment.amount, payment.currency),
      gateway: gatewayLabelFa(payment.gateway),
      reference: compact(payment.externalId, payment.id),
    }

    const delivered = event.kind === 'SUBSCRIPTION_PURCHASED'
      ? await sendAdminSubscriptionPurchasedSms(mobile, {
          ...common,
          plan: planLabelFa(payment.plan),
        })
      : event.kind === 'SUBSCRIPTION_RENEWED'
        ? await sendAdminSubscriptionRenewedSms(mobile, {
            ...common,
            plan: planLabelFa(payment.plan),
          })
        : await sendAdminCreditTopupSms(mobile, {
            ...common,
            balance: formatAmount(payment.workspace.aiCreditBalanceIRR, 'IRR'),
          })

    if (!delivered) {
      captureAdminCommercialSmsError(event, new Error('SMS_DELIVERY_FAILED'))
    }
    return delivered
  } catch (error) {
    captureAdminCommercialSmsError(event, error)
    return false
  }
}
