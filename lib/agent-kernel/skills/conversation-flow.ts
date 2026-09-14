import type { ChatMessage } from '@/lib/ai/openrouter'

export const CONVERSATION_FLOW_SKILL_VERSION = '1.1.0'

const BARE_GREETING = /^(?:(?:سلام|درود|وقت(?:تون|تان)?\s*(?:بخیر|خوش)|صبح\s*بخیر|عصر\s*بخیر|شب\s*بخیر|hi|hello|hey|good\s+(?:morning|afternoon|evening))[\s!,.،؟?]*)+$/i
const CONTEXT_REFERENCE = /(?:کدومش|کدامش|کدوم‌ش|کدام‌ش|این\s*(?:دو|دوتا)|اون\s*(?:یکی|دوتا)?|آن\s*(?:یکی|دوتا)?|همین|همون|همان|قبلی|اولی|دومی|هر\s*دو|جفتشون|جفتشان|(?:قیمت|کیفیت|جنس|رنگ|سایز|مزیت|عیب)ش(?:ون|ان)?|ارزون\s*تر|ارزان\s*تر|گرون\s*تر|گران\s*تر|which\s+one|these\s+two|the\s+other|same\s+one|previous\s+one|both\s+of\s+them)/iu

export function conversationFlowInstruction(params: {
  isFa: boolean
  history: ChatMessage[]
  userMessage: string
}): string {
  const hasPriorTurns = params.history.some((message) =>
    message.role === 'user' || message.role === 'assistant')
  const greetingOnly = BARE_GREETING.test(params.userMessage.trim())
  const referencesHistory = CONTEXT_REFERENCE.test(params.userMessage)

  if (params.isFa) {
    if (hasPriorTurns) {
      return `این نوبت ادامهٔ همان گفتگو است: پاسخ را با سلام، خوش‌آمدگویی یا معرفی شروع نکن و مستقیم به پیام آخر پاسخ بده؛ تاریخچه فقط زمینه است، درخواست‌های پاسخ‌داده‌شده را دوباره جواب نده. معیار سؤال فعلی (مثلاً کیفیت) را با معیار نوبت قبلی (مثلاً قیمت) جایگزین نکن و فقط اگر برای فهم پاسخ لازم است به نتیجهٔ قبلی اشاره کن.${referencesHistory ? ' پیام فعلی مرجع وابسته به سابقه دارد: مرجع‌هایی مثل «کدومش/این دوتا/اون یکی/همین/قبلی» را از نزدیک‌ترین پیام‌های مرتبط پیدا کن. اگر مرجع از سابقه روشن است دوباره نام گزینه‌ها را نپرس؛ محصول یا موضوع سومی که در سابقه یا دادهٔ معتبر فعلی نیست وارد نکن.' : ''} اگر مشتری فقط سلام کرده هم یک تأیید خیلی کوتاه کافی است. ایموجی فقط وقتی استفاده کن که در فرمت یا صدای برند صریحاً مجاز شده باشد.`
    }
    if (greetingOnly) {
      return 'این پیام فقط احوال‌پرسی است: یک خوش‌آمد کوتاه و فقط یک سؤال ساده برای فهم نیاز بپرس؛ مثلاً «سلام! چطور می‌توانم کمکتان کنم؟». سؤال دوم، چندبخشی یا مثالِ پرسشی اضافه نکن. هنوز محصول، خدمت یا قیمت پیشنهاد نده. ایموجی فقط وقتی استفاده کن که در فرمت یا صدای برند صریحاً مجاز شده باشد.'
    }
    return 'این نخستین نوبت است اما مشتری درخواست مشخصی دارد: پاسخ را با سلام، خوش‌آمدگویی یا معرفی شروع نکن و اول همان درخواست را مستقیم پاسخ بده. صرفاً به‌خاطر اولین پیام، پاسخ را عقب نینداز یا از مشتری نپرس چه کمکی می‌خواهد. ایموجی فقط وقتی استفاده کن که در فرمت یا صدای برند صریحاً مجاز شده باشد.'
  }

  if (hasPriorTurns) {
    return `This turn continues the same conversation: do not begin with another greeting, welcome, or introduction. Answer only the latest request; history is context, not a request to answer resolved questions again. Do not replace the current criterion (for example, quality) with the previous one (for example, price), and mention the prior result only when needed to understand the answer.${referencesHistory ? ' The current message contains a history-dependent reference: resolve phrases such as “which one”, “these two”, “the other”, “same”, or “previous” from the nearest relevant messages. If the referent is clear, do not ask for the option names again. Never introduce a third product or topic absent from the history or current trusted data.' : ''} Even if the customer only says hello, a very brief acknowledgement is enough. Use emoji only when the agent format or brand voice explicitly allows it.`
  }
  if (greetingOnly) {
    return 'This message is only a greeting: give one short welcome and exactly one simple question, for example “Hello! How can I help?”. Never add a second, compound, or example question. Do not pitch a product, service, or price yet. Use emoji only when the agent format or brand voice explicitly allows it.'
  }
  return 'This is the first turn, but the customer has made a concrete request: do not begin with a greeting, welcome, or introduction; answer that request first. Never delay an answer merely because it is the first message, and do not ask how you can help. Use emoji only when the agent format or brand voice explicitly allows it.'
}
