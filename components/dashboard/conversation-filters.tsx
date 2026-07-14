'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Bot, MessageCircleWarning, Radio, Search, SlidersHorizontal, X } from 'lucide-react'
import { MaterialSelect } from '@/components/ui/material-select'
import { cn } from '@/lib/utils'

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
		const values = {
			status: next.status !== undefined ? next.status : activeStatus,
			channel: next.channel !== undefined ? next.channel : activeChannel,
			agent: next.agent !== undefined ? next.agent : activeAgent,
			q: next.q !== undefined ? next.q : query,
		}
		for (const [key, value] of Object.entries(values)) {
			sp.delete(key)
			if (value) sp.set(key, value)
		}
		sp.delete('page')
		const qs = sp.toString()
		router.push(qs ? `${basePath}?${qs}` : basePath)
	}

	const totalResults = statusOptions.find((option) => option.key === 'ALL')?.count ?? 0
	const operatorCount = statusOptions.find((option) => option.key === 'HANDED_OFF')?.count ?? 0
	const nf = new Intl.NumberFormat(isFa ? 'fa-IR' : 'en-US')

	return (
		<section className="spatial-surface overflow-hidden rounded-[1.5rem]">
			<div className="flex flex-col gap-3 border-b border-black/[0.07] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 className="flex items-center gap-2 text-xs font-bold text-black"><SlidersHorizontal className="h-3.5 w-3.5" />{isFa ? 'جست‌وجو و فیلتر گفتگوها' : 'Search and filter conversations'}</h2>
					<p className="mt-1 text-[11px] text-black/40">{nf.format(totalResults)} {isFa ? 'گفتگو در همه کانال‌ها' : 'conversations across all channels'}</p>
				</div>
				<button
					type="button"
					onClick={() => navigate({ status: activeStatus === 'HANDED_OFF' ? undefined : 'HANDED_OFF' })}
					className={cn(
						'spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-[11px] font-semibold transition-[background-color,border-color,color] duration-150',
						activeStatus === 'HANDED_OFF'
							? 'border-amber-400 bg-amber-400 text-black'
							: 'border-amber-400/25 bg-amber-400/[0.08] text-amber-700 hover:bg-amber-400/[0.14]',
					)}
				>
					<span className="relative flex h-2 w-2"><span className="absolute h-full w-full animate-ping rounded-full bg-amber-500 opacity-45 motion-reduce:animate-none" /><span className="relative h-2 w-2 rounded-full bg-amber-500" /></span>
					<MessageCircleWarning className="h-3.5 w-3.5" />
					{isFa ? 'نیاز به اپراتور' : 'Needs operator'}
					<span className="rounded-full bg-black/10 px-2 py-0.5 tabular-nums">{nf.format(operatorCount)}</span>
				</button>
			</div>

			<form action={basePath} method="get" className="grid gap-2.5 p-3 sm:p-4 lg:grid-cols-[minmax(15rem,1fr)_repeat(3,minmax(9.5rem,auto))_auto]">
				{activeStatus && <input type="hidden" name="status" value={activeStatus} />}
				{activeChannel && <input type="hidden" name="channel" value={activeChannel} />}
				{activeAgent && <input type="hidden" name="agent" value={activeAgent} />}

				<label className="relative min-w-0">
					<span className="sr-only">{isFa ? 'جست‌وجوی گفتگو' : 'Search conversations'}</span>
					<Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
					<input name="q" defaultValue={query} maxLength={120} placeholder={isFa ? 'نام، شماره یا متن پیام…' : 'Name, phone, or message text…'} className="min-h-11 w-full rounded-xl border border-black/[0.08] bg-white pe-3 ps-9 text-sm text-black shadow-[0_6px_18px_rgba(0,0,0,0.045)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-black/30 focus:border-black/20 focus:shadow-[0_8px_24px_rgba(0,0,0,0.08)]" />
				</label>

				<MaterialSelect
					value={activeStatus ?? ''}
					onValueChange={(status) => navigate({ status: status || undefined })}
					ariaLabel={isFa ? 'وضعیت گفتگو' : 'Conversation status'}
					label={isFa ? 'وضعیت' : 'Status'}
					icon={<MessageCircleWarning className="h-3.5 w-3.5" />}
					options={statusOptions.map((option) => ({ value: option.key === 'ALL' ? '' : option.key, label: option.label, meta: nf.format(option.count), description: option.key === 'HANDED_OFF' ? (isFa ? 'گفتگوهایی که پاسخ انسانی می‌خواهند' : 'Conversations waiting for a human') : undefined }))}
				/>

				{channelOptions.length > 0 && <MaterialSelect value={activeChannel ?? ''} onValueChange={(channel) => navigate({ channel: channel || undefined })} ariaLabel={isFa ? 'کانال گفتگو' : 'Conversation channel'} label={isFa ? 'کانال' : 'Channel'} icon={<Radio className="h-3.5 w-3.5" />} options={channelOptions.map((option) => ({ value: option.key === 'ALL' ? '' : option.key, label: option.label, meta: option.key === 'ALL' ? nf.format(totalResults) : nf.format(option.count) }))} />}

				{showAgent && <MaterialSelect value={activeAgent ?? ''} onValueChange={(agent) => navigate({ agent: agent || undefined })} ariaLabel={isFa ? 'ایجنت گفتگو' : 'Conversation agent'} label={isFa ? 'ایجنت' : 'Agent'} icon={<Bot className="h-3.5 w-3.5" />} options={[{ value: '', label: isFa ? 'همه ایجنت‌ها' : 'All agents', meta: nf.format(totalResults) }, ...agentOptions.map((option) => ({ value: option.key, label: option.label, meta: nf.format(option.count) }))]} />}

				<div className="flex gap-2">
					<button type="submit" className="spatial-press inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-black px-4 text-xs font-semibold text-white lg:flex-none"><Search className="h-3.5 w-3.5" />{isFa ? 'جست‌وجو' : 'Search'}</button>
					{hasActiveFilter && <button type="button" onClick={() => router.push(basePath)} aria-label={isFa ? 'پاک‌کردن فیلترها' : 'Clear filters'} className="spatial-press inline-flex h-11 w-11 items-center justify-center rounded-xl border border-black/[0.08] bg-white text-black/45 hover:text-black"><X className="h-4 w-4" /></button>}
				</div>
			</form>
		</section>
	)
}
