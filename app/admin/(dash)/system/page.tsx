import { SystemMonitor } from '@/components/admin/system-monitor'

export const dynamic = 'force-dynamic'

export default function AdminSystemPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-light">منابع سرور</h1>
        <p className="mt-1 text-sm text-zinc-500">به‌روزرسانی زنده هر ۵ ثانیه</p>
      </div>
      <SystemMonitor />
    </div>
  )
}
