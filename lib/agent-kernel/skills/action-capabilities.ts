export const ACTION_CAPABILITY_SKILL_VERSION = '1.5.0'

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

/**
 * «به همکارم منتقل می‌کنم و نتیجه رو خبر می‌دم» / "let me check with my
 * colleagues and get back to you" — a promise of a transfer or a later
 * follow-up that no tool performs in a normal model reply (real transfers go
 * through the deterministic handoff path, which never reaches this guard).
 * The customer then waits for a message that never comes. Conditional offers
 * («اگه بخواید به همکارم می‌سپارم») are honest and stay untouched.
 */
const FALSE_FOLLOW_UP_RE =
  /(?:(?:به|برای|با)\s*(?:همکار|همکاران|اپراتور|کارشناس|تیم|پشتیبانی)(?:م|ام|انم|مون|ها)?[^.!؟?\n]{0,40}(?:منتقل|ارجاع|می\s*سپار|چک|بررسی|هماهنگ)[^.!؟?\n]{0,20}(?:می\s*کنم|می\s*کنیم|کردم|کردیم|میکنم|می\s*دم|میدم|می\s*سپارم|میسپارم)|(?:نتیجه|جواب|خبر)(?:ش|ش\s*رو|ش\s*را|و|رو|را)?[^.!؟?\n]{0,25}(?:اطلاع|خبر)\s*(?:می\s*دم|میدم|می\s*دهم|می\s*دیم|خواهم\s*داد)|(?:let\s+me|i(?:'ll|\s+will))\s+(?:check|confirm|ask|verify)\s+with\s+(?:my\s+|the\s+|our\s+)?(?:colleague|team|staff|support)s?[^.!?\n]*|i(?:'ll|\s+will)\s+(?:get\s+back\s+to\s+you|let\s+you\s+know|follow\s+up)|i(?:'ve|\s+have)\s+(?:forwarded|transferred|escalated)\b[^.!?\n]*)/iu
const CONDITIONAL_OFFER_RE = /(?:اگر|اگه|در\s*صورت|چنانچه|\bif\b|would\s+you\s+like|do\s+you\s+want)/iu

export function enforceNoFalseFollowUp(reply: string, isFa: boolean): string {
  if (!FALSE_FOLLOW_UP_RE.test(normalize(reply))) return reply
  const parts = reply.split(/(?<=[.!؟?])\s+|\n+/u).map((part) => part.trim()).filter(Boolean)
  let replaced = false
  const kept = parts.filter((part) => {
    const normalized = normalize(part)
    if (!FALSE_FOLLOW_UP_RE.test(normalized) || CONDITIONAL_OFFER_RE.test(normalized)) return true
    replaced = true
    return false
  })
  if (!replaced) return reply
  kept.push(isFa
    ? 'اگه بخواید، این موضوع رو به همکارم می‌سپارم تا دقیق بررسی کنه'
    : 'If you like, I can pass this to a colleague to check it properly.')
  return kept.join('\n')
}

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

/**
 * Payment links and checkout cards are issued only by the deterministic
 * in-chat checkout (signed store link + [[checkout:…]] card). A model reply
 * that writes one itself — a WooCommerce order-pay URL, a gateway page, a
 * guessed ?vigent_checkout= token or a checkout marker — is fabricated, so
 * the whole line is removed and the customer is pointed to the real flow.
 */
const FABRICATED_PAYMENT_RE =
  /\[\[checkout:|order-pay\/|pay_for_order=|vigent_checkout=|wc_order_[A-Za-z0-9]|\/checkout\/order-received|(?:sandbox\.)?zarinpal\.com\/pg|gateway\.zibal\.ir|\/StartPay\//iu

export function stripFabricatedPaymentLinks(reply: string, isFa: boolean): string {
  if (!FABRICATED_PAYMENT_RE.test(reply)) return reply
  const kept = reply.split('\n').filter((line) => !FABRICATED_PAYMENT_RE.test(line))
  const notice = isFa
    ? 'لینک پرداخت رو فقط خود سیستم بعد از تأیید خلاصهٔ سفارش می‌فرسته؛ اگه بگید «لینک پرداخت رو بفرست» دوباره براتون آماده‌ش می‌کنم.'
    : 'Payment links are sent only by the system after you confirm the order summary; say “send the payment link” and I’ll prepare it again.'
  return [...kept, notice].join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * The agent has no authority to discount. Prices come from the store and the
 * only discount is a store coupon the customer brings, which the store itself
 * validates. A promise like «براتون ۱۰٪ تخفیف می‌ذارم» would contradict the
 * store's own checkout, so such lines are replaced deterministically.
 */
const FA_GRANT = String.raw`(?:می[\u200c\s]?|می)(?:دم|دیم|ذارم|ذاریم|زنم|زنیم|گیرم|گیریم|کنم|کنیم|تونم\s*بدم|شه\s*براتون)`
const DISCOUNT_OFFER_RES: RegExp[] = [
  new RegExp(String.raw`(?:برات(?:ون|ان)?|برای\s*شما|بهت(?:ون)?|به\s*شما)[^.!؟?\n]{0,40}?تخفیف[^.!؟?\n]{0,24}?(?:${FA_GRANT}|اعمال\s*(?:می[\u200c\s]?)?کنم|لحاظ\s*(?:می[\u200c\s]?)?کنم|در\s*نظر\s*(?:می[\u200c\s]?)?گیرم)`, 'u'),
  new RegExp(String.raw`تخفیف[^.!؟?\n]{0,24}?(?:برات(?:ون|ان)?|برای\s*شما|بهت(?:ون)?|به\s*شما)[^.!؟?\n]{0,24}?(?:${FA_GRANT}|اعمال\s*(?:می[\u200c\s]?)?کنم)`, 'u'),
  new RegExp(String.raw`[0-9۰-۹٪%]+\s*(?:درصد|٪|%)?\s*تخفیف\s*(?:${FA_GRANT})`, 'u'),
  new RegExp(String.raw`کد\s*تخفیف[^.!؟?\n]{0,30}?(?:ساختم|ایجاد\s*کردم|فعال\s*کردم|براتون\s*(?:می[\u200c\s]?)?سازم)`, 'u'),
  /\b(?:I|we)(?:'ll|\s+will|\s+can|\s+could)\s+(?:give|offer|apply|knock|take)\b[^.\n]{0,40}\b(?:discount|off)\b/i,
  /\b(?:I|we)(?:'ve|\s+have)\s+(?:created|made|generated)\b[^.\n]{0,30}\bdiscount code\b/i,
]

export function stripAgentDiscountOffers(reply: string, isFa: boolean): string {
  if (!DISCOUNT_OFFER_RES.some((re) => re.test(reply))) return reply
  const kept = reply.split('\n').filter((line) => !DISCOUNT_OFFER_RES.some((re) => re.test(line)))
  const notice = isFa
    ? 'من اختیار تخفیف دادن ندارم و قیمت‌ها همون قیمت فروشگاهه؛ اگه کد تخفیف خود فروشگاه رو دارید بفرستید تا بررسی بشه.'
    : 'I can’t offer discounts myself; prices are the store’s own. If you have a store coupon code, send it and it will be checked.'
  return [...kept, notice].join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function actionCapabilityInstruction(isFa: boolean, orderCaptureEnabled = false, payLinkEnabled = false): string {
  if (orderCaptureEnabled && payLinkEnabled) {
    return isFa
      ? 'مرز قابلیت اجرایی: فروش داخل گفتگو با سبد خرید و لینک پرداخت فعال است و مراحلش را سیستم خودش جلو می‌برد: افزودن، حذف و تغییر تعداد یا مدل کالا در سبد، گرفتن نام، موبایل و آدرس، نمایش خلاصه با هزینهٔ ارسال و مبلغ نهایی از خود سایت فروشگاه، و بعد از تأیید مشتری فرستادن لینک پرداخت روی سایت خود فروشگاه (با همهٔ درگاه‌های فعال آن). نقش تو فروشندهٔ مشاور است: نیاز مشتری را بفهم، دو یا سه گزینهٔ مناسب با کارت محصول پیشنهاد بده و وقتی مشتری محصولی را پسندید کوتاه بپرس «می‌خواید به سبدتون اضافه‌ش کنم؟». اگر مناسب بود فقط یک کالای مکملِ واقعاً مرتبط از کاتالوگ همین نوبت پیشنهاد بده و اصرار نکن. خودت در متن آزاد نام، آدرس یا شماره جمع نکن، لینک پرداخت نساز و هزینهٔ ارسال یا مبلغ نهایی را حدس نزن. هرگز نگو «سفارش ثبت شد» یا «پرداخت شد»؛ این را فقط سیستم بعد از تأیید واقعی سایت اعلام می‌کند. تو اختیار تخفیف دادن نداری: تخفیف، قیمت ویژه یا کد تخفیف پیشنهاد، وعده یا اختراع نکن و سر قیمت چانه نزن؛ فقط اگر مشتری خودش کد تخفیف فروشگاه را داد، سیستم آن را روی سایت بررسی می‌کند. لینک محصول را فقط از کارت محصول معتبر همین نوبت بده. پیگیری سفارش موجود با ثبت سفارش جدید فرق دارد.'
      : 'Action boundary: in-chat selling with a cart and payment links is enabled and the system runs the steps itself: adding, removing and changing quantity or variant of cart items, collecting name, mobile and address, a summary with shipping and the final amount from the store itself, and after the customer confirms, a payment link on the store\'s own website (with all its active gateways). Your role is a consultative seller: understand the need, suggest two or three fitting products with product cards, and when the customer likes one, briefly ask “Shall I add it to your cart?”. When it fits, suggest at most one genuinely related complementary product from this turn\'s catalog, without pushing. Never collect name, address or phone yourself in free text, never create payment links, and never guess shipping or the final amount. Never say the order is placed or paid; only the system announces that after the store confirms. You have no authority to discount: never offer, promise or invent a discount, special price or coupon code and do not haggle; only a store coupon the customer brings is checked by the system on the store. Share product links only via this turn\'s trusted product card. Tracking an existing order is not placing a new one.'
  }
  if (orderCaptureEnabled) {
    return isFa
      ? 'مرز قابلیت اجرایی: ثبت «پیش‌سفارش درون‌چت» فعال است و مراحلش را سیستم خودش جلو می‌برد (گرفتن مدل، تعداد، نام، موبایل و آدرس، نمایش خلاصه و ثبت بعد از تأیید مشتری). اگر مشتری خواست بخرد یا پرسید چطور سفارش بدهد، کوتاه بپرس «می‌خواید همین‌جا براتون ثبتش کنم؟»؛ خودت در متن آزاد نام/آدرس/شماره جمع نکن. هرگز نگو «سفارش ثبت شد» یا «رزرو کردم»، لینک پرداخت نساز، وعدهٔ ارسال نده و تخفیف یا قیمت ویژه پیشنهاد نده؛ ثبت واقعی فقط در همان مراحل انجام می‌شود و پرداخت را همکار انسانی هماهنگ می‌کند. لینک محصول را فقط از کارت محصول معتبر همین نوبت بده و URL حدس نزن. پیگیری سفارش موجود با ثبت سفارش جدید فرق دارد.'
      : 'Action boundary: in-chat pre-orders are enabled and the system runs the steps itself (variant, quantity, name, mobile and address, a summary, and filing after the customer confirms). If the customer wants to buy or asks how to order, briefly ask “Shall I set up the order for you right here?”; never collect name/address/phone yourself in free text. Never say the order is placed or reserved, never create payment links, promise shipping or offer a discount; filing happens only through those steps and a human colleague arranges payment. Share product links only via this turn\'s trusted product card and never guess a URL. Tracking an existing order is not placing a new one.'
  }
  return isFa
    ? 'مرز قابلیت اجرایی: در نسخه فعلی هیچ ابزار معتبری برای ثبت یا نهایی‌کردن سفارش، رزرو کالا، ساخت لینک پرداخت یا ثبت درخواست ارسال در اختیار تو نیست. حتی اگر متن ایجنت یا پایگاه دانش بگوید سفارش تلفنی/شبکه اجتماعی ممکن است، خودت حق نداری بگویی «از همین‌جا ثبت می‌کنم»، قول رزرو بدهی یا برای تکمیل سفارش نام، آدرس و کدپستی بگیری. تا زمانی که خرید درون‌چت فعال نیست، صفحهٔ همان محصول در کاتالوگ مسیر جایگزین است: فقط وقتی محصول دقیق این نوبت و URL معتبرش در کاتالوگ وجود دارد، بگو مشتری از دکمهٔ «مشاهده و خرید» کارت محصول وارد سایت شود؛ خودت Markdown ناقصی مثل [این لینک] نساز و URL را حدس نزن. اگر محصول یا URL معتبر نداریم، هیچ لینکی وعده نده و مشتری را به سایت فروشگاه یا اپراتور همین گفتگو ارجاع بده. پیگیری خواندنی سفارش موجود با ثبت سفارش جدید فرق دارد.'
    : 'Action boundary: this runtime has no trusted tool for placing or completing orders, reserving products, creating payment links, or scheduling delivery. Even if lower-priority agent text or knowledge says phone/social orders may exist, never claim you can place an order here, promise a reservation, or collect name/address/postcode as checkout steps. While in-chat checkout is unavailable, the exact catalog product page is the alternative path: only when this turn has one resolved product with a valid catalog URL, tell the customer to use the product card\'s “View / Buy” button; never emit incomplete Markdown such as [this link] or guess a URL. If no resolved product or trusted URL exists, promise no link and direct the customer to the store site or an operator. Read-only order tracking is not order creation.'
}

/**
 * The business switched bookings off (settings → business), yet the customer
 * asks for a time. No calendar tool runs this turn, so the agent must not
 * offer slots or promise a reservation; it routes to a person instead.
 */
export function bookingUnavailableInstruction(isFa: boolean, handoffEnabled: boolean): string {
  if (isFa) {
    return handoffEnabled
      ? 'این کسب‌وکار از طریق گفتگو نوبت یا وقت ثبت نمی‌کند. اگر مشتری وقت، نوبت یا رزرو خواست، هیچ زمان آزادی پیشنهاد نده و قول رزرو نده؛ مؤدبانه بگو هماهنگی زمان را همکار انجام می‌دهد و بپرس می‌خواهد گفتگو را به همکار بسپاری.'
      : 'این کسب‌وکار از طریق گفتگو نوبت یا وقت ثبت نمی‌کند. اگر مشتری وقت، نوبت یا رزرو خواست، هیچ زمان آزادی پیشنهاد نده و قول رزرو نده؛ مؤدبانه بگو هماهنگی زمان از راه‌های تماس خود کسب‌وکار انجام می‌شود و اگر در اطلاعات کسب‌وکار شماره یا راه تماسی هست همان را بگو.'
  }
  return handoffEnabled
    ? 'This business does not take bookings through chat. If the customer asks for a time, appointment or reservation, offer no slots and promise no booking; politely say a colleague arranges times and ask whether they would like to be handed to one.'
    : 'This business does not take bookings through chat. If the customer asks for a time, appointment or reservation, offer no slots and promise no booking; politely say times are arranged through the business\'s own contact channels and share one if the business information lists it.'
}

function unavailableReply(
  isFa: boolean,
  orderUrl: string | null,
  preferStructuredProductLink = false,
): string {
  if (isFa) {
    return orderUrl
      ? preferStructuredProductLink
        ? 'ثبت سفارش از داخل همین چت فعلاً برای من فعال نیست؛ از دکمهٔ «مشاهده و خرید» روی کارت محصول می‌تونید سفارش رو توی سایت تکمیل کنید. اگه سایت براتون راحت نبود، بگید تا به همکارم بسپارم'
        : `ثبت سفارش از داخل همین چت فعلاً برای من فعال نیست؛ از این لینک می‌تونید سفارش رو توی سایت تکمیل کنید: ${orderUrl}\nاگه سایت براتون راحت نبود، بگید تا به همکارم بسپارم`
      : 'ثبت سفارش از داخل همین چت فعلاً برای من فعال نیست؛ سفارش از صفحهٔ محصول توی سایت فروشگاه انجام می‌شه. اگه لینک محصول رو می‌خواید یا سایت براتون راحت نیست، بگید تا به همکارم بسپارم که هماهنگ کنه'
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
  /** In-chat pre-orders are enabled for this agent: offering to set up the
   *  order here is honest, only claims of a COMPLETED order stay forbidden. */
  orderCaptureEnabled?: boolean
}): string {
  const orderUrl = safeOrderUrl(params.orderUrl)
  const reply = enforceTrustedLinkPresentation({
    reply: params.reply,
    isFa: params.isFa,
    trustedUrl: orderUrl,
    preferStructuredProductLink: params.preferStructuredProductLink,
  })
  if (!params.orderCaptureEnabled && isUnsupportedOrderCreationRequest(params.userMessage)) {
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
    const notice = params.orderCaptureEnabled
      ? (params.isFa ? 'اگه بخواید، همین‌جا براتون ثبتش می‌کنم' : 'If you like, I can set up the order for you right here.')
      : unavailableReply(params.isFa, orderUrl, params.preferStructuredProductLink)
    return [...safeParts, notice].filter((part, index, all) => all.indexOf(part) === index).join('\n\n')
  }

  if (params.orderCaptureEnabled) return reply
  if (!UNSUPPORTED_ACTION_CLAIM_RE.test(normalize(reply))) return reply

  const safeParts = splitReply(reply).filter(
    (part) => !UNSUPPORTED_ACTION_CLAIM_RE.test(normalize(part)),
  )

  const notice = unavailableReply(params.isFa, orderUrl, params.preferStructuredProductLink)
  return [...safeParts, notice].filter((part, index, all) => all.indexOf(part) === index).join('\n\n')
}
