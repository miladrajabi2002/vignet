export const ACTION_CAPABILITY_SKILL_VERSION = '1.3.0'

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

const GENERIC_LINK_LABEL_RE =
  /(?:این\s*)?(?:لینک|پیوند)|اینجا|this\s+link|click\s+here|\blink\b|\bhere\b/iu
const MARKDOWN_LINKISH_RE = /\[([^\]\n]{1,80})\](?:\(\s*([^\)\n]*)\s*\))?/giu

/**
 * Models occasionally emit a label such as `[این لینک]` without any target,
 * or wrap a guessed URL in the same label. Generic link placeholders are not
 * customer-facing evidence: replace them only from the trusted catalog URL,
 * or remove their whole line when no trusted destination exists.
 */
export function enforceTrustedLinkPresentation(params: {
  reply: string
  isFa: boolean
  trustedUrl?: string | null
  /** A canonical product card will be attached after this guard. */
  preferStructuredProductLink?: boolean
}): string {
  const trustedUrl = safeOrderUrl(params.trustedUrl)
  const replacement = params.preferStructuredProductLink
    ? params.isFa
      ? 'دکمهٔ «مشاهده و خرید» در کارت محصول'
      : 'the “View / Buy” button on the product card'
    : trustedUrl ?? ''

  return params.reply
    .split('\n')
    .map((line) => {
      let unsafePlaceholder = false
      const next = line.replace(MARKDOWN_LINKISH_RE, (whole, label: string, destination?: string) => {
        if (!GENERIC_LINK_LABEL_RE.test(label)) return whole
        const safeDestination = safeOrderUrl(destination)
        if (safeDestination && trustedUrl && safeDestination === trustedUrl) {
          unsafePlaceholder = true
          return replacement
        }
        // A missing, malformed, model-invented or off-catalog destination is
        // never exposed. The trusted URL/card is the only allowed replacement.
        unsafePlaceholder = true
        return replacement
      })
      return unsafePlaceholder && !trustedUrl ? '' : next
    })
    .filter((line, index, lines) => line.trim() || (index > 0 && lines[index - 1]?.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function actionCapabilityInstruction(isFa: boolean): string {
  return isFa
    ? 'مرز قابلیت اجرایی: در نسخه فعلی هیچ ابزار معتبری برای ثبت یا نهایی‌کردن سفارش، رزرو کالا، ساخت لینک پرداخت یا ثبت درخواست ارسال در اختیار تو نیست. حتی اگر متن ایجنت یا پایگاه دانش بگوید سفارش تلفنی/شبکه اجتماعی ممکن است، خودت حق نداری بگویی «از همین‌جا ثبت می‌کنم»، قول رزرو بدهی یا برای تکمیل سفارش نام، آدرس و کدپستی بگیری. تا زمانی که خرید درون‌چت فعال نیست، صفحهٔ همان محصول در کاتالوگ مسیر جایگزین است: فقط وقتی محصول دقیق این نوبت و URL معتبرش در کاتالوگ وجود دارد، بگو مشتری از دکمهٔ «مشاهده و خرید» کارت محصول وارد سایت شود؛ خودت Markdown ناقصی مثل [این لینک] نساز و URL را حدس نزن. اگر محصول یا URL معتبر نداریم، هیچ لینکی وعده نده و مشتری را به سایت فروشگاه یا اپراتور همین گفتگو ارجاع بده. پیگیری خواندنی سفارش موجود با ثبت سفارش جدید فرق دارد.'
    : 'Action boundary: this runtime has no trusted tool for placing or completing orders, reserving products, creating payment links, or scheduling delivery. Even if lower-priority agent text or knowledge says phone/social orders may exist, never claim you can place an order here, promise a reservation, or collect name/address/postcode as checkout steps. While in-chat checkout is unavailable, the exact catalog product page is the alternative path: only when this turn has one resolved product with a valid catalog URL, tell the customer to use the product card\'s “View / Buy” button; never emit incomplete Markdown such as [this link] or guess a URL. If no resolved product or trusted URL exists, promise no link and direct the customer to the store site or an operator. Read-only order tracking is not order creation.'
}

function unavailableReply(
  isFa: boolean,
  orderUrl: string | null,
  preferStructuredProductLink = false,
): string {
  if (isFa) {
    return orderUrl
      ? preferStructuredProductLink
        ? 'فعلاً امکان ثبت یا نهایی‌کردن سفارش داخل این گفتگو فعال نیست. برای خرید، روی دکمهٔ «مشاهده و خرید» در کارت محصول بزنید و سفارش را در سایت تکمیل کنید. اگر سفارش در سایت برایتان ممکن نبود، می‌توانم موضوع را برای اپراتور همین گفتگو منتقل کنم'
        : `فعلاً امکان ثبت یا نهایی‌کردن سفارش داخل این گفتگو فعال نیست. برای خرید، از این لینک وارد شوید و سفارش را در سایت تکمیل کنید: ${orderUrl}\nاگر سفارش در سایت برایتان ممکن نبود، می‌توانم موضوع را برای اپراتور همین گفتگو منتقل کنم`
      : 'فعلاً امکان ثبت یا نهایی‌کردن سفارش داخل این گفتگو فعال نیست. برای سفارش، صفحهٔ محصول در سایت فروشگاه یا تماس با فروشگاه مسیر درست است؛ اگر لینک محصول را می‌خواهید یا سایت برایتان قابل استفاده نیست، بگویید تا موضوع را برای اپراتور همین گفتگو منتقل کنم'
  }
  return orderUrl
    ? preferStructuredProductLink
      ? 'Placing an order inside this chat is not currently available. To buy, use the “View / Buy” button on the product card and complete the order on the site. If that does not work for you, I can hand this over to an operator here'
      : `Placing an order inside this chat is not currently available. To buy, use this link and complete the order on the site: ${orderUrl}\nIf that does not work for you, I can hand this over to an operator here`
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
  /** True only when the presentation layer will append a trusted product card
   *  carrying the same URL as a native channel button. */
  preferStructuredProductLink?: boolean
  /** True only when this turn's context contains a <verified_order> block —
   *  real, order-number-scoped store data. Otherwise any completed-order
   *  claim in the reply is fabricated and is replaced deterministically. */
  hasGroundedOrder?: boolean
}): string {
  const orderUrl = safeOrderUrl(params.orderUrl)
  const reply = enforceTrustedLinkPresentation({
    reply: params.reply,
    isFa: params.isFa,
    trustedUrl: orderUrl,
    preferStructuredProductLink: params.preferStructuredProductLink,
  })
  if (isUnsupportedOrderCreationRequest(params.userMessage)) {
    return unavailableReply(params.isFa, orderUrl, params.preferStructuredProductLink)
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
  if (!params.hasGroundedOrder && FALSE_COMPLETED_ORDER_CLAIM_RE.test(normalize(reply))) {
    const safeParts = splitReply(reply).filter(
      (part) => !FALSE_COMPLETED_ORDER_CLAIM_RE.test(normalize(part)),
    )
    const notice = unavailableReply(params.isFa, orderUrl, params.preferStructuredProductLink)
    return [...safeParts, notice].filter((part, index, all) => all.indexOf(part) === index).join('\n\n')
  }

  if (!UNSUPPORTED_ACTION_CLAIM_RE.test(normalize(reply))) return reply

  const safeParts = splitReply(reply).filter(
    (part) => !UNSUPPORTED_ACTION_CLAIM_RE.test(normalize(part)),
  )

  const notice = unavailableReply(params.isFa, orderUrl, params.preferStructuredProductLink)
  return [...safeParts, notice].filter((part, index, all) => all.indexOf(part) === index).join('\n\n')
}
