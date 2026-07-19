import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  readOperatorBotToken,
  routeOperatorReplyFromTelegram,
} from '@/lib/channels/operator-handoff'
import {
  buildOperatorAlertKeyboard,
  buildOperatorMenuKeyboard,
  parseOperatorBotCallback,
  type TelegramInlineKeyboardMarkup,
} from '@/lib/channels/operator-bot'
import { getTelegramWebhookInfo, TELEGRAM_BASE } from '@/lib/channels/telegram'
import { captureError } from '@/lib/errors/capture'

export const dynamic = 'force-dynamic'

interface TgMessage {
  message_id: number
  chat: { id: number }
  text?: string
  reply_to_message?: { message_id: number }
}

interface TgCallbackQuery {
  id: string
  data?: string
  message?: TgMessage
}

interface TgUpdate {
  update_id: number
  message?: TgMessage
  callback_query?: TgCallbackQuery
}

interface OperatorChannelRow {
  id: string
  workspaceId: string
  botToken: string
  operatorChatId: string | null
  botUsername: string | null
  active: boolean
  lastError: string | null
}

const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir').replace(/\/$/, '')

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

async function telegramRequest(
  botToken: string,
  method: string,
  body: Record<string, unknown>,
): Promise<boolean> {
  try {
    const response = await fetch(`${TELEGRAM_BASE}/bot${botToken}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    })
    return response.ok
  } catch {
    return false
  }
}

async function sendMessage(
  botToken: string,
  chatId: string,
  text: string,
  replyMarkup?: TelegramInlineKeyboardMarkup,
): Promise<void> {
  await telegramRequest(botToken, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  })
}

async function showScreen(params: {
  botToken: string
  chatId: string
  messageId?: number
  text: string
  replyMarkup: TelegramInlineKeyboardMarkup
}): Promise<void> {
  if (params.messageId) {
    const edited = await telegramRequest(params.botToken, 'editMessageText', {
      chat_id: params.chatId,
      message_id: params.messageId,
      text: params.text,
      parse_mode: 'HTML',
      reply_markup: params.replyMarkup,
    })
    if (edited) return
  }

  await sendMessage(params.botToken, params.chatId, params.text, params.replyMarkup)
}

async function answerCallback(
  botToken: string,
  callbackQueryId: string,
  text: string,
): Promise<void> {
  await telegramRequest(botToken, 'answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
  })
}

function homeText(op: OperatorChannelRow): string {
  const state = op.active ? '🟢 فعال و آماده دریافت هشدار' : '⏸ هشدارها موقتاً متوقف هستند'
  const chat = op.operatorChatId ? '✅ شناسه اپراتور ثبت شده' : '⚠️ شناسه اپراتور ثبت نشده'
  return [
    '🎛 <b>مرکز مدیریت بات اپراتور ویجنت</b>',
    '',
    state,
    chat,
    '',
    'از دکمه‌های مدیریتی زیر برای بررسی صف، گزارش عملکرد و کنترل بات استفاده کنید.',
  ].join('\n')
}

function helpText(): string {
  return [
    '📖 <b>راهنمای سریع بات اپراتور</b>',
    '',
    '• با «گفتگوهای منتظر» صف ارجاع‌ها را ببینید.',
    '• «قبول گفتگو» وضعیت مورد را به در حال پیگیری تغییر می‌دهد.',
    '• با «علامت‌گذاری حل‌شده» مورد را از صف باز خارج کنید.',
    '• برای پاسخ به مشتری، روی پیام هشدار <b>Reply</b> بزنید و متن را ارسال کنید.',
    '• از «سلامت بات» برای بررسی webhook و خطاهای تلگرام استفاده کنید.',
    '',
    '<b>دستورات:</b> /menu · /chats · /stats · /health · /help',
  ].join('\n')
}

async function getOpenAlerts(workspaceId: string) {
  return prisma.handoffAlert.findMany({
    where: { workspaceId, state: { in: ['open', 'claimed'] } },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: {
      id: true,
      conversationId: true,
      contactName: true,
      contactPhone: true,
      channel: true,
      reason: true,
      state: true,
      createdAt: true,
    },
  })
}

async function openAlertsScreen(workspaceId: string): Promise<{
  text: string
  replyMarkup: TelegramInlineKeyboardMarkup
}> {
  const alerts = await getOpenAlerts(workspaceId)
  if (alerts.length === 0) {
    return {
      text: '📭 <b>صف اپراتور خالی است</b>\n\nدر حال حاضر گفتگوی باز یا در حال پیگیری وجود ندارد.',
      replyMarkup: { inline_keyboard: [[{ text: '↩️ مرکز مدیریت', callback_data: 'menu:home' }]] },
    }
  }

  const lines = [`📥 <b>صف اپراتور · ${alerts.length.toLocaleString('fa-IR')} مورد اخیر</b>`, '']
  const rows: TelegramInlineKeyboardMarkup['inline_keyboard'] = []
  alerts.forEach((alert, index) => {
    const contact = alert.contactName || alert.contactPhone || 'مشتری ناشناس'
    const state = alert.state === 'claimed' ? 'در حال پیگیری' : 'منتظر'
    lines.push(
      `${(index + 1).toLocaleString('fa-IR')}. <b>${escapeHtml(contact)}</b> · ${escapeHtml(alert.channel)} · ${state}` +
        (alert.reason ? `\n   ${escapeHtml(alert.reason.slice(0, 90))}` : ''),
    )
    rows.push([
      {
        text: `💬 ${contact.slice(0, 18)}`,
        url: `${appUrl}/conversations/${encodeURIComponent(alert.conversationId)}`,
      },
      alert.state === 'open'
        ? { text: '🙋 قبول', callback_data: `alert:claim:${alert.id}` }
        : { text: '👤 پیگیری', callback_data: `alert:status:${alert.id}` },
      { text: '✅ حل', callback_data: `alert:resolve:${alert.id}` },
    ])
  })
  rows.push([{ text: '↩️ مرکز مدیریت', callback_data: 'menu:home' }])

  return { text: lines.join('\n'), replyMarkup: { inline_keyboard: rows } }
}

async function statsText(workspaceId: string): Promise<string> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1_000)
  const [open, claimed, resolved, total, delivered] = await Promise.all([
    prisma.handoffAlert.count({ where: { workspaceId, state: 'open' } }),
    prisma.handoffAlert.count({ where: { workspaceId, state: 'claimed' } }),
    prisma.handoffAlert.count({ where: { workspaceId, state: 'resolved', resolvedAt: { gte: since } } }),
    prisma.handoffAlert.count({ where: { workspaceId, createdAt: { gte: since } } }),
    prisma.handoffAlert.count({
      where: { workspaceId, createdAt: { gte: since }, externalMessageId: { not: null } },
    }),
  ])
  const deliveryRate = total > 0 ? Math.round((delivered / total) * 100) : null

  return [
    '📊 <b>گزارش عملیاتی ۲۴ ساعت اخیر</b>',
    '',
    `🔴 منتظر پاسخ: <b>${open.toLocaleString('fa-IR')}</b>`,
    `🟡 در حال پیگیری: <b>${claimed.toLocaleString('fa-IR')}</b>`,
    `🟢 حل‌شده: <b>${resolved.toLocaleString('fa-IR')}</b>`,
    `📨 ارجاع جدید: <b>${total.toLocaleString('fa-IR')}</b>`,
    `📡 تحویل به تلگرام: <b>${deliveryRate === null ? 'بدون داده' : `${deliveryRate.toLocaleString('fa-IR')}٪`}</b>`,
  ].join('\n')
}

async function healthText(op: OperatorChannelRow, botToken: string): Promise<string> {
  const webhook = await getTelegramWebhookInfo(botToken)
  const webhookReady = Boolean(webhook?.url)
  const telegramError = webhook?.lastErrorMessage ?? op.lastError

  return [
    '🩺 <b>سلامت اتصال بات</b>',
    '',
    `${op.active ? '✅' : '⏸'} ارسال هشدار: <b>${op.active ? 'فعال' : 'متوقف'}</b>`,
    `${op.operatorChatId ? '✅' : '⚠️'} شناسه اپراتور: <b>${op.operatorChatId ? 'ثبت شده' : 'ناقص'}</b>`,
    `${webhookReady ? '✅' : '❌'} webhook تلگرام: <b>${webhookReady ? 'متصل' : 'در دسترس نیست'}</b>`,
    `📥 به‌روزرسانی در صف: <b>${(webhook?.pendingUpdateCount ?? 0).toLocaleString('fa-IR')}</b>`,
    telegramError ? `\n⚠️ <b>آخرین خطا:</b>\n${escapeHtml(telegramError.slice(0, 280))}` : '\n✨ خطای فعالی گزارش نشده است.',
  ].join('\n')
}

async function handleCallback(params: {
  query: TgCallbackQuery
  op: OperatorChannelRow
  botToken: string
  chatId: string
}): Promise<void> {
  const callback = parseOperatorBotCallback(params.query.data ?? '')
  if (!callback) {
    await answerCallback(params.botToken, params.query.id, 'این عملیات معتبر نیست.')
    return
  }

  const messageId = params.query.message?.message_id

  if (callback.type === 'menu') {
    await answerCallback(params.botToken, params.query.id, 'به‌روزرسانی شد')
    if (callback.action === 'open') {
      const screen = await openAlertsScreen(params.op.workspaceId)
      await showScreen({ ...params, messageId, ...screen })
      return
    }

    const text = callback.action === 'stats'
      ? await statsText(params.op.workspaceId)
      : callback.action === 'health'
        ? await healthText(params.op, params.botToken)
        : callback.action === 'help'
          ? helpText()
          : homeText(params.op)
    await showScreen({
      ...params,
      messageId,
      text,
      replyMarkup: buildOperatorMenuKeyboard(appUrl, params.op.active),
    })
    return
  }

  if (callback.type === 'channel') {
    const active = callback.action === 'resume'
    await prisma.operatorChannel.update({ where: { id: params.op.id }, data: { active } })
    const next = { ...params.op, active }
    await answerCallback(
      params.botToken,
      params.query.id,
      active ? 'هشدارها فعال شدند' : 'هشدارها متوقف شدند',
    )
    await showScreen({
      ...params,
      messageId,
      text: homeText(next),
      replyMarkup: buildOperatorMenuKeyboard(appUrl, active),
    })
    return
  }

  const alert = await prisma.handoffAlert.findFirst({
    where: { id: callback.alertId, workspaceId: params.op.workspaceId },
    select: { id: true, conversationId: true, state: true },
  })
  if (!alert) {
    await answerCallback(params.botToken, params.query.id, 'این گفتگو دیگر در دسترس نیست.')
    return
  }

  let state = alert.state
  let feedback = state === 'resolved' ? 'این مورد قبلاً حل شده است.' : 'وضعیت به‌روز است.'
  if (callback.action === 'claim' && state === 'open') {
    const updated = await prisma.handoffAlert.update({
      where: { id: alert.id },
      data: { state: 'claimed', claimedBy: `telegram:${params.chatId}` },
      select: { state: true },
    })
    state = updated.state
    feedback = 'گفتگو به شما اختصاص یافت.'
  } else if (callback.action === 'resolve' && state !== 'resolved') {
    const updated = await prisma.handoffAlert.update({
      where: { id: alert.id },
      data: { state: 'resolved', resolvedAt: new Date() },
      select: { state: true },
    })
    state = updated.state
    feedback = 'گفتگو حل‌شده ثبت شد.'
  }

  await answerCallback(params.botToken, params.query.id, feedback)

  if (params.query.message?.text?.includes('صف اپراتور')) {
    const screen = await openAlertsScreen(params.op.workspaceId)
    await showScreen({ ...params, messageId, ...screen })
    return
  }

  if (messageId) {
    await telegramRequest(params.botToken, 'editMessageReplyMarkup', {
      chat_id: params.chatId,
      message_id: messageId,
      reply_markup: buildOperatorAlertKeyboard({
        appUrl,
        conversationId: alert.conversationId,
        alertId: alert.id,
        state,
      }),
    })
  }
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  const tokenParam = url.searchParams.get('token')
  if (!tokenParam) return NextResponse.json({ ok: true })

  const update = (await req.json().catch(() => null)) as TgUpdate | null
  if (!update) return NextResponse.json({ ok: true })

  const candidates = await prisma.operatorChannel.findMany({
    select: {
      id: true,
      workspaceId: true,
      botToken: true,
      operatorChatId: true,
      botUsername: true,
      active: true,
      lastError: true,
    },
  })
  const op = candidates.find((candidate) => readOperatorBotToken(candidate.botToken) === tokenParam)
  if (!op) return NextResponse.json({ ok: true })

  const botToken = readOperatorBotToken(op.botToken)
  const incomingMessage = update.message ?? update.callback_query?.message
  const chatId = incomingMessage ? String(incomingMessage.chat.id) : null
  if (!botToken || !chatId || !op.operatorChatId || chatId !== op.operatorChatId) {
    if (botToken && update.callback_query) {
      await answerCallback(botToken, update.callback_query.id, 'شما به این مرکز مدیریت دسترسی ندارید.')
    }
    return NextResponse.json({ ok: true })
  }

  try {
    if (update.callback_query) {
      await handleCallback({ query: update.callback_query, op, botToken, chatId })
      return NextResponse.json({ ok: true })
    }

    const message = update.message
    if (!message) return NextResponse.json({ ok: true })
    const text = (message.text ?? '').trim()
    const command = text.split(/\s/, 1)[0]?.split('@', 1)[0]?.toLowerCase()
    const repliedMessageId = message.reply_to_message?.message_id

    if (repliedMessageId && text && !text.startsWith('/')) {
      const result = await routeOperatorReplyFromTelegram({
        workspaceId: op.workspaceId,
        telegramMessageId: String(repliedMessageId),
        operatorText: text,
      })
      await sendMessage(
        botToken,
        op.operatorChatId,
        result.ok
          ? '✅ پیام شما برای مشتری ارسال شد.'
          : '⚠️ ارسال انجام نشد. مطمئن شوید روی یک هشدار باز Reply زده‌اید و دوباره تلاش کنید.',
        buildOperatorMenuKeyboard(appUrl, op.active),
      )
      return NextResponse.json({ ok: true })
    }

    if (command === '/start' || command === '/menu') {
      await sendMessage(botToken, op.operatorChatId, homeText(op), buildOperatorMenuKeyboard(appUrl, op.active))
    } else if (command === '/chats' || command === '/open') {
      const screen = await openAlertsScreen(op.workspaceId)
      await sendMessage(botToken, op.operatorChatId, screen.text, screen.replyMarkup)
    } else if (command === '/stats') {
      await sendMessage(botToken, op.operatorChatId, await statsText(op.workspaceId), buildOperatorMenuKeyboard(appUrl, op.active))
    } else if (command === '/health') {
      await sendMessage(botToken, op.operatorChatId, await healthText(op, botToken), buildOperatorMenuKeyboard(appUrl, op.active))
    } else if (command === '/help') {
      await sendMessage(botToken, op.operatorChatId, helpText(), buildOperatorMenuKeyboard(appUrl, op.active))
    } else if (text && !text.startsWith('/')) {
      await sendMessage(
        botToken,
        op.operatorChatId,
        'ℹ️ برای پاسخ به مشتری، روی پیام هشدار <b>Reply</b> بزنید؛ یا از مرکز مدیریت استفاده کنید.',
        buildOperatorMenuKeyboard(appUrl, op.active),
      )
    }
  } catch (error) {
    captureError('operator-webhook:processing', error, {
      workspaceId: op.workspaceId,
      metadata: { chatId: op.operatorChatId },
    })
  }

  return NextResponse.json({ ok: true })
}
