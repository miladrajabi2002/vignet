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
  /** Products in the connected store, when it reported more than are stored. */
  storeTotal?: number | null
}

const PLAN_LABELS = {
  fa: { TRIAL: 'آزمایشی', STARTER: 'استارتر', PRO: 'حرفه‌ای', BUSINESS: 'سازمانی' },
  en: { TRIAL: 'Trial', STARTER: 'Starter', PRO: 'Pro', BUSINESS: 'Business' },
} satisfies Record<'fa' | 'en', Record<Plan, string>>

const RESOURCE_LABELS = {
  fa: { products: 'محصول', orders: 'سفارش', customers: 'مشتری', channels: 'اتصال' },
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
    ? `ظرفیت ${resource} در پلن ${currentPlan} پر شده`
    : `Your ${currentPlan} plan ${resource} allowance is full`
  const missing = limit.storeTotal != null ? Math.max(0, limit.storeTotal - limit.used) : 0
  const explanation = missing > 0
    ? locale === 'fa'
      ? `فروشگاه شما ${nf.format(limit.storeTotal!)} محصول دارد، ولی پلن ${currentPlan} تا ${nf.format(limit.limit)} محصول جا دارد؛ ${nf.format(missing)} محصول به ویجنت نیامده و دستیار آن‌ها را نمی‌شناسد.`
      : `Your store has ${nf.format(limit.storeTotal!)} products, but ${currentPlan} holds ${nf.format(limit.limit)}; ${nf.format(missing)} products were not brought in and the assistant does not know them.`
    : locale === 'fa'
    ? syncContext
      ? `افزونه وصل است؛ فقط ${resource} جدید تا بیشتر شدن ظرفیت نمی‌آید.`
      : `الان ${nf.format(limit.used)} از ${nf.format(limit.limit)} ${resource} پر است.`
    : syncContext
      ? `The plugin is connected; only new ${resource} imports are paused until capacity increases.`
      : `You are using ${nf.format(limit.used)} of ${nf.format(limit.limit)} ${resource} slots.`
  const recommendation = missing > 0
    ? nextPlan
      ? locale === 'fa'
        ? `برای اضافه شدن بقیهٔ محصولات، پلن ${nextPlan} (تا ${nf.format(limit.recommendedLimit ?? 0)} محصول) را بگیرید؛ بعد از ارتقا خودکار همگام می‌شوند.`
        : `Take ${nextPlan} (up to ${nf.format(limit.recommendedLimit ?? 0)} products) to bring in the rest; they sync on their own after the upgrade.`
      : locale === 'fa'
        ? 'هیچ پلنی همهٔ محصولات این فروشگاه را جا نمی‌دهد؛ برای ظرفیت بیشتر با پشتیبانی هماهنگ کنید.'
        : 'No plan holds this whole catalog; contact support for more capacity.'
    : nextPlan && limit.recommendedLimit
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
            <span className="rounded-full border border-amber-300 bg-white/70 px-2.5 py-1 text-[12px] font-bold">
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
          className="spatial-press inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-black px-4 text-xs font-bold text-white shadow-[var(--shadow-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
        >
          {limit.recommendedPlan
            ? locale === 'fa' ? `ارتقا به پلن ${nextPlan}` : `Upgrade to ${nextPlan}`
            : locale === 'fa' ? 'دیدن پلن‌های بالاتر' : 'View capacity options'}
          <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}

const PLAN_RANK: Record<Plan, number> = { TRIAL: 0, STARTER: 1, PRO: 2, BUSINESS: 3 }

/**
 * Several full allowances in one notice instead of one near-identical card
 * per resource: one title, a used/limit chip per resource, one upgrade
 * button (the smallest plan that fixes all of them).
 */
export function PlanLimitsNotice({
  limits,
  locale,
  syncContext = false,
  compact = false,
}: {
  limits: PlanLimitInfo[]
  locale: 'fa' | 'en'
  syncContext?: boolean
  compact?: boolean
}) {
  if (limits.length === 0) return null
  if (limits.length === 1) return <PlanLimitNotice limit={limits[0]} locale={locale} syncContext={syncContext} compact={compact} />

  const fa = locale === 'fa'
  const nf = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')
  const currentPlan = PLAN_LABELS[locale][limits[0].plan]
  const recommended = limits
    .map((limit) => limit.recommendedPlan)
    .filter((plan): plan is PaidPlan => plan !== null)
    .sort((a, b) => PLAN_RANK[b] - PLAN_RANK[a])[0] ?? null
  const nextPlan = recommended ? PLAN_LABELS[locale][recommended] : null
  const names = limits.map((limit) => RESOURCE_LABELS[locale][limit.resource])
  const joined = fa
    ? `${names.slice(0, -1).join('، ')} و ${names[names.length - 1]}`
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  const upgradeHref = recommended ? `/billing?plan=${recommended}#plan-${recommended}` : '/billing#vigent-plans'
  const storeGap = limits.find((limit) => limit.storeTotal != null && limit.storeTotal > limit.used) ?? null

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
          <h2 className="text-sm font-bold leading-6">
            {fa ? `ظرفیت ${joined} در پلن ${currentPlan} تکمیل شده است` : `Your ${currentPlan} plan is full for ${joined}s`}
          </h2>
          <p className="mt-1 text-xs leading-6 text-amber-900/85">
            {syncContext
              ? fa ? 'سایت وصل است و به‌روزرسانی‌ها ادامه دارد؛ فقط مورد تازه‌ای تا بیشتر شدن ظرفیت اضافه نمی‌شود.' : 'The site stays connected and updates continue; only new items wait for more capacity.'
              : fa ? 'موارد جدید تا افزایش ظرفیت اضافه نمی‌شوند.' : 'New items wait until capacity increases.'}
          </p>
          {storeGap && (
            <p className="mt-1 text-xs font-semibold leading-6 text-amber-950">
              {fa
                ? `فروشگاه شما ${nf.format(storeGap.storeTotal!)} محصول دارد و ${nf.format(storeGap.storeTotal! - storeGap.used)} محصول هنوز به ویجنت نیامده.`
                : `Your store has ${nf.format(storeGap.storeTotal!)} products; ${nf.format(storeGap.storeTotal! - storeGap.used)} have not been brought in yet.`}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {limits.map((limit) => (
              <span key={limit.resource} className="rounded-full border border-amber-300 bg-white/70 px-2.5 py-1 text-[12px] font-bold tabular-nums">
                {RESOURCE_LABELS[locale][limit.resource]} {nf.format(limit.used)}/{nf.format(limit.limit)}
              </span>
            ))}
          </div>
        </div>
        <Link
          href={upgradeHref}
          className="spatial-press inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-black px-4 text-xs font-bold text-white shadow-[var(--shadow-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
        >
          {nextPlan
            ? fa ? `ارتقا به پلن ${nextPlan}` : `Upgrade to ${nextPlan}`
            : fa ? 'دیدن پلن‌های بالاتر' : 'View capacity options'}
          <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}
