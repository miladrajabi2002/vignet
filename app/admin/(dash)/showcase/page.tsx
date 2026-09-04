import { Star, Eye, EyeOff, Users } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { AdminShowcaseManager, type ShowcaseRow } from '@/components/showcase/admin-showcase-manager'
import { PageHeader, StatCard, Card, fa } from '../ui'

export const dynamic = 'force-dynamic'

export default async function AdminShowcasePage() {
	const entries = await prisma.showcaseEntry.findMany({
		orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
	})

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

	return (
		<div className="space-y-6">
			<PageHeader
				title="مشتریان ویجنت"
				subtitle="مدیریت ویترین مشتریان روی صفحه اصلی سایت"
				breadcrumbs={[
					{ label: 'داشبورد', href: '/admin' },
					{ label: 'مشتریان' },
				]}
			/>

			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
		</div>
	)
}
