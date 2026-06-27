import { getTranslations, getLocale } from 'next-intl/server'
import { MessagesSquare, Cpu, Wallet, Sparkles } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { StatsCard } from '@/components/dashboard/stats-card'
import { formatDateTime } from '@/lib/format'

const PLAN_KEY: Record<string, string> = {
  TRIAL: 'planTrial',
  STARTER: 'planStarter',
  PRO: 'planPro',
  BUSINESS: 'planBusiness',
}

export default async function BillingPage() {
  const user = await requireUser()
  const t = await getTranslations('billing')
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
  const ws = user.workspaceId

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [workspace, subscription, convoCount, usage] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: ws },
      select: { plan: true, trialEndsAt: true },
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
      _sum: { promptTokens: true, completionTokens: true, cost: true },
    }),
  ])

  const nf = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US')
  const plan = workspace?.plan ?? 'TRIAL'
  const tokens =
    (usage._sum.promptTokens ?? 0) + (usage._sum.completionTokens ?? 0)
  const cost = usage._sum.cost ?? 0

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-light text-[var(--text-primary)]">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {t('subtitle')}
        </p>
      </div>

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
          <a
            href="/#pricing"
            className="rounded-xl bg-white px-5 py-2.5 text-sm font-medium text-black transition-transform hover:scale-[1.02]"
          >
            {t('upgrade')}
          </a>
        </div>
      </section>

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
          <StatsCard label={t('tokens')} value={nf.format(tokens)} icon={Cpu} />
          <StatsCard
            label={t('estCost')}
            value={`$${cost.toFixed(2)}`}
            icon={Wallet}
          />
        </div>
      </div>

      <p className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-muted)] p-4 text-xs leading-relaxed text-[var(--text-secondary)]">
        {t('byok')}
      </p>
    </div>
  )
}
