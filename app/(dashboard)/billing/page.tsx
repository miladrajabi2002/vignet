import { getTranslations, getLocale } from 'next-intl/server'
import { Cpu, Wallet, Check, Sparkles, CircleAlert, RefreshCw } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { StatsCard } from '@/components/dashboard/stats-card'
import { PlanCheckout } from '@/components/dashboard/plan-checkout'
import { CreditTopup } from '@/components/dashboard/credit-topup'
import { formatDateTime } from '@/lib/format'
import { formatLocalizedDate } from '@/lib/localized-date'
import { getEffectivePlanDefs, getEffectivePlanReplyPricesIRR, isPaidPlan, PAID_PLANS, PERIOD_DAYS } from '@/lib/billing/plans'
import { estimateRemainingReplies } from '@/lib/billing/credit-estimates'
import { AGENT_MODELS } from '@/lib/ai/models'
import { cn } from '@/lib/utils'
import { getActiveChannelConnectionCount, getMonthlyMessageCount } from '@/lib/billing/entitlements'
import { PageHeader } from '@/components/dashboard/page-header'
import { CreditFlowMotion } from '@/components/motion/explainers'

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

  const [workspace, subscription, usage, messagesUsed, payments, channelsUsed, productsUsed, ordersUsed, customersUsed] =
    await Promise.all([
      prisma.workspace.findUnique({
        where: { id: ws },
        select: { plan: true, trialEndsAt: true, aiCreditBalanceIRR: true, aiCreditReservedIRR: true },
      }),
      prisma.subscription.findUnique({
        where: { workspaceId: ws },
        select: { status: true, currentPeriodEnd: true },
      }),
      prisma.usageLog.aggregate({
        where: { workspaceId: ws, date: { gte: monthStart } },
        _sum: { promptTokens: true, completionTokens: true, cost: true, chargedIRR: true },
      }),
      getMonthlyMessageCount(ws),
      // Abandoned checkouts stay PENDING forever; they are not payments.
      prisma.payment.findMany({
        where: { workspaceId: ws, status: { not: 'PENDING' } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, gateway: true, plan: true, kind: true, amount: true, currency: true, status: true, createdAt: true, paidAt: true },
      }),
      getActiveChannelConnectionCount(ws),
      prisma.product.count({ where: { workspaceId: ws } }),
      prisma.storeOrder.count({ where: { workspaceId: ws } }),
      prisma.contact.count({ where: { workspaceId: ws } }),
    ])

  const nf = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US')
  const plan = workspace?.plan ?? 'TRIAL'
  const chargedIRR = usage._sum.chargedIRR ?? 0
  const balanceIRR = workspace?.aiCreditBalanceIRR ?? 0
  const reservedIRR = workspace?.aiCreditReservedIRR ?? 0
  const toman = locale === 'fa' ? 'تومان' : 'toman'

  const defs = await getEffectivePlanDefs()
  const replyPricesIRR = await getEffectivePlanReplyPricesIRR(plan)
  const trialExpired =
    plan === 'TRIAL' &&
    !!workspace?.trialEndsAt &&
    workspace.trialEndsAt < new Date()

  const paymentStatus = searchParams?.payment
  const requestedPlan = searchParams?.plan && isPaidPlan(searchParams.plan)
    ? searchParams.plan
    : null
  const checkoutLabels = {
    rial: t('payRial'),
    crypto: t('payCrypto'),
    error: t('paymentError'),
  }
  const now = new Date()
  const subscriptionLive = !!subscription && subscription.status === 'ACTIVE' && subscription.currentPeriodEnd > now
  const periodEnd = subscription?.currentPeriodEnd ?? workspace?.trialEndsAt ?? null
  const daysLeft = periodEnd ? Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / 86_400_000)) : 0
  const planStatus: { label: string; tone: Tone } = subscription
    ? subscriptionLive
      ? { label: locale === 'fa' ? 'فعال' : 'Active', tone: 'ok' }
      : subscription.status === 'CANCELLED'
        ? { label: locale === 'fa' ? 'لغوشده' : 'Cancelled', tone: 'warn' }
        : subscription.status === 'PAST_DUE'
          ? { label: locale === 'fa' ? 'نیازمند پرداخت' : 'Past due', tone: 'warn' }
          : { label: locale === 'fa' ? 'منقضی‌شده' : 'Expired', tone: 'danger' }
    : trialExpired
      ? { label: locale === 'fa' ? 'پایان‌یافته' : 'Ended', tone: 'danger' }
      : { label: locale === 'fa' ? 'دورهٔ آزمایشی' : 'Trial', tone: 'neutral' }

  const currentDef = defs[plan]
  const capacity = [
    { label: locale === 'fa' ? 'اتصال برنامهٔ فعال' : 'Active channel connections', used: channelsUsed, limit: currentDef.maxChannels },
    { label: locale === 'fa' ? 'محصول' : 'Products', used: productsUsed, limit: currentDef.maxProducts },
    { label: locale === 'fa' ? 'سفارش' : 'Orders', used: ordersUsed, limit: currentDef.maxOrders },
    { label: locale === 'fa' ? 'مشتری' : 'Customers', used: customersUsed, limit: currentDef.maxCustomers },
  ]
  const replyTiers = AGENT_MODELS.map((model) => ({
    id: model.id,
    name: locale === 'fa' ? model.name : model.nameEn,
    priceIRR: replyPricesIRR[model.id],
    replies: estimateRemainingReplies(balanceIRR, replyPricesIRR[model.id]),
  }))

  const paymentRows = payments.map((payment) => ({
    id: payment.id,
    date: formatDateTime(payment.paidAt ?? payment.createdAt, locale),
    title: payment.kind === 'AI_CREDIT'
      ? (locale === 'fa' ? 'افزایش اعتبار هوش مصنوعی' : 'AI credit top-up')
      : `${locale === 'fa' ? 'اشتراک' : 'Subscription'} ${payment.plan ? t(PLAN_KEY[payment.plan] ?? 'planTrial') : ''}`.trim(),
    amount: payment.currency === 'USD'
      ? `$${nf.format(payment.amount)}`
      : `${nf.format(payment.amount / 10)} ${toman}`,
    gateway: payment.gateway === 'ZARINPAY'
      ? (locale === 'fa' ? 'زرین‌پی' : 'ZarinPay')
      : (locale === 'fa' ? 'ارز دیجیتال' : 'Crypto'),
    status: PAYMENT_STATUS[payment.status]?.[locale] ?? payment.status,
    tone: PAYMENT_STATUS[payment.status]?.tone ?? 'neutral',
  }))

  const creditRules = [
    {
      icon: Sparkles,
      title: locale === 'fa' ? 'پاسخ موفق هوش مصنوعی' : 'Successful AI request',
      desc: locale === 'fa' ? 'پاسخ، تحلیل گفتگو یا تست پاسخ' : 'Reply, conversation analysis, or response test',
      result: locale === 'fa' ? 'کسر به قیمت مدل انتخابی' : 'Charged at the selected model price',
      tone: 'neutral' as Tone,
    },
    {
      icon: Check,
      title: locale === 'fa' ? 'اتوماسیون اینستاگرام' : 'Instagram automation',
      desc: locale === 'fa' ? 'پاسخ ثابت، کلیدواژه، کامنت و سناریوهای بدون AI' : 'Static replies, keywords, comments and non-AI scenarios',
      result: locale === 'fa' ? 'رایگان · بدون محدودیت سناریو' : 'Free · unlimited scenarios',
      tone: 'ok' as Tone,
    },
    {
      icon: RefreshCw,
      title: locale === 'fa' ? 'درخواست ناموفق' : 'Failed request',
      desc: locale === 'fa' ? 'پاسخی ساخته نشد' : 'No reply was produced',
      result: locale === 'fa' ? 'بدون هزینه · رزرو برمی‌گردد' : 'No charge · hold released',
      tone: 'ok' as Tone,
    },
  ]

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

      {/* Status first: what the workspace has (plan) and what it can spend
          (credit), each with its own action right inside the card. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <section className="spatial-surface flex flex-col rounded-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-medium text-[var(--text-muted)]">{t('currentPlan')}</h2>
            <StatusPill tone={planStatus.tone}>{planStatus.label}</StatusPill>
          </div>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{t(PLAN_KEY[plan] ?? 'planTrial')}</p>
          {periodEnd ? (
            <>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
                <span>{subscription ? t('renewsOn') : t('trialEnds')} {formatLocalizedDate(periodEnd, locale)}</span>
                <span className="tabular-nums">
                  {locale === 'fa' ? `${nf.format(daysLeft)} روز مانده` : `${nf.format(daysLeft)} days left`}
                </span>
              </div>
              {subscription && <Meter className="mt-2" ratio={daysLeft / PERIOD_DAYS} />}
            </>
          ) : (
            <p className="mt-2 text-xs text-[var(--text-secondary)]">{t('noSubscription')}</p>
          )}

          <div className="mt-4 grid gap-3 border-t border-[var(--border-subtle)] pt-4">
            {capacity.map((item) => {
              const ratio = item.limit > 0 ? item.used / item.limit : 1
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-[var(--text-secondary)]">{item.label}</span>
                    <span className="tabular-nums text-[var(--text-muted)]">
                      {locale === 'fa'
                        ? `${nf.format(item.used)} از ${nf.format(item.limit)}`
                        : `${nf.format(item.used)} of ${nf.format(item.limit)}`}
                    </span>
                  </div>
                  <Meter className="mt-1.5" ratio={ratio} warnWhenFull />
                </div>
              )
            })}
          </div>

          <div className="mt-auto pt-5">
            <a href="#vigent-plans" className="spatial-press inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--text-primary)] px-5 text-sm font-bold text-[var(--bg-elevated)]">
              {locale === 'fa'
                ? (subscription ? 'تمدید یا تغییر پلن' : 'انتخاب پلن')
                : (subscription ? 'Renew or change plan' : 'Choose a plan')}
            </a>
          </div>
        </section>

        <section className="spatial-surface rounded-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-medium text-[var(--text-muted)]">{locale === 'fa' ? 'اعتبار هوش مصنوعی' : 'AI credit'}</h2>
            <span className="text-xs text-[var(--text-muted)]">{locale === 'fa' ? 'منقضی نمی‌شود' : 'Never expires'}</span>
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
            {nf.format(balanceIRR / 10)} <span className="text-xs font-normal text-[var(--text-muted)]">{toman}</span>
          </p>
          {reservedIRR > 0 && (
            <p className="mt-1 text-xs tabular-nums text-[var(--text-secondary)]">
              {locale === 'fa'
                ? `${nf.format(reservedIRR / 10)} تومان در حال پردازش`
                : `${nf.format(reservedIRR / 10)} toman currently reserved`}
            </p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {replyTiers.map((tier) => (
              <div key={tier.id} className="min-w-0 rounded-xl bg-[var(--bg-muted)] px-3 py-2.5">
                <p className="text-sm font-bold tabular-nums text-[var(--text-primary)]">
                  ≈ {nf.format(tier.replies)} {locale === 'fa' ? 'پاسخ' : 'replies'}
                </p>
                <p className="mt-0.5 text-[12px] leading-5 text-[var(--text-secondary)]">
                  {tier.name} · <span className="tabular-nums">{nf.format(tier.priceIRR / 10)} {toman}</span>
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
            <CreditTopup locale={locale} />
          </div>
        </section>
      </div>

      {/* Usage */}
      <div>
        <h2 className="mb-3 text-sm font-bold text-[var(--text-primary)]">
          {t('usageThisMonth')}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatsCard label={locale === 'fa' ? 'پاسخ موفق هوش مصنوعی' : 'Successful AI replies'} value={nf.format(messagesUsed)} icon={Cpu} />
          <StatsCard
            label={locale === 'fa' ? 'اعتبار مصرف‌شده' : 'Credit charged'}
            value={nf.format(chargedIRR / 10)}
            unit={toman}
            icon={Wallet}
          />
        </div>
      </div>

      {/* Plans: each card lists only what differs; shared features sit once below. */}
      <div id="vigent-plans" className="scroll-mt-24">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">{t('plans')}</h2>
          <span className="text-xs text-[var(--text-muted)]">
            {locale === 'fa' ? `هر پرداخت ${nf.format(PERIOD_DAYS)} روز اشتراک` : `Each payment covers ${nf.format(PERIOD_DAYS)} days`}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PAID_PLANS.map((p) => {
            const def = defs[p]
            const isRecommended = requestedPlan === p
            const isCurrent = plan === p && subscriptionLive
            const limits = [
              { label: locale === 'fa' ? 'اتصال برنامهٔ فعال' : 'Active channel connections', value: nf.format(def.maxChannels) },
              { label: locale === 'fa' ? 'محصول' : 'Products', value: nf.format(def.maxProducts) },
              { label: locale === 'fa' ? 'سفارش' : 'Orders', value: nf.format(def.maxOrders) },
              { label: locale === 'fa' ? 'مشتری' : 'Customers', value: nf.format(def.maxCustomers) },
              { label: locale === 'fa' ? 'اعتبار هدیهٔ اولین خرید' : 'Gift credit on first purchase', value: `${nf.format(def.includedCreditIRR / 10)} ${toman}` },
            ]
            return (
              <section
                key={p}
                id={`plan-${p}`}
                className={cn(
                  'spatial-surface relative flex scroll-mt-24 flex-col rounded-card p-5',
                  isCurrent && 'border-[var(--text-primary)] ring-1 ring-[var(--text-primary)]',
                  isRecommended && 'border-amber-400 ring-2 ring-amber-300/60',
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-[var(--text-secondary)]">
                    {t(PLAN_KEY[p])}
                  </h3>
                  {isCurrent && <StatusPill tone="ok">{t('currentPlanBadge')}</StatusPill>}
                  {isRecommended && !isCurrent && (
                    <StatusPill tone="warn">{locale === 'fa' ? 'پیشنهاد متناسب با ظرفیت شما' : 'Recommended for your capacity'}</StatusPill>
                  )}
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">
                    {nf.format(def.priceIRR / 10)}
                  </span>
                  <span className="ms-1 text-xs text-[var(--text-muted)]">
                    {t('tomanPerMonth')}
                  </span>
                </div>
                <dl className="mt-4 flex-1 text-sm">
                  {limits.map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] py-2">
                      <dt className="text-[var(--text-secondary)]">{item.label}</dt>
                      <dd className="font-bold tabular-nums text-[var(--text-primary)]">{item.value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4">
                  <PlanCheckout
                    plan={p}
                    emphasis={isCurrent || isRecommended}
                    labels={{
                      ...checkoutLabels,
                      rial: isCurrent
                        ? (locale === 'fa' ? `تمدید ${nf.format(PERIOD_DAYS)} روزه` : `Renew for ${nf.format(PERIOD_DAYS)} days`)
                        : checkoutLabels.rial,
                      crypto: `${checkoutLabels.crypto} · ≈ $${def.priceUSD}`,
                    }}
                  />
                </div>
              </section>
            )
          })}
        </div>
        <p className="mt-3 rounded-xl border border-dashed border-[var(--border-hover)] bg-[var(--bg-elevated)] px-4 py-3 text-xs leading-6 text-[var(--text-secondary)]">
          <strong className="font-bold text-[var(--text-primary)]">{locale === 'fa' ? 'در همهٔ پلن‌ها: ' : 'In every plan: '}</strong>
          {[
            t('featChannels'),
            t('featUnlimitedAgents'),
            locale === 'fa' ? 'تعرفهٔ ثابت پاسخ' : 'Same reply price',
            locale === 'fa' ? 'بدون بسته یا تعهد تعداد پیام' : 'No message packs or volume commitment',
          ].join(' · ')}
        </p>
      </div>

      {/* Recent payments: table on desktop, one card per payment on phones. */}
      <div>
        <h2 className="mb-3 text-sm font-bold text-[var(--text-primary)]">
          {locale === 'fa' ? 'پرداخت‌های اخیر' : 'Recent payments'}
        </h2>
        {paymentRows.length === 0 ? (
          <p className="spatial-surface rounded-card p-5 text-sm text-[var(--text-secondary)]">
            {locale === 'fa' ? 'هنوز پرداختی ثبت نشده است. اولین خرید اشتراک یا اعتبار همین‌جا دیده می‌شود.' : 'No payments yet. Your first plan or credit purchase will appear here.'}
          </p>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {paymentRows.map((row) => (
                <article key={row.id} className="spatial-surface rounded-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="min-w-0 text-[15px] font-bold text-[var(--text-primary)]">{row.title}</h3>
                    <StatusPill tone={row.tone}>{row.status}</StatusPill>
                  </div>
                  <p className="mt-2 text-lg font-bold tabular-nums text-[var(--text-primary)]">{row.amount}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-[var(--border-subtle)] pt-2.5 text-xs text-[var(--text-muted)]">
                    <span className="tabular-nums">{row.date}</span>
                    <span>{row.gateway}</span>
                  </div>
                </article>
              ))}
            </div>
            <div className="spatial-surface hidden overflow-x-auto rounded-card md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-start text-xs font-medium text-[var(--text-muted)]">
                    <th className="px-5 py-3 text-start font-medium">{locale === 'fa' ? 'تاریخ' : 'Date'}</th>
                    <th className="px-5 py-3 text-start font-medium">{locale === 'fa' ? 'شرح' : 'Description'}</th>
                    <th className="px-5 py-3 text-start font-medium">{locale === 'fa' ? 'مبلغ' : 'Amount'}</th>
                    <th className="px-5 py-3 text-start font-medium">{locale === 'fa' ? 'روش پرداخت' : 'Method'}</th>
                    <th className="px-5 py-3 text-start font-medium">{locale === 'fa' ? 'وضعیت' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentRows.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--border-subtle)] last:border-b-0">
                      <td className="whitespace-nowrap px-5 py-3 tabular-nums text-[var(--text-secondary)]">{row.date}</td>
                      <td className="px-5 py-3 font-medium text-[var(--text-primary)]">{row.title}</td>
                      <td className="whitespace-nowrap px-5 py-3 font-bold tabular-nums text-[var(--text-primary)]">{row.amount}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-[var(--text-secondary)]">{row.gateway}</td>
                      <td className="px-5 py-3"><StatusPill tone={row.tone}>{row.status}</StatusPill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* The credit rule, told and shown: the three cases on one side, the
          same three playing out in motion on the other. */}
      <div>
        <h2 className="mb-3 text-sm font-bold text-[var(--text-primary)]">
          {locale === 'fa' ? 'اعتبار چطور مصرف می‌شود؟' : 'How is credit used?'}
        </h2>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)]">
          <section className="spatial-surface flex flex-col gap-3 rounded-card p-4 sm:p-5">
            {creditRules.map((rule) => (
              <div key={rule.title} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border border-[var(--border-subtle)] p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--bg-muted)] text-[var(--text-primary)]">
                    <rule.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">{rule.title}</h3>
                    <p className="text-xs leading-5 text-[var(--text-secondary)]">{rule.desc}</p>
                  </div>
                </div>
                <StatusPill tone={rule.tone}>{rule.result}</StatusPill>
              </div>
            ))}
            <p className="mt-auto flex items-start gap-2 text-xs leading-6 text-[var(--text-secondary)]">
              <CircleAlert className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
              {t('usageBilling')}
            </p>
          </section>
          <CreditFlowMotion locale={locale} />
        </div>
      </div>
    </div>
  )
}

type Tone = 'ok' | 'warn' | 'danger' | 'neutral'

const PAYMENT_STATUS: Record<string, { fa: string; en: string; tone: Tone }> = {
  PAID: { fa: 'موفق', en: 'Paid', tone: 'ok' },
  FAILED: { fa: 'ناموفق', en: 'Failed', tone: 'danger' },
  EXPIRED: { fa: 'منقضی‌شده', en: 'Expired', tone: 'neutral' },
}

const TONE_CLASS: Record<Tone, string> = {
  ok: 'bg-[var(--ok-soft)] text-[var(--ok-ink)]',
  warn: 'bg-[var(--warn-soft)] text-[var(--warn-ink)]',
  danger: 'bg-[var(--danger-soft)] text-[var(--danger-ink)]',
  neutral: 'bg-[var(--bg-muted)] text-[var(--text-secondary)]',
}

function StatusPill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex min-h-6 shrink-0 items-center rounded-full px-2.5 text-[12px] font-bold', TONE_CLASS[tone])}>
      {children}
    </span>
  )
}

/** Thin progress bar. With `warnWhenFull` it turns amber from 80% and a deeper amber at the cap: a full allowance is a limit, not an error. */
function Meter({ ratio, warnWhenFull, className }: { ratio: number; warnWhenFull?: boolean; className?: string }) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0))
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-[var(--bg-muted)]', className)}>
      <div
        className={cn(
          'h-full rounded-full bg-[var(--text-primary)]',
          warnWhenFull && clamped >= 0.8 && 'bg-amber-500',
          warnWhenFull && clamped >= 1 && 'bg-amber-600',
        )}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  )
}
