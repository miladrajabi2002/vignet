import { BriefcaseBusiness, CalendarDays, Sparkles } from 'lucide-react'
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

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        icon={BriefcaseBusiness}
        title="خدمات"
        subtitle="خدمت، مدت و محل ارائه را یک‌بار ثبت کنید؛ همین داده در ایجنت، رزرو و معرفی به مشتری استفاده می‌شود."
        actions={
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-2xl border border-black/8 bg-black/[0.025] px-4 py-3"><Sparkles className="mx-auto h-4 w-4"/><p className="mt-1 text-lg font-bold">{services.filter((item) => item.active).length.toLocaleString('fa-IR')}</p><p className="text-[9px] text-black/40">خدمت فعال</p></div>
            <div className="rounded-2xl border border-black/8 bg-black/[0.025] px-4 py-3"><CalendarDays className="mx-auto h-4 w-4"/><p className="mt-1 text-lg font-bold">{services.reduce((sum, item) => sum + item._count.appointments, 0).toLocaleString('fa-IR')}</p><p className="text-[9px] text-black/40">رزرو ثبت‌شده</p></div>
          </div>
        }
      />
      <ServiceCatalogManager initialServices={services.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() }))} />
    </div>
  )
}
