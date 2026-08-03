import {
  ArrowRightLeft,
  BadgeCheck,
  BookOpenCheck,
  Boxes,
  CalendarCheck2,
  CalendarClock,
  CalendarX2,
  CircleCheck,
  ExternalLink,
  Headphones,
  PackageCheck,
  Scale,
  Send,
  TriangleAlert,
  UserRoundCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Locale = 'fa' | 'en'
type Metadata = Record<string, unknown> | null

type Receipt = {
  kind:
    | 'knowledge_used'
    | 'catalog_checked'
    | 'products_presented'
    | 'products_compared'
    | 'stock_checked'
    | 'link_shared'
    | 'slots_checked'
    | 'appointment_booked'
    | 'appointment_cancelled'
  count?: number
}

type TimelineActivity = {
  kind: 'customer_identified' | 'handoff_ready' | 'operator_reply' | 'campaign_sent'
  fields?: Array<'name' | 'phone'>
  summaryReady?: boolean
  source?: 'dashboard' | 'telegram_bot' | 'agent'
}

function asReceipt(value: unknown): Receipt | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const kinds: Receipt['kind'][] = [
    'knowledge_used',
    'catalog_checked',
    'products_presented',
    'products_compared',
    'stock_checked',
    'link_shared',
    'slots_checked',
    'appointment_booked',
    'appointment_cancelled',
  ]
  if (!kinds.includes(row.kind as Receipt['kind'])) return null
  return {
    kind: row.kind as Receipt['kind'],
    count: typeof row.count === 'number' ? row.count : undefined,
  }
}

function receiptCopy(receipt: Receipt, locale: Locale): string {
  const count = Math.max(0, receipt.count ?? 0)
  if (locale === 'en') {
    switch (receipt.kind) {
      case 'knowledge_used':
        return `Answer checked against ${count} knowledge ${count === 1 ? 'source' : 'sources'}`
      case 'catalog_checked':
        return `${count} catalog ${count === 1 ? 'item' : 'items'} checked`
      case 'products_presented':
        return `${count} ${count === 1 ? 'product' : 'products'} presented from the catalog`
      case 'products_compared':
        return `${count} catalog products compared and presented`
      case 'stock_checked':
        return 'Catalog stock checked'
      case 'link_shared':
        return 'Relevant link shared'
      case 'slots_checked':
        return 'Live appointment availability checked'
      case 'appointment_booked':
        return 'Appointment confirmed and recorded'
      case 'appointment_cancelled':
        return 'Appointment cancellation recorded'
    }
  }

  switch (receipt.kind) {
    case 'knowledge_used':
      return `پاسخ با ${count.toLocaleString('fa-IR')} بخش از پایگاه دانش بررسی شد`
    case 'catalog_checked':
      return `${count.toLocaleString('fa-IR')} مورد از کاتالوگ بررسی شد`
    case 'products_presented':
      return `${count.toLocaleString('fa-IR')} محصول از کاتالوگ نمایش داده شد`
    case 'products_compared':
      return `${count.toLocaleString('fa-IR')} محصول از کاتالوگ مقایسه و نمایش داده شد`
    case 'stock_checked':
      return 'موجودی کاتالوگ بررسی شد'
    case 'link_shared':
      return 'لینک مرتبط ارسال شد'
    case 'slots_checked':
      return 'زمان‌های آزاد به‌صورت زنده بررسی شد'
    case 'appointment_booked':
      return 'نوبت تأیید و در تقویم ثبت شد'
    case 'appointment_cancelled':
      return 'لغو نوبت در تقویم ثبت شد'
  }
}

const receiptIcons: Record<Receipt['kind'], typeof BadgeCheck> = {
  knowledge_used: BookOpenCheck,
  catalog_checked: Boxes,
  products_presented: PackageCheck,
  products_compared: Scale,
  stock_checked: BadgeCheck,
  link_shared: ExternalLink,
  slots_checked: CalendarClock,
  appointment_booked: CalendarCheck2,
  appointment_cancelled: CalendarX2,
}

export function MessageActivityReceipts({
  metadata,
  locale,
}: {
  metadata: Metadata
  locale: Locale
}) {
  const raw = metadata?.vigentoReceipts
  const receipts = Array.isArray(raw)
    ? raw.map(asReceipt).filter((item): item is Receipt => item != null)
    : []
  const deliveryRaw = metadata?.delivery
  const delivery = deliveryRaw && typeof deliveryRaw === 'object'
    ? deliveryRaw as Record<string, unknown>
    : null
  const deliveryStatus = delivery?.status
  if (receipts.length === 0 && !['sent', 'unavailable', 'failed'].includes(String(deliveryStatus))) return null

  return (
    <div
      className="mt-2 flex max-w-xl flex-wrap justify-end gap-1.5"
      role="list"
      aria-label={locale === 'fa' ? 'اقدام‌های انجام‌شده توسط ایجنت' : 'Actions completed by the agent'}
    >
      {receipts.map((receipt, index) => {
        const Icon = receiptIcons[receipt.kind]
        return (
          <span
            key={`${receipt.kind}-${index}`}
            role="listitem"
            className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-emerald-500/15 bg-emerald-500/[0.07] px-2.5 py-1 text-[11px] leading-4 text-emerald-700 dark:text-emerald-300"
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {receiptCopy(receipt, locale)}
          </span>
        )
      })}
      {deliveryStatus === 'sent' && (
        <span role="listitem" className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-emerald-500/15 bg-emerald-500/[0.07] px-2.5 py-1 text-[11px] leading-4 text-emerald-700 dark:text-emerald-300">
          <CircleCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {locale === 'fa' ? 'پذیرفته‌شده برای ارسال' : 'Accepted by channel'}
        </span>
      )}
      {(deliveryStatus === 'failed' || deliveryStatus === 'unavailable') && (
        <span role="listitem" className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/[0.08] px-2.5 py-1 text-[11px] leading-4 text-amber-700 dark:text-amber-300">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {locale === 'fa' ? 'ذخیره شد؛ تحویل نشد' : 'Saved; not delivered'}
        </span>
      )}
    </div>
  )
}

function getTimelineActivity(metadata: Metadata): TimelineActivity | null {
  const raw = metadata?.vigentoActivity
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  if (!['customer_identified', 'handoff_ready', 'operator_reply', 'campaign_sent'].includes(String(row.kind))) {
    return null
  }
  return row as TimelineActivity
}

function timelineCopy(activity: TimelineActivity, locale: Locale): {
  title: string
  detail: string
} {
  if (locale === 'en') {
    if (activity.kind === 'customer_identified') {
      const fields = activity.fields?.includes('phone') && activity.fields.includes('name')
        ? 'Name and phone'
        : activity.fields?.includes('phone')
          ? 'Phone number'
          : 'Customer name'
      return { title: `${fields} captured`, detail: 'Customer profile updated for the operator' }
    }
    if (activity.kind === 'handoff_ready') {
      return {
        title: 'Conversation handed to an operator',
        detail: activity.summaryReady ? 'A context summary is ready' : 'Conversation context attached',
      }
    }
    if (activity.kind === 'operator_reply') return {
      title: 'Operator reply sent',
      detail: activity.source === 'telegram_bot' ? 'Sent from the operator bot' : 'Sent from the dashboard',
    }
    return { title: 'Campaign message delivered', detail: 'Recorded in this conversation' }
  }

  if (activity.kind === 'customer_identified') {
    const fields = activity.fields?.includes('phone') && activity.fields.includes('name')
      ? 'نام و شماره مشتری'
      : activity.fields?.includes('phone')
        ? 'شماره مشتری'
        : 'نام مشتری'
    return { title: `${fields} دریافت شد`, detail: 'پروفایل مشتری برای ادامه گفتگو به‌روزرسانی شد' }
  }
  if (activity.kind === 'handoff_ready') {
    return {
      title: 'گفتگو به اپراتور تحویل شد',
      detail: activity.summaryReady ? 'خلاصه زمینه گفتگو آماده است' : 'زمینه گفتگو پیوست شد',
    }
  }
  if (activity.kind === 'operator_reply') return {
    title: 'پاسخ اپراتور ارسال شد',
    detail: activity.source === 'telegram_bot' ? 'از ربات مدیر تلگرام' : 'از پنل گفتگوها',
  }
  return { title: 'پیام کمپین تحویل شد', detail: 'در همین گفتگو ثبت شد' }
}

export function ConversationTimelineActivity({
  metadata,
  locale,
  dateLabel,
}: {
  metadata: Metadata
  locale: Locale
  dateLabel: string
}) {
  const activity = getTimelineActivity(metadata)
  if (!activity) return null
  const copy = timelineCopy(activity, locale)
  const Icon = activity.kind === 'customer_identified'
    ? UserRoundCheck
    : activity.kind === 'handoff_ready'
      ? ArrowRightLeft
      : Send

  return (
    <div className="relative flex items-center justify-center py-2" role="note">
      <div className="absolute inset-x-4 top-1/2 h-px bg-[var(--border-subtle)]" />
      <div
        className={cn(
          'relative flex max-w-[92%] items-center gap-2.5 rounded-xl border px-3 py-2 shadow-sm',
          activity.kind === 'handoff_ready'
            ? 'border-amber-500/20 bg-amber-500/[0.08]'
            : 'border-[var(--border-default)] bg-[var(--bg-base)]',
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border-default)]">
          {activity.kind === 'handoff_ready' ? (
            <Headphones className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Icon className="h-4 w-4" aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-medium text-[var(--text-primary)]">{copy.title}</span>
          <span className="mt-0.5 block text-[11px] text-[var(--text-muted)]">
            {copy.detail} · {dateLabel}
          </span>
        </span>
      </div>
    </div>
  )
}
