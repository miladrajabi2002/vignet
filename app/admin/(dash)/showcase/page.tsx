import { Star, Eye, EyeOff, Users } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { AdminShowcaseManager, type ShowcaseRow } from '@/components/showcase/admin-showcase-manager'
import { AdminTrustedLogoManager, type TrustedLogoRow } from '@/components/showcase/admin-trusted-logo-manager'
import { PageHeader, StatCard, Card, fa } from '../ui'

export const dynamic = 'force-dynamic'

export default async function AdminShowcasePage() {
        const [entries, logos] = await Promise.all([
                prisma.showcaseEntry.findMany({
                        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
                }),
                prisma.trustedLogo.findMany({
                        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                }),
        ])

        const rows: ShowcaseRow[] = entries.map((e) => ({
                id: e.id,
                name: e.name,
                handle: e.handle,
                url: e.url,
                imageUrl: e.imageUrl,
                channels: e.channels,
                quote: e.quote,
                metricValue: e.metricValue,
                metricLabel: e.metricLabel,
                featured: e.featured,
                active: e.active,
                sortOrder: e.sortOrder,
                updatedAt: e.updatedAt.toISOString(),
        }))

        const activeCount = rows.filter((r) => r.active).length
        const featuredCount = rows.filter((r) => r.featured).length
        const withInstagram = rows.filter((r) => r.handle || r.channels.includes('INSTAGRAM')).length

        const logoRows: TrustedLogoRow[] = logos.map((l) => ({
                id: l.id,
                name: l.name,
                imageUrl: l.imageUrl,
                url: l.url,
                active: l.active,
                sortOrder: l.sortOrder,
                updatedAt: l.updatedAt.toISOString(),
        }))
        const activeLogos = logoRows.filter((l) => l.active).length

        return (
                <div className="space-y-6">
                        <PageHeader
                                title="محتوای صفحه اصلی"
                                subtitle="مدیریت ویترین مشتریان و لوگوی اعتماد روی صفحه اصلی سایت"
                                breadcrumbs={[
                                        { label: 'داشبورد', href: '/admin' },
                                        { label: 'محتوای صفحه اصلی' },
                                ]}
                        />

                        <div className="grid grid-cols-2 gap-3 min-[1380px]:grid-cols-4">
                                <StatCard
                                        label="کل مشتریان ثبت‌شده"
                                        value={fa(rows.length)}
                                        icon={<Users className="h-5 w-5" />}
                                        tone="default"
                                />
                                <StatCard
                                        label="فعال روی صفحه اصلی"
                                        value={fa(activeCount)}
                                        icon={<Eye className="h-5 w-5" />}
                                        tone="success"
                                />
                                <StatCard
                                        label="غیرفعال"
                                        value={fa(rows.length - activeCount)}
                                        icon={<EyeOff className="h-5 w-5" />}
                                        tone="warning"
                                />
                                <StatCard
                                        label="ویژه"
                                        value={fa(featuredCount)}
                                        icon={<Star className="h-5 w-5" />}
                                        tone="info"
                                />
                        </div>

                        <Card pad={false} className="overflow-hidden">
                                <AdminShowcaseManager initialEntries={rows} />
                        </Card>

                        <p className="text-[11px] leading-6 text-zinc-400">
                                {withInstagram > 0
                                        ? `${fa(withInstagram)} مشتری اینستاگرامی ثبت شده است.`
                                        : 'هنوز مشتری اینستاگرامی ثبت نشده است.'}{' '}
                                تغییرات بلافاصله روی صفحه اصلی اعمال می‌شوند؛ برای حذف موقت، دکمهٔ روشن/خاموش را بزنید.
                        </p>

                        <Card pad={false} className="overflow-hidden">
                                <div className="p-4">
                                        <AdminTrustedLogoManager initialLogos={logoRows} />
                                </div>
                        </Card>

                        <p className="text-[11px] leading-6 text-zinc-400">
                                {activeLogos > 0
                                        ? `${fa(activeLogos)} لوگوی فعال در بخش «اعتماد بهترین‌های صنعت» بالای صفحه اصلی نمایش داده می‌شود.`
                                        : 'هنوز لوگوی فعالی ثبت نشده است؛ بخش اعتماد تا اولین لوگوی فعال روی صفحه اصلی مخفی است.'}{' '}
                                آپلود لوگو با فرمت PNG یا WebP و پس‌زمینهٔ شفاف بهترین نتیجه را می‌دهد.
                        </p>
                </div>
        )
}
