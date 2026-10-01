import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  readOperatorBotToken,
  routeOperatorReplyFromTelegram,
} from '@/lib/channels/operator-handoff'
import {
  buildOperatorAlertKeyboard,
  parseOperatorBotCallback,
  type OperatorBotScreenName,
  type TelegramInlineKeyboardMarkup,
} from '@/lib/channels/operator-bot'
import {
  agentConfirmScreen,
  agentsScreen,
  alertsScreen,
  bookingsScreen,
  caseScreen,
  clearReplyTarget,
  creditScreen,
  escapeHtml,
  helpScreen,
  homeScreen,
  isOperatorPrefKey,
  ordersScreen,
  queueScreen,
  QUICK_REPLIES,
  quickRepliesScreen,
  readOperatorPrefs,
  reportScreen,
  takeReplyTarget,
  todayScreen,
  writeReplyScreen,
  type OperatorContext,
} from '@/lib/channels/operator-bot-screens'
import { getTelegramWebhookInfo, setTelegramBotCommands, TELEGRAM_BASE } from '@/lib/channels/telegram'
import { invalidateWidgetConfig } from '@/lib/widget/cache'
import type { Prisma } from '@prisma/client'
import { captureError } from '@/lib/errors/capture'
import { operatorWebhookSecret } from '@/lib/channels/operator-bot'
import { rateLimit } from '@/lib/ratelimit'
import {
  readBoundedRequestBody,
  RequestBodyTooLargeError,
} from '@/lib/security/request-body'
import { timingSafeEqual } from 'node:crypto'

export const dynamic = 'force-dynamic'

const MAX_UPDATE_BYTES = 256 * 1024

function secretMatches(expected: string, received: string): boolean {
  const expectedBytes = Buffer.from(expected)
  const receivedBytes = Buffer.from(received)
  return (
    expectedBytes.length === receivedBytes.length &&
    timingSafeEqual(expectedBytes, receivedBytes)
  )
}

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
  prefs: Prisma.JsonValue
  lastError: string | null
}

const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir').replace(/\/$/, '')

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

async function healthText(op: OperatorChannelRow, botToken: string): Promise<string> {
  const webhook = await getTelegramWebhookInfo(botToken)
  const webhookReady = Boolean(webhook?.url)
  const callbacksReady = webhook?.allowedUpdates.includes('callback_query') ?? false
  const telegramError = webhook?.lastErrorMessage ?? op.lastError

  return [
    '🩺 <b>سلامت اتصال ربات مدیر</b>',
    '',
    `${op.active ? '✅' : '⏸'} ارسال هشدار: <b>${op.active ? 'فعال' : 'متوقف'}</b>`,
    `${op.operatorChatId ? '✅' : '⚠️'} شناسه اپراتور: <b>${op.operatorChatId ? 'ثبت شده' : 'ناقص'}</b>`,
    `${webhookReady ? '✅' : '❌'} webhook تلگرام: <b>${webhookReady ? 'متصل' : 'در دسترس نیست'}</b>`,
    `${callbacksReady ? '✅' : '⚠️'} دکمه‌های مدیریتی: <b>${callbacksReady ? 'فعال' : 'نیازمند همگام‌سازی'}</b>`,
    `📥 به‌روزرسانی در صف: <b>${(webhook?.pendingUpdateCount ?? 0).toLocaleString('fa-IR')}</b>`,
    telegramError ? `\n⚠️ <b>آخرین خطا:</b>\n${escapeHtml(telegramError.slice(0, 280))}` : '\n✨ خطای فعالی گزارش نشده است.',
  ].join('\n')
}

type Screen = { text: string; keyboard: TelegramInlineKeyboardMarkup }

function toContext(op: OperatorChannelRow): OperatorContext {
  return { id: op.id, workspaceId: op.workspaceId, active: op.active, prefs: op.prefs }
}

async function screenFor(name: OperatorBotScreenName, op: OperatorChannelRow, botToken: string): Promise<Screen> {
  switch (name) {
    case 'queue': return queueScreen(op.workspaceId)
    case 'today': return todayScreen(op.workspaceId)
    case 'orders': return ordersScreen(op.workspaceId)
    case 'book': return bookingsScreen(op.workspaceId)
    case 'agents': return agentsScreen(op.workspaceId)
    case 'credit': return creditScreen(op.workspaceId)
    case 'alerts': return alertsScreen(toContext(op))
    case 'help': return helpScreen()
    case 'health':
      return {
        text: await healthText(op, botToken),
        keyboard: { inline_keyboard: [[{ text: '🔄 بررسی دوباره', callback_data: 'm:health' }, { text: '🏠 خانه', callback_data: 'm:home' }]] },
      }
    default: return homeScreen(toContext(op))
  }
}

const GONE: Screen = {
  text: 'این گفتگو دیگر در دسترس نیست.',
  keyboard: { inline_keyboard: [[{ text: '↩️ صف اپراتور', callback_data: 'm:queue' }, { text: '🏠 خانه', callback_data: 'm:home' }]] },
}

async function handleCallback(params: {
  query: TgCallbackQuery
  op: OperatorChannelRow
  botToken: string
  chatId: string
}): Promise<void> {
  const { op, botToken, chatId } = params
  const callback = parseOperatorBotCallback(params.query.data ?? '')
  if (!callback) {
    await answerCallback(botToken, params.query.id, 'این دکمه قدیمی است؛ /start را بزنید.')
    return
  }
  const messageId = params.query.message?.message_id
  // A pushed alert keeps its content: case screens open as a new message and
  // only its buttons are refreshed. Control-center screens edit in place.
  const fromAlert = messageId
    ? (await prisma.handoffAlert.count({ where: { workspaceId: op.workspaceId, externalMessageId: String(messageId) } })) > 0
    : false
  const show = (screen: Screen, inPlace = !fromAlert) =>
    showScreen({ botToken, chatId, messageId: inPlace ? messageId : undefined, text: screen.text, replyMarkup: screen.keyboard })

  switch (callback.type) {
    case 'screen': {
      await answerCallback(botToken, params.query.id, '')
      await show(await screenFor(callback.screen, op, botToken))
      return
    }
    case 'report': {
      await answerCallback(botToken, params.query.id, '')
      await show(await reportScreen(op.workspaceId, callback.days))
      return
    }
    case 'channel': {
      const active = callback.action === 'resume'
      await prisma.operatorChannel.update({ where: { id: op.id }, data: { active } })
      await answerCallback(botToken, params.query.id, active ? 'هشدارها روشن شدند' : 'هشدارها خاموش شدند')
      await show(alertsScreen(toContext({ ...op, active })))
      return
    }
    case 'pref': {
      if (!isOperatorPrefKey(callback.key)) {
        await answerCallback(botToken, params.query.id, 'گزینهٔ نامعتبر')
        return
      }
      const prefs = readOperatorPrefs(op.prefs)
      prefs[callback.key] = !prefs[callback.key]
      await prisma.operatorChannel.update({ where: { id: op.id }, data: { prefs } })
      await answerCallback(botToken, params.query.id, prefs[callback.key] ? 'روشن شد ✅' : 'خاموش شد')
      await show(alertsScreen(toContext({ ...op, prefs })))
      return
    }
    case 'cancel': {
      await clearReplyTarget(op.workspaceId)
      await answerCallback(botToken, params.query.id, 'لغو شد')
      await show(await homeScreen(toContext(op)))
      return
    }
    case 'agent': {
      const agent = await prisma.agent.findFirst({ where: { id: callback.agentId, workspaceId: op.workspaceId }, select: { id: true, name: true, active: true } })
      if (!agent) {
        await answerCallback(botToken, params.query.id, 'این ایجنت پیدا نشد.')
        await show(await agentsScreen(op.workspaceId))
        return
      }
      if (callback.action === 'ask') {
        await answerCallback(botToken, params.query.id, '')
        const screen = await agentConfirmScreen(op.workspaceId, agent.id)
        if (screen) await show(screen)
        return
      }
      await prisma.agent.update({ where: { id: agent.id }, data: { active: !agent.active } })
      await invalidateWidgetConfig(agent.id).catch(() => {})
      const notice = agent.active ? `⏸ «${escapeHtml(agent.name)}» متوقف شد.` : `▶️ «${escapeHtml(agent.name)}» دوباره فعال شد.`
      await answerCallback(botToken, params.query.id, agent.active ? 'متوقف شد' : 'فعال شد')
      await show(await agentsScreen(op.workspaceId, notice))
      return
    }
    case 'send': {
      const text = QUICK_REPLIES[callback.index]
      if (!text) {
        await answerCallback(botToken, params.query.id, 'پاسخ پیدا نشد.')
        return
      }
      const result = await routeOperatorReplyFromTelegram({ workspaceId: op.workspaceId, alertId: callback.alertId, operatorText: text })
      await answerCallback(botToken, params.query.id, result.ok ? 'ارسال شد ✅' : 'ارسال نشد')
      const screen = await caseScreen(op.workspaceId, callback.alertId, result.ok
        ? `✅ پاسخ برای ${escapeHtml(result.contactName || 'مشتری')} ارسال شد.`
        : '⚠️ ارسال انجام نشد؛ ممکن است گفتگو بسته شده باشد. از پنل امتحان کنید.')
      await show(screen ?? GONE)
      return
    }
    case 'alert': break
  }

  const alert = await prisma.handoffAlert.findFirst({
    where: { id: callback.alertId, workspaceId: op.workspaceId },
    select: { id: true, conversationId: true, state: true },
  })
  if (!alert) {
    await answerCallback(botToken, params.query.id, 'این گفتگو دیگر در دسترس نیست.')
    return
  }

  if (callback.action === 'view' || callback.action === 'quick' || callback.action === 'write') {
    await answerCallback(botToken, params.query.id, '')
    const screen = callback.action === 'view'
      ? await caseScreen(op.workspaceId, alert.id)
      : callback.action === 'quick'
        ? await quickRepliesScreen(op.workspaceId, alert.id)
        : await writeReplyScreen(op.workspaceId, alert.id)
    await show(screen ?? GONE)
    return
  }

  let state = alert.state
  let feedback = state === 'resolved' ? 'این مورد قبلاً حل شده است.' : 'وضعیت به‌روز است.'
  if (callback.action === 'claim' && state === 'open') {
    state = (await prisma.handoffAlert.update({
      where: { id: alert.id },
      data: { state: 'claimed', claimedBy: `telegram:${chatId}` },
      select: { state: true },
    })).state
    feedback = 'گفتگو به شما سپرده شد 🙋'
  } else if (callback.action === 'resolve' && state !== 'resolved') {
    state = (await prisma.handoffAlert.update({
      where: { id: alert.id },
      data: { state: 'resolved', resolvedAt: new Date() },
      select: { state: true },
    })).state
    feedback = 'حل‌شده ثبت شد ✅'
  }
  await answerCallback(botToken, params.query.id, feedback)

  if (fromAlert && messageId) {
    await telegramRequest(botToken, 'editMessageReplyMarkup', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: buildOperatorAlertKeyboard({ appUrl, conversationId: alert.conversationId, alertId: alert.id, state }),
    })
    return
  }
  await show((await caseScreen(op.workspaceId, alert.id)) ?? GONE)
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspaceId')
  if (!workspaceId || !/^[A-Za-z0-9_-]{8,64}$/.test(workspaceId)) {
    return NextResponse.json({ ok: true })
  }
  if (!(await rateLimit('operator-webhook:global', 1200, 60, { failClosed: true }))) {
    return NextResponse.json({ error: 'TEMPORARILY_UNAVAILABLE' }, { status: 503 })
  }

  const op = await prisma.operatorChannel.findUnique({
    where: { workspaceId },
    select: {
      id: true,
      workspaceId: true,
      botToken: true,
      operatorChatId: true,
      botUsername: true,
      active: true,
      prefs: true,
      lastError: true,
    },
  })
  if (!op) return NextResponse.json({ ok: true })

  const botToken = readOperatorBotToken(op.botToken)
  let expectedSecret = ''
  try {
    if (botToken) expectedSecret = operatorWebhookSecret(op.workspaceId, botToken)
  } catch {
    return NextResponse.json({ error: 'TEMPORARILY_UNAVAILABLE' }, { status: 503 })
  }
  const receivedSecret = req.headers.get('x-telegram-bot-api-secret-token') ?? ''
  if (!botToken || !secretMatches(expectedSecret, receivedSecret)) {
    return NextResponse.json({ ok: true })
  }
  if (!(await rateLimit(`operator-webhook:${op.workspaceId}`, 240, 60, { failClosed: true }))) {
    return NextResponse.json({ error: 'TEMPORARILY_UNAVAILABLE' }, { status: 503 })
  }

  let rawBody: Buffer
  try {
    rawBody = await readBoundedRequestBody(req, MAX_UPDATE_BYTES)
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 })
    }
    throw error
  }
  let update: TgUpdate | null = null
  try {
    update = JSON.parse(rawBody.toString('utf8')) as TgUpdate
  } catch {
    return NextResponse.json({ ok: true })
  }

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
    const send = (screen: Screen) => sendMessage(botToken, op.operatorChatId!, screen.text, screen.keyboard)

    if (command?.startsWith('/')) {
      await clearReplyTarget(op.workspaceId)
      // Keep the Telegram command menu down to one entry: everything else is
      // a glass button inside the bot.
      if (command === '/start') void setTelegramBotCommands(botToken).catch(() => {})
      const byCommand: Record<string, OperatorBotScreenName> = { '/chats': 'queue', '/open': 'queue', '/health': 'health', '/help': 'help' }
      if (command === '/stats') await send(await reportScreen(op.workspaceId, 1))
      else await send(await screenFor(byCommand[command] ?? 'home', op, botToken))
      return NextResponse.json({ ok: true })
    }
    if (!text) return NextResponse.json({ ok: true })

    // «نوشتن پاسخ» armed a target, or the owner used Telegram's Reply on an alert.
    const targetAlertId = repliedMessageId ? null : await takeReplyTarget(op.workspaceId)
    if (repliedMessageId || targetAlertId) {
      const result = await routeOperatorReplyFromTelegram({
        workspaceId: op.workspaceId,
        ...(targetAlertId ? { alertId: targetAlertId } : { telegramMessageId: String(repliedMessageId) }),
        operatorText: text,
      })
      if (result.ok) {
        await sendMessage(botToken, op.operatorChatId, `✅ برای <b>${escapeHtml(result.contactName || 'مشتری')}</b> ارسال شد.`, {
          inline_keyboard: [[
            ...(targetAlertId ? [{ text: '↩️ پرونده', callback_data: `a:v:${targetAlertId}` }] : []),
            { text: '📥 صف اپراتور', callback_data: 'm:queue' },
            { text: '🏠 خانه', callback_data: 'm:home' },
          ]],
        })
      } else {
        await sendMessage(
          botToken,
          op.operatorChatId,
          '⚠️ ارسال انجام نشد. ممکن است این گفتگو بسته شده باشد؛ از صف اپراتور دوباره انتخابش کنید.',
          { inline_keyboard: [[{ text: '📥 صف اپراتور', callback_data: 'm:queue' }, { text: '🏠 خانه', callback_data: 'm:home' }]] },
        )
      }
      return NextResponse.json({ ok: true })
    }

    // Free text with no target: bring the control center back.
    await send(await homeScreen(toContext(op)))
  } catch (error) {
    captureError('operator-webhook:processing', error, {
      workspaceId: op.workspaceId,
      metadata: { chatId: op.operatorChatId },
    })
  }

  return NextResponse.json({ ok: true })
}
