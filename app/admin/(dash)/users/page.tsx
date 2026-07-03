import Link from 'next/link'
import { Search, Users, UserPlus, Building2, Crown } from 'lucide-react'
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
  fa,
  fmtDay,
} from '../ui'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 30

type BadgeTone = 'default' | 'info' | 'muted' | 'success' | 'warning' | 'danger'

const ROLE_LABEL: Record<string, { label: string; tone: BadgeTone }> = {
  OWNER: { label: 'مدیر', tone: 'default' },
  ADMIN: { label: 'ادمین', tone: 'info' },
  MEMBER: { label: 'عضو', tone: 'muted' },
}

const PLAN_LABEL: Record<string, { label: string; tone: BadgeTone }> = {
  TRIAL: { label: 'آزمایشی', tone: 'muted' },
  STARTER: { label: 'استارتر', tone: 'info' },
  PRO: { label: 'حرفه‌ای', tone: 'success' },
  BUSINESS: { label: 'سازمانی', tone: 'default' },
}

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export default async function AdminUsersPage(
  props: {
    searchParams: Promise<{ q?: string; page?: string }>
  },
) {
  const searchParams = await props.searchParams
  const q = searchParams.q?.trim() || ''
  const page = Math.max(1, Number(searchParams.page) || 1)

  const where: Prisma.UserWhereInput = q
    ? { OR: [{ phone: { contains: q } }, { name: { contains: q } }] }
    : {}

  const [totalCount, todayCount, workspaceCount, ownerCount, rows] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: startOfToday() } } }),
    prisma.workspace.count(),
    prisma.user.count({ where: { role: 'OWNER' } }),
    prisma.user.findMany({
      where,
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            plan: true,
            _count: { select: { agents: true, conversations: true } },
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

  const makeHref = (p: number) => {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    if (p > 1) sp.set('page', String(p))
    const qs = sp.toString()
    return qs ? `/admin/users?${qs}` : '/admin/users'
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="کاربران"
        subtitle="مدیریت کاربران و کسب‌وکارهای ثبت‌نام‌شده"
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
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 pr-10 text-sm focus:border-zinc-900 focus:outline-none"
        />
      </form>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="کل کاربران"
          value={totalCount}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="کاربران امروز"
          value={todayCount}
          tone="success"
          icon={<UserPlus className="h-4 w-4" />}
        />
        <StatCard
          label="کسب‌وکارها"
          value={workspaceCount}
          tone="info"
          icon={<Building2 className="h-4 w-4" />}
        />
        <StatCard
          label="اونرها"
          value={ownerCount}
          tone="warning"
          icon={<Crown className="h-4 w-4" />}
        />
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <EmptyState icon={<Users className="h-8 w-8" />}>
          {q ? `نتیجه‌ای برای «${q}» یافت نشد` : 'کاربری ثبت نشده'}
        </EmptyState>
      ) : (
        <TableShell>
          <thead className="border-b border-zinc-200">
            <tr>
              <Th>کاربر</Th>
              <Th>نقش</Th>
              <Th>تلفن</Th>
              <Th>کسب‌وکار</Th>
              <Th>پلن</Th>
              <Th>ایجنت‌ها</Th>
              <Th>مکالمات</Th>
              <Th>تاریخ عضویت</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {items.map((u) => {
              const role = ROLE_LABEL[u.role] ?? { label: u.role, tone: 'muted' as BadgeTone }
              const plan = u.workspace
                ? (PLAN_LABEL[u.workspace.plan] ?? { label: u.workspace.plan, tone: 'muted' as BadgeTone })
                : null
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
                        <div className="text-xs text-zinc-500">{u.phone}</div>
                      </div>
                    </Link>
                  </Td>
                  <Td>
                    <Badge tone={role.tone}>{role.label}</Badge>
                  </Td>
                  <Td>
                    <span dir="ltr" className="font-mono text-xs text-zinc-600">
                      {u.phone}
                    </span>
                  </Td>
                  <Td>
                    {u.workspace ? (
                      <Link
                        href={`/admin/workspaces/${u.workspace.id}`}
                        className="text-zinc-700 hover:text-zinc-900 hover:underline"
                      >
                        {u.workspace.name}
                      </Link>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </Td>
                  <Td>
                    {plan ? <Badge tone={plan.tone}>{plan.label}</Badge> : <span className="text-zinc-400">—</span>}
                  </Td>
                  <Td className="text-zinc-600">{fa(u.workspace?._count.agents ?? 0)}</Td>
                  <Td className="text-zinc-600">{fa(u.workspace?._count.conversations ?? 0)}</Td>
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
