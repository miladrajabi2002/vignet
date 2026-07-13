import { SlidersHorizontal } from 'lucide-react'
import { PlatformSettingsForm } from '@/components/admin/platform-settings-form'
import { getPlatformCommercialConfig } from '@/lib/platform/commercial-config'
import { PageHeader } from '../ui'

export const dynamic = 'force-dynamic'

export default async function AdminPlatformSettingsPage() {
  const settings = await getPlatformCommercialConfig()
  return (
    <div className="space-y-5">
      <PageHeader
        title="تنظیمات پلتفرم"
        subtitle="تعرفه‌ها، پلن‌ها و سیاست‌های runtime ویجنتو"
        action={<span className="admin-icon-well"><SlidersHorizontal className="h-4 w-4" /></span>}
      />
      <PlatformSettingsForm initial={settings} />
    </div>
  )
}
