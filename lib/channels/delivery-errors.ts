/**
 * Why an operator message did not reach the customer, in words the operator
 * can act on. Provider errors arrive as adapter exceptions whose message holds
 * the raw API body (Meta Graph JSON, Telegram/Bale/Rubika Bot API JSON); this
 * module turns them into a small set of stable reasons and the copy shown for
 * each. It is pure and import-free so both the API route and the dashboard can
 * use it.
 */

/** Delivery problems with a known cause and a known operator action. */
export type ProviderFailureReason =
  | 'comment_unavailable'
  | 'reply_window_closed'
  | 'recipient_unreachable'
  | 'token_invalid'
  | 'permission_missing'
  | 'rate_limited'
  | 'network_error'
  | 'message_rejected'
  | 'provider_error'

/** Prefix of Instagram comment-thread conversation ids (public replies). */
export const INSTAGRAM_COMMENT_THREAD_PREFIX = 'comment:'

export function isInstagramCommentThread(externalId: string | null | undefined): boolean {
  return Boolean(externalId?.startsWith(INSTAGRAM_COMMENT_THREAD_PREFIX))
}

function metaErrorCodes(detail: string): { code: number | null; subcode: number | null } {
  const code = /"code"\s*:\s*(\d+)/.exec(detail)
  const subcode = /"error_subcode"\s*:\s*(\d+)/.exec(detail)
  return { code: code ? Number(code[1]) : null, subcode: subcode ? Number(subcode[1]) : null }
}

/** Map a thrown adapter error to the reason the operator should see. */
export function classifyProviderFailure(cause: unknown): ProviderFailureReason {
  const name = cause instanceof Error ? cause.name : ''
  const detail = cause instanceof Error ? cause.message : String(cause ?? '')

  if (name === 'Instagram24hWindowError' || /2534022|outside of allowed window/i.test(detail)) {
    return 'reply_window_closed'
  }
  if (name === 'AbortError' || name === 'TimeoutError' || /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|timed? ?out/i.test(detail)) {
    return 'network_error'
  }

  // Meta Graph (Instagram).
  if (/^INSTAGRAM\b/.test(detail) || /IGApiException|OAuthException|fbtrace_id/.test(detail)) {
    const { code, subcode } = metaErrorCodes(detail)
    if (/invalid credentials/i.test(detail) || code === 190 || code === 102) return 'token_invalid'
    if (/comment reply failed/i.test(detail)) {
      if (code === 100 || subcode === 33 || /does not exist/i.test(detail)) return 'comment_unavailable'
    }
    if (code === 4 || code === 17 || code === 32 || code === 613 || /rate.?limit/i.test(detail)) return 'rate_limited'
    if (code === 10 || code === 230 || (code !== null && code >= 200 && code < 300) || /permission.*denied/i.test(detail)) {
      return 'permission_missing'
    }
    // 2534014: no matching user; 551: user unavailable; plain 100 on a DM is
    // almost always a thread the customer never opened or has left.
    if (subcode === 2534014 || code === 551 || /no matching user|user.*unavailable|not.*accept/i.test(detail)) {
      return 'recipient_unreachable'
    }
    if (/length of param|too long/i.test(detail)) return 'message_rejected'
    if (code === 100) return 'recipient_unreachable'
    return 'provider_error'
  }

  // Telegram-style Bot APIs (Telegram, Bale) and Rubika.
  if (/\b401\b|unauthorized|invalid token|token.*(invalid|not found)/i.test(detail)) return 'token_invalid'
  if (/\b429\b|too many requests|retry after/i.test(detail)) return 'rate_limited'
  if (/bot was blocked|user is deactivated|chat not found|bot can't initiate|have no rights|kicked|PEER_ID_INVALID|\b403\b/i.test(detail)) {
    return 'recipient_unreachable'
  }
  if (/message is too long|can't parse entities|wrong file|\b400\b/i.test(detail)) return 'message_rejected'
  return 'provider_error'
}

type Copy = { fa: string; en: string }

/** One-line chip label for a message in the thread. */
const SHORT: Record<string, Copy> = {
  comment_unavailable: { fa: 'کامنت دیگر در دسترس نیست', en: 'Comment no longer available' },
  reply_window_closed: { fa: 'مهلت پاسخ ۲۴ساعته بسته شده', en: '24-hour reply window closed' },
  recipient_unreachable: { fa: 'مشتری در دسترس نیست', en: 'Customer unreachable' },
  token_invalid: { fa: 'اتصال برنامه منقضی شده', en: 'Channel connection expired' },
  permission_missing: { fa: 'دسترسی برنامه کافی نیست', en: 'Channel permission missing' },
  rate_limited: { fa: 'محدودیت ارسال؛ کمی بعد', en: 'Rate limited; retry shortly' },
  network_error: { fa: 'خطای شبکه در ارسال', en: 'Network error while sending' },
  message_rejected: { fa: 'برنامه پیام را نپذیرفت', en: 'Channel rejected the message' },
  products_need_dm: { fa: 'محصول فقط در دایرکت ارسال می‌شود', en: 'Products need a direct message' },
  missing_thread: { fa: 'گفتگوی مقصد پیدا نشد', en: 'No destination thread' },
  channel_inactive: { fa: 'برنامه غیرفعال است', en: 'Channel is inactive' },
  credentials_missing: { fa: 'برنامه متصل نیست', en: 'Channel not connected' },
  channel_retired: { fa: 'این برنامه دیگر پشتیبانی نمی‌شود', en: 'Channel retired' },
}

/** Full sentence under the composer: what happened and what to do. */
const LONG: Record<string, Copy> = {
  comment_unavailable: {
    fa: 'این کامنت در اینستاگرام حذف یا پنهان شده و دیگر نمی‌شود زیرش پاسخ داد. اگر مشتری دایرکت داده، از گفتگوی دایرکتش جواب بدهید.',
    en: 'This comment was deleted or hidden on Instagram, so it can no longer be replied to. If the customer sent a DM, reply in that conversation.',
  },
  reply_window_closed: {
    fa: 'بیش از ۲۴ ساعت از آخرین پیام مشتری گذشته و اینستاگرام اجازهٔ ارسال نمی‌دهد. وقتی مشتری دوباره پیام بدهد می‌توانید جواب بدهید.',
    en: 'More than 24 hours passed since the customer’s last message, so Instagram blocks sending. You can reply once they message again.',
  },
  recipient_unreachable: {
    fa: 'مشتری ربات را مسدود کرده، حسابش غیرفعال است یا گفتگو را نپذیرفته؛ پیام به او نمی‌رسد.',
    en: 'The customer blocked the bot, deactivated their account or never accepted the chat, so the message cannot reach them.',
  },
  token_invalid: {
    fa: 'اتصال این برنامه منقضی یا باطل شده است. از بخش کانال‌ها برنامه را دوباره وصل کنید.',
    en: 'This channel’s connection expired or was revoked. Reconnect it from the channels page.',
  },
  permission_missing: {
    fa: 'برنامه دسترسی لازم برای این نوع ارسال را ندارد. از بخش کانال‌ها برنامه را قطع و دوباره وصل کنید و همهٔ دسترسی‌ها را تأیید کنید.',
    en: 'The channel lacks the permission for this kind of send. Disconnect and reconnect it from the channels page, approving every permission.',
  },
  rate_limited: {
    fa: 'برنامه موقتاً جلوی ارسال‌های پشت‌سرهم را گرفته است. یک دقیقه صبر کنید و دوباره بفرستید.',
    en: 'The channel is temporarily throttling sends. Wait a minute and send again.',
  },
  network_error: {
    fa: 'ارتباط با سرور برنامه برقرار نشد. چند لحظه بعد دوباره تلاش کنید.',
    en: 'Could not reach the channel’s servers. Try again in a moment.',
  },
  message_rejected: {
    fa: 'برنامه این پیام را نپذیرفت (مثلاً متن خیلی طولانی یا قالب نامعتبر). متن را کوتاه‌تر کنید و دوباره بفرستید.',
    en: 'The channel rejected this message (for example it was too long or malformed). Shorten it and send again.',
  },
  products_need_dm: {
    fa: 'این گفتگو کامنت عمومی است و کارت محصول فقط در دایرکت ارسال می‌شود. لینک محصول را به‌صورت متن بفرستید.',
    en: 'This is a public comment thread; product cards only go out in direct messages. Send the product link as text instead.',
  },
  missing_thread: {
    fa: 'گفتگوی مقصد این مشتری در برنامه پیدا نشد؛ پیام فقط در پنل ثبت شد.',
    en: 'No destination thread exists for this customer; the message was only saved in the dashboard.',
  },
  channel_inactive: {
    fa: 'این برنامه برای ایجنت غیرفعال است. از بخش کانال‌ها آن را فعال کنید.',
    en: 'This channel is turned off for the agent. Turn it on from the channels page.',
  },
  credentials_missing: {
    fa: 'برنامه به ایجنت متصل نیست. از بخش کانال‌ها آن را دوباره وصل کنید.',
    en: 'The channel is not connected to the agent. Reconnect it from the channels page.',
  },
  channel_retired: {
    fa: 'این برنامه دیگر پشتیبانی نمی‌شود؛ پیام فقط در گفتگو ثبت شد.',
    en: 'This channel is retired; the message was only saved in the conversation.',
  },
}

export function deliveryReasonLabel(reason: unknown, fa: boolean): string | null {
  const copy = typeof reason === 'string' ? SHORT[reason] : undefined
  return copy ? (fa ? copy.fa : copy.en) : null
}

export function deliveryReasonDetail(reason: unknown, fa: boolean): string | null {
  const copy = typeof reason === 'string' ? LONG[reason] : undefined
  return copy ? (fa ? copy.fa : copy.en) : null
}
