export type TelegramInlineKeyboardButton = {
  text: string
  callback_data?: string
  url?: string
}

export type TelegramInlineKeyboardMarkup = {
  inline_keyboard: TelegramInlineKeyboardButton[][]
}

export type OperatorBotCallback =
  | { type: 'menu'; action: 'home' | 'open' | 'stats' | 'health' | 'help' }
  | { type: 'channel'; action: 'pause' | 'resume' }
  | { type: 'alert'; action: 'claim' | 'resolve' | 'status'; alertId: string }

function normalizeAppUrl(appUrl: string): string {
  return appUrl.replace(/\/$/, '')
}

/**
 * Telegram calls inline keyboards "inline keyboard markup". In Persian bot
 * terminology these are commonly known as glass buttons (دکمه شیشه‌ای).
 */
export function buildOperatorMenuKeyboard(
  appUrl: string,
  active: boolean,
): TelegramInlineKeyboardMarkup {
  const baseUrl = normalizeAppUrl(appUrl)

  return {
    inline_keyboard: [
      [
        { text: '📥 گفتگوهای منتظر', callback_data: 'menu:open' },
        { text: '📊 گزارش ۲۴ساعته', callback_data: 'menu:stats' },
      ],
      [
        { text: '🩺 سلامت بات', callback_data: 'menu:health' },
        {
          text: active ? '⏸ توقف هشدارها' : '▶️ فعال‌سازی هشدارها',
          callback_data: active ? 'channel:pause' : 'channel:resume',
        },
      ],
      [
        { text: '❓ راهنما', callback_data: 'menu:help' },
        { text: '🖥 پنل ویجنت', url: `${baseUrl}/conversations` },
      ],
    ],
  }
}

export function buildOperatorAlertKeyboard(params: {
  appUrl: string
  conversationId: string
  alertId: string
  state?: string
}): TelegramInlineKeyboardMarkup {
  const baseUrl = normalizeAppUrl(params.appUrl)
  const resolved = params.state === 'resolved'
  const claimed = params.state === 'claimed'

  const stateButton: TelegramInlineKeyboardButton = resolved
    ? { text: '✅ حل‌شده', callback_data: `alert:status:${params.alertId}` }
    : claimed
      ? { text: '👤 در حال پیگیری', callback_data: `alert:status:${params.alertId}` }
      : { text: '🙋 قبول گفتگو', callback_data: `alert:claim:${params.alertId}` }

  return {
    inline_keyboard: [
      [
        {
          text: '💬 مشاهده و پاسخ',
          url: `${baseUrl}/conversations/${encodeURIComponent(params.conversationId)}`,
        },
      ],
      resolved
        ? [stateButton]
        : [
            stateButton,
            { text: '✅ علامت‌گذاری حل‌شده', callback_data: `alert:resolve:${params.alertId}` },
          ],
      [{ text: '📊 مرکز مدیریت', callback_data: 'menu:home' }],
    ],
  }
}

export function parseOperatorBotCallback(value: string): OperatorBotCallback | null {
  const menu = /^menu:(home|open|stats|health|help)$/.exec(value)
  if (menu) {
    return {
      type: 'menu',
      action: menu[1] as 'home' | 'open' | 'stats' | 'health' | 'help',
    }
  }

  const channel = /^channel:(pause|resume)$/.exec(value)
  if (channel) {
    return { type: 'channel', action: channel[1] as 'pause' | 'resume' }
  }

  const alert = /^alert:(claim|resolve|status):([A-Za-z0-9_-]{8,50})$/.exec(value)
  if (alert) {
    return {
      type: 'alert',
      action: alert[1] as 'claim' | 'resolve' | 'status',
      alertId: alert[2],
    }
  }

  return null
}
