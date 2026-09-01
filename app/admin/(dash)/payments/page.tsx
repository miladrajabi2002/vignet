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
import { displayPhone } from '@/lib/phone'
import { AdminFilterSheet } from '@/components/admin/admin-filter-sheet'
import { AdminUsersSearchForm } from '@/components/admin/admin-users-search-form'

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
    searchParams: Promise<{ q?: string; status?: string; gateway?: string; page?: string }>
  },
) {
  const searchParams = await props.searchParams
  const q = searchParams.q?.trim().slice(0, 120) ?? ''

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
  const where: Prisma.PaymentWhereInput = {
    ...ADMIN_VISIBLE_RELATED_WHERE,
    ...(q
      ? {
          OR: [
            { id: { contains: q, mode: 'insensitive' } },
            { authority: { contains: q, mode: 'insensitive' } },
            { externalId: { contains: q, mode: 'insensitive' } },
            { workspace: { owner: { name: { contains: q, mode: 'insensitive' } } } },
            { workspace: { owner: { phone: { contains: q } } } },
          ],
        }
      : {}),
  }
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
    if (q) sp.set('q', q)
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

      {/* Live search + adaptive filters */}
      <div className="sticky top-20 z-20 flex gap-2 rounded-[1.35rem] border border-black/[0.07] bg-white/90 p-2 shadow-[var(--shadow-soft)] backdrop-blur-xl md:static md:bg-white/72">
        <AdminUsersSearchForm
          defaultQuery={q}
          placeholder="جستجوی کاربر، شناسه یا کد پرداخت…"
          ariaLabel="جستجوی پرداخت‌ها"
          basePath="/admin/payments"
        />
        <div className="hidden min-w-0 flex-1 flex-wrap items-center justify-end gap-2 md:flex">
          <FilterPills options={statusPills} />
          <FilterPills options={gatewayPills} />
        </div>
        <div className="md:hidden">
          <AdminFilterSheet
            title="فیلتر پرداخت‌ها"
            description="وضعیت و درگاه پرداخت را انتخاب کنید"
            groups={[
              { label: 'وضعیت', options: statusPills },
              { label: 'درگاه', options: gatewayPills },
            ]}
            activeCount={(status ? 1 : 0) + (gateway ? 1 : 0)}
            clearHref={q ? `/admin/payments?q=${encodeURIComponent(q)}` : '/admin/payments'}
          />
        </div>
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
        <>
        <div className="grid gap-3 md:hidden">
          {items.map((payment) => {
            const user = payment.workspace.owner
            return (
              <article key={payment.id} className="rounded-2xl border border-black/[0.07] bg-white p-4 shadow-[var(--shadow-soft)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-zinc-950">
                      {user ? (user.name || displayPhone(user.phone)) : 'کاربر نامشخص'}
                    </p>
                    <p dir="ltr" className="mt-1 truncate text-start text-[11px] text-zinc-400">#{payment.id}</p>
                  </div>
                  <StatusBadge status={payment.status} />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-zinc-50 p-3 text-xs">
                  <div><dt className="text-zinc-400">مبلغ</dt><dd className="mt-1 font-bold tabular-nums text-zinc-900">{payment.currency === 'IRR' ? fmtIRR(payment.amount) : fmtUSD(payment.amount)}</dd></div>
                  <div><dt className="text-zinc-400">تاریخ</dt><dd className="mt-1 font-medium text-zinc-700">{fmtDay(payment.createdAt)}</dd></div>
                  <div><dt className="text-zinc-400">پلن / نوع</dt><dd className="mt-1"><PlanBadge plan={payment.plan} kind={payment.kind} /></dd></div>
                  <div><dt className="text-zinc-400">درگاه</dt><dd className="mt-1"><GatewayBadge gateway={payment.gateway} /></dd></div>
                </dl>
                <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3">
                  {user ? <Link href={`/admin/users/${user.id}`} className="inline-flex min-h-11 items-center text-xs font-semibold text-zinc-500">پروفایل کاربر</Link> : <span />}
                  <Link href={`/admin/payments/${payment.id}`} className="inline-flex min-h-11 items-center rounded-xl border border-zinc-200 px-3 text-xs font-bold text-zinc-900">جزئیات پرداخت</Link>
                </div>
              </article>
            )
          })}
        </div>
        <div className="hidden md:block">
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
                      {user.name || displayPhone(user.phone)}
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
        </div>
        </>
      )}

      <AdminPagination
        page={page}
        hasNext={hasNext}
        makeHref={(p) => buildHref({ page: String(p) })}
      />
    </div>
  )
}
