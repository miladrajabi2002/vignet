import { ListChecks } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { AdminUsersSearchForm } from '@/components/admin/admin-users-search-form'
import { adminPaymentWhere, type AdminPaymentFilter } from '@/lib/admin/payment-gateway'
import { AdminPagination, EmptyState, FilterPills, Toolbar } from '../../ui'
import { AdminPaymentsTable, paymentCountLabel } from '../payments-table'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 40
const FILTERS: Array<[AdminPaymentFilter, string]> = [['all', 'همه'], ['review', 'منتظر بررسی'], ['open', 'منتظر واریز'], ['paid', 'پرداخت‌شده'], ['failed', 'ناموفق']]

export default async function AdminGatewayPaymentsPage(props: { searchParams: Promise<{ q?: string; filter?: string; page?: string }> }) {
  const searchParams = await props.searchParams
  const q = searchParams.q?.trim() ?? ''
  const page = Math.max(1, Number(searchParams.page) || 1)
  const filter = (FILTERS.find(([key]) => key === searchParams.filter)?.[0] ?? 'all') as AdminPaymentFilter
  const where = adminPaymentWhere(filter, q)
  const [total, rows] = await Promise.all([
    prisma.cardPayment.count({ where }),
    prisma.cardPayment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
      include: { card: { select: { bankKey: true, last4: true, deletedAt: true } }, workspace: { select: { id: true, name: true } }, site: { select: { name: true } } },
    }),
  ])
  const href = (next: { filter?: AdminPaymentFilter; page?: number }) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    const f = next.filter ?? filter
    if (f !== 'all') params.set('filter', f)
    if (next.page && next.page > 1) params.set('page', String(next.page))
    const query = params.toString()
    return query ? `/admin/payment-gateway/payments?${query}` : '/admin/payment-gateway/payments'
  }
  return (
    <div className="space-y-4">
      <Toolbar className="flex flex-wrap items-center gap-3">
        <div className="min-w-[14rem] flex-1">
          <AdminUsersSearchForm defaultQuery={q} placeholder="کد، مبلغ، نام یا شمارهٔ مشتری، کسب‌وکار" ariaLabel="جستجوی تراکنش" basePath="/admin/payment-gateway/payments" />
        </div>
        <div className="max-w-full overflow-x-auto"><FilterPills options={FILTERS.map(([key, label]) => ({ label, href: href({ filter: key }), active: filter === key }))} /></div>
      </Toolbar>
      <p className="text-[12.5px] text-[var(--text-muted)]">{paymentCountLabel(total)}</p>
      {rows.length ? <AdminPaymentsTable rows={rows.slice(0, PAGE_SIZE)} showBusiness /> : <EmptyState icon={<ListChecks />}>تراکنشی پیدا نشد.</EmptyState>}
      <AdminPagination page={page} hasNext={rows.length > PAGE_SIZE} makeHref={(next) => href({ page: next })} />
    </div>
  )
}
