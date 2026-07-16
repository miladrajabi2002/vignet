import { BriefcaseBusiness, CalendarDays, Plus, Sparkles } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ServiceCatalogManager } from '@/components/services/service-catalog-manager'
import { PageHeader } from '@/components/dashboard/page-header'

export default async function ServicesPage() {
  const user = await requireUser()
  const services = await prisma.service.findMany({
    where: { workspaceId: user.workspaceId },
    orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
    include: { _count: { select: { appointments: true } } },
  })

  const activeCount = services.filter((item) => item.active).length
  const totalBookings = services.reduce((sum, item) => sum + item._count.appointments, 0)

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        icon={BriefcaseBusiness}
        title="خدمات"
        subtitle="خدمت، مدت و محل ارائه را یک‌بار ثبت کنید؛ همین داده در ایجنت، رزرو و معرفی به مشتری استفاده می‌شود."
        actions={
          <ServiceNewButton />
        }
      />

      {/* Stat row — two compact tiles, consistent with the rest of the dashboard */}
      <div className="grid grid-cols-2 gap-4">
        <div className="spatial-surface flex items-center gap-4 rounded-[1.5rem] p-4 sm:p-5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-black text-white shadow-[var(--shadow-control)]">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">
              {activeCount.toLocaleString('fa-IR')}
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">خدمت فعال</p>
          </div>
        </div>
        <div className="spatial-surface flex items-center gap-4 rounded-[1.5rem] p-4 sm:p-5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-black text-white shadow-[var(--shadow-control)]">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">
              {totalBookings.toLocaleString('fa-IR')}
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">رزرو ثبت‌شده</p>
          </div>
        </div>
      </div>

      <ServiceCatalogManager initialServices={services.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() }))} />
    </div>
  )
}

/**
 * The "خدمت جدید" trigger lives in the PageHeader actions (matching the
 * agents page pattern). It dispatches a CustomEvent that the
 * ServiceCatalogManager listens for to open its inline form — keeping the
 * form state where it belongs (the client component) while the button
 * renders in the server-rendered PageHeader.
 */
function ServiceNewButton() {
  return (
    <button
      type="button"
      // eslint-disable-next-line react/no-unknown-property
      onclick="window.dispatchEvent(new CustomEvent('service:new'))"
      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-sm font-bold text-[var(--bg-base)] shadow-[var(--shadow-control)] transition-opacity hover:opacity-90"
    >
      <Plus className="h-4 w-4" />
      خدمت جدید
    </button>
  )
}
