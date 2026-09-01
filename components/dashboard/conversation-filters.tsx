'use client'

import { type FormEvent, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
        Loader2,
        MessageCircleWarning,
        Search,
        SlidersHorizontal,
        X,
} from 'lucide-react'
import { MaterialSelect } from '@/components/ui/material-select'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'
import { cn } from '@/lib/utils'

type StatusKey = 'OPEN' | 'RESOLVED' | 'HANDED_OFF'

interface StatusOption {
        key: StatusKey | 'ALL'
        label: string
        count: number
}

interface FilterOption {
        key: string
        label: string
        count: number
}

type NavigateInput = {
        status?: string
        channel?: string
        agent?: string
        sales?: string
        q?: string
}

export function ConversationFilters({
        statusOptions,
        channelOptions,
        activeStatus,
        activeChannel,
        activeAgent,
        activeSales,
        agentOptions = [],
        salesOptions = [],
        query,
        resultCount,
        basePath = '/conversations',
        isFa,
}: {
        statusOptions: StatusOption[]
        channelOptions: FilterOption[]
        activeStatus: string | undefined
        activeChannel: string | undefined
        activeAgent?: string
        activeSales?: string
        agentOptions?: FilterOption[]
        salesOptions?: FilterOption[]
        query?: string
        resultCount: number
        basePath?: string
        isFa: boolean
}) {
        const router = useRouter()
        const params = useSearchParams()
        const paramsString = params.toString()
        const filterTriggerRef = useRef<HTMLButtonElement>(null)
        const [searchValue, setSearchValue] = useState(query ?? '')
        const [filterOpen, setFilterOpen] = useState(false)
        const [isSearching, startSearchTransition] = useTransition()
        const hasActiveFilter = Boolean(
                activeStatus || activeChannel || activeAgent || activeSales || searchValue,
        )
        const activeFacetCount = [
                activeStatus,
                activeChannel,
                activeAgent,
                activeSales,
        ].filter(Boolean).length
        const showAgent = agentOptions.length > 1

        function navigate(next: NavigateInput) {
                const sp = new URLSearchParams(params.toString())
                const values = {
                        status: next.status !== undefined ? next.status : activeStatus,
                        channel: next.channel !== undefined ? next.channel : activeChannel,
                        agent: next.agent !== undefined ? next.agent : activeAgent,
                        sales: next.sales !== undefined ? next.sales : activeSales,
                        q: next.q !== undefined ? next.q : searchValue.trim(),
                }
                for (const [key, value] of Object.entries(values)) {
                        sp.delete(key)
                        if (value) sp.set(key, value)
                }
                sp.delete('page')
                const qs = sp.toString()
                router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false })
        }

        function clearAll() {
                setSearchValue('')
                router.push(basePath, { scroll: false })
        }

        function submitSearch(event: FormEvent<HTMLFormElement>) {
                event.preventDefault()
                navigate({ q: searchValue.trim() || undefined })
        }

        useEffect(() => {
                setSearchValue(query ?? '')
        }, [query])

        useEffect(() => {
                const nextQuery = searchValue.trim()
                if (nextQuery === (query ?? '')) return

                const timer = window.setTimeout(() => {
                        const sp = new URLSearchParams(paramsString)
                        sp.delete('q')
                        if (nextQuery) sp.set('q', nextQuery)
                        sp.delete('page')
                        const qs = sp.toString()
                        startSearchTransition(() => {
                                router.replace(qs ? `${basePath}?${qs}` : basePath, {
                                        scroll: false,
                                })
                        })
                }, 280)

                return () => window.clearTimeout(timer)
        }, [basePath, paramsString, query, router, searchValue])

        const totalResults =
                statusOptions.find((option) => option.key === 'ALL')?.count ?? 0
        const operatorCount =
                statusOptions.find((option) => option.key === 'HANDED_OFF')?.count ?? 0
        const nf = new Intl.NumberFormat(isFa ? 'fa-IR' : 'en-US')
        const activeItems = [
                activeStatus
                        ? {
                                  key: 'status',
                                  label:
                                          statusOptions.find((option) => option.key === activeStatus)
                                                  ?.label ?? activeStatus,
                                  clear: () => navigate({ status: '' }),
                          }
                        : null,
                activeChannel
                        ? {
                                  key: 'channel',
                                  label:
                                          channelOptions.find((option) => option.key === activeChannel)
                                                  ?.label ?? activeChannel,
                                  clear: () => navigate({ channel: '' }),
                          }
                        : null,
                activeAgent
                        ? {
                                  key: 'agent',
                                  label:
                                          agentOptions.find((option) => option.key === activeAgent)
                                                  ?.label ?? activeAgent,
                                  clear: () => navigate({ agent: '' }),
                          }
                        : null,
                activeSales
                        ? {
                                  key: 'sales',
                                  label:
                                          salesOptions.find((option) => option.key === activeSales)
                                                  ?.label ?? activeSales,
                                  clear: () => navigate({ sales: '' }),
                          }
                        : null,
        ].filter((item): item is NonNullable<typeof item> => Boolean(item))

        const searchProps = {
                value: searchValue,
                loading: isSearching,
                placeholder: isFa
                        ? 'نام، شماره یا متن پیام…'
                        : 'Name, phone, or message text…',
                ariaLabel: isFa ? 'جست‌وجوی گفتگو' : 'Search conversations',
                clearLabel: isFa ? 'پاک‌کردن جست‌وجو' : 'Clear search',
                onChange: setSearchValue,
        }

        return (
                <>
                        <div className="md:hidden">
                                <form onSubmit={submitSearch} className="flex items-center gap-2">
                                        <ConversationSearchField {...searchProps} />
                                        <button
                                                ref={filterTriggerRef}
                                                type="button"
                                                onClick={() => setFilterOpen(true)}
                                                aria-haspopup="dialog"
                                                aria-expanded={filterOpen}
                                                aria-label={isFa ? 'فیلترهای گفتگو' : 'Conversation filters'}
                                                className={cn(
                                                        'spatial-press relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60',
                                                        activeFacetCount > 0
                                                                ? 'border-black bg-black text-white'
                                                                : 'border-[var(--border-default)] text-[var(--text-secondary)]',
                                                )}
                                        >
                                                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                                                {activeFacetCount > 0 && (
                                                        <span className="absolute -end-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-amber-400 px-1 text-[10px] font-bold tabular-nums text-black">
                                                                {nf.format(activeFacetCount)}
                                                        </span>
                                                )}
                                        </button>
                                </form>

                                {activeItems.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                        {activeItems.map((item) => (
                                                        <ActiveFilterChip
                                                                key={item.key}
                                                                label={item.label}
                                                                onRemove={item.clear}
                                                        />
                                        ))}
                                </div>
                                )}
                        </div>

                        <form
                                action={basePath}
                                method="get"
                                className="hidden flex-wrap items-center gap-2 md:flex"
                                onSubmit={submitSearch}
                        >
                                {activeStatus && (
                                        <input type="hidden" name="status" value={activeStatus} />
                                )}
                                {activeChannel && (
                                        <input type="hidden" name="channel" value={activeChannel} />
                                )}
                                {activeAgent && (
                                        <input type="hidden" name="agent" value={activeAgent} />
                                )}
                                {activeSales && (
                                        <input type="hidden" name="sales" value={activeSales} />
                                )}

                                <ConversationSearchField
                                        {...searchProps}
                                        className="min-w-[12rem] flex-1"
                                />

                                <MaterialSelect
                                        value={activeStatus ?? ''}
                                        onValueChange={(status) => navigate({ status })}
                                        ariaLabel={isFa ? 'وضعیت گفتگو' : 'Conversation status'}
                                        className="min-w-40"
                                        options={statusOptions.map((option) => ({
                                                value: option.key === 'ALL' ? '' : option.key,
                                                label: option.label,
                                                meta: nf.format(option.count),
                                        }))}
                                />

                                {channelOptions.length > 0 && (
                                        <MaterialSelect
                                                value={activeChannel ?? ''}
                                                onValueChange={(channel) => navigate({ channel })}
                                                ariaLabel={isFa ? 'کانال گفتگو' : 'Conversation channel'}
                                                className="min-w-40"
                                                options={channelOptions.map((option) => ({
                                                        value: option.key === 'ALL' ? '' : option.key,
                                                        label: option.label,
                                                        meta:
                                                                option.key === 'ALL'
                                                                        ? nf.format(totalResults)
                                                                        : nf.format(option.count),
                                                }))}
                                        />
                                )}

                                {showAgent && (
                                        <MaterialSelect
                                                value={activeAgent ?? ''}
                                                onValueChange={(agent) => navigate({ agent })}
                                                ariaLabel={isFa ? 'ایجنت گفتگو' : 'Conversation agent'}
                                                className="min-w-40"
                                                options={[
                                                        {
                                                                value: '',
                                                                label: isFa ? 'همه ایجنت‌ها' : 'All agents',
                                                                meta: nf.format(totalResults),
                                                        },
                                                        ...agentOptions.map((option) => ({
                                                                value: option.key,
                                                                label: option.label,
                                                                meta: nf.format(option.count),
                                                        })),
                                                ]}
                                        />
                                )}

                                {salesOptions.length > 0 && (
                                        <MaterialSelect
                                                value={activeSales ?? ''}
                                                onValueChange={(sales) => navigate({ sales })}
                                                ariaLabel={
                                                        isFa
                                                                ? 'دسته‌بندی هوش فروش'
                                                                : 'Sales intelligence category'
                                                }
                                                className="min-w-44"
                                                options={salesOptions.map((option) => ({
                                                        value: option.key === 'ALL' ? '' : option.key,
                                                        label: option.label,
                                                        meta: nf.format(option.count),
                                                }))}
                                        />
                                )}

                                <button
                                        type="button"
                                        onClick={() =>
                                                navigate({
                                                        status:
                                                                activeStatus === 'HANDED_OFF'
                                                                        ? ''
                                                                        : 'HANDED_OFF',
                                                })
                                        }
                                        aria-pressed={activeStatus === 'HANDED_OFF'}
                                        className={cn(
                                                'spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-[0.75rem] border px-3 text-xs font-semibold transition-[background-color,border-color,color] duration-150',
                                                activeStatus === 'HANDED_OFF'
                                                        ? 'border-amber-400 bg-amber-400 text-black'
                                                        : 'border-amber-400/25 bg-amber-400/[0.08] text-amber-700 hover:bg-amber-400/[0.14]',
                                        )}
                                >
                                        <MessageCircleWarning className="h-3.5 w-3.5" aria-hidden="true" />
                                        <span className="hidden sm:inline">
                                                {isFa ? 'نیاز به اپراتور' : 'Needs operator'}
                                        </span>
                                        <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] tabular-nums">
                                                {nf.format(operatorCount)}
                                        </span>
                                </button>

                                {hasActiveFilter && (
                                        <button
                                                type="button"
                                                onClick={clearAll}
                                                aria-label={isFa ? 'پاک‌کردن فیلترها' : 'Clear filters'}
                                                className="spatial-press inline-flex h-11 w-11 items-center justify-center rounded-[0.75rem] border border-black/[0.08] bg-white text-black/45 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60"
                                        >
                                                <X className="h-4 w-4" aria-hidden="true" />
                                        </button>
                                )}
                        </form>

                        <MobileBottomSheet
                                open={filterOpen}
                                title={isFa ? 'فیلتر گفتگوها' : 'Conversation filters'}
                                description={
                                        isFa
                                                ? 'صندوق گفتگوها را بر اساس وضعیت، کانال، ایجنت و هوش فروش محدود کنید'
                                                : 'Narrow the inbox by status, channel, agent, and sales intelligence'
                                }
                                closeLabel={isFa ? 'بستن فیلترها' : 'Close filters'}
                                triggerRef={filterTriggerRef}
                                onClose={() => setFilterOpen(false)}
                                footer={
                                        <div className="grid grid-cols-[auto_1fr] gap-2">
                                                <button
                                                        type="button"
                                                        onClick={clearAll}
                                                        disabled={!hasActiveFilter}
                                                        className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--border-default)] px-4 text-xs font-semibold text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 disabled:opacity-40"
                                                >
                                                        {isFa ? 'پاک‌کردن' : 'Clear'}
                                                </button>
                                                <button
                                                        type="button"
                                                        onClick={() => setFilterOpen(false)}
                                                        className="inline-flex min-h-12 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2"
                                                >
                                                        {isFa ? 'نمایش نتایج' : 'Show results'} ({nf.format(resultCount)})
                                                </button>
                                        </div>
                                }
                        >
                                <div className="space-y-4">
                                        <FilterField label={isFa ? 'وضعیت گفتگو' : 'Conversation status'}>
                                                <MaterialSelect
                                                        value={activeStatus ?? ''}
                                                        onValueChange={(status) => navigate({ status })}
                                                        ariaLabel={isFa ? 'وضعیت گفتگو' : 'Conversation status'}
                                                        options={statusOptions.map((option) => ({
                                                                value: option.key === 'ALL' ? '' : option.key,
                                                                label: option.label,
                                                                meta: nf.format(option.count),
                                                        }))}
                                                />
                                        </FilterField>

                                        {channelOptions.length > 0 && (
                                                <FilterField label={isFa ? 'کانال گفتگو' : 'Channel'}>
                                                        <MaterialSelect
                                                                value={activeChannel ?? ''}
                                                                onValueChange={(channel) => navigate({ channel })}
                                                                ariaLabel={isFa ? 'کانال گفتگو' : 'Conversation channel'}
                                                                options={channelOptions.map((option) => ({
                                                                        value: option.key === 'ALL' ? '' : option.key,
                                                                        label: option.label,
                                                                        meta:
                                                                                option.key === 'ALL'
                                                                                        ? nf.format(totalResults)
                                                                                        : nf.format(option.count),
                                                                }))}
                                                        />
                                                </FilterField>
                                        )}

                                        {showAgent && (
                                                <FilterField label={isFa ? 'ایجنت پاسخ‌گو' : 'Agent'}>
                                                        <MaterialSelect
                                                                value={activeAgent ?? ''}
                                                                onValueChange={(agent) => navigate({ agent })}
                                                                ariaLabel={isFa ? 'ایجنت گفتگو' : 'Conversation agent'}
                                                                options={[
                                                                        {
                                                                                value: '',
                                                                                label: isFa
                                                                                        ? 'همه ایجنت‌ها'
                                                                                        : 'All agents',
                                                                                meta: nf.format(totalResults),
                                                                        },
                                                                        ...agentOptions.map((option) => ({
                                                                                value: option.key,
                                                                                label: option.label,
                                                                                meta: nf.format(option.count),
                                                                        })),
                                                                ]}
                                                        />
                                                </FilterField>
                                        )}

                                        {salesOptions.length > 0 && (
                                                <FilterField
                                                        label={isFa ? 'دسته هوش فروش' : 'Sales intelligence'}
                                                >
                                                        <MaterialSelect
                                                                value={activeSales ?? ''}
                                                                onValueChange={(sales) => navigate({ sales })}
                                                                ariaLabel={
                                                                        isFa
                                                                                ? 'دسته‌بندی هوش فروش'
                                                                                : 'Sales intelligence category'
                                                                }
                                                                options={salesOptions.map((option) => ({
                                                                        value: option.key === 'ALL' ? '' : option.key,
                                                                        label: option.label,
                                                                        meta: nf.format(option.count),
                                                                }))}
                                                        />
                                                </FilterField>
                                        )}
                                </div>
                        </MobileBottomSheet>
                </>
        )
}

function ConversationSearchField({
        value,
        loading,
        placeholder,
        ariaLabel,
        clearLabel,
        onChange,
        className,
}: {
        value: string
        loading: boolean
        placeholder: string
        ariaLabel: string
        clearLabel: string
        onChange: (value: string) => void
        className?: string
}) {
        return (
                <div className={cn('relative min-w-0 flex-1', className)}>
                        {loading ? (
                                <Loader2
                                        className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--text-muted)] motion-reduce:animate-none"
                                        aria-hidden="true"
                                />
                        ) : (
                                <Search
                                        className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
                                        aria-hidden="true"
                                />
                        )}
                        <input
                                name="q"
                                type="search"
                                inputMode="search"
                                value={value}
                                onChange={(event) => onChange(event.target.value)}
                                maxLength={120}
                                placeholder={placeholder}
                                aria-label={ariaLabel}
                                className="input min-h-11 w-full ps-9 pe-11 text-base sm:text-sm"
                        />
                        {value && (
                                <button
                                        type="button"
                                        onClick={() => onChange('')}
                                        className="absolute end-0 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/60"
                                        aria-label={clearLabel}
                                >
                                        <X className="h-4 w-4" aria-hidden="true" />
                                </button>
                        )}
                </div>
        )
}

function ActiveFilterChip({
        label,
        onRemove,
}: {
        label: string
        onRemove: () => void
}) {
        return (
                <button
                        type="button"
                        onClick={onRemove}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60"
                >
                        <span className="max-w-36 truncate">{label}</span>
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
        )
}

function FilterField({
        label,
        children,
}: {
        label: string
        children: React.ReactNode
}) {
        return (
                <div>
                        <span className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                                {label}
                        </span>
                        {children}
                </div>
        )
}
