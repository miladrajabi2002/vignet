'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { MessageCircleWarning, Search, X } from 'lucide-react'
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
                <form action={basePath} method="get" className="flex flex-wrap items-center gap-2">
                        {activeStatus && <input type="hidden" name="status" value={activeStatus} />}
                        {activeChannel && <input type="hidden" name="channel" value={activeChannel} />}
                        {activeAgent && <input type="hidden" name="agent" value={activeAgent} />}

                        <div className="relative min-w-[12rem] flex-1">
                                <span className="sr-only">{isFa ? 'جست‌وجوی گفتگو' : 'Search conversations'}</span>
                                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                                <input
                                        name="q"
                                        defaultValue={query}
                                        maxLength={120}
                                        placeholder={isFa ? 'نام، شماره یا متن پیام…' : 'Name, phone, or message text…'}
                                        className="input ps-9"
                                />
                        </div>

                        <MaterialSelect
                                value={activeStatus ?? ''}
                                onValueChange={(status) => navigate({ status: status || undefined })}
                                ariaLabel={isFa ? 'وضعیت گفتگو' : 'Conversation status'}
                                className="min-w-40"
                                options={statusOptions.map((option) => ({ value: option.key === 'ALL' ? '' : option.key, label: option.label, meta: nf.format(option.count) }))}
                        />

                        {channelOptions.length > 0 && (
                                <MaterialSelect
                                        value={activeChannel ?? ''}
                                        onValueChange={(channel) => navigate({ channel: channel || undefined })}
                                        ariaLabel={isFa ? 'کانال گفتگو' : 'Conversation channel'}
                                        className="min-w-40"
                                        options={channelOptions.map((option) => ({ value: option.key === 'ALL' ? '' : option.key, label: option.label, meta: option.key === 'ALL' ? nf.format(totalResults) : nf.format(option.count) }))}
                                />
                        )}

                        {showAgent && (
                                <MaterialSelect
                                        value={activeAgent ?? ''}
                                        onValueChange={(agent) => navigate({ agent: agent || undefined })}
                                        ariaLabel={isFa ? 'ایجنت گفتگو' : 'Conversation agent'}
                                        className="min-w-40"
                                        options={[{ value: '', label: isFa ? 'همه ایجنت‌ها' : 'All agents', meta: nf.format(totalResults) }, ...agentOptions.map((option) => ({ value: option.key, label: option.label, meta: nf.format(option.count) }))]}
                                />
                        )}

                        <button
                                type="button"
                                onClick={() => navigate({ status: activeStatus === 'HANDED_OFF' ? undefined : 'HANDED_OFF' })}
                                aria-pressed={activeStatus === 'HANDED_OFF'}
                                className={cn(
                                        'spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-[0.75rem] border px-3 text-xs font-semibold transition-[background-color,border-color,color] duration-150',
                                        activeStatus === 'HANDED_OFF'
                                                ? 'border-amber-400 bg-amber-400 text-black'
                                                : 'border-amber-400/25 bg-amber-400/[0.08] text-amber-700 hover:bg-amber-400/[0.14]',
                                )}
                        >
                                <MessageCircleWarning className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{isFa ? 'نیاز به اپراتور' : 'Needs operator'}</span>
                                <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] tabular-nums">{nf.format(operatorCount)}</span>
                        </button>

                        {hasActiveFilter && (
                                <button type="button" onClick={() => router.push(basePath)} aria-label={isFa ? 'پاک‌کردن فیلترها' : 'Clear filters'} className="spatial-press inline-flex h-11 w-11 items-center justify-center rounded-[0.75rem] border border-black/[0.08] bg-white text-black/45 hover:text-black">
                                        <X className="h-4 w-4" />
                                </button>
                        )}

                        {/* Hidden submit so Enter in the search box submits the form
                            (browsers require a submit button for form submission). */}
                        <button type="submit" className="sr-only" aria-hidden tabIndex={-1} />
                </form>
        )
}
