import Link from 'next/link'
import { Search, Users, Building2, CreditCard, Clock } from 'lucide-react'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  PageHeader,
  StatCard,
  TableShell,
  Th,
  Td,
  Badge,
  Avatar,
  AdminPagination,
  EmptyState,
  FilterPills,
  fa,
  fmtDay,
} from '../ui'
import { Sparkline } from '@/components/admin/sparkline'
import { conversationsDailyByWorkspace } from '@/lib/admin/charts'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 30

type BadgeTone = 'default' | 'info' | 'muted' | 'success' | 'warning' | 'danger'

const ROLE_LABEL: Record<string, { label: string; tone: BadgeTone }> = {
  OWNER: { label: 'مالک کسب‌وکار', tone: 'default' },
  ADMIN: { label: 'مدیر کسب‌وکار', tone: 'info' },
  MEMBER: { label: 'عضو', tone: 'muted' },
}

const PLAN_LABEL: Record<string, { label: string; tone: BadgeTone }> = {
  TRIAL: { label: 'آزمایشی', tone: 'muted' },
  STARTER: { label: 'استارتر', tone: 'info' },
  PRO: { label: 'حرفه‌ای', tone: 'success' },
  BUSINESS: { label: 'سازمانی', tone: 'default' },
}

const PLAN_OPTIONS = [
  { value: 'TRIAL', label: 'آزمایشی' },
  { value: 'STARTER', label: 'استارتر' },
  { value: 'PRO', label: 'حرفه‌ای' },
  { value: 'BUSINESS', label: 'سازمانی' },
] as const

const VALID_PLANS = ['TRIAL', 'STARTER', 'PRO', 'BUSINESS'] as const
type PlanFilter = (typeof VALID_PLANS)[number]

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export default async function AdminUsersPage(
  props: {
    searchParams: Promise<{ q?: string; page?: string; plan?: string }>
  },
) {
  const searchParams = await props.searchParams
  const q = searchParams.q?.trim() || ''
  const page = Math.max(1, Number(searchParams.page) || 1)

  // Validate the plan filter — when set, we only show users whose workspace
  // matches that plan. This merges the old "workspaces" filter into this page.
  const planParam = searchParams.plan
  const planFilter: PlanFilter | null =
    planParam && (VALID_PLANS as readonly string[]).includes(planParam)
      ? (planParam as PlanFilter)
      : null

  const where: Prisma.UserWhereInput = {}
  if (q) {
    where.OR = [{ phone: { contains: q } }, { name: { contains: q } }]
  }
  if (planFilter) {
    where.workspace = { plan: planFilter }
  }

  const stalledSince = new Date(Date.now() - 48 * 60 * 60 * 1000)
  const [totalCount, todayCount, workspaceCount, paidWorkspaces, stalledWorkspaces, rows] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: startOfToday() } } }),
      prisma.workspace.count(),
      prisma.workspace.count({ where: { plan: { in: ['STARTER', 'PRO', 'BUSINESS'] } } }),
      prisma.workspace.count({ where: { onboardingCompleted: false, createdAt: { lt: stalledSince } } }),
      prisma.user.findMany({
        where,
        include: {
          workspace: {
            select: {
              id: true,
              name: true,
              plan: true,
              onboardingCompleted: true,
              createdAt: true,
              _count: { select: { agents: true, conversations: true, payments: true, users: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE + 1,
      }),
    ])

  const hasNext = rows.length > PAGE_SIZE
  const items = hasNext ? rows.slice(0, PAGE_SIZE) : rows

  // Fetch 7-day conversation sparkline data for all workspaces in one query.
  const workspaceIds = items
    .map((u) => u.workspace?.id)
    .filter((id): id is string => !!id)
  const sparks = workspaceIds.length
    ? await conversationsDailyByWorkspace(7)
    : new Map<string, { workspaceId: string; series: number[]; total: number }>()

  // Plan filter pills — clicking resets to page 1.
  const filterPillOptions = [
    { label: 'همه', href: '/admin/users', active: !planFilter },
    ...PLAN_OPTIONS.map((p) => ({
      label: p.label,
      href: `/admin/users?plan=${p.value}`,
      active: planFilter === p.value,
    })),
  ]

  const makeHref = (p: number) => {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    if (planFilter) sp.set('plan', planFilter)
    if (p > 1) sp.set('page', String(p))
    const qs = sp.toString()
    return qs ? `/admin/users?${qs}` : '/admin/users'
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="کاربران"
        subtitle="مدیریت کاربران، کسب‌وکارها و پلن‌های آن‌ها در یک نمای واحد"
        breadcrumbs={[
          { label: 'داشبورد', href: '/admin' },
          { label: 'کاربران' },
        ]}
      />

      {/* Search bar */}
      <form method="GET" className="relative" autoComplete="off">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="جستجو بر اساس نام یا تلفن…"
          className="admin-input pr-10"
        />
        {planFilter && <input type="hidden" name="plan" value={planFilter} />}
      </form>

      {/* Plan filter pills */}
      <FilterPills options={filterPillOptions} />

      {/* Stats — merged from old users + workspaces pages */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="کل کاربران"
          value={totalCount}
          sub={`${fa(todayCount)} امروز`}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="کسب‌وکارها"
          value={workspaceCount}
          icon={<Building2 className="h-4 w-4" />}
          tone="info"
        />
        <StatCard
          label="پلن‌های پرداختی"
          value={paidWorkspaces}
          icon={<CreditCard className="h-4 w-4" />}
          tone="success"
        />
        <StatCard
          label="راه‌اندازی متوقف"
          value={stalledWorkspaces}
          sub="بیش از ۴۸ ساعت بدون تکمیل آنبوردینگ"
          icon={<Clock className="h-4 w-4" />}
          tone={stalledWorkspaces > 0 ? 'warning' : 'success'}
        />
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <EmptyState icon={<Users className="h-8 w-8" />}>
          {q ? `نتیجه‌ای برای «${q}» یافت نشد` : 'کاربری ثبت نشده'}
        </EmptyState>
      ) : (
        <TableShell>
          <thead className="border-b border-zinc-200 bg-zinc-50/60">
            <tr>
              <Th>کاربر</Th>
              <Th>نقش</Th>
              <Th>کسب‌وکار</Th>
              <Th>پلن</Th>
              <Th>ایجنت‌ها</Th>
              <Th>مکالمات</Th>
              <Th>روند ۷ روز</Th>
              <Th>تاریخ عضویت</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {items.map((u) => {
              const role = ROLE_LABEL[u.role] ?? { label: u.role, tone: 'muted' as BadgeTone }
              const ws = u.workspace
              const plan = ws ? (PLAN_LABEL[ws.plan] ?? { label: ws.plan, tone: 'muted' as BadgeTone }) : null
              const spark = ws ? sparks.get(ws.id) : undefined
              return (
                <tr key={u.id} className="hover:bg-zinc-50">
                  <Td>
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="flex items-center gap-2.5"
                    >
                      <Avatar name={u.name} size={36} />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-zinc-900 hover:underline">
                          {u.name ?? 'بدون نام'}
                        </div>
                        <div className="text-xs text-zinc-500" dir="ltr">{u.phone}</div>
                      </div>
                    </Link>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone={role.tone}>{role.label}</Badge>
                      {u.platformRole === 'ADMIN' && <Badge tone="danger">مدیر اصلی ویجنتو</Badge>}
                    </div>
                  </Td>
                  <Td>
                    {ws ? (
                      <div className="space-y-1.5">
                        <Link
                          href={`/admin/workspaces/${ws.id}`}
                          className="text-zinc-700 hover:text-zinc-900 hover:underline"
                        >
                          {ws.name}
                        </Link>
                        <div>
                          <Badge
                            tone={ws.onboardingCompleted ? 'success' : (ws.createdAt < stalledSince ? 'warning' : 'info')}
                          >
                            {ws.onboardingCompleted ? 'فعال‌شده' : (ws.createdAt < stalledSince ? 'متوقف در راه‌اندازی' : 'در حال راه‌اندازی')}
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </Td>
                  <Td>
                    {plan ? (
                      <Badge tone={plan.tone}>{plan.label}</Badge>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </Td>
                  <Td className="text-zinc-600 tabular-nums">
                    {fa(ws?._count.agents ?? 0)}
                  </Td>
                  <Td className="text-zinc-600 tabular-nums">
                    {fa(ws?._count.conversations ?? 0)}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Sparkline data={spark?.series ?? []} width={88} height={26} />
                      <span className="text-[11px] font-medium tabular-nums text-zinc-500">
                        {spark ? fa(spark.total) : '۰'}
                      </span>
                    </div>
                  </Td>
                  <Td className="text-xs text-zinc-500">{fmtDay(u.createdAt)}</Td>
                </tr>
              )
            })}
          </tbody>
        </TableShell>
      )}

      <AdminPagination page={page} hasNext={hasNext} makeHref={makeHref} />
    </div>
  )
}
