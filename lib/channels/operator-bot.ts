import crypto from 'node:crypto'

export type TelegramInlineKeyboardButton = {
  text: string
  callback_data?: string
  url?: string
}

export type TelegramInlineKeyboardMarkup = {
  inline_keyboard: TelegramInlineKeyboardButton[][]
}

export type OperatorBotScreenName =
  | 'home' | 'queue' | 'today' | 'orders' | 'book' | 'agents' | 'credit' | 'alerts' | 'health' | 'help' | 'pay'

/** Payment lists in the bot: all · waiting for a transfer · owner review · paid. */
export type PaymentListFilter = 'a' | 'o' | 'r' | 'p'

export type OperatorBotCallback =
  | { type: 'screen'; screen: OperatorBotScreenName }
  | { type: 'report'; days: 1 | 7 | 30 }
  | { type: 'channel'; action: 'pause' | 'resume' }
  | { type: 'alert'; action: 'view' | 'claim' | 'resolve' | 'status' | 'quick' | 'write'; alertId: string }
  | { type: 'send'; alertId: string; index: number }
  | { type: 'agent'; action: 'ask' | 'confirm'; agentId: string }
  | { type: 'pref'; key: string }
  | { type: 'cancel' }
  | { type: 'payList'; filter: PaymentListFilter; page: number }
  | { type: 'payment'; action: 'view' | 'askConfirm' | 'confirm' | 'askReject' | 'reject' | 'askCancel' | 'cancel'; paymentId: string }
  | { type: 'smsList' }
  | { type: 'sms'; action: 'view' | 'ignore'; smsId: string }
  | { type: 'smsAttach'; smsId: string; paymentId: string }
  | { type: 'payLink' }
  | { type: 'gateway'; action: 'ask' | 'pause' | 'resume' }

function normalizeAppUrl(appUrl: string): string {
  return appUrl.replace(/\/$/, '')
}

/** Derive Telegram's webhook header secret without exposing the bot token. */
export function operatorWebhookSecret(
  workspaceId: string,
  botToken: string,
): string {
  const key = process.env.ENCRYPTION_KEY
  if (!key) throw new Error('ENCRYPTION_KEY is not set')
  return crypto
    .createHmac('sha256', key)
    .update(`operator-webhook:${workspaceId}:${botToken}`)
    .digest('base64url')
}

/**
 * Glass buttons (دکمه‌های شیشه‌ای — Telegram's inline keyboard) under a pushed
 * handoff/pre-order alert: reply right here, claim or resolve, open the case.
 */
export function buildOperatorAlertKeyboard(params: {
  appUrl: string
  conversationId: string
  alertId: string
  state?: string
}): TelegramInlineKeyboardMarkup {
  const baseUrl = normalizeAppUrl(params.appUrl)
  const open: TelegramInlineKeyboardButton = {
    text: '🖥 باز کردن در پنل',
    url: `${baseUrl}/conversations/${encodeURIComponent(params.conversationId)}`,
  }
  if (params.state === 'resolved') {
    return {
      inline_keyboard: [
        [{ text: '✅ حل‌شده', callback_data: `a:t:${params.alertId}` }],
        [open, { text: '🏠 خانه', callback_data: 'm:home' }],
      ],
    }
  }
  return {
    inline_keyboard: [
      [
        { text: '✍️ نوشتن پاسخ', callback_data: `a:w:${params.alertId}` },
        { text: '⚡ پاسخ آماده', callback_data: `a:q:${params.alertId}` },
      ],
      [
        params.state === 'claimed'
          ? { text: '👤 در حال پیگیری', callback_data: `a:t:${params.alertId}` }
          : { text: '🙋 قبول گفتگو', callback_data: `a:c:${params.alertId}` },
        { text: '✅ حل شد', callback_data: `a:r:${params.alertId}` },
      ],
      [open, { text: '🏠 خانه', callback_data: 'm:home' }],
    ],
  }
}

const SCREENS: readonly OperatorBotScreenName[] = ['home', 'queue', 'today', 'orders', 'book', 'agents', 'credit', 'alerts', 'health', 'help', 'pay']
const PAYMENT_ACTIONS = { v: 'view', y: 'askConfirm', Y: 'confirm', n: 'askReject', N: 'reject', x: 'askCancel', X: 'cancel' } as const
const LEGACY_MENU: Record<string, OperatorBotScreenName> = { home: 'home', open: 'queue', health: 'health', help: 'help' }
const ALERT_ACTIONS = { v: 'view', c: 'claim', r: 'resolve', t: 'status', q: 'quick', w: 'write' } as const
const ID = '([A-Za-z0-9_-]{8,50})'

export function parseOperatorBotCallback(value: string): OperatorBotCallback | null {
  const screen = /^m:([a-z]+)$/.exec(value)
  if (screen && (SCREENS as readonly string[]).includes(screen[1])) {
    return { type: 'screen', screen: screen[1] as OperatorBotScreenName }
  }
  const report = /^m:rep:(1|7|30)$/.exec(value)
  if (report) return { type: 'report', days: Number(report[1]) as 1 | 7 | 30 }

  const alert = new RegExp(`^a:([vcrtqw]):${ID}$`).exec(value)
  if (alert) return { type: 'alert', action: ALERT_ACTIONS[alert[1] as keyof typeof ALERT_ACTIONS], alertId: alert[2] }
  const send = new RegExp(`^a:s:${ID}:(\\d)$`).exec(value)
  if (send) return { type: 'send', alertId: send[1], index: Number(send[2]) }

  const agent = new RegExp(`^g:([ty]):${ID}$`).exec(value)
  if (agent) return { type: 'agent', action: agent[1] === 't' ? 'ask' : 'confirm', agentId: agent[2] }

  const payList = /^py:l:([aorp]):(\d{1,2})$/.exec(value)
  if (payList) return { type: 'payList', filter: payList[1] as PaymentListFilter, page: Number(payList[2]) }
  const payment = new RegExp(`^py:([vyYnNxX]):${ID}$`).exec(value)
  if (payment) return { type: 'payment', action: PAYMENT_ACTIONS[payment[1] as keyof typeof PAYMENT_ACTIONS], paymentId: payment[2] }
  if (value === 'ps:l') return { type: 'smsList' }
  const sms = new RegExp(`^ps:([vi]):${ID}$`).exec(value)
  if (sms) return { type: 'sms', action: sms[1] === 'v' ? 'view' : 'ignore', smsId: sms[2] }
  const attach = new RegExp(`^ps:a:${ID}:${ID}$`).exec(value)
  if (attach) return { type: 'smsAttach', smsId: attach[1], paymentId: attach[2] }
  if (value === 'pn:new') return { type: 'payLink' }
  const gateway = /^pg:(t|p|r)$/.exec(value)
  if (gateway) return { type: 'gateway', action: gateway[1] === 't' ? 'ask' : gateway[1] === 'p' ? 'pause' : 'resume' }

  const pref = /^p:([a-z]{3,12})$/.exec(value)
  if (pref) return { type: 'pref', key: pref[1] }
  if (value === 'x:c') return { type: 'cancel' }

  const channel = /^(?:ch|channel):(pause|resume)$/.exec(value)
  if (channel) return { type: 'channel', action: channel[1] as 'pause' | 'resume' }

  // Buttons on messages sent before the control-center redesign.
  const legacyMenu = /^menu:(home|open|stats|health|help)$/.exec(value)
  if (legacyMenu) {
    return legacyMenu[1] === 'stats' ? { type: 'report', days: 1 } : { type: 'screen', screen: LEGACY_MENU[legacyMenu[1]] }
  }
  const legacyAlert = new RegExp(`^alert:(claim|resolve|status):${ID}$`).exec(value)
  if (legacyAlert) return { type: 'alert', action: legacyAlert[1] as 'claim' | 'resolve' | 'status', alertId: legacyAlert[2] }

  return null
}
