import { Store } from 'lucide-react'
import { AdminUsersSearchForm } from '@/components/admin/admin-users-search-form'
import { filterGatewayBusinesses, loadGatewayBusinesses, type GatewayBusinessFilter } from '@/lib/admin/payment-gateway'
import { EmptyState, FilterPills, Toolbar, fa } from '../../ui'
import { GatewayBusinessesTable } from '../shared'

export const dynamic = 'force-dynamic'

const FILTERS: Array<[GatewayBusinessFilter, string]> = [['all', 'همه'], ['live', 'فعال'], ['attention', 'نیاز به توجه'], ['setup', 'راه‌اندازی/خاموش'], ['suspended', 'متوقف']]

export default async function AdminGatewayBusinessesPage(props: { searchParams: Promise<{ q?: string; filter?: string }> }) {
  const searchParams = await props.searchParams
  const q = searchParams.q?.trim() ?? ''
  const filter = (FILTERS.find(([key]) => key === searchParams.filter)?.[0] ?? 'all') as GatewayBusinessFilter
  const all = await loadGatewayBusinesses()
  const rows = filterGatewayBusinesses(all, filter, q)
  const href = (next: GatewayBusinessFilter) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (next !== 'all') params.set('filter', next)
    const query = params.toString()
    return query ? `/admin/payment-gateway/businesses?${query}` : '/admin/payment-gateway/businesses'
  }
  return (
    <div className="space-y-4">
      <Toolbar className="flex flex-wrap items-center gap-3">
        <div className="min-w-[14rem] flex-1">
          <AdminUsersSearchForm defaultQuery={q} placeholder="نام کسب‌وکار یا شمارهٔ مالک" ariaLabel="جستجوی کسب‌وکار" basePath="/admin/payment-gateway/businesses" />
        </div>
        <div className="max-w-full overflow-x-auto"><FilterPills options={FILTERS.map(([key, label]) => ({ label: `${label}${key === 'all' ? ` · ${fa(all.length)}` : ''}`, href: href(key), active: filter === key }))} /></div>
      </Toolbar>
      {rows.length ? <GatewayBusinessesTable rows={rows} /> : <EmptyState icon={<Store />}>{all.length ? 'کسب‌وکاری با این فیلتر نیست.' : 'هنوز هیچ کسب‌وکاری درگاه پرداخت را راه نینداخته است.'}</EmptyState>}
    </div>
  )
}
