import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import {
  Building2,
  Users,
  Bot,
  MessageSquare,
  Wallet,
  FileText,
  Package,
  ArrowLeft,
} from 'lucide-react'
import {
  PageHeader,
  Panel,
  StatCard,
  Badge,
  EmptyState,
  SectionLabel,
  KV,
  Avatar,
  Card,
  fmtDay,
  fmtIRR,
  fmtUSD,
  fa,
} from '../../ui'

export const dynamic = 'force-dynamic'

// ─── BADGE LOOKUPS ────────────────────────────────────────────────

type BadgeTone = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted'

const PLAN_BADGE: Record<string, { tone: BadgeTone; label: string }> = {
  TRIAL: { tone: 'muted', label: 'آزمایشی' },
  STARTER: { tone: 'info', label: 'استارتر' },
  PRO: { tone: 'success', label: 'حرفه‌ای' },
  BUSINESS: { tone: 'default', label: 'سازمانی' },
}

const ROLE_BADGE: Record<string, { tone: BadgeTone; label: string }> = {
  OWNER: { tone: 'default', label: 'مدیر' },
  ADMIN: { tone: 'info', label: 'ادمین' },
  MEMBER: { tone: 'muted', label: 'عضو' },
}

const PAYMENT_STATUS_BADGE: Record<string, { tone: BadgeTone; label: string }> = {
  PAID: { tone: 'success', label: 'پرداخت‌شده' },
  PENDING: { tone: 'warning', label: 'در انتظار' },
  FAILED: { tone: 'danger', label: 'ناموفق' },
  EXPIRED: { tone: 'muted', label: 'منقضی' },
}

const GATEWAY_BADGE: Record<string, { tone: BadgeTone; label: string }> = {
  ZARINPAY: { tone: 'info', label: 'زرین‌پال' },
  NOWPAYMENTS: { tone: 'default', label: 'کریپتو' },
}

function PlanBadge({ plan, kind }: { plan: string | null; kind?: string }) {
  if (kind === 'AI_CREDIT' || !plan) {
    return <Badge tone="info">اعتبار هوش مصنوعی</Badge>
  }
  const cfg = PLAN_BADGE[plan] ?? { tone: 'muted' as BadgeTone, label: plan }
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>
}

function RoleBadge({ role }: { role: string }) {
  const cfg = ROLE_BADGE[role] ?? { tone: 'muted' as BadgeTone, label: role }
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>
}

function PaymentStatusBadge({ status }: { status: string }) {
  const cfg = PAYMENT_STATUS_BADGE[status] ?? { tone: 'muted' as BadgeTone, label: status }
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>
}

function GatewayBadge({ gateway }: { gateway: string }) {
  const cfg = GATEWAY_BADGE[gateway] ?? { tone: 'muted' as BadgeTone, label: gateway }
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>
}

// ─── PAGE ─────────────────────────────────────────────────────────

export default async function AdminWorkspaceDetailPage(
  props: {
    params: Promise<{ workspaceId: string }>
  }
) {
  const params = await props.params
  const { workspaceId } = params

  // 30-day rolling window for usage stats.
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [wsNullable, revenueAgg, recentPayments, members, agents, usageAgg] =
    await Promise.all([
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: {
          _count: {
            select: {
              users: true,
              agents: true,
              conversations: true,
              payments: true,
              products: true,
              blogPosts: true,
            },
          },
        },
      }),
      prisma.payment.aggregate({
        where: { workspaceId, status: 'PAID', currency: 'IRR' },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.payment.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          gateway: true,
          plan: true,
          kind: true,
          amount: true,
          currency: true,
          status: true,
          createdAt: true,
          paidAt: true,
        },
      }),
      prisma.user.findMany({
        where: { workspaceId },
        select: { id: true, name: true, phone: true, role: true, createdAt: true },
      }),
      prisma.agent.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          name: true,
          active: true,
          createdAt: true,
          _count: { select: { conversations: true } },
        },
      }),
      prisma.usageLog.aggregate({
        where: { workspaceId, date: { gte: since30 } },
        _sum: { promptTokens: true, completionTokens: true, cost: true },
        _count: { _all: true },
      }),
    ])

  if (!wsNullable) notFound()
  const workspace = wsNullable

  const totalRevenueIRR = revenueAgg._sum.amount ?? 0
  const paidPaymentCount = revenueAgg._count._all ?? 0
  const usageCount = usageAgg._count._all ?? 0
  const promptTokens = usageAgg._sum.promptTokens ?? 0
  const completionTokens = usageAgg._sum.completionTokens ?? 0
  const totalTokens = promptTokens + completionTokens
  const totalCost = usageAgg._sum.cost ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={workspace.name}
        subtitle={`عضو از ${fmtDay(workspace.createdAt)}`}
        action={<PlanBadge plan={workspace.plan} />}
        breadcrumbs={[
          { label: 'داشبورد', href: '/admin' },
          { label: 'کاربران', href: '/admin/users' },
          { label: workspace.name },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ─── LEFT — main column ─────────────────────────────── */}
        <div className="space-y-4 lg:col-span-2">
          {/* Business info */}
          <Panel title="اطلاعات کسب‌وکار">
            <SectionLabel>پروفایل</SectionLabel>
            <div className="divide-y divide-zinc-100">
              <KV label="نام">{workspace.name}</KV>
              <KV label="اسلاگ" mono>
                <span className="truncate">{workspace.slug}</span>
              </KV>
              <KV label="پلن فعلی">
                <PlanBadge plan={workspace.plan} />
              </KV>
              <KV label="ایمیل گزارش">{workspace.reportEmail || '—'}</KV>
              <KV label="پایان دوره آزمایشی">
                {workspace.trialEndsAt ? fmtDay(workspace.trialEndsAt) : '—'}
              </KV>
              <KV label="زبان">{workspace.language}</KV>
              <KV label="مدل پیش‌فرض" mono>
                <span className="truncate">{workspace.defaultModel}</span>
              </KV>
              <KV label="وضعیت آنبوردینگ">
                <span className="inline-flex items-center gap-2">
                  {workspace.onboardingCompleted ? (
                    <Badge tone="success">تکمیل</Badge>
                  ) : (
                    <Badge tone="warning">در حال</Badge>
                  )}
                  <span className="text-xs text-zinc-500">
                    گام {fa(workspace.onboardingStep)}
                  </span>
                </span>
              </KV>
              <KV label="تاریخ عضویت">{fmtDay(workspace.createdAt)}</KV>
            </div>
          </Panel>

          {/* Overall stats */}
          <Panel title="آمار کلی" subtitle="شمارش کل روابط این کسب‌وکار">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <MiniStat
                label="کاربران"
                value={workspace._count.users}
                icon={<Users className="h-4 w-4" />}
              />
              <MiniStat
                label="ایجنت‌ها"
                value={workspace._count.agents}
                icon={<Bot className="h-4 w-4" />}
              />
              <MiniStat
                label="مکالمات"
                value={workspace._count.conversations}
                icon={<MessageSquare className="h-4 w-4" />}
              />
              <MiniStat
                label="پرداخت‌ها"
                value={workspace._count.payments}
                icon={<Wallet className="h-4 w-4" />}
              />
              <MiniStat
                label="محصولات"
                value={workspace._count.products}
                icon={<Package className="h-4 w-4" />}
              />
              <MiniStat
                label="مقالات بلاگ"
                value={workspace._count.blogPosts}
                icon={<FileText className="h-4 w-4" />}
              />
            </div>
          </Panel>

          {/* Usage — last 30 days */}
          <Panel title="مصرف ۳۰ روز اخیر" subtitle="مجموع لاگ‌های استفاده از مدل‌های هوش مصنوعی">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard
                label="درخواست‌های AI"
                value={usageCount}
                icon={<Bot className="h-5 w-5" />}
              />
              <StatCard
                label="کل توکن"
                value={totalTokens}
                icon={<MessageSquare className="h-5 w-5" />}
              />
              <StatCard
                label="هزینه"
                value={totalCost > 0 ? fmtUSD(totalCost) : '—'}
                icon={<Wallet className="h-5 w-5" />}
                tone="success"
              />
            </div>
          </Panel>

          {/* Recent payments */}
          <Panel
            title="پرداخت‌های اخیر"
            href="/admin/payments"
            linkLabel="همه پرداخت‌ها"
          >
            {recentPayments.length === 0 ? (
              <EmptyState icon={<Wallet className="h-8 w-8" />}>
                پرداختی ثبت نشده
              </EmptyState>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {recentPayments.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/admin/payments/${p.id}`}
                      className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-zinc-50"
                    >
                      <div className="flex flex-1 flex-wrap items-center gap-2">
                        <GatewayBadge gateway={p.gateway} />
                        <PlanBadge plan={p.plan} kind={p.kind} />
                        <PaymentStatusBadge status={p.status} />
                      </div>
                      <div className="text-end">
                        <div className="text-sm font-semibold tabular-nums text-zinc-900">
                          {p.currency === 'IRR' ? fmtIRR(p.amount) : fmtUSD(p.amount)}
                        </div>
                        <div className="text-[11px] text-zinc-500">{fmtDay(p.createdAt)}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Recent agents */}
          <Panel title="ایجنت‌های اخیر">
            {agents.length === 0 ? (
              <EmptyState icon={<Bot className="h-8 w-8" />}>
                ایجنتی ساخته نشده
              </EmptyState>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {agents.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-zinc-900">
                          {a.name}
                        </span>
                        {a.active ? (
                          <Badge tone="success">فعال</Badge>
                        ) : (
                          <Badge tone="muted">غیرفعال</Badge>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {fa(a._count.conversations)} مکالمه
                      </div>
                    </div>
                    <div className="text-[11px] text-zinc-500">{fmtDay(a.createdAt)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* ─── RIGHT — sidebar column ────────────────────────── */}
        <div className="space-y-4">
          {/* Financial summary */}
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">خلاصه مالی</h2>
              <PlanBadge plan={workspace.plan} />
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-zinc-500">درآمد کل</p>
                <p className="mt-1 text-3xl font-bold tracking-tight text-zinc-900">
                  {fmtIRR(totalRevenueIRR)}
                </p>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-100 pt-3">
                <span className="text-xs text-zinc-500">پرداخت‌های موفق</span>
                <span className="text-sm font-semibold text-zinc-900">
                  {fa(paidPaymentCount)}
                </span>
              </div>
            </div>
          </Card>

          {/* Members */}
          <Panel title="اعضا">
            {members.length <= 1 ? (
              <EmptyState icon={<Users className="h-8 w-8" />}>
                عضو دیگری ثبت نشده
              </EmptyState>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {members.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/admin/users/${m.id}`}
                      className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-zinc-50"
                    >
                      <Avatar name={m.name} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-zinc-900">
                          {m.name || '—'}
                        </div>
                        <div className="truncate text-xs text-zinc-500" dir="ltr">
                          {m.phone}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <RoleBadge role={m.role} />
                        <span className="text-[11px] text-zinc-500">{fmtDay(m.createdAt)}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Quick links */}
          <Panel title="تماس سریع">
            <ul className="space-y-1">
              <QuickLink
                href="/admin/payments"
                icon={<Wallet className="h-4 w-4" />}
                label="همه پرداخت‌ها"
              />
              <QuickLink
                href="/admin/revenue"
                icon={<Building2 className="h-4 w-4" />}
                label="گزارش درآمد"
              />
              <QuickLink
                href="/admin/agents"
                icon={<Bot className="h-4 w-4" />}
                label="ایجنت‌ها"
              />
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  )
}

// ─── LOCAL HELPERS ────────────────────────────────────────────────

function MiniStat({
  label,
  value,
  icon,
}: {
  label: string
  value: number
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3">
      <div className="flex items-center gap-2 text-zinc-500">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
          {icon}
        </span>
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">{fa(value)}</p>
    </div>
  )
}

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string
  icon: React.ReactNode
  label: string
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-2.5 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
      >
        <span className="text-zinc-500">{icon}</span>
        <span className="flex-1">{label}</span>
        <ArrowLeft className="h-4 w-4 text-zinc-400" />
      </Link>
    </li>
  )
}
