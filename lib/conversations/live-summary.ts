/**
 * A factual, zero-cost summary of where a conversation stands, built from
 * structured state instead of transcript snippets: the customer's current
 * goal, the product under discussion (and others they looked at), the cart
 * or order and what it waits on, the details they already gave, and the
 * agent's open question. Used for open conversations (which have no handoff
 * summary yet) and as the backbone of the deterministic handoff summary.
 */
import type { ConversationWorkingState } from '@/lib/ai/conversation-state'

export interface LiveSummaryDraft {
  code: string
  status: string
  expecting: string | null
  items: unknown
  customerName: string | null
  city: string | null
}

const STATUS_FA: Record<string, string> = {
  COLLECTING: 'در حال تکمیل',
  AWAITING_CONFIRM: 'منتظر تأیید خلاصه',
  SUBMITTED: 'پیش‌سفارش ثبت‌شده (منتظر هماهنگی اپراتور)',
  LINK_SENT: 'لینک پرداخت ارسال شده',
  PAYMENT_PENDING: 'در انتظار پرداخت',
  PAYMENT_FAILED: 'پرداخت ناموفق',
  PAID: 'پرداخت‌شده',
  ON_HOLD: 'در انتظار بررسی فروشگاه',
  CANCELLED: 'لغوشده',
  EXPIRED: 'منقضی‌شده',
}
const STATUS_EN: Record<string, string> = {
  COLLECTING: 'being filled',
  AWAITING_CONFIRM: 'awaiting summary confirmation',
  SUBMITTED: 'pre-order filed (waiting for an operator)',
  LINK_SENT: 'payment link sent',
  PAYMENT_PENDING: 'awaiting payment',
  PAYMENT_FAILED: 'payment failed',
  PAID: 'paid',
  ON_HOLD: 'on hold at the store',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
}
const SLOT_FA: Record<string, string> = {
  name: 'نام', phone: 'شماره', address: 'آدرس', product: 'انتخاب محصول', variant: 'انتخاب مدل/رنگ', shipping: 'روش ارسال',
  confirm: 'تأیید خلاصه', confirm_cancel: 'تأیید لغو',
  color: 'رنگ', size: 'سایز', material: 'جنس', style: 'سبک', design: 'طرح', budget: 'بودجه', location: 'شهر',
  date: 'تاریخ', time: 'ساعت', quantity: 'تعداد', payment: 'پرداخت', use_case: 'کاربرد', variant_pick: 'مدل',
}
const SLOT_EN: Record<string, string> = {
  name: 'name', phone: 'phone', address: 'address', product: 'product choice', variant: 'variant choice', shipping: 'shipping method',
  confirm: 'summary confirmation', confirm_cancel: 'cancel confirmation',
  color: 'color', size: 'size', material: 'material', style: 'style', design: 'design', budget: 'budget', location: 'city',
  date: 'date', time: 'time', quantity: 'quantity', payment: 'payment', use_case: 'use', variant_pick: 'model',
}

function items(value: unknown): Array<{ name: string; variant: string | null; quantity: number }> {
  if (!Array.isArray(value)) return []
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return []
    const row = raw as Record<string, unknown>
    return typeof row.name === 'string'
      ? [{ name: row.name, variant: typeof row.variant === 'string' ? row.variant : null, quantity: typeof row.quantity === 'number' ? row.quantity : 1 }]
      : []
  })
}

function clip(value: string, max: number): string {
  const clean = value.replace(/\s+/g, ' ').trim()
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`
}

export function buildLiveSummary(input: {
  state: ConversationWorkingState | null
  draft: LiveSummaryDraft | null
  language: string
}): string | null {
  const en = input.language === 'en'
  const parts: string[] = []
  const state = input.state
  if (state?.activeGoal && state.status !== 'RESET') {
    parts.push(`${en ? 'Goal' : 'هدف'}: ${clip(state.activeGoal.label, 140)}${state.status === 'RESOLVED' ? (en ? ' (closed)' : ' (بسته‌شده)') : ''}`)
  }
  if (state?.activeEntity?.type === 'PRODUCT' && state.activeEntity.id) {
    parts.push(`${en ? 'Product under discussion' : 'محصول مورد بحث'}: ${clip(state.activeEntity.label, 100)}`)
  }
  const seen = (state?.discussedEntities ?? [])
    .filter((entity) => entity.id.split('#')[0] !== state?.activeEntity?.id?.split('#')[0])
    .slice(0, 4)
    .map((entity) => clip(entity.name, 60))
  if (seen.length) parts.push(`${en ? 'Also looked at' : 'محصولات دیگری که دیده'}: ${seen.join(en ? ', ' : '، ')}`)
  const draft = input.draft
  if (draft) {
    const lines = items(draft.items)
    if (lines.length) {
      const names = lines.map((line) => `${line.name}${line.variant ? ` — ${line.variant}` : ''} × ${line.quantity}`).join(en ? ', ' : '، ')
      const status = (en ? STATUS_EN : STATUS_FA)[draft.status] ?? draft.status
      const waits = draft.expecting ? (en ? SLOT_EN : SLOT_FA)[draft.expecting] ?? draft.expecting : null
      parts.push(`${en ? 'Order' : 'سفارش'} ${draft.code}: ${clip(names, 180)} — ${status}${waits ? `${en ? '; waiting for' : '؛ منتظر'} ${waits}` : ''}`)
    }
  }
  const slots = Object.entries(state?.slots ?? {})
    .filter(([key]) => (en ? SLOT_EN : SLOT_FA)[key])
    .slice(0, 6)
    .map(([key, fact]) => `${(en ? SLOT_EN : SLOT_FA)[key]}: ${clip(fact.value, 40)}`)
  if (slots.length) parts.push(`${en ? 'Stated details' : 'جزئیات گفته‌شده'}: ${slots.join(en ? ', ' : '، ')}`)
  if (state?.lastQuestion) parts.push(`${en ? 'Agent is waiting for' : 'ایجنت منتظر پاسخ'}: «${clip(state.lastQuestion.text, 120)}»`)
  if (!parts.length) return null
  return clip(parts.join(' | '), 700)
}
