import { Suspense } from 'react'
import { BriefcaseBusiness, CalendarDays, Sparkles } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ServiceCatalogManager } from '@/components/services/service-catalog-manager'
import { ServiceNewButton } from '@/components/services/service-new-button'
import { PageHeader } from '@/components/dashboard/page-header'

export const dynamic = 'force-dynamic'

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
          // ServiceNewButton is a client component (uses useRouter). Wrapping it
          // in Suspense is harmless and keeps the header stable during any
          // client-side search-param transitions.
          <Suspense fallback={null}>
            <ServiceNewButton />
          </Suspense>
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

      {/* ServiceCatalogManager uses useSearchParams() to watch the `?new=<ts>`
          param set by the "خدمت جدید" button. In Next.js 15 any client
          component that reads useSearchParams MUST sit inside a <Suspense>
          boundary, otherwise the hook bails out to client-side rendering and
          stops reacting to URL changes — which is exactly why clicking the
          button did nothing. The boundary below fixes that. */}
      <Suspense fallback={null}>
        <ServiceCatalogManager initialServices={services.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() }))} />
      </Suspense>
    </div>
  )
}
