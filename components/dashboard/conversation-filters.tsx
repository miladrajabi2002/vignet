'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Search, X, SlidersHorizontal } from 'lucide-react'

type StatusKey = 'OPEN' | 'RESOLVED' | 'HANDED_OFF'

interface StatusOption {
	key: StatusKey | 'ALL'
	label: string
	count: number
}

interface ChannelOption {
	key: string
	label: string
	count: number
}

/**
 * Conversation filter bar — minimal, material, matches the Contacts page style.
 * Single row: search + status select + channel select + agent select + clear.
 * URL-driven (server-side filtering) with auto-submit on select change.
 */
export function ConversationFilters({
	statusOptions,
	channelOptions,
	activeStatus,
	activeChannel,
	activeAgent,
	agentOptions = [],
	query,
	basePath = '/conversations',
	isFa,
}: {
	statusOptions: StatusOption[]
	channelOptions: ChannelOption[]
	activeStatus: string | undefined
	activeChannel: string | undefined
	activeAgent?: string
	agentOptions?: Array<{ key: string; label: string; count: number }>
	query?: string
	basePath?: string
	isFa: boolean
}) {
	const router = useRouter()
	const params = useSearchParams()
	const hasActiveFilter = !!activeStatus || !!activeChannel || !!activeAgent || !!query
	const showAgent = agentOptions.length > 1

	function navigate(next: { status?: string; channel?: string; agent?: string; q?: string }) {
		const sp = new URLSearchParams(params.toString())
		const setStatus = next.status !== undefined ? next.status : activeStatus
		const setChannel = next.channel !== undefined ? next.channel : activeChannel
		const setAgent = next.agent !== undefined ? next.agent : activeAgent
		const setQ = next.q !== undefined ? next.q : query
		sp.delete('status'); if (setStatus) sp.set('status', setStatus)
		sp.delete('channel'); if (setChannel) sp.set('channel', setChannel)
		sp.delete('agent'); if (setAgent) sp.set('agent', setAgent)
		sp.delete('q'); if (setQ) sp.set('q', setQ)
		sp.delete('page')
		const qs = sp.toString()
		router.push(qs ? `${basePath}?${qs}` : basePath)
	}

	const totalResults = statusOptions.find((o) => o.key === 'ALL')?.count ?? 0

	return (
		<div
			className="rounded-2xl border bg-[var(--bg-surface)] p-3 sm:p-4"
			style={{ borderColor: 'var(--border-default)' }}
		>
			<form
				action={basePath}
				method="get"
				className="flex flex-col gap-2.5 sm:flex-row sm:items-center"
			>
				{activeStatus && <input type="hidden" name="status" value={activeStatus} />}
				{activeChannel && <input type="hidden" name="channel" value={activeChannel} />}
				{activeAgent && <input type="hidden" name="agent" value={activeAgent} />}

				{/* Search */}
				<label className="relative min-w-0 flex-1">
					<span className="sr-only">{isFa ? 'جست‌وجوی گفتگو' : 'Search conversations'}</span>
					<Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
					<input
						name="q"
						defaultValue={query}
						maxLength={120}
						placeholder={isFa ? 'نام، شماره یا متن پیام…' : 'Name, phone, or message text…'}
						className="min-h-11 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] pe-3 ps-9 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--border-strong)]"
					/>
				</label>

				{/* Status select */}
				<select
					value={activeStatus ?? ''}
					onChange={(e) => navigate({ status: e.target.value || undefined })}
					className="input min-h-11 min-w-[8.5rem] cursor-pointer appearance-none bg-[var(--bg-base)] text-sm"
					aria-label={isFa ? 'وضعیت' : 'Status'}
				>
					{statusOptions.map((opt) => (
						<option key={opt.key} value={opt.key === 'ALL' ? '' : opt.key}>
							{opt.label}
							{opt.key !== 'ALL' ? ` (${opt.count.toLocaleString(isFa ? 'fa-IR' : 'en-US')})` : ` (${opt.count.toLocaleString(isFa ? 'fa-IR' : 'en-US')})`}
						</option>
					))}
				</select>

				{/* Channel select */}
				{channelOptions.length > 0 && (
					<select
						value={activeChannel ?? ''}
						onChange={(e) => navigate({ channel: e.target.value || undefined })}
						className="input min-h-11 min-w-[8.5rem] cursor-pointer appearance-none bg-[var(--bg-base)] text-sm"
						aria-label={isFa ? 'کانال' : 'Channel'}
					>
						{channelOptions.map((opt) => (
							<option key={opt.key} value={opt.key === 'ALL' ? '' : opt.key}>
								{opt.label}
								{opt.key !== 'ALL' ? ` (${opt.count.toLocaleString(isFa ? 'fa-IR' : 'en-US')})` : ''}
							</option>
						))}
					</select>
				)}

				{/* Agent select */}
				{showAgent && (
					<select
						value={activeAgent ?? ''}
						onChange={(e) => navigate({ agent: e.target.value || undefined })}
						className="input min-h-11 min-w-[8.5rem] cursor-pointer appearance-none bg-[var(--bg-base)] text-sm"
						aria-label={isFa ? 'ایجنت' : 'Agent'}
					>
						{agentOptions.map((opt) => (
							<option key={opt.key} value={opt.key}>
								{opt.label} ({opt.count.toLocaleString(isFa ? 'fa-IR' : 'en-US')})
							</option>
						))}
					</select>
				)}

				{/* Search button (mobile-friendly submit) */}
				<button
					type="submit"
					className="hidden min-h-11 items-center justify-center rounded-xl bg-[var(--white)] px-4 text-sm font-medium text-[var(--bg-base)] sm:inline-flex"
				>
					{isFa ? 'جست‌وجو' : 'Search'}
				</button>

				{hasActiveFilter && (
					<button
						type="button"
						onClick={() => router.push(basePath)}
						className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-default)] px-3 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
					>
						<X className="h-3.5 w-3.5" />
						{isFa ? 'پاک‌کردن' : 'Clear'}
					</button>
				)}
			</form>

			{/* Result count footer */}
			<div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
				<SlidersHorizontal className="h-3 w-3" />
				<span>
					{totalResults.toLocaleString(isFa ? 'fa-IR' : 'en-US')} {isFa ? 'گفتگو' : 'conversations'}
					{hasActiveFilter ? (isFa ? ' با فیلتر فعال' : ' with active filter') : ''}
				</span>
			</div>
		</div>
	)
}
