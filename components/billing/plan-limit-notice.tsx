import Link from 'next/link'
import type { Plan } from '@prisma/client'
import { ArrowRight, ShieldAlert, Sparkles } from 'lucide-react'
import type { LimitedPlanResource, PaidPlan } from '@/lib/billing/plans'
import { cn } from '@/lib/utils'

export interface PlanLimitInfo {
  resource: LimitedPlanResource
  plan: Plan
  used: number
  limit: number
  recommendedPlan: PaidPlan | null
  recommendedLimit?: number | null
}

const PLAN_LABELS = {
  fa: { TRIAL: 'آزمایشی', STARTER: 'شروع', PRO: 'حرفه‌ای', BUSINESS: 'سازمانی' },
  en: { TRIAL: 'Trial', STARTER: 'Starter', PRO: 'Pro', BUSINESS: 'Business' },
} satisfies Record<'fa' | 'en', Record<Plan, string>>

const RESOURCE_LABELS = {
  fa: { products: 'محصول', orders: 'سفارش', customers: 'مشتری', channels: 'اتصال کانال' },
  en: { products: 'product', orders: 'order', customers: 'customer', channels: 'channel connection' },
} satisfies Record<'fa' | 'en', Record<LimitedPlanResource, string>>

export function PlanLimitNotice({
  limit,
  locale,
  syncContext = false,
  compact = false,
}: {
  limit: PlanLimitInfo
  locale: 'fa' | 'en'
  /** Clarifies that the store connection is healthy and only new imports pause. */
  syncContext?: boolean
  compact?: boolean
}) {
  const nf = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US')
  const resource = RESOURCE_LABELS[locale][limit.resource]
  const currentPlan = PLAN_LABELS[locale][limit.plan]
  const nextPlan = limit.recommendedPlan ? PLAN_LABELS[locale][limit.recommendedPlan] : null
  const upgradeHref = limit.recommendedPlan
    ? `/billing?plan=${limit.recommendedPlan}#plan-${limit.recommendedPlan}`
    : '/billing#vigent-plans'

  const title = locale === 'fa'
    ? `ظرفیت ${resource} پلن ${currentPlan} تکمیل شده است`
    : `Your ${currentPlan} plan ${resource} allowance is full`
  const explanation = locale === 'fa'
    ? syncContext
      ? `اتصال افزونه برقرار است؛ فقط دریافت ${resource} جدید تا افزایش ظرفیت متوقف می‌ماند.`
      : `در حال حاضر ${nf.format(limit.used)} از ${nf.format(limit.limit)} ${resource} استفاده شده است.`
    : syncContext
      ? `The plugin is connected; only new ${resource} imports are paused until capacity increases.`
      : `You are using ${nf.format(limit.used)} of ${nf.format(limit.limit)} ${resource} slots.`
  const recommendation = nextPlan && limit.recommendedLimit
    ? locale === 'fa'
      ? `با پلن ${nextPlan} ظرفیت شما به ${nf.format(limit.recommendedLimit)} می‌رسد.`
      : `${nextPlan} increases your allowance to ${nf.format(limit.recommendedLimit)}.`
    : null

  return (
    <section
      role="status"
      aria-live="polite"
      className={cn(
        'overflow-hidden rounded-2xl border border-amber-300/80 bg-amber-50 text-amber-950 shadow-[var(--shadow-xs)]',
        compact ? 'p-4' : 'p-4 sm:p-5',
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-400/25 text-amber-800">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold leading-6">{title}</h2>
            <span className="rounded-full border border-amber-300 bg-white/70 px-2.5 py-1 text-[11px] font-bold">
              {locale === 'fa' ? `پلن فعلی: ${currentPlan}` : `Current plan: ${currentPlan}`}
            </span>
          </div>
          <p className="mt-1 text-xs leading-6 text-amber-900/85">{explanation}</p>
          {recommendation && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold leading-6 text-amber-950">
              <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {recommendation}
            </p>
          )}
        </div>
        <Link
          href={upgradeHref}
          className="spatial-press inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-black px-4 text-xs font-bold text-white shadow-[var(--shadow-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2"
        >
          {limit.recommendedPlan
            ? locale === 'fa' ? `ارتقا به پلن ${nextPlan}` : `Upgrade to ${nextPlan}`
            : locale === 'fa' ? 'مشاهده گزینه‌های افزایش ظرفیت' : 'View capacity options'}
          <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}
