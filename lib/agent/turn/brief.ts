/**
 * Turn brief: one short, verified block that tells the reply model what the
 * customer asked on this turn and what the system already resolved, instead
 * of leaving it to re-derive intent from the raw message.
 *
 * Only emitted when it adds something: several requests in one message, a
 * resolved reference («همین مبل» = a catalog row), a capability the agent
 * does not have, or a reference the model should clarify instead of guess.
 */
import type { UnderstoodRoute } from '@/lib/agent/turn/route'
import type { Capability, ResolvedRef } from '@/lib/agent/understand/types'

const CAPABILITY_FA: Record<Capability, string> = {
  products: 'دسترسی به کاتالوگ محصولات',
  order_capture: 'ثبت سفارش درون گفتگو',
  pay_link: 'ارسال لینک پرداخت',
  restock: 'اطلاع‌رسانی موجود شدن کالا',
  order_tracking: 'پیگیری سفارش',
  bookings: 'رزرو نوبت',
  courses: 'ثبت‌نام دوره',
  handoff: 'انتقال به اپراتور',
}

const CAPABILITY_EN: Record<Capability, string> = {
  products: 'product catalog access',
  order_capture: 'taking orders in chat',
  pay_link: 'payment links',
  restock: 'back-in-stock alerts',
  order_tracking: 'order tracking',
  bookings: 'appointment booking',
  courses: 'course enrollment',
  handoff: 'transfer to a human',
}

export function composeTurnBrief(params: {
  route: UnderstoodRoute
  refs: Record<string, ResolvedRef>
  lang: 'fa' | 'en' | 'ar'
  /** Message words the customer used for each ref, when known («همین مبل»). */
  showRefs?: boolean
}): string {
  const { route } = params
  const fa = params.lang !== 'en'
  const lines: string[] = []
  const asks = route.brief.filter((item) => item.ask)
  if (asks.length > 1) {
    lines.push(fa
      ? `مشتری در همین پیام ${asks.length} چیز خواسته؛ به همه، به همین ترتیب و کوتاه جواب بده:`
      : `The customer asked ${asks.length} things in this message; answer all of them, in this order, briefly:`)
    asks.forEach((item, index) => lines.push(`${index + 1}) ${item.ask}`))
  }
  const products = Object.values(params.refs).filter((ref) => ref.kind === 'product' || ref.kind === 'cart')
  if (params.showRefs !== false && products.length) {
    const named = products.slice(0, 4).map((ref) => `«${ref.name}»`).join(fa ? '، ' : ', ')
    lines.push(fa
      ? `محصولی که مشتری به آن اشاره می‌کند (از کاتالوگ، قطعی): ${named}. دربارهٔ همین جواب بده و محصول دیگری را جایش نگذار.`
      : `The product the customer refers to (from the catalog, certain): ${named}. Answer about it; never substitute another product.`)
  }
  for (const capability of route.unavailable) {
    lines.push(fa
      ? `مشتری چیزی خواسته که این ایجنت امکانش را ندارد (${CAPABILITY_FA[capability]}). صادقانه و کوتاه بگو و قول انجامش را نده؛ اگر راه دیگری در دانش هست همان را بگو.`
      : `The customer asked for something this agent cannot do (${CAPABILITY_EN[capability]}). Say so briefly and honestly; never promise it. Offer another way only if the knowledge base has one.`)
  }
  if (route.clarify && !route.productIds.length && !route.orderTouch) {
    const question = route.clarify.question?.trim()
    lines.push(fa
      ? `منظور مشتری روشن نیست${route.clarify.reason === 'ambiguous_reference' ? ' (معلوم نیست به کدام محصول اشاره می‌کند)' : ''}. حدس نزن؛ فقط با یک سؤال کوتاه بپرس${question ? `، مثلاً: «${question.slice(0, 160)}»` : ''}.`
      : `What the customer means is unclear${route.clarify.reason === 'ambiguous_reference' ? ' (which product they refer to)' : ''}. Do not guess; ask one short question${question ? `, e.g. “${question.slice(0, 160)}”` : ''}.`)
  }
  if (!lines.length) return ''
  return `\n\n=== ${fa ? 'خلاصهٔ نوبت (تأییدشده توسط سیستم)' : 'Turn brief (verified by the system)'} ===\n${lines.join('\n')}`
}

/** Deterministic closing replies when the understanding read a pure closing. */
export function closingReplyFor(kind: 'thanks' | 'goodbye' | 'defer', lang: 'fa' | 'en' | 'ar'): string {
  if (lang === 'en') return kind === 'defer' ? 'Of course, take your time.' : kind === 'goodbye' ? 'Goodbye.' : 'You’re welcome.'
  return kind === 'defer' ? 'حتماً، با خیال راحت تصمیم بگیرید' : kind === 'goodbye' ? 'خدانگهدار' : 'خواهش می‌کنم'
}
