/**
 * OPERATOR BOT — PAYMENT GATEWAY SCREENS
 * ======================================
 *
 * «درگاه پرداخت» inside the owner's Telegram manager bot, driven by glass
 * buttons like the rest of the control center:
 *
 *   💳 gateway home   today's money, what waits for the owner, phone health
 *   🧾 transactions   filtered, paged list → one payment → confirm / reject / cancel
 *   📩 deposits       a deposit SMS that matched nothing → attach it to the
 *                     closest open payment with one tap (ZarinPay-style)
 *   ➕ payment link   the owner types an amount, the bot answers with a card
 *                     and a link to forward to the customer
 *   ⏸ pause           stop offering the card (phone off, card blocked …)
 *
 * Callback data: py:l:<filter>:<page> · py:<v|y|Y|n|N|x|X>:<paymentId> ·
 * ps:l · ps:<v|i>:<smsId> · ps:a:<smsId>:<paymentId> · pn:new · pg:<t|p|r>
 */

import type { CardPayment } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'
import { toEnglishDigits } from '@/lib/phone'
import { bankByKey } from '@/lib/payments/card/bins'
import { payToman } from '@/lib/payments/card/pay-card'
import { paymentSubject } from '@/lib/payments/card/prepay-service'
import type { PaymentListFilter, TelegramInlineKeyboardButton, TelegramInlineKeyboardMarkup } from '@/lib/channels/operator-bot'
import { escapeHtml, type BotScreen } from '@/lib/channels/operator-bot-screens'

type Row = TelegramInlineKeyboardButton[]

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir').replace(/\/$/, '')
const DAY_MS = 24 * 60 * 60 * 1000
const TEHRAN_OFFSET_MS = 210 * 60 * 1000
const DIVIDER = '┈┈┈┈┈┈┈┈┈┈┈┈'
const PAGE_SIZE = 8

const fa = (n: number) => n.toLocaleString('fa-IR')
const money = (n: number) => payToman(n, 'fa')
const clip = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1)}…` : value)
const btn = (text: string, callback: string): TelegramInlineKeyboardButton => ({ text, callback_data: callback })
const link = (text: string, url: string): TelegramInlineKeyboardButton => ({ text, url })
const kb = (rows: Row[]): TelegramInlineKeyboardMarkup => ({ inline_keyboard: rows })

function tehranDayStart(days = 0): Date {
  const now = Date.now() + TEHRAN_OFFSET_MS
  return new Date(Math.floor(now / DAY_MS) * DAY_MS - TEHRAN_OFFSET_MS + days * DAY_MS)
}

function tehranTime(date: Date): string {
  return new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit' }).format(date)
}

function tehranDateTime(date: Date): string {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone: 'Asia/Tehran', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(date)
}

function ago(date: Date): string {
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000))
  if (minutes < 1) return 'همین حالا'
  if (minutes < 60) return `${fa(minutes)} دقیقه پیش`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${fa(hours)} ساعت پیش`
  return `${fa(Math.round(hours / 24))} روز پیش`
}

export const PAYMENT_STATUS_FA: Record<string, { icon: string; label: string }> = {
  PENDING: { icon: '⏳', label: 'منتظر واریز' },
  CLAIMED: { icon: '🔴', label: 'منتظر بررسی شما' },
  PAID: { icon: '🟢', label: 'پرداخت‌شده' },
  EXPIRED: { icon: '⌛️', label: 'مهلت تمام شد' },
  FAILED: { icon: '❌', label: 'رد شد' },
  CANCELLED: { icon: '🚫', label: 'لغو شد' },
}

const CONFIRMED_BY_FA: Record<string, string> = {
  AUTO: 'خودکار از روی پیامک بانک',
  OWNER: 'دستی از پنل',
  OPERATOR: 'از ربات مدیر',
  ADMIN: 'پشتیبانی ویجنت',
}

const SOURCE_FA: Record<string, string> = { CHAT: 'گفتگو با ایجنت', API: 'سایت متصل (API)', LINK: 'لینک دستی' }

// ─── Gateway home ───────────────────────────────────────────────────────

export async function gatewayEnabled(workspaceId: string): Promise<boolean> {
  const row = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { payGatewayEnabled: true } }).catch(() => null)
  return row?.payGatewayEnabled === true
}

/** Owner-facing counts for the home screen badge and the morning report. */
export async function gatewayAttention(workspaceId: string): Promise<{ review: number; unmatched: number }> {
  const [review, unmatched] = await Promise.all([
    prisma.cardPayment.count({ where: { workspaceId, status: 'CLAIMED' } }),
    prisma.bankSms.count({ where: { workspaceId, status: 'UNMATCHED' } }),
  ])
  return { review, unmatched }
}

export async function gatewayDayTotals(workspaceId: string, from: Date, to?: Date): Promise<{ count: number; sum: number }> {
  const row = await prisma.cardPayment.aggregate({
    where: { workspaceId, status: 'PAID', paidAt: { gte: from, ...(to ? { lt: to } : {}) } },
    _sum: { baseAmount: true },
    _count: { _all: true },
  })
  return { count: row._count._all, sum: row._sum.baseAmount ?? 0 }
}

export async function payHomeScreen(workspaceId: string, notice?: string): Promise<BotScreen> {
  const since = tehranDayStart()
  const [workspace, today, attention, pending, cards, devices, autoToday] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { payGatewayEnabled: true, payGatewaySuspendedAt: true } }),
    gatewayDayTotals(workspaceId, since),
    gatewayAttention(workspaceId),
    prisma.cardPayment.count({ where: { workspaceId, status: 'PENDING' } }),
    prisma.payCard.findMany({ where: { workspaceId, deletedAt: null }, orderBy: { sortOrder: 'asc' }, select: { id: true, bankKey: true, last4: true, active: true } }),
    prisma.payDevice.findMany({ where: { workspaceId, active: true }, select: { name: true, connectedAt: true, lastSmsAt: true, phone: true } }),
    prisma.cardPayment.count({ where: { workspaceId, status: 'PAID', paidAt: { gte: since }, confirmedBy: 'AUTO' } }),
  ])
  const received = cards.length
    ? await prisma.cardPayment.groupBy({ by: ['cardId'], where: { workspaceId, status: 'PAID', paidAt: { gte: since } }, _sum: { baseAmount: true } })
    : []
  const byCard = new Map(received.map((row) => [row.cardId, row._sum.baseAmount ?? 0]))

  const on = workspace?.payGatewayEnabled === true
  const state = workspace?.payGatewaySuspendedAt
    ? '⛔️ متوقف از طرف ویجنت'
    : !on ? '⏸ خاموش' : !cards.some((card) => card.active) ? '⚠️ کارتی فعال نیست' : !devices.some((device) => device.connectedAt) ? '⚠️ گوشی وصل نشده' : '🟢 روشن و آماده'
  const lines = [
    notice ? `${notice}\n` : '',
    `💳 <b>درگاه پرداخت</b> · ${state}`,
    DIVIDER,
    '<b>امروز</b>',
    `✅ دریافتی: <b>${money(today.sum)}</b> · ${fa(today.count)} پرداخت${today.count ? ` (${fa(autoToday)} خودکار)` : ''}`,
    `⏳ منتظر واریز: <b>${fa(pending)}</b>`,
    `🔴 منتظر بررسی شما: <b>${fa(attention.review)}</b>    📩 واریز بی‌سفارش: <b>${fa(attention.unmatched)}</b>`,
  ].filter(Boolean)
  if (cards.length) {
    lines.push(DIVIDER, '<b>کارت‌ها</b>')
    for (const card of cards.slice(0, 5)) {
      lines.push(`${card.active ? '💳' : '▫️'} ${bankByKey(card.bankKey).fa} ••${card.last4} · امروز ${money(byCard.get(card.id) ?? 0)}`)
    }
  }
  if (devices.length) {
    lines.push(DIVIDER, '<b>گوشی دریافت پیامک</b>')
    for (const device of devices.slice(0, 3)) {
      const health = !device.connectedAt ? '⚠️ هنوز پیامکی نرسیده' : device.lastSmsAt ? `آخرین پیامک ${ago(device.lastSmsAt)}` : 'وصل'
      lines.push(`📱 ${escapeHtml(device.name)} · ${health}`)
    }
  }
  if (attention.review) lines.push('', `⚠️ ${fa(attention.review)} مشتری گفته پرداخت کرده و پیامکش نرسیده؛ حساب را نگاه کنید.`)

  const rows: Row[] = []
  const attentionRow: Row = []
  if (attention.review) attentionRow.push(btn(`🔴 بررسی · ${fa(attention.review)}`, 'py:l:r:0'))
  if (attention.unmatched) attentionRow.push(btn(`📩 واریز بی‌سفارش · ${fa(attention.unmatched)}`, 'ps:l'))
  if (attentionRow.length) rows.push(attentionRow)
  rows.push(
    [btn('🧾 تراکنش‌ها', 'py:l:a:0'), btn(pending ? `⏳ منتظر واریز · ${fa(pending)}` : '⏳ منتظر واریز', 'py:l:o:0')],
    [btn('➕ لینک پرداخت', 'pn:new'), btn(on ? '⏸ توقف موقت' : '▶️ روشن کردن', 'pg:t')],
    [link('🖥 درگاه در پنل', `${APP_URL}/payments`), btn('🔄', 'm:pay'), btn('🏠 خانه', 'm:home')],
  )
  return { text: lines.join('\n'), keyboard: kb(rows) }
}

// ─── Transactions ───────────────────────────────────────────────────────

const FILTERS: Record<PaymentListFilter, { title: string; status?: string[] }> = {
  a: { title: 'همهٔ تراکنش‌ها' },
  o: { title: 'منتظر واریز', status: ['PENDING'] },
  r: { title: 'منتظر بررسی شما', status: ['CLAIMED'] },
  p: { title: 'پرداخت‌شده', status: ['PAID'] },
}

export async function paymentListScreen(workspaceId: string, filter: PaymentListFilter, page: number): Promise<BotScreen> {
  const spec = FILTERS[filter]
  const where = { workspaceId, ...(spec.status ? { status: { in: spec.status } } : {}) }
  const [total, rows] = await Promise.all([
    prisma.cardPayment.count({ where }),
    prisma.cardPayment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: page * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, status: true, baseAmount: true, reference: true, customerName: true, createdAt: true, purpose: true, description: true },
    }),
  ])
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const lines = [`🧾 <b>${spec.title}</b> · ${fa(total)} مورد${pages > 1 ? ` · صفحهٔ ${fa(page + 1)} از ${fa(pages)}` : ''}`, DIVIDER]
  if (!rows.length) lines.push('موردی نیست.')
  const buttons: Row[] = []
  for (const row of rows) {
    const status = PAYMENT_STATUS_FA[row.status] ?? { icon: '•', label: row.status }
    const who = row.customerName || paymentSubject(row)
    lines.push(`${status.icon} <b>${money(row.baseAmount)}</b> · ${escapeHtml(clip(who, 26))} · ${ago(row.createdAt)}`)
    buttons.push([btn(`${status.icon} ${fa(row.baseAmount)} · ${clip(who, 22)}`, `py:v:${row.id}`)])
  }
  const tab = (key: PaymentListFilter, label: string) => btn(filter === key ? `● ${label}` : label, `py:l:${key}:0`)
  const rowsOut: Row[] = [[tab('a', 'همه'), tab('o', 'منتظر'), tab('r', 'بررسی'), tab('p', 'پرداخت‌شده')], ...buttons]
  const nav: Row = []
  if (page > 0) nav.push(btn('▶️ قبلی', `py:l:${filter}:${page - 1}`))
  if (page + 1 < pages && page < 99) nav.push(btn('بعدی ◀️', `py:l:${filter}:${page + 1}`))
  if (nav.length) rowsOut.push(nav)
  rowsOut.push([btn('↩️ درگاه پرداخت', 'm:pay'), btn('🏠 خانه', 'm:home')])
  return { text: lines.join('\n'), keyboard: kb(rowsOut) }
}

type PaymentRow = CardPayment & { card: { bankKey: string; last4: string } }

async function loadPayment(workspaceId: string, paymentId: string): Promise<PaymentRow | null> {
  return prisma.cardPayment.findFirst({ where: { id: paymentId, workspaceId }, include: { card: { select: { bankKey: true, last4: true } } } })
}

export async function paymentScreen(workspaceId: string, paymentId: string, notice?: string): Promise<BotScreen | null> {
  const payment = await loadPayment(workspaceId, paymentId)
  if (!payment) return null
  const status = PAYMENT_STATUS_FA[payment.status] ?? { icon: '•', label: payment.status }
  const lateWindow = payment.status === 'EXPIRED' && payment.holdUntil > new Date()
  const lines = [
    notice ? `${notice}\n` : '',
    `🧾 <b>${escapeHtml(paymentSubject(payment))}</b>`,
    `${status.icon} ${status.label}${payment.status === 'PAID' && payment.confirmedBy ? ` · ${CONFIRMED_BY_FA[payment.confirmedBy] ?? payment.confirmedBy}` : ''}`,
    DIVIDER,
    `💰 مبلغ: <b>${money(payment.baseAmount)}</b>`,
    `🔢 مبلغ دقیق واریز: <code>${payment.payAmount}</code> تومان`,
    payment.customerName || payment.customerPhone
      ? `👤 ${escapeHtml(payment.customerName || 'مشتری')}${payment.customerPhone ? ` · 📞 <code>${escapeHtml(payment.customerPhone)}</code>` : ''}`
      : '',
    `💳 ${bankByKey(payment.card.bankKey).fa} ••${payment.card.last4}`,
    `🔗 ${SOURCE_FA[payment.source] ?? payment.source} · کد <code>${escapeHtml(payment.reference)}</code>`,
    `🕒 ساخته شد ${tehranDateTime(payment.createdAt)}`,
    payment.paidAt ? `✅ پرداخت ${tehranDateTime(payment.paidAt)}` : payment.status === 'PENDING' ? `⏳ مهلت تا ${tehranTime(payment.expiresAt)}` : '',
    payment.description && payment.purpose === 'ORDER' ? `📝 ${escapeHtml(clip(payment.description, 140))}` : '',
    lateWindow ? '\nℹ️ مهلت تمام شده ولی اگر واریزش دیر رسیده باشد هنوز می‌توانید تأییدش کنید.' : '',
    payment.callbackError ? `\n⚠️ خبر دادن به سایت ناموفق بود: ${escapeHtml(clip(payment.callbackError, 80))}` : '',
  ].filter(Boolean)

  const rows: Row[] = []
  if (payment.status === 'PENDING' || payment.status === 'CLAIMED' || lateWindow) {
    rows.push([btn('✅ واریز را دیدم، تأیید', `py:y:${payment.id}`), ...(lateWindow ? [] : [btn('❌ رد', `py:n:${payment.id}`)])])
  }
  if (payment.status === 'PENDING') rows.push([btn('🚫 لغو این پرداخت', `py:x:${payment.id}`)])
  const links: Row = []
  if (payment.conversationId) links.push(link('💬 گفتگو', `${APP_URL}/conversations/${encodeURIComponent(payment.conversationId)}`))
  links.push(link('🔗 صفحهٔ پرداخت', `${APP_URL}/pay/${payment.authority}`))
  rows.push(links)
  rows.push([btn('↩️ تراکنش‌ها', 'py:l:a:0'), btn('💳 درگاه', 'm:pay'), btn('🏠 خانه', 'm:home')])
  return { text: lines.join('\n'), keyboard: kb(rows) }
}

/** «Sure?» before money changes state from a phone. */
export async function paymentConfirmScreen(workspaceId: string, paymentId: string, action: 'confirm' | 'reject' | 'cancel'): Promise<BotScreen | null> {
  const payment = await loadPayment(workspaceId, paymentId)
  if (!payment) return null
  const subject = escapeHtml(paymentSubject(payment))
  const text = action === 'confirm'
    ? `✅ <b>پرداخت «${subject}» تأیید شود؟</b>\n\nفقط وقتی بزنید که واریز <b>${money(payment.payAmount)}</b> را در حساب ${bankByKey(payment.card.bankKey).fa} ••${payment.card.last4} دیده‌اید. به مشتری خبر داده می‌شود${payment.callbackUrl ? ' و سایت هم مطلع می‌شود' : ''}.`
    : action === 'reject'
      ? `❌ <b>پرداخت «${subject}» رد شود؟</b>\n\nبه مشتری گفته می‌شود واریزی پیدا نشد و اگر پرداخت کرده رسیدش را بفرستد.`
      : `🚫 <b>پرداخت «${subject}» لغو شود؟</b>\n\nکارت دیگر برای این مبلغ معتبر نیست. اگر مشتری در همین حین واریز کند، تا دو ساعت در «واریز بی‌سفارش» دیده می‌شود.`
  const yes = action === 'confirm' ? `py:Y:${payment.id}` : action === 'reject' ? `py:N:${payment.id}` : `py:X:${payment.id}`
  return {
    text,
    keyboard: kb([[btn(action === 'confirm' ? '✅ بله، تأیید' : action === 'reject' ? '❌ بله، رد کن' : '🚫 بله، لغو کن', yes), btn('↩️ انصراف', `py:v:${payment.id}`)]]),
  }
}

// ─── Deposits that matched nothing ──────────────────────────────────────

export async function smsListScreen(workspaceId: string): Promise<BotScreen> {
  const rows = await prisma.bankSms.findMany({
    where: { workspaceId, status: 'UNMATCHED' },
    orderBy: { receivedAt: 'desc' },
    take: 8,
    select: { id: true, amount: true, receivedAt: true },
  })
  if (!rows.length) {
    return {
      text: '📩 <b>واریز بی‌سفارش</b>\n\nهمهٔ واریزها به پرداختی وصل شده‌اند. 👌',
      keyboard: kb([[btn('↩️ درگاه پرداخت', 'm:pay'), btn('🏠 خانه', 'm:home')]]),
    }
  }
  const lines = [
    `📩 <b>واریز بی‌سفارش</b> · ${fa(rows.length)} مورد`,
    'پیامک واریزی رسیده که مبلغش با هیچ پرداخت بازی یکی نبود (مثلاً مشتری مبلغ را رُند کرده). روی هر کدام بزنید تا نزدیک‌ترین پرداخت‌ها را ببینید.',
    DIVIDER,
  ]
  const buttons: Row[] = []
  for (const row of rows) {
    lines.push(`• <b>${row.amount != null ? money(row.amount) : 'مبلغ نامشخص'}</b> · ${ago(row.receivedAt)}`)
    buttons.push([btn(`📩 ${row.amount != null ? fa(row.amount) : '؟'} · ${ago(row.receivedAt)}`, `ps:v:${row.id}`)])
  }
  buttons.push([btn('↩️ درگاه پرداخت', 'm:pay'), btn('🏠 خانه', 'm:home')])
  return { text: lines.join('\n'), keyboard: kb(buttons) }
}

export async function smsScreen(workspaceId: string, smsId: string): Promise<BotScreen | null> {
  const sms = await prisma.bankSms.findFirst({ where: { id: smsId, workspaceId }, select: { id: true, amount: true, text: true, status: true, receivedAt: true } })
  if (!sms) return null
  if (sms.status !== 'UNMATCHED') {
    return {
      text: '📩 این واریز قبلاً رسیدگی شده است.',
      keyboard: kb([[btn('📩 واریزهای دیگر', 'ps:l'), btn('🏠 خانه', 'm:home')]]),
    }
  }
  const { suggestPaymentsForSms } = await import('@/lib/payments/card/ingest')
  const suggestions = await suggestPaymentsForSms(workspaceId, sms.amount)
  const lines = [
    `📩 <b>واریز ${sms.amount != null ? money(sms.amount) : 'با مبلغ نامشخص'}</b> · ${ago(sms.receivedAt)}`,
    sms.text ? `<blockquote>${escapeHtml(clip(sms.text, 240))}</blockquote>` : '',
    DIVIDER,
    suggestions.length ? '<b>نزدیک‌ترین پرداخت‌های باز</b> — روی درستش بزنید تا تأیید شود؛ اگر واریز کمتر باشد، پرداخت باز می‌ماند و بقیه از مشتری خواسته می‌شود:' : 'پرداخت بازی برای وصل کردن نیست.',
  ].filter(Boolean)
  const rows: Row[] = suggestions.map((payment) => {
    const diff = sms.amount != null ? sms.amount - payment.payAmount : null
    const diffLabel = diff == null || diff === 0 ? '' : ` (${diff > 0 ? '+' : '−'}${fa(Math.abs(diff))})`
    const status = PAYMENT_STATUS_FA[payment.status]?.icon ?? '•'
    return [btn(`🔗 ${status} ${fa(payment.payAmount)}${diffLabel} · ${clip(payment.customerName || payment.reference, 16)}`, `ps:a:${sms.id}:${payment.id}`)]
  })
  rows.push([btn('🙈 مربوط به فروش نیست', `ps:i:${sms.id}`)])
  rows.push([btn('↩️ واریزها', 'ps:l'), btn('🏠 خانه', 'm:home')])
  return { text: lines.join('\n'), keyboard: kb(rows) }
}

// ─── New payment link (typed amount) ────────────────────────────────────

const linkModeKey = (workspaceId: string) => `opbot:paylink:${workspaceId}`

export async function armPayLink(workspaceId: string): Promise<void> {
  await getRedis().set(linkModeKey(workspaceId), '1', 'EX', 10 * 60)
}

export async function takePayLinkMode(workspaceId: string): Promise<boolean> {
  const redis = getRedis()
  const value = await redis.get(linkModeKey(workspaceId))
  if (value) await redis.del(linkModeKey(workspaceId))
  return Boolean(value)
}

export async function clearPayLinkMode(workspaceId: string): Promise<void> {
  await getRedis().del(linkModeKey(workspaceId))
}

export function payLinkPromptScreen(): BotScreen {
  return {
    text: [
      '➕ <b>لینک پرداخت جدید</b>',
      '',
      'مبلغ را به <b>تومان</b> بنویسید و بفرستید؛ اگر خواستید بعد از مبلغ یک توضیح کوتاه هم بنویسید.',
      'مثال: <code>250000 سفارش تلفنی خانم احمدی</code>',
      '',
      'کارت و مبلغ دقیق با شناسه آماده می‌شود تا برای مشتری فوروارد کنید؛ با رسیدن پیامک واریز، خودکار تأیید می‌شود.',
      '⏳ این حالت تا ۱۰ دقیقه منتظر مبلغ می‌ماند.',
    ].join('\n'),
    keyboard: kb([[btn('❌ انصراف', 'x:c')]]),
  }
}

/** «250000 سفارش تلفنی» → amount + description. Digits may be Persian or grouped. */
export function readPayLinkInput(text: string): { amount: number; description: string | null } | null {
  const normalized = toEnglishDigits(text).trim()
  let index = 0
  let digits = ''
  while (index < normalized.length && (/[\d,.\s]/.test(normalized[index]) || normalized[index] === '\u066C')) {
    if (/\d/.test(normalized[index])) digits += normalized[index]
    index += 1
  }
  if (!digits) return null
  const amount = Number(digits)
  if (!Number.isSafeInteger(amount)) return null
  const description = normalized.slice(index).trim().slice(0, 200)
  return { amount, description: description || null }
}

export async function payLinkCreatedScreen(workspaceId: string, input: { amount: number; description: string | null }): Promise<BotScreen> {
  const { createCardPayment, manualLinkReference, payPageUrl, cardPayView } = await import('@/lib/payments/card/service')
  const created = await createCardPayment({
    workspaceId,
    baseAmount: input.amount,
    source: 'LINK',
    reference: manualLinkReference(false),
    description: input.description,
    ttlMinutes: 60,
  })
  if (!created.ok) {
    const reason: Record<string, string> = {
      AMOUNT_TOO_LOW: 'مبلغ باید دست‌کم ۱٬۰۰۰ تومان باشد.',
      AMOUNT_TOO_HIGH: 'این مبلغ از سقف کارت‌به‌کارت بیشتر است.',
      NO_CARD: 'کارت فعالی نیست (یا سقف روزانهٔ کارت‌ها پر شده).',
      DISABLED: 'درگاه پرداخت خاموش است.',
      CAP_REACHED: 'سقف پرداخت‌های این ماهِ پلن شما پر شده است.',
      NO_SLOT: 'برای این مبلغ همین حالا پرداخت باز زیادی هست؛ کمی بعد دوباره امتحان کنید.',
    }
    return {
      text: `⚠️ لینک ساخته نشد. ${reason[created.error] ?? ''}`,
      keyboard: kb([[btn('➕ دوباره', 'pn:new'), btn('💳 درگاه', 'm:pay')]]),
    }
  }
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { payGatewaySettings: true } })
  const { readPayGatewaySettings } = await import('@/lib/payments/card/settings')
  const view = cardPayView(created.payment, created.card, readPayGatewaySettings(workspace?.payGatewaySettings), 'fa')
  const url = payPageUrl(created.payment.authority)
  const bank = bankByKey(created.card.bankKey)
  return {
    text: [
      '✅ <b>لینک پرداخت آماده شد</b> — پیام زیر را برای مشتری فوروارد کنید 👇',
      DIVIDER,
      `💳 ${bank.fa}${view.holder ? ` — به نام ${escapeHtml(view.holder)}` : ''}`,
      `شماره کارت: <code>${view.pan}</code>`,
      `مبلغ دقیق: <code>${view.amount}</code> تومان`,
      'لطفاً دقیقاً همین مبلغ را واریز کنید (بدون رُند کردن)؛ پرداخت خودکار تأیید می‌شود.',
      `🔗 ${url}`,
      `⏳ مهلت: ۶۰ دقیقه`,
    ].join('\n'),
    keyboard: kb([[link('🔗 باز کردن صفحهٔ پرداخت', url)], [btn('🧾 پیگیری این پرداخت', `py:v:${created.payment.id}`), btn('💳 درگاه', 'm:pay')]]),
  }
}

// ─── Pause / resume ─────────────────────────────────────────────────────

export async function gatewayToggleScreen(workspaceId: string): Promise<BotScreen> {
  const on = await gatewayEnabled(workspaceId)
  return on
    ? {
        text: '⏸ <b>درگاه پرداخت موقتاً متوقف شود؟</b>\n\nتا روشن کردن دوباره، کارتی برای مشتری فرستاده نمی‌شود و ایجنت سفارش را به روش قبلی می‌گیرد. پرداخت‌هایی که الان باز هستند همچنان تأیید می‌شوند.\n\nمثلاً وقتی گوشی خاموش است یا کارت مسدود شده.',
        keyboard: kb([[btn('⏸ بله، متوقف کن', 'pg:p'), btn('↩️ انصراف', 'm:pay')]]),
      }
    : {
        text: '▶️ <b>درگاه پرداخت روشن شود؟</b>\n\nاز همین لحظه ایجنت‌هایی که روش پرداختشان درگاه ویجنت است کارت را برای مشتری می‌فرستند.',
        keyboard: kb([[btn('▶️ بله، روشن کن', 'pg:r'), btn('↩️ انصراف', 'm:pay')]]),
      }
}
