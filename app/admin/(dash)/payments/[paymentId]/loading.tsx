import { AdminLoadingShell, PageHeaderSkeleton, PanelSkeleton } from '../../admin-skeletons'

/** Skeleton for /admin/payments/[id] — header → 3 detail panels beside
 *  the summary column. */
export default function AdminPaymentLoading() {
  return (
    <AdminLoadingShell>
      <PageHeaderSkeleton />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <PanelSkeleton rows={6} />
          <PanelSkeleton delay={-120} rows={3} />
          <PanelSkeleton delay={-240} rows={2} />
        </div>
        <div className="space-y-5">
          <PanelSkeleton delay={-80} rows={3} />
          <PanelSkeleton delay={-200} rows={2} />
        </div>
      </div>
    </AdminLoadingShell>
  )
}
