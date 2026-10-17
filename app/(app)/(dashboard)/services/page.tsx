import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { listBookingServices } from '@/lib/bookings/service'
import { getDashboardModuleLabel, getDashboardModules } from '@/lib/verticals/registry'
import { workspaceCapabilities } from '@/lib/verticals/profile'
import { serviceFromApi } from '@/components/bookings/booking-model'
import { ServiceCatalog } from '@/components/services/service-catalog'

export const dynamic = 'force-dynamic'

export default async function ServicesPage() {
  const user = await requireUser()
  const [workspace, services] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: user.workspaceId },
      select: { businessType: true, businessProfile: true },
    }),
    listBookingServices(user.workspaceId),
  ])
  const bookingEnabled = getDashboardModules(workspaceCapabilities(workspace)).includes('appointments')

  return (
    <ServiceCatalog
      title={getDashboardModuleLabel('services', workspace?.businessType, 'fa', 'خدمات')}
      bookingEnabled={bookingEnabled}
      // Active first, then newest — the order a manager scans a catalog in.
      initialServices={services
        .map((service) => serviceFromApi(service as unknown as Record<string, unknown>))
        .sort((a, b) => Number(b.active) - Number(a.active))}
    />
  )
}
