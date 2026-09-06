import type { ChatMessage } from '@/lib/ai/openrouter'

/**
 * Only complete, short closing phrases qualify. A bare yes/no/okay may answer
 * a pending question, and thanks followed by a new request needs normal AI.
 */
export function closingReplyText(message: string, history: ChatMessage[], language: string): string | null {
  if (message.length > 120 || history.at(-1)?.role === 'user') return null
  const text = message.normalize('NFKC')
    .replace(/ي/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[\u200c\u200d]/g, ' ')
    .replace(/[.!،,؛;🙏🌹🌺❤\uFE0F]/gu, ' ')
    .replace(/\s+/g, ' ').trim().toLowerCase()
  const thanks = '(?:نه\\s+)?(?:خیلی\\s+)?(?:ممنونم?|مرسی|متشکرم|سپاس(?:گزارم)?|تشکر)(?:\\s+(?:عزیزم|از\\s+راهنمایی(?:تون|تان)))?'
  const farewell = '(?:خداحافظ|خدانگهدار|فعلا(?:ً)?\\s+(?:کاری|سوالی|سؤالی)\\s+ندارم)'
  const defer = '(?:(?:فعلا(?:ً)?\\s+)?باید\\s+فکر\\s+کنم|بعدا(?:ً)?\\s+تصمیم\\s+می\\s*گیرم)'
  const persianClosing = new RegExp(`^(?:${thanks}|${farewell}|${defer})(?:\\s+(?:${thanks}|${farewell}|${defer}))*$`, 'u')
  const englishClosing = /^(?:(?:no\s+)?thanks?(?:\s+you)?|thank\s+you|goodbye|bye|that(?:'s| is)\s+all|(?:i\s+)?need\s+to\s+think|i(?:'ll| will)\s+decide\s+later)(?:\s+(?:thanks?|thank\s+you|goodbye|bye|that(?:'s| is)\s+all))*$/i
  if (!persianClosing.test(text) && !englishClosing.test(text)) return null
  const english = language.toLowerCase().startsWith('en')
  if (/(?:فکر|تصمیم|think|decide)/.test(text)) return english ? 'Of course, take your time.' : 'حتماً، با خیال راحت تصمیم بگیرید.'
  if (/(?:خداحافظ|خدانگهدار|goodbye|bye)/.test(text)) return english ? 'Goodbye.' : 'خدانگهدار.'
  if (/^(?:نه\s|no\s)/.test(text)) return english ? 'Of course.' : 'حتماً.'
  return english ? 'You’re welcome.' : 'خواهش می‌کنم.'
}

/** Shared by every customer-facing generation path, after saved role examples. */
export function responseEndingInstruction(isFa: boolean): string {
  return isFa
    ? 'قانون پایان پاسخ (مقدم بر قالب نقش، نمونه‌پاسخ‌ها و پیشنهاد فروش): سؤال پیگیری الزامی نیست؛ «حداکثر یک سؤال» سقف است، نه تکلیف. پس از پاسخ کامل، تمام کن. فقط برای روشن‌کردن نیاز مبهم در شروع یا گرفتن یک داده/تأیید ضروری برای درخواست فعلی سؤال بپرس؛ اطلاعاتی را که مشتری قبلاً داده دوباره نپرس. پس از تشکر، خداحافظی، رد پیشنهاد یا «فعلاً باید فکر کنم»، اگر درخواست تازه‌ای نیست فقط یک تأیید کوتاه بده؛ موضوع قبلی، نیازسنجی، پیشنهاد خرید، درخواست تماس یا زمان پیگیری را دوباره باز نکن. مثال: «ممنون» ← «خواهش می‌کنم.»؛ «نه مرسی» ← «حتماً.»؛ «بعداً تصمیم می‌گیرم» ← «حتماً، با خیال راحت تصمیم بگیرید.» جمله‌های «سؤال دیگری دارید؟»، «کمک دیگری می‌خواهید؟» و «اگر خواستید می‌توانم…» را برای ادامه‌دادن گفتگو اضافه نکن. تشکر همراه درخواست تازه و «بله» در پاسخ به پیشنهاد مشخص را از پایان گفتگو جدا کن و همان درخواست را انجام بده. طول تعیین‌شده حداقل اجباری نیست؛ برای پرکردن پاسخ جمله اضافه نکن.'
    : 'Response ending rule (takes precedence over role templates, example answers and sales suggestions): follow-up questions are optional; “at most one” is a limit, not a requirement. Stop after a complete answer. Ask only to clarify an ambiguous initial need or obtain one fact/confirmation essential to the current request; never re-ask known information. After thanks, goodbye, a declined offer or “I need to think”, acknowledge briefly when there is no new request; do not reopen the previous topic, discovery, sales, contact capture or follow-up scheduling. Examples: “Thanks” → “You’re welcome.”; “No thanks” → “Of course.”; “I’ll decide later” → “Take your time.” Do not append “Anything else?”, “How else can I help?” or “If you want, I can…” to prolong the conversation. Thanks with a new request and “yes” accepting a specific offer still require completing that request. The configured length is not a minimum; do not add filler to reach it.'
}
