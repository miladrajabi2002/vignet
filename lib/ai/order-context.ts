import { prisma } from '@/lib/prisma'
import { contactPhoneLookupVariants, toEnglishDigits } from '@/lib/phone'

const ORDER_INTENT = /(?:سفارش|پیگیری\s*(?:خرید|مرسوله|ارسال)?|کد\s*رهگیری|وضعیت\s*(?:خرید|ارسال)|order|tracking|shipment)/i
const ORDER_MUTATION_INTENT = /(?:ثبت\s*سفارش|سفارش\s*(?:بدم|بدهم|ثبت|لغو)|لغو\s*سفارش|تغییر\s*سفارش|مرجوع|خرید\s*(?:کنم|انجام)|place\s+an?\s*order|cancel\s+(?:my\s+)?order|change\s+(?:my\s+)?order)/i

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
 * Return a small, identity-scoped order block only when the current message is
 * actually about order tracking. This is deliberately read-only: the model is
 * never given a tool or instruction that can create, cancel, or mutate orders.
 */
export async function buildOrderContext(params: {
  workspaceId: string
  contactId: string | null
  contactPhone: string | null
  message: string
  enabled: boolean
  language: string
}): Promise<string> {
  if (!ORDER_INTENT.test(params.message)) return ''
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

  const externalOrderId = extractOrderId(params.message)
  if (!externalOrderId) {
    return isFa
      ? '\n\nدرخواست پیگیری سفارش تشخیص داده شد. برای حفظ حریم خصوصی، شماره سفارش را از مشتری بخواه. فقط وضعیت سفارش موجود را گزارش کن؛ ثبت، لغو یا ویرایش سفارش مجاز نیست.'
      : '\n\nAn order-tracking request was detected. Ask for the order number to protect customer privacy. You may only report an existing order; creating, cancelling, or changing orders is not allowed.'
  }

  const phoneVariants = contactPhoneLookupVariants(params.contactPhone)
  if (!params.contactId && !phoneVariants.length) {
    return isFa
      ? '\n\nشماره سفارش دریافت شد، اما هویت مشتری به سفارشی متصل نیست. شماره تلفن ثبت‌شده هنگام خرید را بخواه و هیچ اطلاعات سفارشی را حدس نزن یا نمایش نده.'
      : '\n\nThe order number was provided, but the customer identity is not linked. Ask for the phone used at checkout and do not guess or expose order details.'
  }

  const order = await prisma.storeOrder.findFirst({
    where: {
      workspaceId: params.workspaceId,
      externalOrderId,
      OR: [
        ...(params.contactId ? [{ contactId: params.contactId }] : []),
        ...(phoneVariants.length ? [{ customerPhone: { in: phoneVariants } }] : []),
      ],
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
      shippingMethod: true,
      orderDate: true,
    },
  })

  if (!order) {
    return isFa
      ? '\n\nسفارشی با این شماره برای هویت فعلی پیدا نشد. فقط بگو اطلاعات منطبق پیدا نشد و از مشتری بخواه شماره سفارش و تلفن خرید را بررسی کند؛ هیچ جزئیاتی افشا نکن.'
      : '\n\nNo order matching this number and the current identity was found. Say that no matching record was found and ask the customer to verify the order number and checkout phone; expose no details.'
  }

  const status = isFa ? FA_STATUS[order.status] ?? order.status : order.status
  const orderDate = formatDate(order.orderDate, isFa)
  const lines = [
    `order_number: ${order.externalOrderId}`,
    `status: ${safeValue(status, 80)}`,
    `total: ${order.total} ${order.currency}`,
    `item_count: ${order.itemCount}`,
    order.itemsSummary ? `items: ${safeValue(order.itemsSummary)}` : '',
    order.trackingCode ? `tracking_code: ${safeValue(order.trackingCode, 100)}` : '',
    order.shippingMethod ? `shipping_method: ${safeValue(order.shippingMethod, 120)}` : '',
    orderDate ? `order_date: ${orderDate}` : '',
  ].filter(Boolean)

  const guard = isFa
    ? 'این داده فقط برای اعلام وضعیت/رهگیری است. ثبت، لغو، مرجوع یا ویرایش سفارش انجام نده و اطلاعاتی خارج از این بلوک نساز.'
    : 'This data is read-only for status/tracking. Never create, cancel, return, or change an order, and do not invent details outside this block.'

  return `\n\n<verified_order>\n${lines.join('\n')}\n</verified_order>\n${guard}`
}
