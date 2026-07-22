import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { Wallet, DollarSign, CheckCircle, XCircle } from 'lucide-react'
import {
  PageHeader,
  StatCard,
  Badge,
  EmptyState,
  Th,
  Td,
  TableShell,
  fmtIRR,
  fmtUSD,
  fmtDay,
  AdminPagination,
  FilterPills,
} from '../ui'
import { getRevenueKPIs } from '@/lib/admin/revenue'
import { ADMIN_VISIBLE_RELATED_WHERE } from '@/lib/admin/reporting-scope'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 30

// ─── BADGE LOOKUPS ────────────────────────────────────────────────

const PLAN_BADGE: Record<
  string,
  { tone: 'muted' | 'info' | 'success' | 'default'; label: string }
> = {
  TRIAL: { tone: 'muted', label: 'آزمایشی' },
  STARTER: { tone: 'info', label: 'استارتر' },
  PRO: { tone: 'success', label: 'حرفه‌ای' },
  BUSINESS: { tone: 'default', label: 'سازمانی' },
}

const GATEWAY_BADGE: Record<string, { tone: 'info' | 'default'; label: string }> = {
  ZARINPAY: { tone: 'info', label: 'زرین‌پال' },
  NOWPAYMENTS: { tone: 'default', label: 'کریپتو' },
}

const STATUS_BADGE: Record<
  string,
  { tone: 'success' | 'warning' | 'danger' | 'muted'; label: string }
> = {
  PAID: { tone: 'success', label: 'پرداخت‌شده' },
  PENDING: { tone: 'warning', label: 'در انتظار' },
  FAILED: { tone: 'danger', label: 'ناموفق' },
  EXPIRED: { tone: 'muted', label: 'منقضی' },
}

function PlanBadge({ plan, kind }: { plan: string | null; kind?: string }) {
  if (kind === 'AI_CREDIT' || !plan) {
    return <Badge tone="info">اعتبار هوش مصنوعی</Badge>
  }
  const cfg = PLAN_BADGE[plan] ?? { tone: 'muted' as const, label: plan }
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>
}

function GatewayBadge({ gateway }: { gateway: string }) {
  const cfg = GATEWAY_BADGE[gateway] ?? { tone: 'muted' as const, label: gateway }
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status] ?? { tone: 'muted' as const, label: status }
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>
}

// ─── PAGE ─────────────────────────────────────────────────────────

export default async function AdminPaymentsPage(
  props: {
    searchParams: Promise<{ status?: string; gateway?: string; page?: string }>
  },
) {
  const searchParams = await props.searchParams

  // Validate status filter
  const validStatuses = ['PAID', 'PENDING', 'FAILED', 'EXPIRED']
  const status =
    searchParams.status && validStatuses.includes(searchParams.status)
      ? (searchParams.status as 'PAID' | 'PENDING' | 'FAILED' | 'EXPIRED')
      : undefined

  // Validate gateway filter
  const validGateways = ['ZARINPAY', 'NOWPAYMENTS']
  const gateway =
    searchParams.gateway && validGateways.includes(searchParams.gateway)
      ? (searchParams.gateway as 'ZARINPAY' | 'NOWPAYMENTS')
      : undefined

  const page = Math.max(1, Number(searchParams.page) || 1)

  // Build the where clause
  const where: Prisma.PaymentWhereInput = { ...ADMIN_VISIBLE_RELATED_WHERE }
  if (status) where.status = status
  if (gateway) where.gateway = gateway

  // Fetch list + KPIs in parallel
  const [payments, kpi] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
      include: {
        workspace: {
          select: {
            owner: {
              select: { id: true, name: true, phone: true },
            },
          },
        },
      },
    }),
    getRevenueKPIs(),
  ])

  const hasNext = payments.length > PAGE_SIZE
  const items = hasNext ? payments.slice(0, PAGE_SIZE) : payments

  // Build a query-string maker for filter pills + pagination
  const buildHref = (overrides: { status?: string; gateway?: string; page?: string }) => {
    const sp = new URLSearchParams()
    const s = overrides.status !== undefined ? overrides.status : status
    const g = overrides.gateway !== undefined ? overrides.gateway : gateway
    const p = overrides.page !== undefined ? overrides.page : String(page)
    if (s) sp.set('status', s)
    if (g) sp.set('gateway', g)
    if (p && p !== '1') sp.set('page', p)
    const qs = sp.toString()
    return qs ? `/admin/payments?${qs}` : '/admin/payments'
  }

  // When a filter pill changes, reset to page 1 to avoid empty results.
  const statusPills = [
    { label: 'همه', href: buildHref({ status: '', page: '1' }), active: !status },
    { label: 'پرداخت‌شده', href: buildHref({ status: 'PAID', page: '1' }), active: status === 'PAID' },
    { label: 'در انتظار', href: buildHref({ status: 'PENDING', page: '1' }), active: status === 'PENDING' },
    { label: 'ناموفق', href: buildHref({ status: 'FAILED', page: '1' }), active: status === 'FAILED' },
    { label: 'منقضی', href: buildHref({ status: 'EXPIRED', page: '1' }), active: status === 'EXPIRED' },
  ]

  const gatewayPills = [
    { label: 'همه', href: buildHref({ gateway: '', page: '1' }), active: !gateway },
    {
      label: 'زرین‌پال',
      href: buildHref({ gateway: 'ZARINPAY', page: '1' }),
      active: gateway === 'ZARINPAY',
    },
    {
      label: 'کریپتو',
      href: buildHref({ gateway: 'NOWPAYMENTS', page: '1' }),
      active: gateway === 'NOWPAYMENTS',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="فاکتورها و پرداخت‌ها"
        subtitle="تاریخچه تمام پرداخت‌های پلتفرم"
        breadcrumbs={[
          { label: 'داشبورد', href: '/admin' },
          { label: 'پرداخت‌ها' },
        ]}
      />

      {/* Filter bars */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterPills options={statusPills} />
        <FilterPills options={gatewayPills} />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="درآمد کل (تومان)"
          value={fmtIRR(kpi.totalIRR)}
          icon={<Wallet className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="درآمد کل (دلار)"
          value={fmtUSD(kpi.totalUSD)}
          icon={<DollarSign className="h-5 w-5" />}
          tone="info"
        />
        <StatCard
          label="پرداخت‌های موفق"
          value={kpi.paidCount}
          icon={<CheckCircle className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="پرداخت‌های ناموفق"
          value={kpi.failedCount}
          icon={<XCircle className="h-5 w-5" />}
          tone="danger"
        />
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <EmptyState>پرداختی برای نمایش نیست</EmptyState>
      ) : (
        <TableShell>
          <thead className="border-b border-zinc-200 bg-zinc-50/50">
            <tr>
              <Th>کاربر</Th>
              <Th>پلن</Th>
              <Th>درگاه</Th>
              <Th>مبلغ</Th>
              <Th>وضعیت</Th>
              <Th>تاریخ ایجاد</Th>
              <Th>تاریخ پرداخت</Th>
              <Th>عملیات</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {items.map((p) => {
              const user = p.workspace.owner
              return (
              <tr key={p.id} className="hover:bg-zinc-50/60">
                <Td>
                  {user ? (
                    <Link href={`/admin/users/${user.id}`} className="font-medium text-zinc-900 hover:underline">
                      {user.name || user.phone}
                    </Link>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </Td>
                <Td>
                  <PlanBadge plan={p.plan} kind={p.kind} />
                </Td>
                <Td>
                  <GatewayBadge gateway={p.gateway} />
                </Td>
                <Td className="font-medium tabular-nums">
                  {p.currency === 'IRR' ? fmtIRR(p.amount) : fmtUSD(p.amount)}
                </Td>
                <Td>
                  <StatusBadge status={p.status} />
                </Td>
                <Td className="text-zinc-500">{fmtDay(p.createdAt)}</Td>
                <Td className="text-zinc-500">{p.paidAt ? fmtDay(p.paidAt) : '—'}</Td>
                <Td>
                  <Link
                    href={`/admin/payments/${p.id}`}
                    className="text-xs font-medium text-zinc-900 underline-offset-4 hover:underline"
                  >
                    جزئیات
                  </Link>
                </Td>
              </tr>
              )
            })}
          </tbody>
        </TableShell>
      )}

      <AdminPagination
        page={page}
        hasNext={hasNext}
        makeHref={(p) => buildHref({ page: String(p) })}
      />
    </div>
  )
}
