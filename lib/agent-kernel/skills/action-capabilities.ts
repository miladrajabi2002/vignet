export const ACTION_CAPABILITY_SKILL_VERSION = '1.2.0'

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
  /(?:از\s*(?:همین\s*)?(?:جا|اینجا|دایرکت|چت).{0,35}(?:خرید|سفارش)|(?:خرید|سفارش).{0,35}از\s*(?:همین\s*)?(?:جا|اینجا|دایرکت|چت)|(?:ثبت|تکمیل|نهایی)\s*(?:کردن|کنید|کنین|کنم|بشه|شود)?\s*(?:سفارش|خرید)|(?:سفارش|خرید)\s*(?:رو|را)?\s*(?:ثبت|تکمیل|نهایی)\s*(?:کنید|کنین|کنم|بشه|شود)?|(?:برام|برای\s*من).{0,24}(?:ثبت\s*سفارش|سفارش\s*ثبت|رزرو)|(?:برام|برای\s*من).{0,20}(?:ثبت|رزرو).{0,6}(?:کن|کنید|کنم|کنین|بده)|(?:بخرمش|می\s*خرمش|می\s*خرم)|(?:can|could)\s+i\s+(?:buy|order).{0,25}(?:here|chat|dm)|(?:place|create|register|complete)\s+(?:an?\s+)?order|order\s+(?:it|this|that)\s+for\s+me)/iu

const UNSUPPORTED_ACTION_CLAIM_RE =
  /(?:می\s*(?:تونم|توانم|تونیم|توانیم)|براتون|برایتان).{0,35}(?:سفارش\s*(?:ثبت|نهایی)|ثبت\s*سفارش|محصول\s*(?:رو|را)?\s*رزرو|رزرو\s*(?:کنم|کنیم))|(?:براتون|برایتان|برای\s*شما).{0,25}(?:ثبت|رزرو|نهایی|تکمیل)\s*(?:کنم|کنیم|بکنم)|برای\s*(?:ثبت|تکمیل|نهایی(?:\s*کردن)?)\s*سفارش.{0,80}(?:نام|اسم|آدرس|نشانی|کد\s*پستی).{0,40}(?:بفرمایید|بفرستید|ارسال\s*کنید)|(?:نام|اسم|آدرس|نشانی|کد\s*پستی|شماره\s*(?:تماس|تلفن|موبایل)?)(?:\s*و\s*[^،.!؟\n]{0,20})?.{0,60}?(?:ثبت|تکمیل|نهایی|رزرو)\s*(?:سفارش|خرید)|(?:ثبت|تکمیل|نهایی|رزرو)\s*(?:کردن\s*)?(?:سفارش|خرید).{0,80}(?:نام|اسم|آدرس|نشانی|کد\s*پستی)|(?:i|we)\s+can.{0,30}(?:place|create|register|reserve).{0,20}(?:order|item)/iu

/**
 * A reply that *claims a commerce action already completed* — «سفارش شما
 * ثبت شد», «برایتان ثبت کردم», «کالا از انبار ارسال می‌شود», «لینک پرداخت
 * را برایتان ارسال کنم». Unless this turn carries a verified order block
 * (hasGroundedOrder), such claims are fabricated: the runtime has no
 * order-creation or payment-link tool, so the guard strips them and routes
 * the customer to the honest store-link/operator path instead. Read-only
 * tracking replies about a *verified* order are exempt via the flag.
 */
const FALSE_COMPLETED_ORDER_CLAIM_RE =
  /(?:سفارش|خرید|رزرو|مرسوله)(?:\s*(?:شما|رو|را|تون|تان|مون|براتون|برایتان|اش|ش))?.{0,80}?(?:ثبت|نهایی|تکمیل|رزرو|لغو|ارسال|پست)\s*(?:شد|شده|کردم|کردیم)|از\s*انبار\s*(?:ارسال|فرستاده)\s*(?:می\s*شود|خواهد\s*شد)|(?:لینک\s*(?:پرداخت|سفارش)).{0,40}(?:ارسال\s*کنم|بفرستم|می\s*سازم|ساخت\s*کنم)|(?:order|purchase|reservation)(?:\s+\w+){0,12}?(?:placed|registered|completed|reserved|cancelled|shipped)|(?:i|we)\s+(?:placed|registered|completed|reserved|cancelled)\s+(?:the\s+)?(?:order|purchase)|payment\s+link.{0,40}(?:i\s+will|i'll|let\s+me)/iu

export function isUnsupportedOrderCreationRequest(userMessage: string): boolean {
  const normalized = normalize(userMessage)
  return !COMPLETED_ORDER_STATUS_RE.test(normalized) && ORDER_CREATION_REQUEST_RE.test(normalized)
}

/** Only http(s) URLs are shareable order links — never protocol-relative or
 *  javascript-ish strings that could hide in catalog data. */
export function safeOrderUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  return /^https?:\/\/[^\s]+$/i.test(trimmed) ? trimmed : null
}

export function actionCapabilityInstruction(isFa: boolean): string {
  return isFa
    ? 'مرز قابلیت اجرایی: در نسخه فعلی هیچ ابزار معتبری برای ثبت یا نهایی‌کردن سفارش، رزرو کالا، ساخت لینک پرداخت یا ثبت درخواست ارسال در اختیار تو نیست. حتی اگر متن ایجنت یا پایگاه دانش بگوید سفارش تلفنی/شبکه اجتماعی ممکن است، خودت حق نداری بگویی «از همین‌جا ثبت می‌کنم»، قول رزرو بدهی یا برای تکمیل سفارش نام، آدرس و کدپستی بگیری. اما تا زمانی که خرید درون‌چت فعال نیست، لینک سفارش مسیر جایگزین تو است: هر وقت مشتری خواست بخرد یا سفارش ثبت کند، لینک همان محصول را عیناً از فیلد «لینک» کاتالوگ همین نوبت کپی کن و در پاسخ بگذار و بگو سفارش را از همان صفحه سایت تکمیل کند؛ اگر برای این گفتگو محصولی در کاتالوگ نبود، به‌جای لینک، مشتری را به سایت فروشگاه یا اپراتور همین گفتگو ارجاع بده. هرگز آدرس لینک را از خودت بساز یا حدس بزن؛ فقط لینک‌های موجود در داده‌های همین نوبت معتبرند. پیگیری خواندنی سفارش موجود با ثبت سفارش جدید فرق دارد.'
    : 'Action boundary: this runtime has no trusted tool for placing or completing orders, reserving products, creating payment links, or scheduling delivery. Even if lower-priority agent text or knowledge says phone/social orders may exist, never claim you can place an order here, promise a reservation, or collect name/address/postcode as checkout steps. While in-chat checkout is unavailable, the order link is your alternative path: whenever the customer wants to buy or place an order, copy the product link exactly from the "link" field of this turn\'s catalog data, include it in your reply, and tell them to complete the order on that store page; if no product is in context, direct them to the store website or hand off to an operator instead. Never invent or guess a URL; only links present in this turn\'s trusted data are valid. Read-only order tracking is not order creation.'
}

function unavailableReply(isFa: boolean, orderUrl: string | null): string {
  if (isFa) {
    return orderUrl
      ? `فعلاً امکان ثبت یا نهایی‌کردن سفارش داخل این گفتگو فعال نیست. برای خرید، از این لینک وارد شوید و سفارش را در سایت تکمیل کنید: ${orderUrl}\nاگر سفارش در سایت برایتان ممکن نبود، می‌توانم موضوع را برای اپراتور همین گفتگو منتقل کنم`
      : 'فعلاً امکان ثبت یا نهایی‌کردن سفارش داخل این گفتگو فعال نیست. برای سفارش، صفحهٔ محصول در سایت فروشگاه یا تماس با فروشگاه مسیر درست است؛ اگر لینک محصول را می‌خواهید یا سایت برایتان قابل استفاده نیست، بگویید تا موضوع را برای اپراتور همین گفتگو منتقل کنم'
  }
  return orderUrl
    ? `Placing an order inside this chat is not currently available. To buy, use this link and complete the order on the site: ${orderUrl}\nIf that does not work for you, I can hand this over to an operator here`
    : 'Placing an order inside this chat is not currently available. To order, use the product page on the store website or contact the store; if you would like the product link or cannot use the website, tell me and I will hand this over to an operator here'
}

/**
 * Deterministic last line of defence for an unavailable commerce action.
 * Grounded product facts survive, but unconfirmed checkout promises do not.
 * When a trusted order/product URL is available (from this turn's catalog
 * rows) the fallback actively routes the customer to the store page instead
 * of a dead end.
 */
export function enforceActionCapabilities(params: {
  reply: string
  userMessage: string
  isFa: boolean
  /** Trusted product/store URL selected from this turn's catalog rows. */
  orderUrl?: string | null
  /** True only when this turn's context contains a <verified_order> block —
   *  real, order-number-scoped store data. Otherwise any completed-order
   *  claim in the reply is fabricated and is replaced deterministically. */
  hasGroundedOrder?: boolean
}): string {
  const orderUrl = safeOrderUrl(params.orderUrl)
  if (isUnsupportedOrderCreationRequest(params.userMessage)) {
    return unavailableReply(params.isFa, orderUrl)
  }

  const splitReply = (text: string): string[] =>
    text
      .split(/(?<=[.!؟?])\s+|\n+/u)
      .map((part) => part.trim())
      .filter(Boolean)

  // Fabricated completion claims («سفارش شما ثبت شد …») are stripped even
  // when the request itself looked innocent — the model may "confirm" an
  // order after a bare «بله» acceptance. Verified order-tracking turns are
  // exempt: their status statements are grounded in store data.
  if (!params.hasGroundedOrder && FALSE_COMPLETED_ORDER_CLAIM_RE.test(normalize(params.reply))) {
    const safeParts = splitReply(params.reply).filter(
      (part) => !FALSE_COMPLETED_ORDER_CLAIM_RE.test(normalize(part)),
    )
    const notice = unavailableReply(params.isFa, orderUrl)
    return [...safeParts, notice].filter((part, index, all) => all.indexOf(part) === index).join('\n\n')
  }

  if (!UNSUPPORTED_ACTION_CLAIM_RE.test(normalize(params.reply))) return params.reply

  const safeParts = splitReply(params.reply).filter(
    (part) => !UNSUPPORTED_ACTION_CLAIM_RE.test(normalize(part)),
  )

  const notice = unavailableReply(params.isFa, orderUrl)
  return [...safeParts, notice].filter((part, index, all) => all.indexOf(part) === index).join('\n\n')
}
