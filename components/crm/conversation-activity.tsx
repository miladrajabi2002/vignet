import {
  BadgeCheck,
  BookOpenCheck,
  Boxes,
  CalendarCheck2,
  CalendarClock,
  CalendarX2,
  CircleCheck,
  ExternalLink,
  GraduationCap,
  Headphones,
  ListOrdered,
  PackageCheck,
  Scale,
  Send,
  StickyNote,
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
    | 'course_enrolled'
    | 'course_waitlisted'
    | 'enrollment_cancelled'
    | 'model_error'
  count?: number
}

type TimelineActivity = {
  kind: 'customer_identified' | 'handoff_ready' | 'operator_reply' | 'campaign_sent' | 'operator_note'
  note?: string
  author?: string
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
    'course_enrolled',
    'course_waitlisted',
    'enrollment_cancelled',
    'model_error',
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
      case 'course_enrolled':
        return 'Course enrollment recorded'
      case 'course_waitlisted':
        return 'Added to the course waitlist'
      case 'enrollment_cancelled':
        return 'Course enrollment cancelled'
      case 'model_error':
        return 'AI service error — reply not generated from knowledge'
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
    case 'course_enrolled':
      return 'ثبت‌نام در دوره ثبت شد'
    case 'course_waitlisted':
      return 'به فهرست انتظار دوره اضافه شد'
    case 'enrollment_cancelled':
      return 'انصراف از دوره ثبت شد'
    case 'model_error':
      return 'خطای سرویس هوش مصنوعی — پاسخ از پایگاه دانش تولید نشد'
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
  course_enrolled: GraduationCap,
  course_waitlisted: ListOrdered,
  enrollment_cancelled: CalendarX2,
  model_error: TriangleAlert,
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
  const deliveryReason = delivery?.reason
  // Messages created before the explicit `stored` state used
  // unavailable/not_push_channel for web and chat-link history delivery. Keep
  // those historical rows truthful instead of rendering them as failures.
  const storedInConversation = deliveryStatus === 'stored' || (
    deliveryStatus === 'unavailable' && deliveryReason === 'not_push_channel'
  )
  if (
    receipts.length === 0 &&
    !storedInConversation &&
    !['sent', 'unavailable', 'failed'].includes(String(deliveryStatus))
  ) return null

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
            className={cn(
              'inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] leading-4',
              receipt.kind === 'model_error'
                ? 'border border-amber-500/20 bg-amber-500/[0.08] text-amber-700 dark:text-amber-300'
                : 'border border-emerald-500/15 bg-emerald-500/[0.07] text-emerald-700 dark:text-emerald-300',
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {receiptCopy(receipt, locale)}
          </span>
        )
      })}
      {deliveryStatus === 'sent' && (
        <span role="listitem" className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-emerald-500/15 bg-emerald-500/[0.07] px-2.5 py-1 text-[12px] leading-4 text-emerald-700 dark:text-emerald-300">
          <CircleCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {locale === 'fa' ? 'ارسال‌شده به برنامه' : 'Sent to channel'}
        </span>
      )}
      {storedInConversation && (
        <span role="listitem" className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-emerald-500/15 bg-emerald-500/[0.07] px-2.5 py-1 text-[12px] leading-4 text-emerald-700 dark:text-emerald-300">
          <CircleCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {locale === 'fa' ? 'ثبت‌شده در گفتگو' : 'Added to conversation'}
        </span>
      )}
      {deliveryStatus === 'failed' && (
        <span role="listitem" className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/[0.08] px-2.5 py-1 text-[12px] leading-4 text-amber-700 dark:text-amber-300">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {locale === 'fa' ? 'ارسال به برنامه ناموفق بود' : 'Channel delivery failed'}
        </span>
      )}
      {deliveryStatus === 'unavailable' && !storedInConversation && (
        <span role="listitem" className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/[0.08] px-2.5 py-1 text-[12px] leading-4 text-amber-700 dark:text-amber-300">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {locale === 'fa' ? 'برنامه آمادهٔ ارسال نیست' : 'Channel is not ready to send'}
        </span>
      )}
    </div>
  )
}

function getTimelineActivity(metadata: Metadata): TimelineActivity | null {
  const raw = metadata?.vigentoActivity
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  if (!['customer_identified', 'handoff_ready', 'operator_reply', 'campaign_sent', 'operator_note'].includes(String(row.kind))) {
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
    detail: activity.source === 'telegram_bot' ? 'از ربات مدیریت تلگرام' : 'از پنل گفتگوها',
  }
  return { title: 'پیام کمپین تحویل شد', detail: 'در همین گفتگو ثبت شد' }
}

/**
 * The moment the agent handed the conversation to a person: one amber line in
 * the flow of messages, so the operator sees where their part starts.
 */
export function HandoffMarker({
  locale,
  dateLabel,
  reason,
}: {
  locale: Locale
  dateLabel: string
  reason?: string | null
}) {
  return (
    <div className="flex items-center gap-3 py-1" role="note">
      <span className="h-px flex-1 bg-amber-500/25" aria-hidden="true" />
      <span className="inline-flex max-w-[86%] items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-50 px-3 py-1 text-[12px] font-medium leading-5 text-amber-900">
        <Headphones className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 truncate">
          {locale === 'fa' ? 'ایجنت گفتگو را به شما سپرد' : 'The agent handed this to you'}
          {reason ? ` · ${reason}` : ''}
        </span>
        <span className="shrink-0 font-normal text-amber-900/70">· {dateLabel}</span>
      </span>
      <span className="h-px flex-1 bg-amber-500/25" aria-hidden="true" />
    </div>
  )
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

  if (activity.kind === 'handoff_ready') return <HandoffMarker locale={locale} dateLabel={dateLabel} />

  if (activity.kind === 'operator_note') {
    if (!activity.note) return null
    return (
      <div className="mx-auto w-full max-w-[34rem] rounded-xl border border-dashed border-[var(--notif-strong)]/35 bg-[var(--notif-soft)] px-3.5 py-2.5" role="note">
        <p className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--notif-strong)]">
          <StickyNote className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {locale === 'fa' ? 'یادداشت داخلی' : 'Internal note'}
          <span className="font-normal text-[var(--text-muted)]">
            · {locale === 'fa' ? 'مشتری نمی‌بیند' : 'not visible to the customer'}
          </span>
        </p>
        <p dir="auto" className="mt-1 whitespace-pre-wrap text-[13px] leading-6 text-[var(--text-primary)] [overflow-wrap:anywhere]">{activity.note}</p>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">
          {activity.author ? `${activity.author} · ` : ''}{dateLabel}
        </p>
      </div>
    )
  }

  const copy = timelineCopy(activity, locale)
  const Icon = activity.kind === 'customer_identified' ? UserRoundCheck : Send

  return (
    <div className="flex items-center gap-3 py-1" role="note">
      <span className="h-px flex-1 bg-[var(--border-subtle)]" aria-hidden="true" />
      <span className="inline-flex max-w-[86%] items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-white px-3 py-1 text-[12px] leading-5 text-[var(--text-secondary)]">
        <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
        <span className="min-w-0 truncate" title={copy.detail}>{copy.title}</span>
        <span className="shrink-0 text-[var(--text-muted)]">· {dateLabel}</span>
      </span>
      <span className="h-px flex-1 bg-[var(--border-subtle)]" aria-hidden="true" />
    </div>
  )
}
