import { DashboardHeaderSkeleton } from '@/components/dashboard/dashboard-skeletons'
import {
  BusinessProfileSkeleton,
  OperatorSetupSkeleton,
  SettingsMobileTabsSkeleton,
  WeeklyReportSkeleton,
} from '@/components/dashboard/pages-skeletons'

/**
 * Route-level skeleton for /settings — mirrors the page: PageHeader, the
 * mobile settings tab bar and the three tab panels (business profile,
 * operator channel setup, weekly report card).
 */
export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <DashboardHeaderSkeleton />

      {/* Mobile-only section tabs (business / operator / reports) */}
      <SettingsMobileTabsSkeleton delay={-80} />

      {/* Business profile step */}
      <BusinessProfileSkeleton delay={-120} />

      {/* Operator channel setup */}
      <OperatorSetupSkeleton delay={-180} />

      {/* Weekly report card */}
      <WeeklyReportSkeleton delay={-240} />
    </div>
  )
}
