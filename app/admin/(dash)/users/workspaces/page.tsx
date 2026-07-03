import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Building2, CreditCard, Clock, CheckCircle } from 'lucide-react'
import {
  PageHeader,
  FilterPills,
  StatCard,
  Badge,
  TableShell,
  Th,
  Td,
  AdminPagination,
  EmptyState,
  fmtDay,
  fa,
} from '../ui'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 30

const PLAN_OPTIONS = [
  { value: 'TRIAL', label: 'آزمایشی' },
  { value: 'STARTER', label: 'استارتر' },
  { value: 'PRO', label: 'حرفه‌ای' },
  { value: 'BUSINESS', label: 'سازمانی' },
] as const

const VALID_PLANS = ['TRIAL', 'STARTER', 'PRO', 'BUSINESS'] as const
type PlanFilter = (typeof VALID_PLANS)[number]

type BadgeTone = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted'

const PLAN_BADGE: Record<string, { tone: BadgeTone; label: string }> = {
  TRIAL: { tone: 'muted', label: 'آزمایشی' },
  STARTER: { tone: 'info', label: 'استارتر' },
  PRO: { tone: 'success', label: 'حرفه‌ای' },
  BUSINESS: { tone: 'default', label: 'سازمانی' },
}

function PlanBadge({ plan }: { plan: string }) {
  const cfg = PLAN_BADGE[plan] ?? { tone: 'muted' as BadgeTone, label: plan }
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>
}

function OnboardingBadge({ completed }: { completed: boolean }) {
  return completed ? (
    <Badge tone="success">تکمیل</Badge>
  ) : (
    <Badge tone="warning">در حال</Badge>
  )
}

export default async function AdminWorkspacesPage(
  props: {
    searchParams: Promise<{ plan?: string; page?: string }>
  }
) {
  const searchParams = await props.searchParams

  // Validate the plan filter from the query string.
  const planParam = searchParams.plan
  const planFilter: PlanFilter | null =
    planParam && (VALID_PLANS as readonly string[]).includes(planParam)
      ? (planParam as PlanFilter)
      : null

  const page = Math.max(1, Number(searchParams.page) || 1)

  const where = planFilter ? { plan: planFilter } : {}

  const [totalWorkspaces, paidWorkspaces, trialWorkspaces, onboardedWorkspaces, rows] =
    await Promise.all([
      prisma.workspace.count(),
      prisma.workspace.count({ where: { plan: { in: ['STARTER', 'PRO', 'BUSINESS'] } } }),
      prisma.workspace.count({ where: { plan: 'TRIAL' } }),
      prisma.workspace.count({ where: { onboardingCompleted: true } }),
      prisma.workspace.findMany({
        where,
        include: {
          _count: {
            select: {
              users: true,
              agents: true,
              conversations: true,
              payments: true,
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

  // Plan filter pills — clicking resets to page 1.
  const filterPillOptions = [
    { label: 'همه', href: '/admin/workspaces', active: !planFilter },
    ...PLAN_OPTIONS.map((p) => ({
      label: p.label,
      href: `/admin/workspaces?plan=${p.value}`,
      active: planFilter === p.value,
    })),
  ]

  // Pagination preserves the plan filter.
  const makeHref = (p: number) => {
    const q = new URLSearchParams()
    if (planFilter) q.set('plan', planFilter)
    if (p > 1) q.set('page', String(p))
    const qs = q.toString()
    return qs ? `/admin/workspaces?${qs}` : '/admin/workspaces'
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="کسب‌وکارها"
        subtitle="مدیریت کسب‌وکارها و پلن‌های آن‌ها"
        breadcrumbs={[
          { label: 'داشبورد', href: '/admin' },
          { label: 'کسب‌وکارها' },
        ]}
      />

      <FilterPills options={filterPillOptions} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="کل کسب‌وکارها"
          value={totalWorkspaces}
          icon={<Building2 className="h-5 w-5" />}
        />
        <StatCard
          label="پلن‌های پرداختی"
          value={paidWorkspaces}
          tone="success"
          icon={<CreditCard className="h-5 w-5" />}
        />
        <StatCard
          label="آزمایشی"
          value={trialWorkspaces}
          tone="warning"
          icon={<Clock className="h-5 w-5" />}
        />
        <StatCard
          label="آنبوردینگ تکمیل‌شده"
          value={onboardedWorkspaces}
          tone="success"
          icon={<CheckCircle className="h-5 w-5" />}
        />
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<Building2 className="h-8 w-8" />}>
          کسب‌وکاری یافت نشد
        </EmptyState>
      ) : (
        <TableShell>
          <thead className="border-b border-zinc-200 bg-zinc-50">
            <tr>
              <Th>نام کسب‌وکار</Th>
              <Th>پلن</Th>
              <Th>کاربران</Th>
              <Th>ایجنت‌ها</Th>
              <Th>مکالمات</Th>
              <Th>پرداخت‌ها</Th>
              <Th>آنبوردینگ</Th>
              <Th>تاریخ ایجاد</Th>
              <Th>عملیات</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {items.map((w) => (
              <tr key={w.id} className="hover:bg-zinc-50">
                <Td>
                  <Link
                    href={`/admin/workspaces/${w.id}`}
                    className="font-medium text-zinc-900 underline-offset-4 hover:underline"
                  >
                    {w.name}
                  </Link>
                </Td>
                <Td>
                  <PlanBadge plan={w.plan} />
                </Td>
                <Td className="text-zinc-500">{fa(w._count.users)}</Td>
                <Td className="text-zinc-500">{fa(w._count.agents)}</Td>
                <Td className="text-zinc-500">{fa(w._count.conversations)}</Td>
                <Td className="text-zinc-500">{fa(w._count.payments)}</Td>
                <Td>
                  <OnboardingBadge completed={w.onboardingCompleted} />
                </Td>
                <Td className="text-zinc-500">{fmtDay(w.createdAt)}</Td>
                <Td>
                  <Link
                    href={`/admin/workspaces/${w.id}`}
                    className="text-xs font-medium text-zinc-900 underline-offset-4 hover:underline"
                  >
                    جزئیات
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      <AdminPagination page={page} hasNext={hasNext} makeHref={makeHref} />
    </div>
  )
}
