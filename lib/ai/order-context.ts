import { prisma } from '@/lib/prisma'
import { toEnglishDigits } from '@/lib/phone'

const ORDER_INTENT = /(?:سفارش|پیگیری\s*(?:خرید|مرسوله|ارسال)?|کد\s*رهگیری|وضعیت\s*(?:خرید|ارسال)|order|tracking|shipment)/i
const ORDER_MUTATION_INTENT = /(?:ثبت\s*سفارش|سفارش\s*(?:بدم|بدهم|ثبت|لغو)|لغو\s*سفارش|تغییر\s*سفارش|مرجوع|خرید\s*(?:کنم|انجام)|place\s+an?\s*order|cancel\s+(?:my\s+)?order|change\s+(?:my\s+)?order)/i
const ORDER_FOLLOWUP_CONTEXT = /(?:شماره|کد)\s*(?:سفارش|مرسوله)|پیگیری\s*(?:سفارش|مرسوله)|order\s*(?:number|id|code)|tracking\s*(?:number|code)/i

const FA_STATUS: Record<string, string> = {
  pending: 'در انتظار پرداخت',
  processing: 'در حال پردازش',
  'on-hold': 'در انتظار بررسی',
  completed: 'تکمیل‌شده',
  cancelled: 'لغوشده',
  refunded: 'بازپرداخت‌شده',
  failed: 'ناموفق',
}

function extractOrderId(message: string): string | null {
  const normalized = toEnglishDigits(message)
  const patterns = [
    /(?:شماره\s*)?سفارش(?:م|مان|مون)?(?:\s*(?:من|ما))?\s*(?:شماره|#|:)?\s*#?\s*([a-z0-9_-]*\d[a-z0-9_-]{0,31})/i,
    /order\s*(?:number|no\.?|#|:)?\s*#?\s*([a-z0-9_-]*\d[a-z0-9_-]{0,31})/i,
    /پیگیری\s*(?:سفارش|مرسوله)?\s*#?\s*([a-z0-9_-]*\d[a-z0-9_-]{0,31})/i,
    /#\s*([a-z0-9_-]*\d[a-z0-9_-]{0,31})/i,
  ]
  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

function extractBareOrderId(message: string): string | null {
  const normalized = toEnglishDigits(message).trim()
  const match = normalized.match(/^#?\s*([a-z0-9_-]*\d[a-z0-9_-]{0,31})\s*[.!?؟]*$/i)
  return match?.[1] ?? null
}

function formatDate(value: Date | null, isFa: boolean): string | null {
  if (!value) return null
  return new Intl.DateTimeFormat(isFa ? 'fa-IR' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(value)
}

function safeValue(value: string, maxLength = 300): string {
  return value
    .replace(/[\r\n<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

/**
 * Synthesize a tracking link for common Iranian couriers when the store
 * didn't provide one. This lets the agent share a clickable URL with the
 * customer even when the shipping plugin only recorded a tracking code.
 *
 * Recognized couriers:
 *  • Iran Post (post.ir) — codes are 13–24 digits → tracking.post.ir/?id=<code>
 *  • Tipax (tipax.ir)   — codes are typically 10–14 digits → tipax.ir/track/<code>
 *  • Chapar (chapar.ir) — codes are 13 digits → chapar.ir/track/<code>
 *
 * Returns '' if no recognized pattern matches — we'd rather expose no link
 * than a wrong one.
 */
function synthesizeTrackingLink(trackingCode: string | null, courierName: string | null): string {
  if (!trackingCode) return ''
  const code = trackingCode.trim()
  const courier = (courierName ?? '').toLowerCase()

  // Iran Post — legacy codes plus the current 24-digit barcode.
  if (/^\d{13,24}$/.test(code)) {
    // If the courier name explicitly says Tipax or Chapar, prefer the
    // courier-specific URL; otherwise default to Iran Post.
    if (/tipax|تیپاکس/.test(courier)) {
      return `https://www.tipax.ir/Tracking?code=${encodeURIComponent(code)}`
    }
    if (/chapar|چاپار/.test(courier)) {
      return `https://chapar.ir/track/${encodeURIComponent(code)}`
    }
    return `https://tracking.post.ir/?id=${encodeURIComponent(code)}`
  }

  // Tipax-style codes (alphanumeric, 10–14 chars).
  if (/^.{10,14}$/.test(code) && /tipax|تیپاکس/.test(courier)) {
    return `https://www.tipax.ir/Tracking?code=${encodeURIComponent(code)}`
  }

  return ''
}

/**
 * Return a small order-number-scoped block only when the current message is
 * actually about order tracking. Knowing the exact order number is sufficient
 * for this storefront's support flow; no phone challenge is required. This is
 * deliberately read-only: the model is never given a tool or instruction that
 * can create, cancel, or mutate orders.
 */
export async function buildOrderContext(params: {
  workspaceId: string
  message: string
  history?: Array<{ role: string; content: string | null }>
  enabled: boolean
  language: string
}): Promise<string> {
  const bareOrderId = extractBareOrderId(params.message)
  const isOrderContinuation = Boolean(
    bareOrderId && params.history?.slice(-4).some((turn) =>
      typeof turn.content === 'string' && ORDER_FOLLOWUP_CONTEXT.test(turn.content)),
  )
  if (!ORDER_INTENT.test(params.message) && !isOrderContinuation) return ''
  const isFa = params.language !== 'en'

  if (ORDER_MUTATION_INTENT.test(params.message)) {
    return isFa
      ? '\n\nاین ایجنت اجازه ثبت، لغو، مرجوع یا ویرایش سفارش را ندارد. صریح و کوتاه بگو که فعلاً فقط مشاوره محصول و پیگیری خواندنی سفارش‌های موجود ممکن است؛ انجام عملیات سفارش را تأیید نکن.'
      : '\n\nThis agent cannot create, cancel, return, or change orders. Clearly say that only product consultation and read-only tracking of existing orders are currently available; never confirm an order mutation.'
  }

  if (!params.enabled) {
    return isFa
      ? '\n\nدسترسی پیگیری سفارش برای این ایجنت غیرفعال است. اطلاعات سفارش را نمایش نده و کاربر را به پشتیبانی انسانی ارجاع بده.'
      : '\n\nOrder tracking access is disabled for this agent. Do not expose order data; direct the customer to human support.'
  }

  const externalOrderId = extractOrderId(params.message) ?? (isOrderContinuation ? bareOrderId : null)
  if (!externalOrderId) {
    return isFa
      ? '\n\nدرخواست پیگیری سفارش تشخیص داده شد. فقط شماره سفارش را از مشتری بخواه؛ شماره موبایل یا اطلاعات هویتی دیگری درخواست نکن. ثبت، لغو یا ویرایش سفارش مجاز نیست.'
      : '\n\nAn order-tracking request was detected. Ask only for the order number; do not request a phone number or other identity information. Creating, cancelling, or changing orders is not allowed.'
  }

  const order = await prisma.storeOrder.findFirst({
    where: {
      workspaceId: params.workspaceId,
      externalOrderId,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      externalOrderId: true,
      status: true,
      total: true,
      currency: true,
      itemCount: true,
      itemsSummary: true,
      trackingCode: true,
      courierName: true,
      shippingDate: true,
      trackingLink: true,
      shippingNote: true,
      shippingMethod: true,
      orderDate: true,
    },
  })

  if (!order) {
    return isFa
      ? '\n\nسفارشی با این شماره پیدا نشد. فقط از مشتری بخواه شماره سفارش را دوباره بررسی کند؛ شماره موبایل نخواه و هیچ وضعیت یا کد رهگیری‌ای حدس نزن.'
      : '\n\nNo order with this number was found. Ask the customer to verify only the order number; do not request a phone number and do not guess any status or tracking code.'
  }

  const status = isFa ? FA_STATUS[order.status] ?? order.status : order.status
  const orderDate = formatDate(order.orderDate, isFa)

  // Build a tracking link if one wasn't provided by the store. Iranian Post
  // tracking codes are 13–20 digits and have a well-known URL format. Tipax
  // codes (typically 10–14 digits) link to the Tipax tracker.
  const effectiveTrackingLink = order.trackingLink || synthesizeTrackingLink(order.trackingCode, order.courierName)

  const lines = [
    `order_number: ${order.externalOrderId}`,
    `status: ${safeValue(status, 80)}`,
    `total: ${order.total} ${order.currency}`,
    `item_count: ${order.itemCount}`,
    order.itemsSummary ? `items: ${safeValue(order.itemsSummary)}` : '',
    `tracking_code: ${order.trackingCode ? safeValue(order.trackingCode, 100) : 'NOT_AVAILABLE'}`,
    order.courierName ? `courier_name: ${safeValue(order.courierName, 120)}` : '',
    order.shippingDate ? `shipping_date: ${safeValue(order.shippingDate, 80)}` : '',
    `tracking_link: ${effectiveTrackingLink ? safeValue(effectiveTrackingLink, 300) : 'NOT_AVAILABLE'}`,
    order.shippingMethod ? `shipping_method: ${safeValue(order.shippingMethod, 120)}` : '',
    order.shippingNote ? `shipping_note: ${safeValue(order.shippingNote, 500)}` : '',
    orderDate ? `order_date: ${orderDate}` : '',
  ].filter(Boolean)

  const guard = isFa
    ? 'این بلوک تنها منبع معتبر پاسخ است. شماره موبایل نخواه. فقط مقدار دقیق tracking_code کد رهگیری مرسوله است؛ شماره سفارش، کدپستی، تلفن، مبلغ یا هر عدد دیگری را کد رهگیری تلقی نکن. اگر tracking_code برابر NOT_AVAILABLE است، صریحاً بگو کد رهگیری هنوز ثبت نشده و هیچ کدی نساز. اگر موجود است، همان رشته را کامل و بدون تغییر داخل `...` اعلام کن و tracking_link را هم بده. وضعیت «تکمیل‌شده» به‌تنهایی به معنی تحویل به پست نیست؛ مرحله ارسال یا زمان تحویل را حدس نزن. پاسخ را مستقیم بده و نگو «یک لحظه بررسی می‌کنم». ثبت، لغو، مرجوع یا ویرایش سفارش انجام نده.'
    : 'This block is the only authoritative source. Do not ask for a phone number. Only the exact tracking_code value is a parcel tracking code; never reinterpret an order number, postal code, phone, amount, or any other number as tracking. If tracking_code is NOT_AVAILABLE, clearly say it has not been registered yet and invent nothing. If present, reproduce the complete exact string inside `...` and share tracking_link. A completed order status alone does not prove carrier handoff; never guess shipment stage or delivery time. Answer directly without saying you will check. Never create, cancel, return, or change an order.'

  return `\n\n<verified_order>\n${lines.join('\n')}\n</verified_order>\n${guard}`
}
