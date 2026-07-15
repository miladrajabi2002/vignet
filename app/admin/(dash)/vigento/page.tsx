import { Activity, CheckCircle2, Clock3, Sparkles } from 'lucide-react'
import { VigentoAdminConsole } from '@/components/admin/vigento-admin-console'
import { getVigentoAdminReport } from '@/lib/admin/vigento'
import { PageHeader, StatCard, fa } from '../ui'

export const dynamic = 'force-dynamic'

export default async function AdminVigentoPage() {
  const report = await getVigentoAdminReport(30)
  const successRate = report.total > 0 ? Math.round((report.succeeded / report.total) * 100) : 0
  const applyRate = report.total > 0 ? Math.round((report.applied / report.total) * 100) : 0
  const feedbackTotal = report.helpful + report.unhelpful
  const helpfulRate = feedbackTotal > 0 ? Math.round((report.helpful / feedbackTotal) * 100) : 0

  return (
    <div className="space-y-5">
      <PageHeader
        title="ویجنتو"
        subtitle="هسته اختصاصی تحلیل، تصمیم‌سازی و اجرای عملیات مدیریتی پلتفرم"
        icon={Sparkles}
      />

      <VigentoAdminConsole />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="عملیات ۳۰ روز" value={fa(report.total)} sub={`${fa(report.succeeded)} اجرای موفق`} icon={<Activity className="h-5 w-5" />} />
        <StatCard label="نرخ موفقیت" value={`${fa(successRate)}٪`} sub={`${fa(report.failed)} اجرای ناموفق`} icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="اعمال پیشنهادها" value={`${fa(applyRate)}٪`} sub="پس از تأیید صریح مالک" icon={<Sparkles className="h-5 w-5" />} />
        <StatCard label="بازخورد مفید" value={`${fa(helpfulRate)}٪`} sub={`میانگین پاسخ ${fa(report.averageDurationMs)} میلی‌ثانیه`} icon={<Clock3 className="h-5 w-5" />} />
      </div>

    </div>
  )
}
