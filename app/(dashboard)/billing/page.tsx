import { getTranslations, getLocale } from 'next-intl/server'
import { MessagesSquare, Cpu, Wallet, Sparkles, Check } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { StatsCard } from '@/components/dashboard/stats-card'
import { PlanCheckout } from '@/components/dashboard/plan-checkout'
import { CreditTopup } from '@/components/dashboard/credit-topup'
import { MiniTrend } from '@/components/admin/mini-trend'
import { messagesDailyByWorkspace, chargesDailyByWorkspace } from '@/lib/dashboard/charts'
import { formatDateTime } from '@/lib/format'
import { getPlanDefs, PAID_PLANS } from '@/lib/billing/plans'
import { getMonthlyMessageCount } from '@/lib/billing/entitlements'

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

  const [workspace, subscription, convoCount, usage, messagesUsed, msgTrend7, chargeTrend7] =
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
      messagesDailyByWorkspace(ws, 7),
      chargesDailyByWorkspace(ws, 7),
    ])

  const nf = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US')
  const plan = workspace?.plan ?? 'TRIAL'
  const chargedIRR = usage._sum.chargedIRR ?? 0

  const defs = getPlanDefs()
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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-light text-[var(--text-primary)]">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {t('subtitle')}
        </p>
      </div>

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

      {/* Plan card */}
      <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-sm text-[var(--text-secondary)]">
              {t('currentPlan')}
            </span>
            <div className="mt-1 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[var(--text-primary)]" />
              <span className="text-2xl font-light text-[var(--text-primary)]">
                {t(PLAN_KEY[plan] ?? 'planTrial')}
              </span>
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              {subscription
                ? `${t('status')}: ${subscription.status} · ${t('renewsOn')} ${formatDateTime(subscription.currentPeriodEnd, locale)}`
                : workspace?.trialEndsAt
                  ? `${t('trialEnds')} ${formatDateTime(workspace.trialEndsAt, locale)}`
                  : t('noSubscription')}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 border-t border-[var(--border-subtle)] pt-5 sm:grid-cols-3">
          <div><p className="text-xs text-[var(--text-muted)]">{locale === 'fa' ? 'اعتبار قابل استفاده' : 'Available credit'}</p><p className="mt-1 text-lg font-medium text-[var(--text-primary)]">{nf.format((workspace?.aiCreditBalanceIRR ?? 0) / 10)} {locale === 'fa' ? 'تومان' : 'toman'}</p></div>
          <div><p className="text-xs text-[var(--text-muted)]">{locale === 'fa' ? 'پاسخ موفق این ماه' : 'Successful replies this month'}</p><p className="mt-1 text-lg font-medium text-[var(--text-primary)]">{nf.format(messagesUsed)}</p></div>
          <div><p className="text-xs text-[var(--text-muted)]">{locale === 'fa' ? 'در حال پردازش' : 'Currently reserved'}</p><p className="mt-1 text-lg font-medium text-[var(--text-primary)]">{nf.format((workspace?.aiCreditReservedIRR ?? 0) / 10)} {locale === 'fa' ? 'تومان' : 'toman'}</p></div>
        </div>
      </section>

      <CreditTopup locale={locale} />

      {/* Plans */}
      <div>
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
                className={`flex flex-col rounded-2xl border bg-[var(--bg-surface)] p-6 ${
                  highlight
                    ? 'border-[var(--text-primary)]'
                    : 'border-[var(--border-default)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-[var(--text-primary)]">
                    {t(PLAN_KEY[p])}
                  </h3>
                  {highlight && (
                    <span className="rounded-full bg-[var(--white)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--bg-base)]">
                      {t('popular')}
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-light text-[var(--text-primary)]">
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
                    {t('featAgents', { count: nf.format(def.maxAgents) })}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                    {t('featChannels')}
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
          <StatsCard label={locale === 'fa' ? 'هزینه پاسخ‌ها' : 'Reply cost'} value={`${nf.format(Math.round(chargedIRR / 10))} ${locale === 'fa' ? 'تومان' : 'toman'}`} icon={Cpu} />
          <StatsCard
            label={t('estCost')}
            value={`${nf.format(chargedIRR / 10)} ${locale === 'fa' ? 'تومان' : 'toman'}`}
            icon={Wallet}
          />
        </div>

        {/* ─── 7-day usage trends ─── */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MiniTrend
            label={locale === 'fa' ? 'پیام‌های ۷ روز' : 'Messages 7d'}
            value={msgTrend7.total}
            series={msgTrend7.series}
            color="#3b82f6"
            hint={locale === 'fa' ? 'روزانه' : 'daily'}
          />
          <MiniTrend
            label={locale === 'fa' ? 'هزینه ۷ روز' : 'Cost 7d'}
            value={Math.round(chargeTrend7.total / 10)}
            series={chargeTrend7.series.map((value) => Math.round(value / 10))}
            color="#f59e0b"
            hint={locale === 'fa' ? 'تومان روزانه' : 'toman / day'}
          />
        </div>
      </div>

      <p className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-muted)] p-4 text-xs leading-relaxed text-[var(--text-secondary)]">
        {t('usageBilling')}
      </p>
    </div>
  )
}
