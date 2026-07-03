import { SystemMonitor } from '@/components/admin/system-monitor'
import { PageHeader } from '../ui'

export const dynamic = 'force-dynamic'

export default function AdminSystemPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="منابع سرور"
        subtitle="پایش زنده منابع — به‌روزرسانی هر ۵ ثانیه"
        breadcrumbs={[
          { label: 'داشبورد', href: '/admin' },
          { label: 'منابع سرور' },
        ]}
      />
      <SystemMonitor />
    </div>
  )
}
