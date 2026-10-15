/**
 * Payment gateway — the DB/network half.
 *
 *   create  → a CardPayment with the business's card and a unique amount
 *   ingest  → a forwarded bank SMS from a registered phone; a deposit whose
 *             amount equals one open payment confirms it (lib/…/ingest.ts)
 *   claim   → the customer says «پرداخت کردم» with no SMS yet: the owner reviews
 *   sweep   → deadlines, one reminder and pending site callbacks
 *
 * Nothing here trusts the customer's words about a payment: PAID comes only
 * from a deposit SMS of the owner's own phone or from the owner's own tap.
 */
import crypto from 'node:crypto'
import { Prisma, type CardPayment, type PayCard } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { decrypt, encrypt } from '@/lib/crypto'
import { captureError } from '@/lib/errors/capture'
import { notifyWorkspace } from '@/lib/notifications/create'
import { allocateAmount, tomanToRial } from '@/lib/payments/card/amount'
import { bankByKey, detectBank, luhnValid, panDigits } from '@/lib/payments/card/bins'
import { cardPayMarker, composeCardPayNotice, payToman, type CardPayStatus, type CardPayView } from '@/lib/payments/card/pay-card'
import { getGatewayUsage, getPlatformGatewaySettings } from '@/lib/payments/card/platform'
import { LATE_SMS_GRACE_MS, readPayGatewaySettings, type PayGatewaySettings } from '@/lib/payments/card/settings'
import { paymentSubject, readPurpose, settlePaymentPurpose } from '@/lib/payments/card/prepay-service'
import { paymentAlertButtons } from '@/lib/payments/card/bot-buttons'

export const OPEN_PAYMENT_STATUSES = ['PENDING', 'CLAIMED']
/** OrderDraft.status values owned by the gateway (checkoutMode CARD_TRANSFER). */
export const CARD_DRAFT_PENDING = 'AWAITING_TRANSFER'
export const CARD_DRAFT_REVIEW = 'PAYMENT_REVIEW'
export const CARD_DRAFT_OPEN_STATUSES = [CARD_DRAFT_PENDING, CARD_DRAFT_REVIEW]

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir').replace(/\/$/, '')

export function payPageUrl(authority: string): string {
  return `${APP_URL}/pay/${authority}`
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

// ─── Cards ──────────────────────────────────────────────────────────────────

export class PayCardError extends Error {
  constructor(public code: 'INVALID' | 'DUPLICATE') {
    super(code)
  }
}

export async function addPayCard(workspaceId: string, input: { pan: string; holderName: string; bankKey?: string | null }): Promise<PayCard> {
  const pan = panDigits(input.pan)
  if (!luhnValid(pan)) throw new PayCardError('INVALID')
  const panHash = sha256(pan)
  const existing = await prisma.payCard.findUnique({ where: { workspaceId_panHash: { workspaceId, panHash } } })
  if (existing && !existing.deletedAt) throw new PayCardError('DUPLICATE')
  const bank = detectBank(pan)
  const data = {
    panEncrypted: encrypt(pan),
    bin: pan.slice(0, 6),
    last4: pan.slice(12),
    bankKey: bank?.key ?? (input.bankKey && bankByKey(input.bankKey).key !== 'unknown' ? input.bankKey : 'unknown'),
    holderName: input.holderName.trim().slice(0, 80),
    active: true,
    deletedAt: null,
  }
  if (existing) return prisma.payCard.update({ where: { id: existing.id }, data })
  const count = await prisma.payCard.count({ where: { workspaceId, deletedAt: null } })
  return prisma.payCard.create({ data: { ...data, workspaceId, panHash, sortOrder: count } })
}

export function readPan(card: Pick<PayCard, 'panEncrypted'>): string {
  return decrypt(card.panEncrypted)
}

/** Tomans confirmed on each card since local midnight (Tehran is UTC+3:30). */
export async function receivedTodayByCard(workspaceId: string, now = new Date()): Promise<Map<string, number>> {
  const tehranOffsetMs = 3.5 * 3_600_000
  const local = new Date(now.getTime() + tehranOffsetMs)
  const dayStart = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - tehranOffsetMs)
  const rows = await prisma.cardPayment.groupBy({
    by: ['cardId'],
    // The setup's own test transfers are not money received.
    where: { workspaceId, status: 'PAID', paidAt: { gte: dayStart }, NOT: { reference: { startsWith: 'TEST-' } } },
    _sum: { baseAmount: true },
  })
  return new Map(rows.map((row) => [row.cardId, row._sum.baseAmount ?? 0]))
}

// ─── Chat context ───────────────────────────────────────────────────────────

/** What the order flow needs to offer card-to-card for this agent. */
export interface CardPayContext {
  workspaceId: string
  settings: PayGatewaySettings
  /** Whole tomans; a larger cart is not offered card-to-card. */
  maxAmount: number
}

export type CardPayUnavailable = 'PLATFORM_OFF' | 'WORKSPACE_OFF' | 'SUSPENDED' | 'AGENT_OFF' | 'NO_CARD' | 'CAP_REACHED'

export async function cardPayAvailability(workspaceId: string, agentCardPayEnabled: boolean): Promise<{ context: CardPayContext | null; reason: CardPayUnavailable | null }> {
  if (!agentCardPayEnabled) return { context: null, reason: 'AGENT_OFF' }
  const [platform, workspace] = await Promise.all([
    getPlatformGatewaySettings(),
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { plan: true, payGatewayEnabled: true, payGatewaySettings: true, payGatewaySuspendedAt: true, payGatewayCapOverride: true } }),
  ])
  if (!platform.enabled) return { context: null, reason: 'PLATFORM_OFF' }
  if (!workspace?.payGatewayEnabled) return { context: null, reason: 'WORKSPACE_OFF' }
  if (workspace.payGatewaySuspendedAt) return { context: null, reason: 'SUSPENDED' }
  const cards = await prisma.payCard.count({ where: { workspaceId, active: true, deletedAt: null } })
  if (!cards) return { context: null, reason: 'NO_CARD' }
  const usage = await getGatewayUsage(workspaceId, workspace.plan, workspace.payGatewayCapOverride)
  if (usage.reached) return { context: null, reason: 'CAP_REACHED' }
  return {
    context: { workspaceId, settings: readPayGatewaySettings(workspace.payGatewaySettings), maxAmount: platform.maxAmount },
    reason: null,
  }
}

export async function loadCardPayContext(workspaceId: string, agentCardPayEnabled: boolean): Promise<CardPayContext | null> {
  return (await cardPayAvailability(workspaceId, agentCardPayEnabled)).context
}

/**
 * The gateway context of an agent for a chat turn. Read with a raw query and
 * a catch-all: the worker runs from source, so a restart before the migration
 * must degrade to "off", never break an inbound message.
 */
export async function loadCardPayContextForAgent(workspaceId: string, agentId: string): Promise<CardPayContext | null> {
  try {
    const rows = await prisma.$queryRaw<Array<{ cardPayEnabled: boolean }>>`SELECT "cardPayEnabled" FROM "Agent" WHERE id = ${agentId}`
    if (rows[0]?.cardPayEnabled !== true) return null
    return await loadCardPayContext(workspaceId, true)
  } catch {
    return null
  }
}

// ─── Create ─────────────────────────────────────────────────────────────────

export type CreatePaymentError = 'NO_CARD' | 'AMOUNT_TOO_HIGH' | 'AMOUNT_TOO_LOW' | 'NO_SLOT' | 'DISABLED' | 'CAP_REACHED' | 'DUPLICATE_REFERENCE'

export interface CreatePaymentInput {
  workspaceId: string
  /** Whole tomans. */
  baseAmount: number
  source: 'CHAT' | 'API' | 'LINK'
  reference: string
  orderDraftId?: string | null
  conversationId?: string | null
  siteId?: string | null
  description?: string | null
  customerName?: string | null
  customerPhone?: string | null
  callbackUrl?: string | null
  returnUrl?: string | null
  ttlMinutes?: number
  /** Skip the workspace switch (a hand-made link from the dashboard still needs a card). */
  now?: Date
}

export type CreatePaymentResult = { ok: true; payment: CardPayment; card: PayCard } | { ok: false; error: CreatePaymentError }

/** «L-7KQ2MX» for a hand-made link, «TEST-…» for the setup's own transfer. */
export function manualLinkReference(test: boolean): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.randomBytes(6)
  let code = ''
  for (const byte of bytes) code += alphabet[byte % alphabet.length]
  return `${test ? 'TEST-' : 'L-'}${code}`
}

/** Smallest transfer banks accept by card-to-card. */
export const MIN_PAY_AMOUNT = 1_000

function newAuthority(): string {
  return `P${crypto.randomBytes(18).toString('base64url')}`
}

export async function createCardPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
  const now = input.now ?? new Date()
  const baseAmount = Math.round(input.baseAmount)
  if (!(baseAmount >= MIN_PAY_AMOUNT)) return { ok: false, error: 'AMOUNT_TOO_LOW' }
  const [platform, workspace] = await Promise.all([
    getPlatformGatewaySettings(),
    prisma.workspace.findUnique({ where: { id: input.workspaceId }, select: { plan: true, payGatewayEnabled: true, payGatewaySettings: true, payGatewaySuspendedAt: true, payGatewayCapOverride: true } }),
  ])
  if (!platform.enabled || !workspace?.payGatewayEnabled || workspace.payGatewaySuspendedAt) return { ok: false, error: 'DISABLED' }
  if (baseAmount > platform.maxAmount) return { ok: false, error: 'AMOUNT_TOO_HIGH' }
  const usage = await getGatewayUsage(input.workspaceId, workspace.plan, workspace.payGatewayCapOverride)
  if (usage.reached) return { ok: false, error: 'CAP_REACHED' }
  const settings = readPayGatewaySettings(workspace.payGatewaySettings)
  const ttlMs = (input.ttlMinutes ?? settings.ttlMinutes) * 60_000
  const received = await receivedTodayByCard(input.workspaceId, now)

  try {
    return await prisma.$transaction(async (tx) => {
      // One allocation at a time per business: two carts of the same price
      // must never be handed the same amount.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`cardpay:${input.workspaceId}`}))`
      const cards = await tx.payCard.findMany({ where: { workspaceId: input.workspaceId, active: true, deletedAt: null }, orderBy: { sortOrder: 'asc' } })
      const usable = cards.filter((card) => card.dailyCap == null || (received.get(card.id) ?? 0) + baseAmount <= card.dailyCap)
      if (!usable.length) return { ok: false as const, error: 'NO_CARD' as const }
      // The card that received least today, so load spreads across cards.
      const card = usable.reduce((best, next) => ((received.get(next.id) ?? 0) < (received.get(best.id) ?? 0) ? next : best))
      const reserved = await tx.cardPayment.findMany({
        where: {
          workspaceId: input.workspaceId,
          payAmount: { gt: baseAmount, lte: baseAmount + 999 },
          OR: [{ status: { in: OPEN_PAYMENT_STATUSES } }, { status: 'EXPIRED', holdUntil: { gt: now } }],
        },
        select: { payAmount: true },
      })
      const amount = allocateAmount(baseAmount, new Set(reserved.map((row) => row.payAmount)))
      if (!amount) return { ok: false as const, error: 'NO_SLOT' as const }
      const expiresAt = new Date(now.getTime() + ttlMs)
      const payment = await tx.cardPayment.create({
        data: {
          workspaceId: input.workspaceId,
          cardId: card.id,
          siteId: input.siteId ?? null,
          source: input.source,
          orderDraftId: input.orderDraftId ?? null,
          conversationId: input.conversationId ?? null,
          authority: newAuthority(),
          reference: input.reference.slice(0, 120),
          description: input.description?.slice(0, 300) ?? null,
          customerName: input.customerName?.slice(0, 120) ?? null,
          customerPhone: input.customerPhone?.slice(0, 32) ?? null,
          baseAmount,
          payAmount: amount.payAmount,
          callbackUrl: input.callbackUrl ?? null,
          returnUrl: input.returnUrl ?? null,
          expiresAt,
          holdUntil: new Date(expiresAt.getTime() + LATE_SMS_GRACE_MS),
        },
      })
      return { ok: true as const, payment, card }
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return { ok: false, error: 'DUPLICATE_REFERENCE' }
    throw error
  }
}

export function cardPayView(payment: CardPayment, card: PayCard, settings: PayGatewaySettings, lang: 'fa' | 'en'): CardPayView {
  return {
    code: payment.reference,
    authority: payment.authority,
    url: payPageUrl(payment.authority),
    bankKey: card.bankKey,
    pan: readPan(card),
    holder: settings.showHolderName ? card.holderName : null,
    amount: payment.payAmount,
    expiresAt: payment.expiresAt.toISOString(),
    claim: settings.manualClaim,
    status: payment.status as CardPayStatus,
    lang,
    ...(readPurpose(payment.purpose) !== 'ORDER' ? { title: paymentSubject(payment, lang) } : {}),
    bank: (() => {
      const bank = bankByKey(card.bankKey)
      return { name: lang === 'en' ? bank.en : bank.fa, deep: bank.colors[0], light: bank.colors[1], logo: bank.logo }
    })(),
  }
}

export async function loadCardPayView(paymentId: string, lang: 'fa' | 'en'): Promise<CardPayView | null> {
  const payment = await prisma.cardPayment.findUnique({ where: { id: paymentId }, include: { card: true, workspace: { select: { payGatewaySettings: true } } } })
  if (!payment) return null
  return cardPayView(payment, payment.card, readPayGatewaySettings(payment.workspace.payGatewaySettings), lang)
}

// ─── State changes ──────────────────────────────────────────────────────────

async function conversationOf(payment: Pick<CardPayment, 'conversationId'>) {
  if (!payment.conversationId) return null
  return prisma.conversation.findUnique({ where: { id: payment.conversationId }, select: { id: true, agentId: true, channel: true, externalId: true } })
}

async function tellCustomer(payment: CardPayment, status: CardPayStatus): Promise<void> {
  const conversation = await conversationOf(payment)
  if (!conversation) return
  // Idempotent: one notice per state.
  const claimed = await prisma.cardPayment.updateMany({ where: { id: payment.id, NOT: { notifiedStatus: status } }, data: { notifiedStatus: status } })
  if (!claimed.count) return
  const { deliverAssistantNotice, lastCustomerLang } = await import('@/lib/commerce/checkout-service')
  const lang = await lastCustomerLang(conversation.id).catch((): 'fa' | 'en' => 'fa')
  const text = composeCardPayNotice({ status, code: payment.reference, amount: payment.baseAmount, lang, purpose: readPurpose(payment.purpose), subject: payment.description })
  if (!text) return
  await deliverAssistantNotice(conversation, text, { cardPayNotice: true, paymentId: payment.id, status }).catch((error) => {
    captureError('cardpay:notice', error, { workspaceId: payment.workspaceId })
  })
}

async function syncDraft(payment: CardPayment, status: string, extra: Prisma.OrderDraftUpdateManyMutationInput = {}): Promise<void> {
  if (!payment.orderDraftId) return
  await prisma.orderDraft.updateMany({
    where: { id: payment.orderDraftId, checkoutMode: 'CARD_TRANSFER', status: { in: [...CARD_DRAFT_OPEN_STATUSES, 'EXPIRED'] } },
    data: { status, expecting: null, ...extra },
  }).catch((error) => captureError('cardpay:draft', error, { workspaceId: payment.workspaceId }))
}

export type ConfirmedBy = 'AUTO' | 'OWNER' | 'OPERATOR' | 'ADMIN'

/**
 * Mark a payment paid. Idempotent: only the first caller changes the row and
 * runs the side effects (customer notice, owner alert, site callback).
 * A recently expired payment is still accepted (the SMS was late).
 */
export async function confirmCardPayment(paymentId: string, by: ConfirmedBy, now = new Date()): Promise<{ changed: boolean; payment: CardPayment | null }> {
  const changed = await prisma.cardPayment.updateMany({
    where: {
      id: paymentId,
      OR: [{ status: { in: OPEN_PAYMENT_STATUSES } }, { status: 'EXPIRED', ...(by === 'AUTO' ? { holdUntil: { gt: now } } : {}) }, ...(by === 'AUTO' ? [] : [{ status: 'FAILED' }])],
    },
    data: { status: 'PAID', confirmedBy: by, paidAt: now, resolvedAt: now, callbackNextAt: now },
  })
  const payment = await prisma.cardPayment.findUnique({ where: { id: paymentId } })
  if (!changed.count || !payment) return { changed: false, payment }

  await prisma.payCard.updateMany({ where: { id: payment.cardId, verifiedAt: null }, data: { verifiedAt: now } }).catch(() => {})
  // storeSyncAt: the paid cart is placed on the connected WooCommerce store.
  await syncDraft(payment, 'PAID', { paidAt: now, resolvedAt: now, grandTotal: payment.baseAmount, paymentMethodTitle: 'کارت‌به‌کارت', storeSyncAt: now, storeSyncTries: 0, storeSyncError: null })
  if (payment.orderDraftId) {
    // Not awaited: a slow store must not hold up the SMS that confirmed it.
    // The worker's sweep retries whatever this attempt leaves behind.
    const draftId = payment.orderDraftId
    void import('@/lib/payments/card/store-order')
      .then((store) => store.placeCardOrderOnStore(draftId, now))
      .catch((error) => captureError('cardpay:store-order', error, { workspaceId: payment.workspaceId }))
  }
  await settlePaymentPurpose(payment, 'PAID', now)
  // The setup's own test transfer: the setup turns green, no alert or callback.
  if (payment.reference.startsWith('TEST-')) return { changed: true, payment }
  await tellCustomer(payment, 'PAID')
  await notifyWorkspace({
    workspaceId: payment.workspaceId,
    type: 'SYSTEM',
    title: `پرداخت ${paymentSubject(payment)} رسید`,
    body: `${payToman(payment.baseAmount, 'fa')}${payment.customerName ? ` · ${payment.customerName}` : ''}${by === 'AUTO' ? ' · تأیید خودکار از روی پیامک بانک' : by === 'OPERATOR' ? ' · تأیید از ربات مدیر' : ' · تأیید دستی'}`,
    link: payment.conversationId ? `/conversations/${payment.conversationId}` : '/payments',
    operatorTelegram: 'payments',
    operatorButtons: paymentAlertButtons(payment),
  })
  await sendPaymentCallback(payment.id).catch((error) => captureError('cardpay:callback', error, { workspaceId: payment.workspaceId }))
  return { changed: true, payment }
}

/** The customer says they paid and no SMS has matched: the owner decides. */
export async function claimCardPayment(paymentId: string, opts: { tellCustomer?: boolean } = {}, now = new Date()): Promise<{ changed: boolean; payment: CardPayment | null }> {
  const changed = await prisma.cardPayment.updateMany({ where: { id: paymentId, status: 'PENDING' }, data: { status: 'CLAIMED', claimedAt: now } })
  const payment = await prisma.cardPayment.findUnique({ where: { id: paymentId } })
  if (!changed.count || !payment) return { changed: false, payment }
  await syncDraft(payment, CARD_DRAFT_REVIEW)
  // From the payment page the agent is not in the loop, so the notice is sent here.
  if (opts.tellCustomer) await tellCustomer(payment, 'CLAIMED')
  await notifyWorkspace({
    workspaceId: payment.workspaceId,
    type: 'HANDOFF',
    title: `بررسی پرداخت ${paymentSubject(payment)}`,
    body: `مشتری می‌گوید ${payToman(payment.payAmount, 'fa')} واریز کرده ولی پیامک واریز هنوز نرسیده. حساب را نگاه کنید و تأیید یا رد کنید.`,
    link: payment.conversationId ? `/conversations/${payment.conversationId}` : '/payments',
    operatorTelegram: 'payments',
    operatorButtons: paymentAlertButtons(payment),
  })
  // Two claims in a row with no SMS in between: the phone has stopped forwarding.
  const devices = await prisma.payDevice.findMany({ where: { workspaceId: payment.workspaceId, active: true }, select: { id: true, silentClaims: true } })
  if (devices.length) {
    await prisma.payDevice.updateMany({ where: { workspaceId: payment.workspaceId, active: true }, data: { silentClaims: { increment: 1 } } })
    if (devices.some((device) => device.silentClaims === 1)) {
      await notifyWorkspace({
        workspaceId: payment.workspaceId,
        type: 'CHANNEL_DOWN',
        title: 'گوشی پیامک واریز را نمی‌فرستد',
        body: 'دو مشتری پشت‌سرهم گفته‌اند پرداخت کرده‌اند ولی پیامکی نرسیده. اینترنت، شارژ پیامک و اپ فوروارد گوشی را بررسی کنید؛ تا آن موقع پرداخت‌ها را دستی تأیید کنید.',
        link: '/payments/settings',
        operatorTelegram: 'payments',
      })
    }
  }
  return { changed: true, payment }
}

export async function rejectCardPayment(paymentId: string, now = new Date()): Promise<{ changed: boolean; payment: CardPayment | null }> {
  const changed = await prisma.cardPayment.updateMany({ where: { id: paymentId, status: { in: OPEN_PAYMENT_STATUSES } }, data: { status: 'FAILED', resolvedAt: now, callbackNextAt: now } })
  const payment = await prisma.cardPayment.findUnique({ where: { id: paymentId } })
  if (!changed.count || !payment) return { changed: false, payment }
  await syncDraft(payment, 'CANCELLED', { resolvedAt: now })
  await settlePaymentPurpose(payment, 'FAILED', now)
  await tellCustomer(payment, 'FAILED')
  await sendPaymentCallback(payment.id).catch(() => {})
  return { changed: true, payment }
}

/** The cart changed or the customer cancelled: the card must stop being payable. */
export async function cancelOpenCardPayments(where: { orderDraftId: string } | { id: string } | { appointmentId: string } | { enrollmentId: string }, now = new Date()): Promise<number> {
  const result = await prisma.cardPayment.updateMany({
    where: { ...where, status: { in: OPEN_PAYMENT_STATUSES } },
    // The amount stays reserved for the grace window: a transfer already on its way must not confirm someone else's order.
    data: { status: 'CANCELLED', resolvedAt: now, holdUntil: new Date(now.getTime() + LATE_SMS_GRACE_MS) },
  })
  return result.count
}

// ─── Site callback ──────────────────────────────────────────────────────────

const CALLBACK_BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000, 12 * 3_600_000]

export function signCallback(secret: string, timestamp: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
}

/** POST the payment's state to the site that created it. Records the attempt and schedules the next one. */
export async function sendPaymentCallback(paymentId: string, now = new Date()): Promise<'sent' | 'retry' | 'none'> {
  const payment = await prisma.cardPayment.findUnique({ where: { id: paymentId }, include: { site: true } })
  if (!payment?.callbackUrl || payment.callbackDoneAt) {
    if (payment && payment.callbackNextAt) await prisma.cardPayment.update({ where: { id: paymentId }, data: { callbackNextAt: null } }).catch(() => {})
    return 'none'
  }
  const status = payment.status === 'PAID' ? 'paid' : payment.status === 'CLAIMED' ? 'claimed' : payment.status === 'EXPIRED' ? 'expired' : payment.status === 'FAILED' ? 'failed' : payment.status.toLowerCase()
  const body = JSON.stringify({
    event: `payment.${status}`,
    authority: payment.authority,
    order_id: payment.reference,
    status,
    amount: tomanToRial(payment.baseAmount),
    pay_amount: tomanToRial(payment.payAmount),
  })
  const timestamp = String(Math.floor(now.getTime() / 1000))
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'User-Agent': 'VigentPay/1.0', 'X-Vigent-Timestamp': timestamp }
  if (payment.site) headers['X-Vigent-Signature'] = `sha256=${signCallback(decrypt(payment.site.secretEncrypted), timestamp, body)}`
  let error: string | null = null
  try {
    const response = await fetch(payment.callbackUrl, { method: 'POST', headers, body, signal: AbortSignal.timeout(15_000), redirect: 'follow', cache: 'no-store' })
    if (!response.ok) error = `HTTP ${response.status}`
  } catch (cause) {
    error = cause instanceof Error ? cause.message.slice(0, 200) : 'network error'
  }
  const tries = payment.callbackTries + 1
  if (!error) {
    await prisma.cardPayment.update({ where: { id: paymentId }, data: { callbackTries: tries, callbackDoneAt: now, callbackNextAt: null, callbackError: null } })
    return 'sent'
  }
  const wait = CALLBACK_BACKOFF_MS[tries - 1]
  await prisma.cardPayment.update({
    where: { id: paymentId },
    data: { callbackTries: tries, callbackError: error, callbackNextAt: wait ? new Date(now.getTime() + wait) : null },
  })
  return 'retry'
}

// ─── Sweep (worker) ─────────────────────────────────────────────────────────

export interface CardPaymentSweepStats {
  expired: number
  reminded: number
  callbacks: number
}

const REMIND_BEFORE_MS = 5 * 60_000

export async function sweepCardPayments(now = new Date()): Promise<CardPaymentSweepStats> {
  const stats: CardPaymentSweepStats = { expired: 0, reminded: 0, callbacks: 0 }

  const overdue = await prisma.cardPayment.findMany({ where: { status: 'PENDING', expiresAt: { lt: now } }, take: 200 })
  for (const payment of overdue) {
    const changed = await prisma.cardPayment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'EXPIRED', resolvedAt: now, callbackNextAt: payment.callbackUrl ? now : null } })
    if (!changed.count) continue
    stats.expired += 1
    await syncDraft(payment, 'EXPIRED', { resolvedAt: now })
    await settlePaymentPurpose(payment, 'EXPIRED', now)
    await tellCustomer({ ...payment, status: 'EXPIRED' }, 'EXPIRED')
  }

  // One reminder, five minutes before the deadline, on push channels only.
  const closing = await prisma.cardPayment.findMany({
    where: { status: 'PENDING', remindedAt: null, conversationId: { not: null }, expiresAt: { gt: now, lt: new Date(now.getTime() + REMIND_BEFORE_MS) }, createdAt: { lt: new Date(now.getTime() - REMIND_BEFORE_MS) } },
    take: 100,
  })
  for (const payment of closing) {
    const claimed = await prisma.cardPayment.updateMany({ where: { id: payment.id, remindedAt: null, status: 'PENDING' }, data: { remindedAt: now } })
    if (!claimed.count) continue
    const conversation = await conversationOf(payment)
    if (!conversation || !['TELEGRAM', 'BALE', 'RUBIKA', 'INSTAGRAM'].includes(conversation.channel)) continue
    const { deliverAssistantNotice, lastCustomerLang } = await import('@/lib/commerce/checkout-service')
    const lang = await lastCustomerLang(conversation.id).catch((): 'fa' | 'en' => 'fa')
    const text = lang === 'en'
      ? `Five minutes left to pay for ${paymentSubject(payment, 'en')} (${payToman(payment.payAmount, 'en')}).`
      : `۵ دقیقه تا پایان مهلت پرداخت ${paymentSubject(payment)} مانده (${payToman(payment.payAmount, 'fa')}).`
    const result = await deliverAssistantNotice(conversation, text, { cardPayNotice: true, paymentId: payment.id, status: 'REMINDER' }).catch(() => 'failed')
    if (result === 'sent') stats.reminded += 1
  }

  const callbacks = await prisma.cardPayment.findMany({ where: { callbackNextAt: { lte: now }, callbackDoneAt: null, callbackUrl: { not: null } }, select: { id: true }, take: 100 })
  for (const row of callbacks) {
    const result = await sendPaymentCallback(row.id, now).catch(() => 'retry' as const)
    if (result === 'sent') stats.callbacks += 1
  }
  return stats
}

// ─── Chat helpers ───────────────────────────────────────────────────────────

/** Issue the card for a confirmed chat cart and return the reply that carries it. */
export async function issueCardPayForDraft(params: {
  ctx: CardPayContext
  draftId: string
  code: string
  conversationId: string
  total: number
  customerName: string | null
  customerPhone: string | null
  lang: 'fa' | 'en'
}): Promise<{ text: string; view: CardPayView } | { error: CreatePaymentError }> {
  await cancelOpenCardPayments({ orderDraftId: params.draftId })
  const created = await createCardPayment({
    workspaceId: params.ctx.workspaceId,
    baseAmount: params.total,
    source: 'CHAT',
    reference: params.code,
    orderDraftId: params.draftId,
    conversationId: params.conversationId,
    customerName: params.customerName,
    customerPhone: params.customerPhone,
  })
  if (!created.ok) return { error: created.error }
  const now = new Date()
  await prisma.orderDraft.update({
    where: { id: params.draftId },
    data: { status: CARD_DRAFT_PENDING, checkoutMode: 'CARD_TRANSFER', expecting: null, grandTotal: params.total, submittedAt: now, paymentMethodTitle: 'کارت‌به‌کارت' },
  })
  const view = cardPayView(created.payment, created.card, params.ctx.settings, params.lang)
  const { composeCardPayMessage } = await import('@/lib/payments/card/pay-card')
  return { text: composeCardPayMessage(view), view }
}

export async function openCardPaymentOfDraft(draftId: string): Promise<(CardPayment & { card: PayCard }) | null> {
  return prisma.cardPayment.findFirst({ where: { orderDraftId: draftId }, orderBy: { createdAt: 'desc' }, include: { card: true } })
}

export { cardPayMarker }
