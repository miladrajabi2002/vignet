import { getTranslations, getLocale } from 'next-intl/server'
import { MessagesSquare, Cpu, Wallet, Sparkles, Check, Zap, CalendarCheck2, Clock3 } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { StatsCard } from '@/components/dashboard/stats-card'
import { PlanCheckout } from '@/components/dashboard/plan-checkout'
import { CreditTopup } from '@/components/dashboard/credit-topup'
import { ReplyCreditEstimator } from '@/components/dashboard/reply-credit-estimator'
import { formatDateTime } from '@/lib/format'
import { getEffectivePlanDefs, getEffectivePlanReplyPricesIRR, PAID_PLANS } from '@/lib/billing/plans'
import { getMonthlyMessageCount } from '@/lib/billing/entitlements'
import { PageHeader } from '@/components/dashboard/page-header'

const PLAN_KEY: Record<string, string> = {
  TRIAL: 'planTrial',
  STARTER: 'planStarter',
  PRO: 'planPro',
  BUSINESS: 'planBusiness',
}

export default async function BillingPage(
  props: {
    searchParams?: Promise<{ payment?: string; plan?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const user = await requireUser()
  const t = await getTranslations('billing')
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
  const ws = user.workspaceId

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [workspace, subscription, convoCount, usage, messagesUsed, bookingCount] =
    await Promise.all([
      prisma.workspace.findUnique({
        where: { id: ws },
        select: { plan: true, trialEndsAt: true, aiCreditBalanceIRR: true, aiCreditReservedIRR: true },
      }),
      prisma.subscription.findUnique({
        where: { workspaceId: ws },
        select: { status: true, currentPeriodEnd: true },
      }),
      prisma.conversation.count({
        where: { workspaceId: ws, createdAt: { gte: monthStart } },
      }),
      prisma.usageLog.aggregate({
        where: { workspaceId: ws, date: { gte: monthStart } },
        _sum: { promptTokens: true, completionTokens: true, cost: true, chargedIRR: true },
      }),
      getMonthlyMessageCount(ws),
      prisma.appointment.count({
        where: { workspaceId: ws, createdAt: { gte: monthStart } },
      }),
    ])

  const nf = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US')
  const plan = workspace?.plan ?? 'TRIAL'
  const chargedIRR = usage._sum.chargedIRR ?? 0
  const estimatedMinutesSaved = messagesUsed * 2

  const defs = await getEffectivePlanDefs()
  const replyPricesIRR = await getEffectivePlanReplyPricesIRR(plan)
  const trialExpired =
    plan === 'TRIAL' &&
    !!workspace?.trialEndsAt &&
    workspace.trialEndsAt < new Date()

  const paymentStatus = searchParams?.payment
  const preferredPlan = PAID_PLANS.find((item) => item === searchParams?.plan)
  const checkoutLabels = {
    rial: t('payRial'),
    crypto: t('payCrypto'),
    error: t('paymentError'),
  }
  const subscriptionStatus = subscription
    ? locale === 'fa'
      ? ({ ACTIVE: 'فعال', CANCELLED: 'لغوشده', PAST_DUE: 'نیازمند پرداخت' } as const)[subscription.status]
      : subscription.status.charAt(0) + subscription.status.slice(1).toLowerCase().replace('_', ' ')
    : ''

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        icon={Wallet}
        title={t('title')}
        subtitle={t('subtitle')}
      />

      {/* Payment result banner (after gateway redirect) */}
      {paymentStatus === 'success' && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-600">
          {t('paymentSuccess')}
        </div>
      )}
      {(paymentStatus === 'failed' || paymentStatus === 'cancelled') && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">
          {paymentStatus === 'failed' ? t('paymentFailed') : t('paymentCancelled')}
        </div>
      )}
      {trialExpired && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-600">
          {t('trialExpiredNotice')}
        </div>
      )}

      <section className="spatial-surface flex flex-col gap-4 rounded-[1.5rem] p-4 sm:flex-row sm:items-center sm:p-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-black text-white shadow-[var(--shadow-control)]">
          <Zap className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">
            {locale === 'fa' ? 'اتوماسیون اینستاگرام رایگان است' : 'Instagram automation is free'}
          </h2>
          <p className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">
            {locale === 'fa'
              ? 'پاسخ‌های ثابت، کلیدواژه‌ها، کامنت و سناریوهای بدون AI هزینه‌ای ندارند. فقط وقتی ایجنت هوش مصنوعی پاسخ موفق می‌دهد، از اعتبار پاسخ کم می‌شود.'
              : 'Static replies, keywords, comments and non-AI scenarios cost nothing. Credit is deducted only when the AI agent returns a successful reply.'}
          </p>
        </div>
        <span className="inline-flex min-h-9 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-[11px] font-bold text-[var(--text-primary)]">
          {locale === 'fa' ? 'بدون محدودیت سناریو' : 'Unlimited scenarios'}
        </span>
      </section>

      {/* Plan card */}
      <section className="spatial-surface rounded-[1.5rem] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-sm text-[var(--text-secondary)]">
              {t('currentPlan')}
            </span>
            <div className="mt-1 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[var(--text-primary)]" />
              <span className="text-lg font-bold text-[var(--text-primary)]">
                {t(PLAN_KEY[plan] ?? 'planTrial')}
              </span>
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              {subscription
                ? `${t('status')}: ${subscriptionStatus} · ${t('renewsOn')} ${formatDateTime(subscription.currentPeriodEnd, locale)}`
                : workspace?.trialEndsAt
                  ? `${t('trialEnds')} ${formatDateTime(workspace.trialEndsAt, locale)}`
                  : t('noSubscription')}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 border-t border-[var(--border-subtle)] pt-4 sm:grid-cols-3">
          <div className="rounded-xl bg-[var(--bg-muted)] p-3">
            <p className="text-[11px] font-medium text-[var(--text-muted)]">{locale === 'fa' ? 'اعتبار قابل استفاده' : 'Available credit'}</p>
            <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{nf.format((workspace?.aiCreditBalanceIRR ?? 0) / 10)} <span className="text-xs font-normal text-[var(--text-muted)]">{locale === 'fa' ? 'تومان' : 'toman'}</span></p>
          </div>
          <div className="rounded-xl bg-[var(--bg-muted)] p-3">
            <p className="text-[11px] font-medium text-[var(--text-muted)]">{locale === 'fa' ? 'پاسخ موفق این ماه' : 'Successful replies this month'}</p>
            <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{nf.format(messagesUsed)}</p>
          </div>
          <div className="rounded-xl bg-[var(--bg-muted)] p-3">
            <p className="text-[11px] font-medium text-[var(--text-muted)]">{locale === 'fa' ? 'در حال پردازش' : 'Currently reserved'}</p>
            <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{nf.format((workspace?.aiCreditReservedIRR ?? 0) / 10)} <span className="text-xs font-normal text-[var(--text-muted)]">{locale === 'fa' ? 'تومان' : 'toman'}</span></p>
          </div>
        </div>
      </section>

      {(messagesUsed > 0 || convoCount > 0 || bookingCount > 0) && (
        <section className="dashboard-intro relative overflow-hidden rounded-[1.5rem] border border-[var(--border-default)] p-5 shadow-[var(--shadow-card)] sm:p-6">
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-[var(--border-default)] bg-white px-3 text-xs font-semibold text-[var(--text-secondary)]">
                <Sparkles className="h-3.5 w-3.5" />
                {locale === 'fa' ? 'ارزش ایجادشده این ماه' : 'Value created this month'}
              </span>
              <h2 className="mt-4 text-xl font-bold text-[var(--text-primary)]">
                {locale === 'fa' ? 'قبل از انتخاب پلن، خروجی واقعی ویجنت را ببینید' : 'See Vigent’s actual output before choosing a plan'}
              </h2>
              <p className="mt-2 text-xs leading-7 text-[var(--text-secondary)]">
                {locale === 'fa'
                  ? `برآورد زمان ذخیره‌شده با فرض محافظه‌کارانهٔ ۲ دقیقه برای هر پاسخ موفق محاسبه شده و شامل ارزش فروش یا رزرو نیست.`
                  : 'Estimated time saved uses a conservative two minutes per successful reply and excludes the value of sales or bookings.'}
              </p>
            </div>
            <a href="#vigent-plans" className="spatial-press inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-black px-5 text-xs font-bold text-white">
              {locale === 'fa' ? (plan === 'TRIAL' ? 'فعال‌سازی پلن مناسب' : 'بررسی ارتقا') : (plan === 'TRIAL' ? 'Activate the right plan' : 'Review upgrade')}
            </a>
          </div>
          <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
            <ValueMetric icon={MessagesSquare} label={locale === 'fa' ? 'گفتگوهای این ماه' : 'Conversations this month'} value={nf.format(convoCount)} />
            <ValueMetric icon={CalendarCheck2} label={locale === 'fa' ? 'رزروهای ثبت‌شده' : 'Bookings created'} value={nf.format(bookingCount)} />
            <ValueMetric icon={Clock3} label={locale === 'fa' ? 'زمان تقریبی ذخیره‌شده' : 'Estimated time saved'} value={locale === 'fa' ? `${nf.format(Math.round(estimatedMinutesSaved / 60))} ساعت` : `${nf.format(Math.round(estimatedMinutesSaved / 60))} hours`} />
          </div>
        </section>
      )}

      <ReplyCreditEstimator
        balanceIRR={workspace?.aiCreditBalanceIRR ?? 0}
        pricesIRR={replyPricesIRR}
        locale={locale}
      />

      <CreditTopup locale={locale} />

      {/* Plans */}
      <div id="vigent-plans" className="scroll-mt-24">
        <h2 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">
          {t('plans')}
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PAID_PLANS.map((p) => {
            const def = defs[p]
            const isCurrent =
              plan === p &&
              subscription?.status === 'ACTIVE' &&
              subscription.currentPeriodEnd > new Date()
            const highlight = preferredPlan ? p === preferredPlan : p === 'PRO'
            return (
              <section
                key={p}
                className={`spatial-surface relative flex flex-col rounded-[1.5rem] p-5 ${
                  highlight
                    ? 'ring-2 ring-[var(--text-primary)]'
                    : ''
                }`}
              >
                {highlight && (
                  <span className="absolute -top-2.5 end-5 rounded-full bg-[var(--text-primary)] px-3 py-0.5 text-[11px] font-bold text-[var(--bg-base)] shadow-sm">
                    {t('popular')}
                  </span>
                )}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">
                    {t(PLAN_KEY[p])}
                  </h3>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-bold text-[var(--text-primary)]">
                    {nf.format(def.priceIRR / 10)}
                  </span>
                  <span className="ms-1 text-xs text-[var(--text-muted)]">
                    {t('tomanPerMonth')}
                  </span>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    ≈ ${def.priceUSD} {t('cryptoPerMonth')}
                  </p>
                </div>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-[var(--text-secondary)]">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                    {locale === 'fa' ? 'بدون بسته یا تعهد تعداد پیام' : 'No message packs or volume commitment'}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                    {locale === 'fa'
                      ? `${nf.format(def.includedCreditIRR / 10)} تومان اعتبار هدیه در هر پرداخت موفق`
                      : `${nf.format(def.includedCreditIRR / 10)} toman included credit per successful payment`}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                    {t('featChannelLimit', { count: nf.format(def.maxChannels) })}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                    {t('featChannels')}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                    {t('featUnlimitedAgents')}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                    {locale === 'fa'
                      ? `${nf.format(def.replyDiscountBps / 100)}٪ تخفیف هزینهٔ هر پاسخ`
                      : `${nf.format(def.replyDiscountBps / 100)}% off each reply`}
                  </li>
                </ul>
                <div className="mt-5">
                  {isCurrent ? (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-center text-sm text-emerald-600">
                      {t('currentPlanBadge')}
                    </div>
                  ) : (
                    <PlanCheckout plan={p} labels={checkoutLabels} />
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </div>

      {/* Usage */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">
          {t('usageThisMonth')}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatsCard
            label={t('conversations')}
            value={nf.format(convoCount)}
            icon={MessagesSquare}
          />
          <StatsCard label={locale === 'fa' ? 'پاسخ موفق هوش مصنوعی' : 'Successful AI replies'} value={nf.format(messagesUsed)} icon={Cpu} />
          <StatsCard
            label={locale === 'fa' ? 'اعتبار مصرف‌شده' : 'Credit charged'}
            value={`${nf.format(chargedIRR / 10)} ${locale === 'fa' ? 'تومان' : 'toman'}`}
            icon={Wallet}
          />
        </div>

      </div>

      <p className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-muted)] p-4 text-xs leading-relaxed text-[var(--text-secondary)]">
        {t('usageBilling')}
      </p>
    </div>
  )
}

function ValueMetric({ icon: Icon, label, value }: { icon: typeof MessagesSquare; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-white/90 p-4 shadow-[var(--shadow-xs)]">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--bg-surface)] text-[var(--text-primary)]"><Icon className="h-4 w-4" /></span>
      <p className="mt-3 text-xs text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-[var(--text-primary)]">{value}</p>
    </div>
  )
}
