import { BriefcaseBusiness, CalendarDays, Sparkles } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ServiceCatalogManager } from '@/components/services/service-catalog-manager'

export default async function ServicesPage() {
  const user = await requireUser()
  const services = await prisma.service.findMany({
    where: { workspaceId: user.workspaceId },
    orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
    include: { _count: { select: { appointments: true } } },
  })

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="spatial-surface overflow-hidden rounded-[1.75rem] p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-black text-white shadow-[var(--shadow-control)]"><BriefcaseBusiness className="h-5 w-5" /></span>
            <div><p className="text-[10px] font-bold text-black/40">کاتالوگ خدمات کسب‌وکار</p><h1 className="mt-1 text-2xl font-bold tracking-tight">خدمات</h1><p className="mt-2 max-w-xl text-xs leading-6 text-black/50">خدمت، مدت و محل ارائه را یک‌بار ثبت کنید؛ همین داده در ایجنت، رزرو و معرفی به مشتری استفاده می‌شود.</p></div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-2xl border border-black/8 bg-black/[0.025] px-4 py-3"><Sparkles className="mx-auto h-4 w-4"/><p className="mt-1 text-lg font-bold">{services.filter((item) => item.active).length.toLocaleString('fa-IR')}</p><p className="text-[9px] text-black/40">خدمت فعال</p></div>
            <div className="rounded-2xl border border-black/8 bg-black/[0.025] px-4 py-3"><CalendarDays className="mx-auto h-4 w-4"/><p className="mt-1 text-lg font-bold">{services.reduce((sum, item) => sum + item._count.appointments, 0).toLocaleString('fa-IR')}</p><p className="text-[9px] text-black/40">رزرو ثبت‌شده</p></div>
          </div>
        </div>
      </header>
      <ServiceCatalogManager initialServices={services.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() }))} />
    </div>
  )
}
