import { ServerCog } from 'lucide-react'
import { PageHeader } from '../ui'
import { ServiceHealthPanel } from '@/components/admin/service-health-panel'
import { ServerStatsWidget } from '@/components/admin/server-stats-widget'

export const dynamic = 'force-dynamic'

export default function AdminSystemPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="سلامت زیرساخت"
        subtitle="کنترل زنده سرویس‌ها، صف‌ها، پردازشگرها، لاگ‌های ناموفق و منابع سرور"
        icon={ServerCog}
        breadcrumbs={[{ label: 'داشبورد', href: '/admin' }, { label: 'سلامت زیرساخت' }]}
      />
      <ServiceHealthPanel />
      <ServerStatsWidget />
    </div>
  )
}
