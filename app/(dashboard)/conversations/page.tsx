import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import type { ChannelType, ConvStatus } from '@prisma/client'
import { MessagesSquare, User, Clock, Filter, RefreshCw } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ChannelBadge } from '@/components/crm/channel-badge'
import { MetricsExplainer } from '@/components/dashboard/metrics-explainer'
import { MiniTrend } from '@/components/admin/mini-trend'
import { ConversationFilters } from '@/components/dashboard/conversation-filters'
import {
	conversationsDailyByWorkspace,
	resolvedDailyByWorkspace,
	handoffsDailyByWorkspace,
} from '@/lib/dashboard/charts'
import { relativeTime } from '@/lib/format'
import { stripProductTokens } from '@/lib/widget/config'
import { Pagination } from '@/components/ui/pagination'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 50

const CHANNEL_LABELS_FA: Record<string, string> = {
	TELEGRAM: 'تلگرام',
	WHATSAPP: 'واتساپ',
	INSTAGRAM: 'اینستاگرام',
	RUBIKA: 'روبیکا',
	BALE: 'بله',
	WEB_WIDGET: 'ویجت وب',
	API: 'API',
}

export default async function ConversationsPage(props: {
	searchParams: Promise<{ page?: string; channel?: string; status?: string }>
}) {
	const searchParams = await props.searchParams
	const user = await requireUser()
	const t = await getTranslations('conversations')
	const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
	const isFa = locale === 'fa'

	const page = Math.max(1, Number(searchParams.page) || 1)

	// ── Filters from query string ──
	const channelFilter = searchParams.channel as ChannelType | undefined
	const statusFilter = searchParams.status as ConvStatus | undefined

	const where: {
		workspaceId: string
		channel?: ChannelType
		status?: ConvStatus
	} = { workspaceId: user.workspaceId }
	if (channelFilter) where.channel = channelFilter
	if (statusFilter) where.status = statusFilter

	const [
		conversations,
		totalCount,
		openCount,
		resolvedCount,
		handedOffCount,
		convTrend7,
		resolvedTrend7,
		handoffTrend7,
		channelGroups,
	] = await Promise.all([
		prisma.conversation.findMany({
			where,
			orderBy: [
				// Handed-off conversations first (need attention), then by last message.
				{ handedOff: 'desc' },
				{ lastMessageAt: 'desc' },
				{ createdAt: 'desc' },
			],
			skip: (page - 1) * PAGE_SIZE,
			take: PAGE_SIZE + 1,
			select: {
				id: true,
				channel: true,
				status: true,
				handedOff: true,
				lastMessageAt: true,
				createdAt: true,
				agent: { select: { name: true } },
				contact: { select: { name: true, phone: true } },
				messages: {
					orderBy: { createdAt: 'desc' },
					take: 1,
					select: { content: true, role: true },
				},
			},
		}),
		prisma.conversation.count({ where: { workspaceId: user.workspaceId } }),
		prisma.conversation.count({
			where: { workspaceId: user.workspaceId, status: 'OPEN' },
		}),
		prisma.conversation.count({
			where: { workspaceId: user.workspaceId, status: 'RESOLVED' },
		}),
		prisma.conversation.count({
			where: { workspaceId: user.workspaceId, status: 'HANDED_OFF' },
		}),
		conversationsDailyByWorkspace(user.workspaceId, 7),
		resolvedDailyByWorkspace(user.workspaceId, 7),
		handoffsDailyByWorkspace(user.workspaceId, 7),
		// Available channels for the filter pills.
		prisma.conversation.groupBy({
			by: ['channel'],
			where: { workspaceId: user.workspaceId },
			_count: { _all: true },
		}),
	])

	const hasNext = conversations.length > PAGE_SIZE
	const pageItems = hasNext ? conversations.slice(0, PAGE_SIZE) : conversations

	// Build filter pill hrefs (resets to page 1).
	const channelLabels = isFa ? CHANNEL_LABELS_FA : null
	const availableChannels = channelGroups
		.map((g) => ({ channel: g.channel, count: g._count._all }))
		.sort((a, b) => b.count - a.count)

	function filterHref(overrides: { channel?: string; status?: string }): string {
		const sp = new URLSearchParams()
		const ch = overrides.channel ?? ''
		const st = overrides.status ?? ''
		if (ch) sp.set('channel', ch)
		if (st) sp.set('status', st)
		const qs = sp.toString()
		return qs ? `/conversations?${qs}` : '/conversations'
	}

	return (
		<div className="mx-auto max-w-4xl space-y-6">
			<div>
				<h1 className="text-2xl font-light text-[var(--text-primary)]">{t('title')}</h1>
				<p className="mt-1 text-sm text-[var(--text-secondary)]">{t('subtitle')}</p>
			</div>

			{/* ─── 7-day MiniTrends ─── */}
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
				<MiniTrend
					label={isFa ? 'مکالمات ۷ روز' : 'Conversations 7d'}
					value={convTrend7.total}
					series={convTrend7.series}
					color="#3b82f6"
					hint={
						isFa ? `کل: ${totalCount.toLocaleString('fa-IR')}` : `Total: ${totalCount}`
					}
				/>
				<MiniTrend
					label={isFa ? 'بسته‌شده ۷ روز' : 'Resolved 7d'}
					value={resolvedTrend7.total}
					series={resolvedTrend7.series}
					color="#22c55e"
					hint={
						isFa
							? `کل: ${resolvedCount.toLocaleString('fa-IR')}`
							: `Total: ${resolvedCount}`
					}
				/>
				<MiniTrend
					label={isFa ? 'تحویل اپراتور ۷ روز' : 'Handoffs 7d'}
					value={handoffTrend7.total}
					series={handoffTrend7.series}
					color="#f59e0b"
					hint={
						isFa
							? `کل: ${handedOffCount.toLocaleString('fa-IR')}`
							: `Total: ${handedOffCount}`
					}
				/>
			</div>

			{/* ─── Filters: status (handed-off prioritized) + channel ─── */}
			<ConversationFilters
				isFa={isFa}
				activeStatus={statusFilter}
				activeChannel={channelFilter}
				makeHref={(o) => filterHref({ channel: o.channel, status: o.status })}
				clearHref="/conversations"
				statusOptions={[
					{ key: 'ALL', label: isFa ? 'همه' : 'All', count: totalCount },
					{
						key: 'HANDED_OFF',
						label: isFa ? 'تحویل اپراتور' : 'Handed off',
						count: handedOffCount,
					},
					{ key: 'OPEN', label: isFa ? 'باز' : 'Open', count: openCount },
					{
						key: 'RESOLVED',
						label: isFa ? 'بسته‌شده' : 'Resolved',
						count: resolvedCount,
					},
				]}
				channelOptions={[
					{ key: 'ALL', label: isFa ? 'همه' : 'All', count: 0 },
					...availableChannels.map((c) => ({
						key: c.channel,
						label: channelLabels?.[c.channel] ?? c.channel,
						count: c.count,
					})),
				]}
			/>

			{pageItems.length === 0 ? (
				<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-16 text-center">
					<MessagesSquare className="h-8 w-8 text-[var(--text-muted)]" />
					<p className="mt-4 text-sm text-[var(--text-secondary)]">
						{channelFilter || statusFilter
							? isFa
								? 'مکالمه‌ای با این فیلتر یافت نشد'
								: 'No conversations match these filters'
							: t('empty')}
					</p>
					{!channelFilter && !statusFilter && (
						<Link
							href="/integrations"
							className="mt-6 rounded-xl bg-[var(--white)] px-5 py-2.5 text-sm font-medium text-[var(--bg-base)] transition-transform hover:scale-[1.02]"
						>
							{t('emptyCta')}
						</Link>
					)}
				</div>
			) : (
				<div className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
					{pageItems.map((c) => {
						const last = c.messages[0]
						const when = c.lastMessageAt ?? c.createdAt
						const who = c.contact?.name || c.contact?.phone || t('anonymous')
						return (
							<Link
								key={c.id}
								href={`/conversations/${c.id}`}
								className={cn(
									'flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-hover)]',
									c.handedOff && 'bg-amber-500/5',
								)}
							>
								<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] text-[var(--text-secondary)]">
									<User className="h-4 w-4" />
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<span className="truncate text-sm font-medium text-[var(--text-primary)]">
											{who}
										</span>
										<ChannelBadge type={c.channel} />
										{c.handedOff && (
											<span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-500">
												<span className="relative flex h-1.5 w-1.5">
													<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
													<span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
												</span>
												{isFa ? 'تحویل اپراتور' : 'Handed off'}
											</span>
										)}
									</div>
									<p className="truncate text-xs text-[var(--text-secondary)]">
										{last
											? `${last.role === 'ASSISTANT' ? '↩ ' : ''}${stripProductTokens(last.content)}`
											: c.agent.name}
									</p>
								</div>
								<span className="shrink-0 text-[11px] text-[var(--text-muted)]">
									{relativeTime(when, locale)}
								</span>
							</Link>
						)
					})}
				</div>
			)}

			<Pagination
				page={page}
				hasNext={hasNext}
				makeHref={(p) => {
					const sp = new URLSearchParams()
					if (channelFilter) sp.set('channel', channelFilter)
					if (statusFilter) sp.set('status', statusFilter)
					if (p > 1) sp.set('page', String(p))
					const qs = sp.toString()
					return qs ? `/conversations?${qs}` : '/conversations'
				}}
			/>

			<MetricsExplainer
				title={
					locale === 'fa' ? 'این لیست چگونه مرتب می‌شود؟' : 'How is this list ordered?'
				}
				items={[
					{
						icon: Clock,
						term: locale === 'fa' ? 'ترتیب نمایش: ' : 'Sort order: ',
						body:
							locale === 'fa'
								? 'مکالمات تحویل‌داده‌شده به اپراتور (نیاز به توجه) اول نمایش داده می‌شوند، سپس بقیه بر اساس زمان آخرین پیام (جدیدترین اول).'
								: 'Handed-off conversations (needing attention) are shown first, then the rest by last message time (newest first).',
					},
					{
						icon: Filter,
						term: locale === 'fa' ? 'فیلترها: ' : 'Filters: ',
						body:
							locale === 'fa'
								? 'می‌توانید بر اساس کانال (تلگرام، واتساپ، ...) و وضعیت (باز، بسته‌شده، تحویل اپراتور) فیلتر کنید. فیلترها در URL ذخیره می‌شوند تا قابل اشتراک‌گذاری باشند.'
								: 'Filter by channel (Telegram, WhatsApp, ...) and status (open, resolved, handed off). Filters are stored in the URL so they can be shared.',
					},
					{
						icon: RefreshCw,
						term: locale === 'fa' ? 'به‌روزرسانی: ' : 'Live updates: ',
						body:
							locale === 'fa'
								? 'این صفحه به‌صورت لحظه‌ای به‌روز نمی‌شود. برای دیدن مکالمات جدید، صفحه را refresh کنید. وضعیت مکالمه در صفحه جزئیات قابل تغییر است.'
								: 'This page does not update in real time. Refresh to see new conversations. Conversation status can be changed on the detail page.',
					},
				]}
			/>
		</div>
	)
}
