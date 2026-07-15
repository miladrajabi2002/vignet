import { ServerCog } from 'lucide-react'
import { PageHeader, Panel } from '../ui'
import { SystemMonitor } from '@/components/admin/system-monitor'
import { ServiceHealthPanel } from '@/components/admin/service-health-panel'

export const dynamic = 'force-dynamic'

export default function AdminSystemPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="سلامت زیرساخت"
        subtitle="کنترل زنده سرور، دیتابیس، Redis، Queue، Worker، MinIO، OpenRouter و کانال‌ها"
        icon={ServerCog}
        breadcrumbs={[{ label: 'مرکز فرمان', href: '/admin' }, { label: 'سلامت زیرساخت' }]}
      />
      <ServiceHealthPanel />
      <Panel title="منابع ماشین" subtitle="CPU، حافظه، دیسک و آپ‌تایم سیستم‌عامل؛ بروزرسانی هر ۵ ثانیه">
        <SystemMonitor />
      </Panel>
    </div>
  )
}
