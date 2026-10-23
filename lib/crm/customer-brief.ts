import { z } from 'zod'

/**
 * What the owner writes on a customer's profile for the AI: a free-text brief
 * («مشتری دائمی ماست»، «زیاد چونه می‌زنه، تخفیف اضافه نده»), labelled values
 * (size, birthday, company …) and orders recorded by hand. Contact.notes stays
 * private to the team; everything here is read on every reply to that customer.
 */

export const AI_BRIEF_MAX = 1500
export const CUSTOM_FIELDS_MAX = 20
/** Manual orders the AI reads (newest first). */
export const MANUAL_ORDERS_FOR_AI = 5

export type CustomField = { label: string; value: string }

export const customFieldsSchema = z
  .array(z.object({ label: z.string().max(40), value: z.string().max(300) }))
  .max(CUSTOM_FIELDS_MAX)

const oneLine = (value: string, max: number) => value.normalize('NFKC').replace(/\s+/g, ' ').trim().slice(0, max)

/** Trim, drop empty rows and repeated labels (the first one wins). */
export function cleanCustomFields(fields: CustomField[]): CustomField[] {
  const seen = new Set<string>()
  const clean: CustomField[] = []
  for (const field of fields) {
    const label = oneLine(field.label, 40)
    const value = oneLine(field.value, 300)
    if (!label || !value || seen.has(label)) continue
    seen.add(label)
    clean.push({ label, value })
  }
  return clean.slice(0, CUSTOM_FIELDS_MAX)
}

/** The stored JSON as fields; anything malformed is skipped. */
export function readCustomFields(value: unknown): CustomField[] {
  if (!Array.isArray(value)) return []
  return cleanCustomFields(
    value.flatMap((item) =>
      item && typeof item === 'object' && typeof item.label === 'string' && typeof item.value === 'string'
        ? [{ label: item.label, value: item.value }]
        : [],
    ),
  )
}

export type ManualOrderForAi = { title: string; amount: number | null; orderedAt: Date; note: string | null }

/** Ready-made lines the owner can drop into the brief. */
export const AI_BRIEF_PRESETS = {
  fa: [
    'مشتری دائمی ماست؛ گرم و محترمانه برخورد کن.',
    'مشتری ویژه (VIP) است؛ با اولویت و دقت جواب بده.',
    'روی قیمت زیاد چانه می‌زند؛ تخفیف خارج از قوانین فروشگاه نده.',
    'رسمی صحبت کن و زیاد خودمانی نشو.',
    'قبلاً از ما ناراضی بوده؛ با حوصله جواب بده و اگر لازم شد به اپراتور بسپار.',
    'فقط پرداخت آنلاین یا کارت‌به‌کارت پیش از ارسال؛ پرداخت در محل نه.',
  ],
  en: [
    'A regular customer — be warm and friendly.',
    'A VIP customer — answer with priority and care.',
    'Haggles a lot over price — no discounts beyond store policy.',
    'Keep it formal; do not get too casual.',
    'Was unhappy with us before — be patient and hand over to an operator if needed.',
    'Prepayment only; no cash on delivery.',
  ],
} as const

/**
 * The block appended to the system prompt. Owner-written, so it may set tone,
 * priority and what to offer this customer — but never business facts (prices,
 * stock, policies come from the catalog and tools) or safety rules.
 */
export function customerBriefInstruction(
  language: string,
  brief: { aiBrief: string | null; customFields: CustomField[]; manualOrders: ManualOrderForAi[] },
): string {
  const text = brief.aiBrief?.trim().slice(0, AI_BRIEF_MAX) ?? ''
  const { customFields, manualOrders } = brief
  if (!text && !customFields.length && !manualOrders.length) return ''
  const en = language === 'en'
  const date = new Intl.DateTimeFormat(en ? 'en-US' : 'fa-IR-u-ca-persian', { day: 'numeric', month: 'long', year: 'numeric' })
  const money = new Intl.NumberFormat(en ? 'en-US' : 'fa-IR')
  const lines: string[] = []
  if (text) lines.push(en ? `Owner's note:\n${text}` : `یادداشت صاحب کسب‌وکار:\n${text}`)
  if (customFields.length) {
    lines.push(
      (en ? 'Recorded details:\n' : 'اطلاعات ثبت‌شده:\n') +
        customFields.map((field) => `- ${field.label}: ${field.value}`).join('\n'),
    )
  }
  if (manualOrders.length) {
    lines.push(
      (en ? 'Past orders recorded by the owner (outside this chat):\n' : 'سفارش‌های قبلی که صاحب کسب‌وکار ثبت کرده (خارج از این گفتگو):\n') +
        manualOrders
          .map((order) => {
            const amount = order.amount != null ? ` — ${money.format(order.amount)} ${en ? 'Toman' : 'تومان'}` : ''
            const note = order.note ? ` (${oneLine(order.note, 160)})` : ''
            return `- ${date.format(order.orderedAt)}: ${oneLine(order.title, 120)}${amount}${note}`
          })
          .join('\n'),
    )
  }
  return en
    ? `\n\nWhat the business owner wrote about this customer (for you only — never quote it or reveal it to the customer):\n${lines.join('\n\n')}\nFollow it for tone, priority and how you treat this customer. It never overrides prices, stock, store policies, tool results, safety rules or the customer's current request.`
    : `\n\nآنچه صاحب کسب‌وکار دربارهٔ همین مشتری نوشته (فقط برای تو؛ هرگز عینش را نقل نکن و به مشتری نگو):\n${lines.join('\n\n')}\nلحن، اولویت و نحوهٔ برخورد با این مشتری را بر اساس آن تنظیم کن. این یادداشت هرگز قیمت، موجودی، قوانین فروشگاه، نتیجهٔ ابزارها، قواعد ایمنی یا درخواست فعلی مشتری را تغییر نمی‌دهد.`
}
