import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import {
	Bot,
	MessagesSquare,
	Users,
	Package,
	Star,
	CheckCircle2,
	Cpu,
} from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { StatsCard } from '@/components/dashboard/stats-card'
import { OnboardingChecklist } from '@/components/dashboard/onboarding-checklist'
import { computeOnboarding } from '@/lib/onboarding'
import {
	ConversationChart,
	type TrendPoint,
} from '@/components/dashboard/charts/conversation-chart'
import { ChannelDonut } from '@/components/dashboard/charts/channel-donut'
import { BarList } from '@/components/dashboard/charts/bar-list'
import { SatisfactionGauge } from '@/components/dashboard/charts/satisfaction-gauge'
import { HourlyHeatmap } from '@/components/dashboard/charts/hourly-heatmap'
import { AgentSparkline } from '@/components/dashboard/charts/agent-sparkline'
import { CHANNEL_LABELS } from '@/components/crm/channel-badge'

const DAYS = 14

export default async function OverviewPage() {
	const user = await requireUser()
	const t = await getTranslations('dashboard')
	const tA = await getTranslations('analytics')
	const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
	const ws = user.workspaceId

	const [
		agents,
		conversations,
		contacts,
		products,
		onboarding,
		convos,
		channelGroups,
		ratingAgg,
		ratedCount,
		resolved,
		totalConvos,
		usageAgg,
		topProducts,
		agentList,
	] = await Promise.all([
		prisma.agent.count({ where: { workspaceId: ws } }),
		prisma.conversation.count({ where: { workspaceId: ws } }),
		prisma.contact.count({ where: { workspaceId: ws } }),
		prisma.product.count({ where: { workspaceId: ws } }),
		computeOnboarding(ws),
		prisma.conversation.findMany({
			where: { workspaceId: ws, createdAt: { gte: daysAgo(DAYS) } },
			select: { createdAt: true, agentId: true },
		}),
		prisma.conversation.groupBy({
			by: ['channel'],
			where: { workspaceId: ws },
			_count: { _all: true },
		}),
		prisma.conversation.aggregate({
			where: { workspaceId: ws, rating: { not: null } },
			_avg: { rating: true },
		}),
		prisma.conversation.count({
			where: { workspaceId: ws, rating: { not: null } },
		}),
		prisma.conversation.count({
			where: { workspaceId: ws, status: 'RESOLVED' },
		}),
		prisma.conversation.count({ where: { workspaceId: ws } }),
		prisma.usageLog.aggregate({
			where: { workspaceId: ws },
			_sum: { promptTokens: true, completionTokens: true },
		}),
		prisma.product.findMany({
			where: { workspaceId: ws, queryCount: { gt: 0 } },
			orderBy: { queryCount: 'desc' },
			take: 6,
			select: { name: true, queryCount: true },
		}),
		prisma.agent.findMany({
			where: { workspaceId: ws },
			select: { id: true, name: true },
		}),
	])

	// ── Daily trend ──
	const dayFmt = new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-US', {
		month: 'short',
		day: 'numeric',
	})
	const buckets = new Map<string, number>()
	for (let i = 0; i < DAYS; i++) {
		const d = new Date(daysAgo(DAYS))
		d.setDate(d.getDate() + i)
		buckets.set(d.toDateString(), 0)
	}
	for (const c of convos) {
		const key = new Date(c.createdAt).toDateString()
		if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1)
	}
	const trend: TrendPoint[] = [...buckets.entries()].map(([key, value]) => ({
		label: dayFmt.format(new Date(key)),
		value,
	}))

	// ── Day-of-week × hour heatmap ──
	const heatmap: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0))
	for (const c of convos) {
		const d = new Date(c.createdAt)
		heatmap[d.getDay()][d.getHours()] += 1
	}
	const dayFmtShort = new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-US', {
		weekday: 'short',
	})
	const dayLabels = Array.from({ length: 7 }, (_, i) =>
		dayFmtShort.format(new Date(2024, 0, 7 + i)),
	)

	// ── Per-agent daily trend sparklines ──
	const agentName = new Map(agentList.map((a) => [a.id, a.name]))
	const agentDaily = new Map<string, number[]>()
	for (const c of convos) {
		if (!c.agentId) continue
		let arr = agentDaily.get(c.agentId)
		if (!arr) {
			arr = new Array(DAYS).fill(0)
			agentDaily.set(c.agentId, arr)
		}
		const idx = Math.floor(
			(new Date(c.createdAt).getTime() - daysAgo(DAYS).getTime()) / 86_400_000,
		)
		if (idx >= 0 && idx < DAYS) arr[idx] += 1
	}
	const agentTrends = [...agentDaily.entries()]
		.map(([id, series]) => ({
			id,
			name: agentName.get(id) ?? '—',
			series,
			total: series.reduce((a, b) => a + b, 0),
		}))
		.sort((a, b) => b.total - a.total)
		.slice(0, 6)

	const channels = channelGroups
		.map((g) => ({
			label: CHANNEL_LABELS[g.channel] ?? g.channel,
			value: g._count._all,
		}))
		.sort((a, b) => b.value - a.value)

	const avgRating = ratingAgg._avg.rating
	const totalTokens =
		(usageAgg._sum.promptTokens ?? 0) + (usageAgg._sum.completionTokens ?? 0)
	const resolveRate = totalConvos ? Math.round((resolved / totalConvos) * 100) : 0
	const handedOffCount = await prisma.conversation.count({
		where: { workspaceId: ws, handedOff: true },
	})

	const nf = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US')

	return (
		<div className="mx-auto max-w-6xl space-y-6">
			<div>
				<h1 className="text-2xl font-light text-[var(--text-primary)]">
					{t('overview')}
				</h1>
			</div>

			{!onboarding.completed && <OnboardingChecklist initialState={onboarding} />}

			{/* Top stats — counts */}
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				<StatsCard label={t('agents')} value={agents} icon={Bot} />
				<StatsCard
					label={t('conversations')}
					value={conversations}
					icon={MessagesSquare}
				/>
				<StatsCard label={t('contacts')} value={contacts} icon={Users} />
				<StatsCard label={t('products')} value={products} icon={Package} />
			</div>

			{/* Mid stats — quality metrics */}
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				<StatsCard
					label={tA('resolveRate')}
					value={`${nf.format(resolveRate)}${locale === 'fa' ? '٪' : '%'}`}
					icon={CheckCircle2}
					hint={locale === 'fa' ? 'گفتگوهای کامل بسته‌شده' : 'Conversations fully closed'}
				/>
				<StatsCard
					label={tA('avgRating')}
					value={avgRating ? avgRating.toFixed(1) : '—'}
					icon={Star}
					hint={
						locale === 'fa'
							? `${nf.format(ratedCount)} رأی`
							: `${nf.format(ratedCount)} ratings`
					}
				/>
				<StatsCard
					label={locale === 'fa' ? 'تحویل به اپراتور' : 'Handoffs'}
					value={nf.format(handedOffCount)}
					icon={Users}
					hint={
						locale === 'fa' ? 'انتقال به اپراتور انسانی' : 'Escalated to human operator'
					}
				/>
				<StatsCard
					label={tA('tokensUsed')}
					value={nf.format(totalTokens)}
					icon={Cpu}
					hint={locale === 'fa' ? 'مجموع توکن مصرفی' : 'Total tokens consumed'}
				/>
			</div>

			{/* Conversations trend */}
			<Panel title={tA('conversationsTrend')}>
				<ConversationChart data={trend} />
			</Panel>

			{/* Channel + satisfaction */}
			<div className="grid gap-4 lg:grid-cols-2">
				<Panel title={tA('channelBreakdown')}>
					{channels.length ? (
						<ChannelDonut data={channels} />
					) : (
						<Empty text={tA('noData')} />
					)}
				</Panel>
				<Panel title={tA('satisfaction')}>
					<SatisfactionGauge value={avgRating} count={ratedCount} label={tA('ratings')} />
				</Panel>
			</div>

			{/* Heatmap */}
			<Panel title={tA('activityHeatmap')}>
				<HourlyHeatmap matrix={heatmap} dayLabels={dayLabels} emptyText={tA('noData')} />
			</Panel>

			{/* Top products + agent activity */}
			<div className="grid gap-4 lg:grid-cols-2">
				<Panel title={tA('topProducts')}>
					{topProducts.length ? (
						<BarList
							data={topProducts.map((p) => ({
								label: p.name,
								value: p.queryCount,
							}))}
						/>
					) : (
						<Empty text={tA('noData')} />
					)}
				</Panel>
				<Panel title={tA('agentActivity')}>
					{agentTrends.length ? (
						<div className="divide-y divide-[var(--border-subtle)]">
							{agentTrends.map((a) => (
								<Link
									key={a.id}
									href={`/agents/${a.id}/analytics`}
									className="flex items-center gap-3 py-2.5 transition-colors hover:opacity-80"
								>
									<span className="min-w-0 flex-1 truncate text-sm text-[var(--text-primary)]">
										{a.name}
									</span>
									<AgentSparkline data={a.series} />
									<span className="w-8 text-end text-sm text-[var(--text-secondary)]">
										{nf.format(a.total)}
									</span>
								</Link>
							))}
						</div>
					) : (
						<Empty text={tA('noData')} />
					)}
				</Panel>
			</div>
		</div>
	)
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
			<h2 className="mb-4 text-sm font-medium text-[var(--text-secondary)]">{title}</h2>
			{children}
		</section>
	)
}

function Empty({ text }: { text: string }) {
	return (
		<div className="flex h-[180px] items-center justify-center text-sm text-[var(--text-muted)]">
			{text}
		</div>
	)
}

function daysAgo(n: number): Date {
	const d = new Date()
	d.setHours(0, 0, 0, 0)
	d.setDate(d.getDate() - (n - 1))
	return d
}
