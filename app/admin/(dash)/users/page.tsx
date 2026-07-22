import Link from 'next/link'
import { Search, Users, Building2, CreditCard, Clock, UserRound } from 'lucide-react'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  PageHeader,
  StatCard,
  TableShell,
  Th,
  Td,
  Badge,
  AdminPagination,
  EmptyState,
  FilterPills,
  fa,
  fmtDay,
} from '../ui'
import { Sparkline } from '@/components/admin/sparkline'
import { conversationsDailyByWorkspace } from '@/lib/admin/charts'
import { toEnglishDigits } from '@/lib/phone'
import { AdminBroadcastDialog } from '@/components/admin/admin-broadcast-form'
import { ADMIN_VISIBLE_USER_WHERE, ADMIN_VISIBLE_WORKSPACE_WHERE } from '@/lib/admin/reporting-scope'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 30

type BadgeTone = 'default' | 'info' | 'muted' | 'success' | 'warning' | 'danger'

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

function displayPhone(value: string): string {
  const phone = toEnglishDigits(value).replace(/[\s()-]/g, '')
  if (phone.startsWith('+98')) return `0${phone.slice(3)}`
  if (phone.startsWith('0098')) return `0${phone.slice(4)}`
  if (phone.startsWith('98') && phone.length === 12) return `0${phone.slice(2)}`
  return phone
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

  const where: Prisma.UserWhereInput = { AND: [ADMIN_VISIBLE_USER_WHERE] }
  if (q) {
    where.OR = [
      { phone: { contains: q } },
      { name: { contains: q, mode: 'insensitive' } },
      { workspace: { name: { contains: q, mode: 'insensitive' } } },
    ]
  }
  if (planFilter) {
    where.workspace = { plan: planFilter }
  }

  const stalledSince = new Date(Date.now() - 48 * 60 * 60 * 1000)
  const [totalCount, todayCount, workspaceCount, paidWorkspaces, stalledWorkspaces, rows, messageUsers] =
    await Promise.all([
      prisma.user.count({ where: ADMIN_VISIBLE_USER_WHERE }),
      prisma.user.count({ where: { ...ADMIN_VISIBLE_USER_WHERE, createdAt: { gte: startOfToday() } } }),
      prisma.workspace.count({ where: ADMIN_VISIBLE_WORKSPACE_WHERE }),
      prisma.workspace.count({ where: { ...ADMIN_VISIBLE_WORKSPACE_WHERE, plan: { in: ['STARTER', 'PRO', 'BUSINESS'] } } }),
      prisma.workspace.count({ where: { ...ADMIN_VISIBLE_WORKSPACE_WHERE, onboardingCompleted: false, createdAt: { lt: stalledSince } } }),
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
              _count: { select: { agents: true, conversations: true, payments: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE + 1,
      }),
      prisma.user.findMany({
        where: ADMIN_VISIBLE_USER_WHERE,
        orderBy: { createdAt: 'desc' },
        take: 500,
        select: {
          id: true,
          name: true,
          phone: true,
          workspace: { select: { name: true, plan: true } },
        },
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
        title="کاربر ها"
        subtitle="مدیریت کاربران، کسب‌وکارها و پلن‌های آن‌ها در یک نمای واحد"
        breadcrumbs={[
          { label: 'داشبورد', href: '/admin' },
          { label: 'کاربران' },
        ]}
        action={
          <AdminBroadcastDialog
            users={messageUsers.map((user) => ({
              id: user.id,
              name: user.name || 'بدون نام',
              phone: displayPhone(user.phone),
              workspace: user.workspace.name,
              plan: user.workspace.plan,
            }))}
          />
        }
      />

      <div className="flex flex-col gap-2 rounded-[1.35rem] border border-black/[0.07] bg-white/72 p-2 shadow-[var(--shadow-soft)] backdrop-blur-xl lg:flex-row lg:items-center">
        <form method="GET" className="relative min-w-0 flex-1" autoComplete="off">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="جستجوی نام، تلفن یا کسب‌وکار…"
            aria-label="جستجوی کاربرها"
            className="admin-input border-0 bg-black/[0.025] pr-10 shadow-none"
          />
          {planFilter && <input type="hidden" name="plan" value={planFilter} />}
        </form>
        <div className="shrink-0 overflow-x-auto"><FilterPills options={filterPillOptions} /></div>
      </div>

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
              <Th>شماره تلفن</Th>
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
              const ws = u.workspace
              const plan = ws ? (PLAN_LABEL[ws.plan] ?? { label: ws.plan, tone: 'muted' as BadgeTone }) : null
              const spark = ws ? sparks.get(ws.id) : undefined
              return (
                <tr key={u.id} className="hover:bg-zinc-50">
                  <Td>
                    <Link href={`/admin/users/${u.id}`} className="group flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-black/20">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[.9rem] border border-black/[0.06] bg-[radial-gradient(circle_at_35%_25%,#fff_0%,#f4f4f5_58%,#e4e4e7_100%)] text-zinc-600 shadow-[inset_0_1px_0_white,0_4px_12px_rgba(0,0,0,.055)]">
                        <UserRound className="h-4 w-4 stroke-[1.8]" />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-zinc-900 transition-opacity group-hover:opacity-65">
                          {u.name ?? 'بدون نام'}
                        </div>
                      </div>
                    </Link>
                  </Td>
                  <Td className="text-right text-zinc-700">
                    <span dir="ltr" className="inline-block">
                      {displayPhone(u.phone)}
                    </span>
                  </Td>
                  <Td>
                    {ws ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/users/${u.id}`}
                          className="text-zinc-700 hover:text-zinc-900 hover:underline"
                        >
                          {ws.name}
                        </Link>
                        <Badge
                          tone={ws.onboardingCompleted ? 'success' : (ws.createdAt < stalledSince ? 'warning' : 'info')}
                        >
                          {ws.onboardingCompleted ? 'فعال‌شده' : (ws.createdAt < stalledSince ? 'متوقف در راه‌اندازی' : 'در حال راه‌اندازی')}
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-zinc-400">نیست</span>
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
                    <div className="flex items-center">
                      <Sparkline data={spark?.series ?? []} width={88} height={26} />
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
