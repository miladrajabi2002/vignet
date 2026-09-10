export const ACTION_CAPABILITY_SKILL_VERSION = '1.0.0'

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\u200d]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const COMPLETED_ORDER_STATUS_RE =
  /(?:ثبت\s*(?:شده|شد)|وضعیت|پیگیری|رهگیری|کجاست|شماره)\s*(?:سفارش|خرید)?|(?:سفارش|خرید).{0,20}(?:ثبت\s*(?:شده|شد)|کجاست|پیگیری|رهگیری|وضعیت)/iu

const ORDER_CREATION_REQUEST_RE =
  /(?:از\s*(?:همین\s*)?(?:جا|اینجا|دایرکت|چت).{0,35}(?:خرید|سفارش)|(?:خرید|سفارش).{0,35}از\s*(?:همین\s*)?(?:جا|اینجا|دایرکت|چت)|(?:ثبت|تکمیل|نهایی)\s*(?:کردن|کنید|کنین|کنم|بشه|شود)?\s*(?:سفارش|خرید)|(?:سفارش|خرید)\s*(?:رو|را)?\s*(?:ثبت|تکمیل|نهایی)\s*(?:کنید|کنین|کنم|بشه|شود)?|(?:برام|برای\s*من).{0,24}(?:ثبت\s*سفارش|سفارش\s*ثبت|رزرو)|(?:can|could)\s+i\s+(?:buy|order).{0,25}(?:here|chat|dm)|(?:place|create|register|complete)\s+(?:an?\s+)?order)/iu

const UNSUPPORTED_ACTION_CLAIM_RE =
  /(?:می\s*(?:تونم|توانم|تونیم|توانیم)|براتون|برایتان).{0,35}(?:سفارش\s*(?:ثبت|نهایی)|ثبت\s*سفارش|محصول\s*(?:رو|را)?\s*رزرو|رزرو\s*(?:کنم|کنیم))|برای\s*(?:ثبت|تکمیل|نهایی(?:\s*کردن)?)\s*سفارش.{0,80}(?:نام|اسم|آدرس|نشانی|کد\s*پستی).{0,40}(?:بفرمایید|بفرستید|ارسال\s*کنید)|(?:i|we)\s+can.{0,30}(?:place|create|register|reserve).{0,20}(?:order|item)/iu

export function isUnsupportedOrderCreationRequest(userMessage: string): boolean {
  const normalized = normalize(userMessage)
  return !COMPLETED_ORDER_STATUS_RE.test(normalized) && ORDER_CREATION_REQUEST_RE.test(normalized)
}

export function actionCapabilityInstruction(isFa: boolean): string {
  return isFa
    ? 'مرز قابلیت اجرایی: در نسخه فعلی هیچ ابزار معتبری برای ثبت یا نهایی‌کردن سفارش، رزرو کالا، ساخت لینک پرداخت یا ثبت درخواست ارسال در اختیار تو نیست. حتی اگر متن ایجنت یا پایگاه دانش بگوید سفارش تلفنی/شبکه اجتماعی ممکن است، خودت حق نداری بگویی «از همین‌جا ثبت می‌کنم»، قول رزرو بدهی یا برای تکمیل سفارش نام، آدرس و کدپستی بگیری. اگر مشتری نتوانست از سایت خرید کند، شفاف بگو ثبت سفارش داخل این گفتگو فعلاً فعال نیست؛ فقط می‌توانی اطلاعات محصول را بررسی کنی یا موضوع را برای اپراتور همین گفتگو منتقل کنی. پیگیری خواندنی سفارش موجود با ثبت سفارش جدید فرق دارد.'
    : 'Action boundary: this runtime has no trusted tool for placing or completing orders, reserving products, creating payment links, or scheduling delivery. Even if lower-priority agent text or knowledge says phone/social orders may exist, never claim you can place an order here, promise a reservation, or collect name/address/postcode as checkout steps. If the customer cannot use the site, say in-chat ordering is not currently available; only offer product information or a handoff to an operator in this conversation. Read-only order tracking is not order creation.'
}

function unavailableReply(isFa: boolean): string {
  return isFa
    ? 'فعلاً امکان ثبت یا نهایی‌کردن سفارش داخل این گفتگو فعال نیست. می‌توانم موجودی و مشخصات محصول را بررسی کنم؛ اگر سایت برایتان قابل استفاده نیست، می‌توانم موضوع را برای اپراتور همین گفتگو منتقل کنم'
    : 'Placing or completing an order inside this chat is not currently available. I can check product details and availability, or hand this over to an operator here if you cannot use the website.'
}

/**
 * Deterministic last line of defence for an unavailable commerce action.
 * Grounded product facts survive, but unconfirmed checkout promises do not.
 */
export function enforceActionCapabilities(params: {
  reply: string
  userMessage: string
  isFa: boolean
}): string {
  if (isUnsupportedOrderCreationRequest(params.userMessage)) {
    return unavailableReply(params.isFa)
  }
  if (!UNSUPPORTED_ACTION_CLAIM_RE.test(normalize(params.reply))) return params.reply

  const safeParts = params.reply
    .split(/(?<=[.!؟?])\s+|\n+/u)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !UNSUPPORTED_ACTION_CLAIM_RE.test(normalize(part)))

  const notice = unavailableReply(params.isFa)
  return [...safeParts, notice].filter((part, index, all) => all.indexOf(part) === index).join('\n\n')
}
