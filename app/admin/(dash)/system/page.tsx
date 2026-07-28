import { ServerCog } from 'lucide-react'
import { PageHeader } from '../ui'
import { ServiceHealthPanel } from '@/components/admin/service-health-panel'
import { ServerStatsWidget } from '@/components/admin/server-stats-widget'
import { SystemErrorsPanel } from '@/components/admin/system-errors-panel'

export const dynamic = 'force-dynamic'

export default async function AdminSystemPage(props: {
  searchParams: Promise<{ errorLevel?: string; errorPage?: string; errorQuery?: string }>
}) {
  const searchParams = await props.searchParams
  return (
    <div className="space-y-6">
      <PageHeader
        title="سلامت زیرساخت و خطاها"
        subtitle="کنترل زنده سرویس‌ها، صف‌ها، پردازشگرها، منابع سرور و لاگ‌های قابل دیباگ"
        icon={ServerCog}
        breadcrumbs={[{ label: 'داشبورد', href: '/admin' }, { label: 'سلامت زیرساخت' }]}
      />
      <ServiceHealthPanel />
      <ServerStatsWidget />
      <SystemErrorsPanel level={searchParams.errorLevel} page={searchParams.errorPage} query={searchParams.errorQuery} />
    </div>
  )
}
