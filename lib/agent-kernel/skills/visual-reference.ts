import type { ChatMessage } from '@/lib/ai/openrouter'

export const VISUAL_REFERENCE_SKILL_VERSION = '1.1.0'

const OUTBOUND_VISUAL_REFERENCE_RE =
  /(?:عکس|تصویر|کارت|پست)[^.!؟?\n]{0,28}(?:گذاشت(?:ین|ید)|فرستاد(?:ین|ید)|نشون\s*داد(?:ین|ید)|بالا|قبلی)|(?:همون|همان).{0,20}(?:عکس|تصویر|مدل|رنگ|کار|طرح)|(?:^|\s)(?:این|همین)\s*(?:مدل|رنگ|کار|طرح)|(?:photo|image|card).{0,25}(?:you\s+(?:sent|showed|posted)|above|previous)/iu

/** The model claiming it cannot see media that the customer never sent. */
const BLIND_MEDIA_CLAIM_RE =
  /(?:نمی\s*(?:توانم|تونم|بینم|ببینم|ببینیم|ببینید|شنوم|بشنوم)|نمیتونم|نمیبینم)[^.!؟?\n]{0,40}(?:عکس|تصویر|ویدیو|ویس|فایل|پیام\s*صوتی|رسانه)|(?:عکس|تصویر|ویدیو|ویس|پیام\s*صوتی|رسانه)[^.!؟?\n]{0,30}(?:نمی\s*(?:توانم|تونم|بینم|ببینم|ببینیم|ببینید|شنوم|بشنوم)|نمیتونم|نمیبینم)/iu

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\u200d]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function latestShownProduct(history: ChatMessage[]): string | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== 'assistant' || !message.content) continue
    const marker = message.content.match(/\[\[product:\{[^\n]*?"name"\s*:\s*"([^"]{1,140})"/u)?.[1]
    if (marker) return marker
  }
  return null
}

export function needsVisualReferenceSkill(params: {
  userMessage: string
  inboundMediaKind?: string
}): boolean {
  return Boolean(params.inboundMediaKind) || OUTBOUND_VISUAL_REFERENCE_RE.test(normalize(params.userMessage))
}

export function visualReferenceInstruction(params: {
  isFa: boolean
  userMessage: string
  history: ChatMessage[]
  inboundMediaKind?: string
}): string {
  if (params.inboundMediaKind) {
    return params.isFa
      ? `متادیتای معتبر کانال تأیید می‌کند مشتری در همین نوبت یک پیوست از نوع «${params.inboundMediaKind}» فرستاده است، اما محتوای بصری/صوتی آن در ورودی متنی مدل نیست. دریافت پیوست را تأیید کن ولی محتوایش را حدس نزن؛ اگر پاسخ بدون دیدن فایل ممکن نیست، فقط نام یا کد محصول را بپرس یا انتقال به اپراتور را پیشنهاد بده.`
      : `Trusted channel metadata confirms a ${params.inboundMediaKind} attachment on this turn, but its visual/audio content is not available to the text model. Acknowledge receipt without guessing its contents; ask only for the product name/code or offer operator handoff when inspection is required.`
  }

  const product = latestShownProduct(params.history)
  if (OUTBOUND_VISUAL_REFERENCE_RE.test(normalize(params.userMessage))) {
    return params.isFa
      ? `مشتری به عکس/کارت/مدل قبلیِ ارسال‌شده از طرف فروشگاه اشاره کرده است؛ این جمله به معنی فرستادن عکس جدید توسط مشتری نیست و نباید بگویی «نمی‌توانم عکس شما را ببینم». مرجع را از تاریخچه و آخرین کارت محصول پیدا کن${product ? ` (آخرین محصول نمایش‌داده‌شده: «${product}»)` : ''}. اگر دقیقاً معلوم نیست کدام بخش یا محصول داخل تصویر منظور است، فقط یک سؤال روشن‌کننده درباره نام یا کد آن بپرس و چیزی حدس نزن.`
      : `The customer is referring to an earlier image/card/model sent by the store; this does not mean the customer attached a new image, so never say you cannot see their image. Resolve the reference from history and the latest product card${product ? ` (latest shown product: “${product}”)` : ''}; if the exact item inside the image is ambiguous, ask one product-name/code clarification and do not guess.`
  }

  return ''
}

/**
 * Deterministic last line of defence. When channel metadata proves the
 * customer did NOT send media on this turn, yet they referred to something the
 * store itself showed earlier («دامنش که عکس گذاشتین موجوده»), a model reply
 * claiming «نمی‌توانم عکس را ببینم» is factually wrong — the store sent that
 * image. Strip the blind-claim sentences and replace them with an honest
 * clarification request anchored to the conversation.
 */
export function enforceVisualReferenceGrounding(params: {
  reply: string
  userMessage: string
  inboundMediaKind?: string
  isFa: boolean
}): string {
  if (params.inboundMediaKind) return params.reply
  const userRefersToOutboundVisual = OUTBOUND_VISUAL_REFERENCE_RE.test(normalize(params.userMessage))
  if (!userRefersToOutboundVisual) return params.reply
  if (!BLIND_MEDIA_CLAIM_RE.test(normalize(params.reply))) return params.reply

  const kept = params.reply
    .split(/(?<=[.!؟?])\s+|\n+/u)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !BLIND_MEDIA_CLAIM_RE.test(normalize(part)))

  const notice = params.isFa
    ? 'منظورتان همان محصولی است که کارتش را در همین گفتگو فرستادیم؟ نام یا کدش را بگویید تا موجودی و قیمت را دقیق چک کنم.'
    : 'Do you mean the product whose card was shared earlier in this conversation? Tell me its name or code and I will check stock and price.'
  const parts = kept.length > 0 ? kept : []
  parts.push(notice)
  return parts.filter((part, index, all) => all.indexOf(part) === index).join('\n\n')
}
