/**
 * OPERATOR BOT — CONTROL CENTER SCREENS
 * =====================================
 *
 * The workspace's Telegram manager bot is driven entirely by glass buttons
 * (inline keyboards): one message that is edited in place as the owner moves
 * between screens, so the chat never fills up with menus. Every screen is a
 * pure `{ text, keyboard }` built from live workspace data.
 *
 * Screens: home · operator queue · case detail (+ quick replies / write a
 * reply) · today's conversations · orders · bookings · performance report ·
 * agents (pause/resume) · credit & plan · alert preferences · health · help.
 * Plus the morning report pushed by the worker.
 *
 * Callback data (≤ 64 bytes, Telegram limit):
 *   m:<screen>[:arg]      navigate           a:<v|c|r|q|w>:<alertId>   case
 *   a:s:<alertId>:<n>     send quick reply   g:<t|y>:<agentId>         agent
 *   p:<prefKey>           toggle an alert    ch:<pause|resume>         alerts
 *   x:c                   cancel writing
 */

import type { ChannelType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'
import { getDashboardModules } from '@/lib/verticals/registry'
import { readBusinessProfile, workspaceCapabilities } from '@/lib/verticals/profile'
import type { TelegramInlineKeyboardButton, TelegramInlineKeyboardMarkup } from '@/lib/channels/operator-bot'

export interface BotScreen {
  text: string
  keyboard: TelegramInlineKeyboardMarkup
}

type Row = TelegramInlineKeyboardButton[]

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir').replace(/\/$/, '')
const DAY_MS = 24 * 60 * 60 * 1000
// Iran has had no DST since 2022: Tehran is a fixed UTC+03:30.
const TEHRAN_OFFSET_MS = 210 * 60 * 1000

// ─── Alert preferences ──────────────────────────────────────────────────

export const OPERATOR_PREF_KEYS = ['handoff', 'orders', 'stock', 'bookings', 'billing', 'health', 'daily'] as const
export type OperatorPrefKey = (typeof OPERATOR_PREF_KEYS)[number]
export type OperatorPrefs = Record<OperatorPrefKey, boolean>

const PREF_LABELS: Record<OperatorPrefKey, { icon: string; title: string; hint: string }> = {
  handoff: { icon: '🙋', title: 'گفتگوهای سپرده‌شده به شما', hint: 'وقتی ایجنت گفتگو را به اپراتور می‌سپارد' },
  orders: { icon: '🛒', title: 'سفارش و پیش‌سفارش جدید', hint: 'ثبت سفارش در گفتگو' },
  stock: { icon: '📦', title: 'موجودی کم محصول', hint: 'وقتی موجودی به حد هشدار می‌رسد' },
  bookings: { icon: '📅', title: 'رزرو، لغو و یادآوری نوبت', hint: 'نوبت‌های جدید و نزدیک' },
  billing: { icon: '💳', title: 'اعتبار و پلن', hint: 'کم شدن اعتبار و پایان دوره' },
  health: { icon: '🩺', title: 'قطعی اتصال برنامه‌ها', hint: 'وقتی یک برنامه پیام دریافت نمی‌کند' },
  daily: { icon: '🌅', title: 'گزارش صبحگاهی', hint: 'هر روز ساعت ۹ صبح' },
}

export function readOperatorPrefs(value: unknown): OperatorPrefs {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  return Object.fromEntries(
    OPERATOR_PREF_KEYS.map((key) => [key, record[key] === undefined ? true : record[key] === true]),
  ) as OperatorPrefs
}

export function isOperatorPrefKey(value: string): value is OperatorPrefKey {
  return (OPERATOR_PREF_KEYS as readonly string[]).includes(value)
}

// ─── Reply target («write a reply» mode) ────────────────────────────────

const replyTargetKey = (workspaceId: string) => `opbot:reply:${workspaceId}`

export async function setReplyTarget(workspaceId: string, alertId: string): Promise<void> {
  await getRedis().set(replyTargetKey(workspaceId), alertId, 'EX', 15 * 60)
}

export async function takeReplyTarget(workspaceId: string): Promise<string | null> {
  const redis = getRedis()
  const key = replyTargetKey(workspaceId)
  const value = await redis.get(key)
  if (value) await redis.del(key)
  return value
}

export async function clearReplyTarget(workspaceId: string): Promise<void> {
  await getRedis().del(replyTargetKey(workspaceId))
}

// ─── Formatting helpers ─────────────────────────────────────────────────

export function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

const fa = (n: number) => n.toLocaleString('fa-IR')
const toman = (irr: number) => `${fa(Math.floor(irr / 10))} تومان`
/** Store orders keep the shop's own currency; catalog prices are toman. */
function storeMoney(total: number, currency: string): string {
  const code = currency.toUpperCase()
  const unit = code === 'IRR' ? 'ریال' : code === 'IRT' || code === 'TMN' ? 'تومان' : code
  return `${fa(Math.round(total))} ${unit}`
}
const clip = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1)}…` : value)

export const CHANNEL_FA: Record<ChannelType, string> = {
  INSTAGRAM: 'اینستاگرام',
  TELEGRAM: 'تلگرام',
  BALE: 'بله',
  RUBIKA: 'روبیکا',
  WEB_WIDGET: 'ویجت سایت',
  CHAT_LINK: 'لینک چت',
  WHATSAPP: 'واتساپ',
  API: 'API',
}

const CHANNEL_ICON: Record<ChannelType, string> = {
  INSTAGRAM: '📸',
  TELEGRAM: '✈️',
  BALE: '🟢',
  RUBIKA: '🟠',
  WEB_WIDGET: '🌐',
  CHAT_LINK: '🔗',
  WHATSAPP: '🟩',
  API: '🧩',
}

const PLAN_FA: Record<string, string> = { TRIAL: 'آزمایشی', STARTER: 'استارتر', PRO: 'حرفه‌ای', BUSINESS: 'بیزینس' }

const ORDER_STATUS_FA: Record<string, string> = {
  pending: 'در انتظار پرداخت',
  processing: 'در حال انجام',
  'on-hold': 'معلق',
  completed: 'تکمیل‌شده',
  cancelled: 'لغوشده',
  refunded: 'مرجوع‌شده',
  failed: 'ناموفق',
}

/** Start of the current Tehran day (as a UTC instant), shifted by `days`. */
function tehranDayStart(days = 0): Date {
  const now = Date.now() + TEHRAN_OFFSET_MS
  return new Date(Math.floor(now / DAY_MS) * DAY_MS - TEHRAN_OFFSET_MS + days * DAY_MS)
}

function tehranTime(date: Date): string {
  return new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit' }).format(date)
}

function tehranDate(date: Date): string {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone: 'Asia/Tehran', weekday: 'long', day: 'numeric', month: 'long' }).format(date)
}

function ago(date: Date): string {
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000))
  if (minutes < 1) return 'همین حالا'
  if (minutes < 60) return `${fa(minutes)} دقیقه پیش`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${fa(hours)} ساعت پیش`
  return `${fa(Math.round(hours / 24))} روز پیش`
}

const btn = (text: string, callback: string): TelegramInlineKeyboardButton => ({ text, callback_data: callback })
const link = (text: string, path: string): TelegramInlineKeyboardButton => ({ text, url: `${APP_URL}${path}` })
const homeRow = (extra?: TelegramInlineKeyboardButton): Row => (extra ? [extra, btn('🏠 خانه', 'm:home')] : [btn('🏠 خانه', 'm:home')])
const kb = (rows: Row[]): TelegramInlineKeyboardMarkup => ({ inline_keyboard: rows })
const DIVIDER = '┈┈┈┈┈┈┈┈┈┈┈┈'

// ─── Shared queries ─────────────────────────────────────────────────────

export interface OperatorContext {
  id: string
  workspaceId: string
  active: boolean
  prefs: unknown
}

async function workspaceBasics(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true, plan: true, trialEndsAt: true, aiCreditBalanceIRR: true, aiCreditReservedIRR: true, businessType: true, businessProfile: true },
  })
  const profile = readBusinessProfile(workspace?.businessProfile, workspace?.businessType)
  const modules = getDashboardModules(workspaceCapabilities(workspace))
  return {
    name: profile?.businessName || workspace?.name || 'کسب‌وکار شما',
    plan: workspace?.plan ?? 'TRIAL',
    trialEndsAt: workspace?.trialEndsAt ?? null,
    balance: Math.max(0, (workspace?.aiCreditBalanceIRR ?? 0) - (workspace?.aiCreditReservedIRR ?? 0)),
    hasStore: modules.includes('products'),
    hasBookings: modules.includes('appointments'),
  }
}

async function periodStats(workspaceId: string, since: Date) {
  const conversationWhere: Prisma.ConversationWhereInput = { workspaceId, deletedAt: null, createdAt: { gte: since } }
  const [conversations, resolved, handedOff, contacts, orders, drafts, bookings, spend] = await Promise.all([
    prisma.conversation.count({ where: conversationWhere }),
    prisma.conversation.count({ where: { ...conversationWhere, status: 'RESOLVED' } }),
    prisma.handoffAlert.count({ where: { workspaceId, createdAt: { gte: since } } }),
    prisma.contact.count({ where: { workspaceId, createdAt: { gte: since } } }),
    prisma.storeOrder.count({ where: { workspaceId, deletedAt: null, createdAt: { gte: since } } }),
    prisma.orderDraft.count({ where: { workspaceId, submittedAt: { gte: since } } }),
    prisma.appointment.count({ where: { workspaceId, createdAt: { gte: since }, status: { not: 'CANCELLED' } } }),
    prisma.usageLog.aggregate({ where: { workspaceId, date: { gte: since } }, _sum: { chargedIRR: true } }),
  ])
  const decided = resolved + handedOff
  return {
    conversations,
    resolved,
    handedOff,
    autoRate: decided > 0 ? Math.round((resolved / decided) * 100) : null,
    contacts,
    orders: orders + drafts,
    bookings,
    spend: spend._sum.chargedIRR ?? 0,
  }
}

// ─── Home ───────────────────────────────────────────────────────────────

export async function homeScreen(op: OperatorContext): Promise<BotScreen> {
  const [basics, today, waiting] = await Promise.all([
    workspaceBasics(op.workspaceId),
    periodStats(op.workspaceId, tehranDayStart()),
    prisma.handoffAlert.count({ where: { workspaceId: op.workspaceId, state: { in: ['open', 'claimed'] } } }),
  ])
  const upcoming = basics.hasBookings
    ? await prisma.appointment.count({ where: { workspaceId: op.workspaceId, startsAt: { gte: new Date(), lt: tehranDayStart(1) }, status: { in: ['PENDING', 'CONFIRMED'] } } })
    : 0

  const lines = [
    `🎛 <b>مرکز مدیریت ${escapeHtml(basics.name)}</b>`,
    `${op.active ? '🟢 هشدارها روشن' : '⏸ هشدارها موقتاً خاموش'} · ${tehranDate(new Date())} · ${tehranTime(new Date())}`,
    DIVIDER,
    '<b>امروز در یک نگاه</b>',
    `💬 گفتگو: <b>${fa(today.conversations)}</b>    🤖 خودکار: <b>${today.autoRate === null ? '—' : `${fa(today.autoRate)}٪`}</b>`,
    `🙋 منتظر شما: <b>${fa(waiting)}</b>    👥 مشتری جدید: <b>${fa(today.contacts)}</b>`,
  ]
  if (basics.hasStore || basics.hasBookings) {
    lines.push([
      basics.hasStore ? `🛒 سفارش: <b>${fa(today.orders)}</b>` : null,
      basics.hasBookings ? `📅 نوبت باقی‌مانده: <b>${fa(upcoming)}</b>` : null,
    ].filter(Boolean).join('    '))
  }
  lines.push(DIVIDER, `💳 اعتبار: <b>${toman(basics.balance)}</b> · پلن ${PLAN_FA[basics.plan] ?? basics.plan}`)
  if (waiting > 0) lines.push('', `⚠️ ${fa(waiting)} گفتگو منتظر پاسخ شماست.`)

  const rows: Row[] = [
    [btn(waiting > 0 ? `📥 صف اپراتور · ${fa(waiting)}` : '📥 صف اپراتور', 'm:queue'), btn('💬 گفتگوهای امروز', 'm:today')],
  ]
  const business: Row = []
  if (basics.hasStore) business.push(btn('🛒 سفارش‌ها', 'm:orders'))
  if (basics.hasBookings) business.push(btn('📅 نوبت‌ها', 'm:book'))
  if (business.length) rows.push(business)
  rows.push(
    [btn('📊 گزارش عملکرد', 'm:rep:1'), btn('🤖 ایجنت‌ها', 'm:agents')],
    [btn('💳 اعتبار و پلن', 'm:credit'), btn('🔔 هشدارها', 'm:alerts')],
    [btn('🩺 سلامت اتصال', 'm:health'), btn('❓ راهنما', 'm:help')],
    [btn('🔄 به‌روزرسانی', 'm:home'), link('🖥 پنل ویجنت', '/overview')],
  )
  return { text: lines.join('\n'), keyboard: kb(rows) }
}

// ─── Operator queue & case detail ───────────────────────────────────────

export async function queueScreen(workspaceId: string): Promise<BotScreen> {
  const alerts = await prisma.handoffAlert.findMany({
    where: { workspaceId, state: { in: ['open', 'claimed'] } },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: { id: true, contactName: true, contactPhone: true, channel: true, reason: true, state: true, createdAt: true },
  })
  if (alerts.length === 0) {
    return {
      text: ['📭 <b>صف اپراتور خالی است</b>', '', 'همهٔ گفتگوها را ایجنت جواب داده یا شما رسیدگی کرده‌اید. 👌'].join('\n'),
      keyboard: kb([homeRow(btn('🔄 به‌روزرسانی', 'm:queue'))]),
    }
  }
  const lines = [`📥 <b>صف اپراتور</b> · ${fa(alerts.length)} مورد`, 'روی هر مورد بزنید تا خلاصه و پاسخ سریع را ببینید.', DIVIDER]
  const rows: Row[] = []
  alerts.forEach((alert, index) => {
    const name = alert.contactName || alert.contactPhone || 'مشتری'
    const state = alert.state === 'claimed' ? '🟡 در حال پیگیری' : '🔴 منتظر'
    lines.push(
      `${fa(index + 1)}. <b>${escapeHtml(name)}</b> · ${CHANNEL_FA[alert.channel]} · ${state}`,
      `   ${escapeHtml(clip(alert.reason ?? 'درخواست صحبت با اپراتور', 70))} · ${ago(alert.createdAt)}`,
    )
    rows.push([btn(`${alert.state === 'claimed' ? '🟡' : '🔴'} ${clip(name, 22)} · ${CHANNEL_FA[alert.channel]}`, `a:v:${alert.id}`)])
  })
  rows.push(homeRow(btn('🔄 به‌روزرسانی', 'm:queue')))
  return { text: lines.join('\n'), keyboard: kb(rows) }
}

export async function caseScreen(workspaceId: string, alertId: string, notice?: string): Promise<BotScreen | null> {
  const alert = await prisma.handoffAlert.findFirst({
    where: { id: alertId, workspaceId },
    select: { id: true, conversationId: true, contactName: true, contactPhone: true, channel: true, reason: true, summary: true, state: true, createdAt: true },
  })
  if (!alert) return null
  const messages = await prisma.message.findMany({
    where: { conversationId: alert.conversationId, role: { in: ['USER', 'ASSISTANT'] } },
    orderBy: { createdAt: 'desc' },
    take: 4,
    select: { role: true, content: true },
  })
  const name = alert.contactName || 'مشتری'
  const state = alert.state === 'resolved' ? '🟢 حل‌شده' : alert.state === 'claimed' ? '🟡 در حال پیگیری' : '🔴 منتظر پاسخ'
  const lines = [
    notice ? `${notice}\n` : '',
    `🙋 <b>${escapeHtml(name)}</b> · ${CHANNEL_ICON[alert.channel]} ${CHANNEL_FA[alert.channel]}`,
    alert.contactPhone ? `📞 <code>${escapeHtml(alert.contactPhone)}</code>` : '',
    `⏱ ${ago(alert.createdAt)} · ${state}`,
    alert.reason ? `📝 <b>دلیل:</b> ${escapeHtml(clip(alert.reason, 160))}` : '',
    alert.summary ? `\n📋 <b>خلاصه</b>\n${escapeHtml(clip(alert.summary, 420))}` : '',
  ].filter(Boolean)
  if (messages.length) {
    lines.push('', '💬 <b>آخرین پیام‌ها</b>')
    for (const message of messages.reverse()) {
      lines.push(`${message.role === 'USER' ? '👤' : '🤖'} ${escapeHtml(clip(message.content.replace(/\s+/g, ' '), 140))}`)
    }
  }

  const rows: Row[] = []
  if (alert.state !== 'resolved') {
    rows.push([btn('✍️ نوشتن پاسخ', `a:w:${alert.id}`), btn('⚡ پاسخ آماده', `a:q:${alert.id}`)])
    rows.push(alert.state === 'open'
      ? [btn('🙋 قبول گفتگو', `a:c:${alert.id}`), btn('✅ حل شد', `a:r:${alert.id}`)]
      : [btn('✅ علامت حل‌شده', `a:r:${alert.id}`)])
  }
  rows.push([link('🖥 باز کردن در پنل', `/conversations/${encodeURIComponent(alert.conversationId)}`)])
  rows.push([btn('↩️ صف اپراتور', 'm:queue'), btn('🏠 خانه', 'm:home')])
  return { text: lines.join('\n'), keyboard: kb(rows) }
}

export const QUICK_REPLIES = [
  'سلام، وقت‌تون بخیر 🌿 پیام‌تون رو دیدم و همین الان بررسی می‌کنم.',
  'ممنون از صبرتون 🙏 تا چند دقیقهٔ دیگه جواب کامل رو براتون می‌فرستم.',
  'لطفاً شماره تماس‌تون رو بفرستید تا همکارمون باهاتون تماس بگیره. ☎️',
  'درخواست‌تون ثبت شد ✅ نتیجه رو همین‌جا بهتون اطلاع می‌دم.',
  'مشکل برطرف شد 🌸 اگه سؤال دیگه‌ای بود در خدمتم.',
] as const

export async function quickRepliesScreen(workspaceId: string, alertId: string): Promise<BotScreen | null> {
  const alert = await prisma.handoffAlert.findFirst({ where: { id: alertId, workspaceId }, select: { id: true, contactName: true } })
  if (!alert) return null
  const lines = [`⚡ <b>پاسخ آماده برای ${escapeHtml(alert.contactName || 'مشتری')}</b>`, 'با یک لمس، همان متن برای مشتری در برنامهٔ خودش فرستاده می‌شود.', DIVIDER]
  QUICK_REPLIES.forEach((reply, index) => lines.push(`${fa(index + 1)}. ${reply}`))
  const rows: Row[] = [
    QUICK_REPLIES.slice(0, 3).map((_, index) => btn(`ارسال ${fa(index + 1)}`, `a:s:${alert.id}:${index}`)),
    QUICK_REPLIES.slice(3).map((_, index) => btn(`ارسال ${fa(index + 4)}`, `a:s:${alert.id}:${index + 3}`)),
    [btn('↩️ بازگشت به پرونده', `a:v:${alert.id}`)],
  ]
  return { text: lines.join('\n'), keyboard: kb(rows) }
}

export async function writeReplyScreen(workspaceId: string, alertId: string): Promise<BotScreen | null> {
  const alert = await prisma.handoffAlert.findFirst({ where: { id: alertId, workspaceId }, select: { id: true, contactName: true, channel: true } })
  if (!alert) return null
  await setReplyTarget(workspaceId, alert.id)
  return {
    text: [
      `✍️ <b>پاسخ به ${escapeHtml(alert.contactName || 'مشتری')}</b>`,
      '',
      `پیام‌تان را همین‌جا بنویسید و بفرستید؛ مستقیم در ${CHANNEL_FA[alert.channel]} برای مشتری ارسال می‌شود.`,
      '⏳ این حالت تا ۱۵ دقیقه فعال می‌ماند.',
    ].join('\n'),
    keyboard: kb([[btn('❌ انصراف', `x:c`)], [btn('↩️ بازگشت به پرونده', `a:v:${alert.id}`)]]),
  }
}

// ─── Today's conversations ──────────────────────────────────────────────

export async function todayScreen(workspaceId: string): Promise<BotScreen> {
  const since = tehranDayStart()
  const where: Prisma.ConversationWhereInput = { workspaceId, deletedAt: null, lastMessageAt: { gte: since } }
  const [byChannel, recent] = await Promise.all([
    prisma.conversation.groupBy({ by: ['channel'], where, _count: { _all: true } }),
    prisma.conversation.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      take: 6,
      select: { id: true, channel: true, status: true, lastMessageAt: true, contact: { select: { name: true } } },
    }),
  ])
  const total = byChannel.reduce((sum, row) => sum + row._count._all, 0)
  if (total === 0) {
    return { text: '💬 <b>گفتگوهای امروز</b>\n\nامروز هنوز گفتگویی شروع نشده است.', keyboard: kb([homeRow(btn('🔄 به‌روزرسانی', 'm:today'))]) }
  }
  const lines = [
    `💬 <b>گفتگوهای امروز</b> · ${fa(total)} گفتگو`,
    byChannel.sort((a, b) => b._count._all - a._count._all).map((row) => `${CHANNEL_ICON[row.channel]} ${CHANNEL_FA[row.channel]} ${fa(row._count._all)}`).join('  ·  '),
    DIVIDER,
  ]
  const statusFa = { OPEN: '🔵 باز', RESOLVED: '🟢 حل‌شده', HANDED_OFF: '🟡 نزد اپراتور' } as Record<string, string>
  for (const conversation of recent) {
    lines.push(`${statusFa[conversation.status] ?? ''} <b>${escapeHtml(conversation.contact?.name || 'مشتری')}</b> · ${CHANNEL_FA[conversation.channel]} · ${conversation.lastMessageAt ? tehranTime(conversation.lastMessageAt) : ''}`)
  }
  const rows: Row[] = []
  for (let index = 0; index < recent.length; index += 2) {
    rows.push(recent.slice(index, index + 2).map((conversation) => link(`💬 ${clip(conversation.contact?.name || 'مشتری', 16)}`, `/conversations/${encodeURIComponent(conversation.id)}`)))
  }
  rows.push(homeRow(btn('🔄 به‌روزرسانی', 'm:today')))
  return { text: lines.join('\n'), keyboard: kb(rows) }
}

// ─── Orders ─────────────────────────────────────────────────────────────

export async function ordersScreen(workspaceId: string): Promise<BotScreen> {
  const [orders, drafts, today] = await Promise.all([
    prisma.storeOrder.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { externalOrderId: true, customerName: true, total: true, currency: true, status: true, createdAt: true },
    }),
    prisma.orderDraft.findMany({
      where: { workspaceId, status: 'SUBMITTED' },
      orderBy: { submittedAt: 'desc' },
      take: 5,
      select: { code: true, customerName: true, total: true, submittedAt: true },
    }),
    periodStats(workspaceId, tehranDayStart()),
  ])
  const lines = [
    '🛒 <b>سفارش‌ها</b>',
    `امروز: <b>${fa(today.orders)}</b> سفارش`,
  ]
  if (drafts.length) {
    lines.push(DIVIDER, '📝 <b>پیش‌سفارش‌های منتظر تأیید</b> (ثبت‌شده در گفتگو)')
    for (const draft of drafts) {
      lines.push(`• <code>${draft.code}</code> · ${escapeHtml(draft.customerName || 'مشتری')}${draft.total ? ` · ${fa(Math.round(draft.total))} تومان` : ''}${draft.submittedAt ? ` · ${ago(draft.submittedAt)}` : ''}`)
    }
  }
  if (orders.length) {
    lines.push(DIVIDER, '📦 <b>آخرین سفارش‌های سایت</b>')
    for (const order of orders) {
      lines.push(`• #${escapeHtml(order.externalOrderId)} · ${escapeHtml(order.customerName || 'مشتری')} · ${storeMoney(order.total, order.currency)} · ${ORDER_STATUS_FA[order.status] ?? order.status}`)
    }
  }
  if (!drafts.length && !orders.length) lines.push('', 'هنوز سفارشی ثبت نشده است.')
  return {
    text: lines.join('\n'),
    keyboard: kb([[link('📦 همهٔ سفارش‌ها در پنل', '/products/orders')], homeRow(btn('🔄 به‌روزرسانی', 'm:orders'))]),
  }
}

// ─── Bookings ───────────────────────────────────────────────────────────

export async function bookingsScreen(workspaceId: string): Promise<BotScreen> {
  const appointments = await prisma.appointment.findMany({
    where: { workspaceId, startsAt: { gte: tehranDayStart(), lt: tehranDayStart(2) }, status: { in: ['PENDING', 'CONFIRMED'] } },
    orderBy: { startsAt: 'asc' },
    take: 14,
    select: { customerName: true, startsAt: true, status: true, service: { select: { name: true } } },
  })
  const tomorrow = tehranDayStart(1)
  const today = appointments.filter((item) => item.startsAt < tomorrow)
  const next = appointments.filter((item) => item.startsAt >= tomorrow)
  const block = (title: string, items: typeof appointments) => [
    `<b>${title}</b> · ${fa(items.length)} نوبت`,
    ...(items.length
      ? items.map((item) => `${item.startsAt < new Date() ? '✔️' : '🕒'} ${tehranTime(item.startsAt)} · ${escapeHtml(item.customerName)} · ${escapeHtml(item.service.name)}${item.status === 'PENDING' ? ' · ⏳ منتظر تأیید' : ''}`)
      : ['— نوبتی ثبت نشده']),
  ]
  return {
    text: ['📅 <b>نوبت‌ها</b>', DIVIDER, ...block('امروز', today), '', ...block('فردا', next)].join('\n'),
    keyboard: kb([[link('🗓 تقویم کامل در پنل', '/appointments')], homeRow(btn('🔄 به‌روزرسانی', 'm:book'))]),
  }
}

// ─── Performance report ─────────────────────────────────────────────────

export async function reportScreen(workspaceId: string, days: 1 | 7 | 30): Promise<BotScreen> {
  const since = days === 1 ? tehranDayStart() : new Date(Date.now() - days * DAY_MS)
  const [stats, basics] = await Promise.all([periodStats(workspaceId, since), workspaceBasics(workspaceId)])
  const title = days === 1 ? 'امروز' : `${fa(days)} روز اخیر`
  const lines = [
    `📊 <b>گزارش عملکرد · ${title}</b>`,
    DIVIDER,
    `💬 گفتگو: <b>${fa(stats.conversations)}</b>`,
    `🤖 حل خودکار: <b>${fa(stats.resolved)}</b>${stats.autoRate === null ? '' : ` (${fa(stats.autoRate)}٪)`}`,
    `🙋 سپرده به اپراتور: <b>${fa(stats.handedOff)}</b>`,
    `👥 مشتری جدید: <b>${fa(stats.contacts)}</b>`,
  ]
  if (basics.hasStore) lines.push(`🛒 سفارش: <b>${fa(stats.orders)}</b>`)
  if (basics.hasBookings) lines.push(`📅 نوبت جدید: <b>${fa(stats.bookings)}</b>`)
  lines.push(`💳 هزینهٔ هوش مصنوعی: <b>${toman(stats.spend)}</b>`)
  const tab = (value: 1 | 7 | 30, label: string) => btn(days === value ? `● ${label}` : label, `m:rep:${value}`)
  return { text: lines.join('\n'), keyboard: kb([[tab(1, 'امروز'), tab(7, '۷ روز'), tab(30, '۳۰ روز')], [link('📈 گزارش کامل در پنل', '/analytics')], homeRow()]) }
}

// ─── Agents ─────────────────────────────────────────────────────────────

export async function agentsScreen(workspaceId: string, notice?: string): Promise<BotScreen> {
  const since = tehranDayStart()
  const agents = await prisma.agent.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'asc' },
    take: 8,
    select: { id: true, name: true, active: true, _count: { select: { conversations: { where: { lastMessageAt: { gte: since }, deletedAt: null } } } } },
  })
  const lines = [notice ? `${notice}\n` : '', '🤖 <b>ایجنت‌ها</b>', 'ایجنت متوقف‌شده تا روشن شدن دوباره به پیام مشتری‌ها جواب نمی‌دهد.', DIVIDER].filter(Boolean)
  const rows: Row[] = []
  if (!agents.length) lines.push('هنوز ایجنتی نساخته‌اید.')
  for (const agent of agents) {
    lines.push(`${agent.active ? '🟢' : '⏸'} <b>${escapeHtml(agent.name)}</b> · امروز ${fa(agent._count.conversations)} گفتگو`)
    rows.push([btn(`${agent.active ? '⏸ توقف' : '▶️ روشن کردن'} · ${clip(agent.name, 22)}`, `g:t:${agent.id}`)])
  }
  rows.push([link('⚙️ تنظیمات ایجنت‌ها', '/agents')], homeRow())
  return { text: lines.join('\n'), keyboard: kb(rows) }
}

export async function agentConfirmScreen(workspaceId: string, agentId: string): Promise<BotScreen | null> {
  const agent = await prisma.agent.findFirst({ where: { id: agentId, workspaceId }, select: { id: true, name: true, active: true } })
  if (!agent) return null
  return {
    text: agent.active
      ? `⏸ <b>ایجنت «${escapeHtml(agent.name)}» متوقف شود؟</b>\n\nتا وقتی دوباره روشنش کنید به پیام‌های جدید جواب نمی‌دهد و گفتگوها برای شما می‌ماند.`
      : `▶️ <b>ایجنت «${escapeHtml(agent.name)}» روشن شود؟</b>\n\nاز همین لحظه دوباره به پیام‌های مشتری‌ها جواب می‌دهد.`,
    keyboard: kb([[btn(agent.active ? '✅ بله، متوقف کن' : '✅ بله، روشن کن', `g:y:${agent.id}`), btn('↩️ انصراف', 'm:agents')]]),
  }
}

// ─── Credit & plan ──────────────────────────────────────────────────────

export async function creditScreen(workspaceId: string): Promise<BotScreen> {
  const [basics, week] = await Promise.all([
    workspaceBasics(workspaceId),
    prisma.usageLog.aggregate({ where: { workspaceId, date: { gte: new Date(Date.now() - 7 * DAY_MS) } }, _sum: { chargedIRR: true } }),
  ])
  const perDay = (week._sum.chargedIRR ?? 0) / 7
  const daysLeft = perDay > 0 ? Math.floor(basics.balance / perDay) : null
  const lines = [
    '💳 <b>اعتبار و پلن</b>',
    DIVIDER,
    `📦 پلن: <b>${PLAN_FA[basics.plan] ?? basics.plan}</b>`,
    basics.plan === 'TRIAL' && basics.trialEndsAt ? `⏳ پایان دورهٔ آزمایشی: <b>${tehranDate(basics.trialEndsAt)}</b>` : '',
    `💰 اعتبار قابل استفاده: <b>${toman(basics.balance)}</b>`,
    `📉 مصرف ۷ روز اخیر: <b>${toman(week._sum.chargedIRR ?? 0)}</b>`,
    daysLeft !== null ? `📆 با همین روند: حدود <b>${fa(daysLeft)} روز</b> دیگر` : '',
  ].filter(Boolean)
  if (daysLeft !== null && daysLeft <= 5) lines.push('', '⚠️ اعتبار رو به اتمام است؛ برای اینکه ایجنت‌ها متوقف نشوند شارژ کنید.')
  return { text: lines.join('\n'), keyboard: kb([[link('⚡ شارژ اعتبار', '/billing'), link('⬆️ ارتقای پلن', '/billing#vigent-plans')], homeRow()]) }
}

// ─── Alert preferences ──────────────────────────────────────────────────

export function alertsScreen(op: OperatorContext): BotScreen {
  const prefs = readOperatorPrefs(op.prefs)
  const lines = [
    '🔔 <b>هشدارها</b>',
    'انتخاب کنید کدام رویدادها همین‌جا به شما خبر داده شود. همه‌چیز در پنل هم ثبت می‌ماند.',
    DIVIDER,
    ...OPERATOR_PREF_KEYS.map((key) => `${prefs[key] ? '✅' : '⬜️'} ${PREF_LABELS[key].icon} ${PREF_LABELS[key].title} — ${PREF_LABELS[key].hint}`),
  ]
  if (!op.active) lines.push('', '⏸ همهٔ هشدارها موقتاً خاموش هستند.')
  const rows: Row[] = []
  for (let index = 0; index < OPERATOR_PREF_KEYS.length; index += 2) {
    rows.push(OPERATOR_PREF_KEYS.slice(index, index + 2).map((key) => btn(`${prefs[key] ? '✅' : '⬜️'} ${PREF_LABELS[key].icon} ${PREF_LABELS[key].title.split(' ')[0]}`, `p:${key}`)))
  }
  rows.push([btn(op.active ? '⏸ خاموش کردن همهٔ هشدارها' : '▶️ روشن کردن هشدارها', op.active ? 'ch:pause' : 'ch:resume')], homeRow())
  return { text: lines.join('\n'), keyboard: kb(rows) }
}

// ─── Help ───────────────────────────────────────────────────────────────

export function helpScreen(): BotScreen {
  return {
    text: [
      '📖 <b>راهنمای ربات مدیر</b>',
      DIVIDER,
      'همه‌چیز با دکمه‌های شیشه‌ای کار می‌کند؛ لازم نیست دستوری تایپ کنید.',
      '',
      '🙋 <b>گفتگوی سپرده‌شده:</b> هشدار با خلاصه می‌رسد. «قبول» یعنی شما پیگیری می‌کنید؛ «نوشتن پاسخ» یا «پاسخ آماده» پیام را مستقیم برای مشتری در همان برنامه می‌فرستد.',
      '↩️ روی خود پیام هشدار هم می‌توانید Reply بزنید و جواب بدهید.',
      '📊 <b>گزارش:</b> امروز، ۷ و ۳۰ روز — و هر صبح ساعت ۹ یک خلاصه.',
      '🤖 <b>ایجنت‌ها:</b> در مواقع لازم یک ایجنت را متوقف یا روشن کنید.',
      '🔔 <b>هشدارها:</b> انتخاب کنید چه چیزهایی به شما خبر داده شود.',
      '',
      'هر وقت گم شدید، /start را بزنید تا به خانه برگردید.',
    ].join('\n'),
    keyboard: kb([homeRow()]),
  }
}

// ─── Morning report (pushed by the worker) ──────────────────────────────

export async function dailyReportScreen(op: OperatorContext): Promise<BotScreen> {
  const [basics, yesterday, waiting] = await Promise.all([
    workspaceBasics(op.workspaceId),
    (async () => {
      const from = tehranDayStart(-1)
      const to = tehranDayStart()
      const where: Prisma.ConversationWhereInput = { workspaceId: op.workspaceId, deletedAt: null, createdAt: { gte: from, lt: to } }
      const [conversations, resolved, handedOff, contacts] = await Promise.all([
        prisma.conversation.count({ where }),
        prisma.conversation.count({ where: { ...where, status: 'RESOLVED' } }),
        prisma.handoffAlert.count({ where: { workspaceId: op.workspaceId, createdAt: { gte: from, lt: to } } }),
        prisma.contact.count({ where: { workspaceId: op.workspaceId, createdAt: { gte: from, lt: to } } }),
      ])
      return { conversations, resolved, handedOff, contacts }
    })(),
    prisma.handoffAlert.count({ where: { workspaceId: op.workspaceId, state: { in: ['open', 'claimed'] } } }),
  ])
  const bookingsToday = basics.hasBookings
    ? await prisma.appointment.count({ where: { workspaceId: op.workspaceId, startsAt: { gte: tehranDayStart(), lt: tehranDayStart(1) }, status: { in: ['PENDING', 'CONFIRMED'] } } })
    : 0
  const decided = yesterday.resolved + yesterday.handedOff
  const lines = [
    `🌅 <b>صبح بخیر! گزارش ${escapeHtml(basics.name)}</b>`,
    tehranDate(new Date()),
    DIVIDER,
    '<b>دیروز</b>',
    `💬 ${fa(yesterday.conversations)} گفتگو · 🤖 ${decided > 0 ? `${fa(Math.round((yesterday.resolved / decided) * 100))}٪ خودکار` : '—'}`,
    `🙋 ${fa(yesterday.handedOff)} سپرده به اپراتور · 👥 ${fa(yesterday.contacts)} مشتری جدید`,
    '',
    '<b>امروز</b>',
    `📥 منتظر شما: <b>${fa(waiting)}</b>${basics.hasBookings ? ` · 📅 نوبت: <b>${fa(bookingsToday)}</b>` : ''}`,
    `💳 اعتبار: <b>${toman(basics.balance)}</b>`,
  ]
  const rows: Row[] = [[btn('📥 صف اپراتور', 'm:queue'), btn('📊 گزارش کامل', 'm:rep:7')]]
  if (basics.hasBookings) rows.push([btn('📅 نوبت‌های امروز', 'm:book')])
  rows.push([btn('🏠 مرکز مدیریت', 'm:home')])
  return { text: lines.join('\n'), keyboard: kb(rows) }
}
