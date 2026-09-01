'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { ChannelType } from '@prisma/client'
import { ChevronLeft, Columns3, Download, Filter, GripVertical, LayoutList, Loader2, Search, SlidersHorizontal, Users, X } from 'lucide-react'
import { ChannelBadge, SourceTagBadges } from '@/components/crm/channel-badge'
import { relativeTime } from '@/lib/format'
import { contactDisplayName } from '@/lib/crm/display'
import { displayPhone } from '@/lib/phone'
import { cn } from '@/lib/utils'
import type { CampaignAudienceInput } from '@/lib/campaigns/audience'
import { MaterialSelect } from '@/components/ui/material-select'
import { PageHeader } from '@/components/dashboard/page-header'
import { CampaignLaunchButton } from '@/components/crm/campaign-launch-button'
import {
        LiveArrivalItem,
        LiveArrivalProvider,
        LiveArrivalStatus,
        LiveRefreshProbe,
} from '@/components/crm/live-arrivals'
import { ContactAvatar } from '@/components/crm/contact-avatar'
import { BulkDeleteButton } from '@/components/ui/bulk-delete-button'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'
import { ContactDetailSheet } from '@/components/crm/contact-detail-sheet'
import { ContactQuickAdd } from '@/components/crm/contact-quick-add'
import {
        CONTACT_STAGES,
        ContactStageBadge,
        type ContactStage,
} from '@/components/crm/contact-stage-badge'

export interface ContactRow {
        id: string
        name: string | null
        phone: string | null
        stage: string
        tags: string[]
        channels: ChannelType[]
        conversationCount: number
        lastActivity: string
        avatarUrl?: string | null
        avatarFallbackUrl?: string | null
        channelUsernames?: Partial<Record<ChannelType, string | null>>
        marketingOptIn: boolean
}

const STAGES = CONTACT_STAGES
type Stage = ContactStage

const STAGE_KEY: Record<Stage, string> = {
        lead: 'stageLead',
        qualified: 'stageQualified',
        customer: 'stageCustomer',
        lost: 'stageLost',
}

const CHANNEL_LABEL: Record<string, readonly [string, string]> = {
        INSTAGRAM: ['اینستاگرام', 'Instagram'], WHATSAPP: ['واتساپ', 'WhatsApp'], TELEGRAM: ['تلگرام', 'Telegram'], BALE: ['بله', 'Bale'], RUBIKA: ['روبیکا', 'Rubika'],
}

const FILTER_CHANNELS: ChannelType[] = ['INSTAGRAM', 'WHATSAPP', 'TELEGRAM', 'BALE', 'RUBIKA']

/**
 * Resolve a contact's display name with a per-channel fallback. When the
 * contact has no name/phone/handle, we show "کاربر اینستاگرام" (etc.) based
 * on the contact's first channel — so Instagram DMs (which only carry a
 * sender id) no longer appear as "ناشناس".
 */
function rowDisplayName(c: ContactRow, anonymousLabel: string): string {
        const firstChannel = c.channels[0] ?? null
        return contactDisplayName({
                name: c.name,
                phone: c.phone,
                // Prefer the username of the first connected channel.
                handle: firstChannel ? (c.channelUsernames?.[firstChannel] ?? null) : null,
                channel: firstChannel,
                channelId: firstChannel ? (firstChannel as string) : null,
                anonymousLabel,
        })
}

export function ContactsView({
        initial,
        locale,
        liveVersion,
        liveEnabled,
        liveScope,
        query: serverQuery,
        initialStageFilter,
        initialChannelFilter,
        initialTagFilter,
        totalResults,
        detailContactId,
        detailReturnTo,
        insights,
        footer,
}: {
        initial: ContactRow[]
        locale: 'fa' | 'en'
        liveVersion: string
        liveEnabled?: boolean
        liveScope: string
        query: string
        initialStageFilter: Stage | ''
        initialChannelFilter: ChannelType | ''
        initialTagFilter: string
        totalResults: number
        detailContactId?: string
        detailReturnTo: string
        insights?: React.ReactNode
        footer?: React.ReactNode
}) {
        const t = useTranslations('contacts')
        const router = useRouter()
        const [rows, setRows] = useState(initial)
        const [view, setView] = useState<'list' | 'pipeline'>('list')
        const [query, setQuery] = useState(serverQuery)
        const [isSearching, startSearchTransition] = useTransition()
        const [stageFilter, setStageFilter] = useState<Stage | ''>(initialStageFilter)
        const [channelFilter, setChannelFilter] = useState<ChannelType | ''>(initialChannelFilter)
        const [tagFilter, setTagFilter] = useState(initialTagFilter)
        const [selected, setSelected] = useState<Set<string>>(() => new Set())
        const [filterSheetOpen, setFilterSheetOpen] = useState(false)
        const filterTriggerRef = useRef<HTMLButtonElement>(null)
        const detailTriggerRef = useRef<HTMLElement | null>(null)
        const detailOpenedLocallyRef = useRef(false)

        useEffect(() => {
                setRows(initial)
        }, [initial])

        useEffect(() => {
                setQuery(serverQuery)
                setStageFilter(initialStageFilter)
                setChannelFilter(initialChannelFilter)
                setTagFilter(initialTagFilter)
        }, [serverQuery, initialStageFilter, initialChannelFilter, initialTagFilter])

        useEffect(() => {
                if (!detailContactId) detailOpenedLocallyRef.current = false
        }, [detailContactId])

        useEffect(() => {
                const nextQuery = query.trim()
                if (
                        nextQuery === serverQuery &&
                        stageFilter === initialStageFilter &&
                        channelFilter === initialChannelFilter &&
                        tagFilter === initialTagFilter
                ) return
                const timer = window.setTimeout(() => {
                        startSearchTransition(() => {
                                const params = new URLSearchParams()
                                if (nextQuery) params.set('q', nextQuery)
                                if (stageFilter) params.set('stage', stageFilter)
                                if (channelFilter) params.set('channel', channelFilter)
                                if (tagFilter) params.set('tag', tagFilter)
                                const search = params.toString()
                                router.replace(search ? `/contacts?${search}` : '/contacts', { scroll: false })
                        })
                }, nextQuery === serverQuery ? 0 : 280)
                return () => window.clearTimeout(timer)
        }, [
                query,
                stageFilter,
                channelFilter,
                tagFilter,
                router,
                serverQuery,
                initialStageFilter,
                initialChannelFilter,
                initialTagFilter,
        ])

        const availableTags = useMemo(
                () => [...new Set(rows.flatMap((row) => row.tags))].sort((a, b) => a.localeCompare(b)),
                [rows],
        )

        const filtered = useMemo(() => {
                return rows.filter((r) => {
                        if (stageFilter && r.stage !== stageFilter) return false
                        if (channelFilter && !r.channels.includes(channelFilter)) return false
                        if (tagFilter && !r.tags.includes(tagFilter)) return false
                        return true
                })
        }, [rows, stageFilter, channelFilter, tagFilter])

        const selectedPreview = detailContactId
                ? rows.find((row) => row.id === detailContactId)
                : undefined
        const activeFacetCount = [stageFilter, channelFilter, tagFilter].filter(Boolean).length
        const stageLabel = stageFilter ? t(STAGE_KEY[stageFilter]) : ''
        const channelLabel = channelFilter
                ? CHANNEL_LABEL[channelFilter]?.[locale === 'fa' ? 0 : 1] ?? channelFilter
                : ''
        const filtersMatchServer =
                query.trim() === serverQuery &&
                stageFilter === initialStageFilter &&
                channelFilter === initialChannelFilter &&
                tagFilter === initialTagFilter
        const visibleResultCount = filtersMatchServer ? totalResults : filtered.length

        const campaignAudience = useMemo<CampaignAudienceInput>(() => {
                if (selected.size > 0) return { selectedContactIds: [...selected] }
                return {
                        filters: {
                                ...(stageFilter ? { stage: stageFilter } : {}),
                                ...(channelFilter && ['TELEGRAM', 'INSTAGRAM', 'RUBIKA', 'BALE'].includes(channelFilter)
                                        ? { channel: channelFilter as 'TELEGRAM' | 'INSTAGRAM' | 'RUBIKA' | 'BALE' }
                                        : {}),
                                ...(tagFilter ? { tag: tagFilter } : {}),
                                ...(query.trim() ? { query: query.trim() } : {}),
                        },
                }
        }, [selected, stageFilter, channelFilter, tagFilter, query])

        const exportHref = useMemo(() => {
                const params = new URLSearchParams()
                if (query.trim()) params.set('q', query.trim())
                if (stageFilter) params.set('stage', stageFilter)
                if (channelFilter) params.set('channel', channelFilter)
                if (tagFilter) params.set('tag', tagFilter)
                const search = params.toString()
                return `/api/contacts/export${search ? `?${search}` : ''}`
        }, [query, stageFilter, channelFilter, tagFilter])

        const hasFilters = Boolean(query || stageFilter || channelFilter || tagFilter)

        function toggleSelected(id: string) {
                setSelected((current) => {
                        const next = new Set(current)
                        if (next.has(id)) next.delete(id)
                        else next.add(id)
                        return next
                })
        }

        function clearFilters() {
                setQuery('')
                setStageFilter('')
                setChannelFilter('')
                setTagFilter('')
                setSelected(new Set())
                router.push('/contacts')
        }

        function clearFacetFilters() {
                setStageFilter('')
                setChannelFilter('')
                setTagFilter('')
        }

        function openContactDetails(id: string, trigger: HTMLElement) {
                detailTriggerRef.current = trigger
                detailOpenedLocallyRef.current = true
                const params = new URLSearchParams(window.location.search)
                params.set('contact', id)
                router.push(`/contacts?${params.toString()}`, { scroll: false })
        }

        function closeContactDetails() {
                if (detailOpenedLocallyRef.current) {
                        detailOpenedLocallyRef.current = false
                        router.back()
                        return
                }
                router.replace(detailReturnTo, { scroll: false })
        }

        async function move(id: string, stage: Stage) {
                setRows((prev) => prev.map((r) => (r.id === id ? { ...r, stage } : r)))
                await fetch(`/api/contacts/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ stage }),
                }).catch(() => {})
        }

        return (
                <LiveArrivalProvider key={liveScope} ids={rows.map((row) => row.id)}>
                <LiveRefreshProbe
                        resource="contacts"
                        initialVersion={liveVersion}
                        enabled={liveEnabled}
                />
                <div className="space-y-6">
                        <PageHeader
                                icon={Users}
                                title={t('title')}
                                subtitle={t('subtitle')}
                                actions={
                                        <>
                                                <ContactQuickAdd locale={locale} />
                                                <a
                                                        href={exportHref}
                                                        download
                                                        title={t('exportDescription')}
                                                        aria-label={t('exportExcel')}
                                                        className="spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-white px-3 text-xs font-semibold text-[var(--text-secondary)] shadow-[var(--shadow-xs)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 sm:px-4 sm:text-sm"
                                                >
                                                        <Download className="h-4 w-4" aria-hidden="true" />
                                                        <span className="hidden sm:inline">{t('exportExcel')}</span>
                                                </a>
                                                <BulkDeleteButton
                                                        countEndpoint="/api/contacts/bulk"
                                                        deleteEndpoint="/api/contacts/bulk"
                                                        entityLabel={locale === 'fa' ? 'مشتری' : 'contact'}
                                                        buttonLabel={locale === 'fa' ? 'حذف همه مشتریان' : 'Delete all'}
                                                        extraWarning={locale === 'fa'
                                                                ? 'گفتگوهای مشتریان حفظ می‌شوند اما به‌صورت «ناشناس» در می‌آیند. تاریخچه چت از بین نمی‌رود.'
                                                                : 'Conversations are preserved but become anonymous. Chat history is NOT lost.'}
                                                        compactOnMobile
                                                        onDeleted={() => router.refresh()}
                                                />
                                                <CampaignLaunchButton
                                                        audience={campaignAudience}
                                                        locale={locale}
                                                        disabled={filtered.length === 0}
                                                        compactOnMobile
                                                        label={selected.size > 0
                                                                ? locale === 'fa'
                                                                        ? `ارسال پیام به ${selected.size.toLocaleString('fa-IR')} مشتری`
                                                                        : `Message ${selected.size} customers`
                                                                : undefined}
                                                />
                                        </>
                                }
                        />

                        {insights}

                        <div className="flex flex-wrap items-center justify-end gap-2">
                                <div className="flex items-center gap-1 rounded-xl border border-[var(--border-default)] p-1">
                                        <ToggleBtn
                                                active={view === 'list'}
                                                onClick={() => setView('list')}
                                                icon={<LayoutList className="h-4 w-4" />}
                                                label={t('list')}
                                        />
                                        <ToggleBtn
                                                active={view === 'pipeline'}
                                                onClick={() => setView('pipeline')}
                                                icon={<Columns3 className="h-4 w-4" />}
                                                label={t('pipeline')}
                                        />
                                </div>
                        </div>

                        <div className="sticky top-[5.35rem] z-20 md:static md:z-auto">
                                <div className="spatial-surface rounded-[1.35rem] p-2.5 shadow-[0_14px_36px_rgba(0,0,0,0.08)] md:rounded-[1.5rem] md:p-4 md:shadow-[var(--shadow-card)]">
                                        <div className="flex items-center gap-2 md:hidden">
                                                <ContactSearchField
                                                        value={query}
                                                        loading={isSearching}
                                                        placeholder={t('search')}
                                                        ariaLabel={locale === 'fa' ? 'جست‌وجوی سراسری مشتریان' : 'Search all customers'}
                                                        clearLabel={t('clearFilters')}
                                                        onChange={setQuery}
                                                />
                                                <button
                                                        ref={filterTriggerRef}
                                                        type="button"
                                                        onClick={() => setFilterSheetOpen(true)}
                                                        aria-haspopup="dialog"
                                                        aria-expanded={filterSheetOpen}
                                                        className={cn(
                                                                'spatial-press relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60',
                                                                activeFacetCount > 0
                                                                        ? 'border-black bg-black text-white'
                                                                        : 'border-[var(--border-default)] text-[var(--text-secondary)]',
                                                        )}
                                                        aria-label={t('filters')}
                                                >
                                                        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                                                        {activeFacetCount > 0 && (
                                                                <span className="absolute -end-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-amber-400 px-1 text-[10px] font-bold tabular-nums text-black">
                                                                        {activeFacetCount.toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')}
                                                                </span>
                                                        )}
                                                </button>
                                        </div>

                                        {activeFacetCount > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-2 md:hidden" aria-label={t('filters')}>
                                                        {stageFilter && (
                                                                <ActiveFilterChip label={stageLabel} onRemove={() => setStageFilter('')} />
                                                        )}
                                                        {channelFilter && (
                                                                <ActiveFilterChip label={channelLabel} onRemove={() => setChannelFilter('')} />
                                                        )}
                                                        {tagFilter && (
                                                                <ActiveFilterChip label={tagFilter} onRemove={() => setTagFilter('')} />
                                                        )}
                                                </div>
                                        )}

                                        <div className="hidden flex-wrap items-center gap-2 md:flex">
                                                <ContactSearchField
                                                        value={query}
                                                        loading={isSearching}
                                                        placeholder={t('search')}
                                                        ariaLabel={locale === 'fa' ? 'جست‌وجوی سراسری مشتریان' : 'Search all customers'}
                                                        clearLabel={t('clearFilters')}
                                                        onChange={setQuery}
                                                        className="min-w-[12rem] flex-1"
                                                />
                                                <MaterialSelect value={stageFilter} onValueChange={(value) => setStageFilter(value as Stage | '')} ariaLabel={locale === 'fa' ? 'فیلتر مرحله مشتری' : 'Filter customer stage'} className="min-w-40" options={[{ value: '', label: t('allStages') }, ...STAGES.map((stage) => ({ value: stage, label: t(STAGE_KEY[stage]) }))]} />
                                                <MaterialSelect value={channelFilter} onValueChange={(value) => setChannelFilter(value as ChannelType | '')} ariaLabel={locale === 'fa' ? 'فیلتر کانال' : 'Filter channel'} className="min-w-40" options={[{ value: '', label: t('allChannels') }, ...FILTER_CHANNELS.map((channel) => ({ value: channel, label: CHANNEL_LABEL[channel][locale === 'fa' ? 0 : 1] }))]} />
                                                <MaterialSelect value={tagFilter} onValueChange={setTagFilter} ariaLabel={locale === 'fa' ? 'فیلتر تگ' : 'Filter tag'} className="min-w-40" options={[{ value: '', label: t('allTags') }, ...availableTags.map((tag) => ({ value: tag, label: tag }))]} />
                                                {hasFilters && (
                                                        <button type="button" onClick={clearFilters} className="inline-flex h-11 w-11 items-center justify-center rounded-[0.75rem] border border-[var(--border-default)] bg-white text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60" aria-label={t('clearFilters')}><X className="h-4 w-4" /></button>
                                                )}
                                        </div>
                                </div>
                        </div>

                        <MobileBottomSheet
                                open={filterSheetOpen}
                                title={t('filters')}
                                description={t('filtersDescription')}
                                closeLabel={t('detail.close')}
                                triggerRef={filterTriggerRef}
                                onClose={() => setFilterSheetOpen(false)}
                                footer={
                                        <div className="grid grid-cols-[auto_1fr] gap-2">
                                                <button
                                                        type="button"
                                                        onClick={clearFacetFilters}
                                                        disabled={activeFacetCount === 0}
                                                        className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--border-default)] px-4 text-xs font-semibold text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 disabled:opacity-40"
                                                >
                                                        {t('clearFilters')}
                                                </button>
                                                <button
                                                        type="button"
                                                        onClick={() => setFilterSheetOpen(false)}
                                                        className="inline-flex min-h-12 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2"
                                                >
                                                        {t('showResults')} ({filtered.length.toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')})
                                                </button>
                                        </div>
                                }
                        >
                                <div className="space-y-4">
                                        <FilterField label={locale === 'fa' ? 'مرحله مشتری' : 'Customer stage'}>
                                                <MaterialSelect value={stageFilter} onValueChange={(value) => setStageFilter(value as Stage | '')} ariaLabel={locale === 'fa' ? 'فیلتر مرحله مشتری' : 'Filter customer stage'} options={[{ value: '', label: t('allStages') }, ...STAGES.map((stage) => ({ value: stage, label: t(STAGE_KEY[stage]) }))]} />
                                        </FilterField>
                                        <FilterField label={locale === 'fa' ? 'کانال ارتباطی' : 'Channel'}>
                                                <MaterialSelect value={channelFilter} onValueChange={(value) => setChannelFilter(value as ChannelType | '')} ariaLabel={locale === 'fa' ? 'فیلتر کانال' : 'Filter channel'} options={[{ value: '', label: t('allChannels') }, ...FILTER_CHANNELS.map((channel) => ({ value: channel, label: CHANNEL_LABEL[channel][locale === 'fa' ? 0 : 1] }))]} />
                                        </FilterField>
                                        <FilterField label={locale === 'fa' ? 'برچسب مشتری' : 'Customer tag'}>
                                                <MaterialSelect value={tagFilter} onValueChange={setTagFilter} ariaLabel={locale === 'fa' ? 'فیلتر تگ' : 'Filter tag'} options={[{ value: '', label: t('allTags') }, ...availableTags.map((tag) => ({ value: tag, label: tag }))]} />
                                        </FilterField>
                                </div>
                        </MobileBottomSheet>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                                <span className="inline-flex items-center gap-1.5" aria-live="polite"><Filter className="h-3.5 w-3.5" />{locale === 'fa' ? `${visibleResultCount.toLocaleString('fa-IR')} نتیجه` : `${visibleResultCount} results`}</span>
                                <div className="flex flex-wrap items-center gap-2">
                                        <LiveArrivalStatus resource="contacts" locale={locale} />
                                        {view === 'list' && filtered.length > 0 && <button type="button" onClick={() => setSelected(new Set(filtered.map((row) => row.id)))} className="min-h-11 rounded-xl px-2.5 hover:bg-[var(--bg-hover)]">{locale === 'fa' ? 'انتخاب همه نتایج این صفحه' : 'Select all results on this page'}</button>}
                                </div>
                        </div>

                        {filtered.length === 0 ? (
                                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-16 text-center">
                                        <Users className="h-8 w-8 text-[var(--text-muted)]" />
                                        <p className="mt-4 text-sm text-[var(--text-secondary)]">{t('empty')}</p>
                                </div>
                        ) : view === 'list' ? (
                                <ListView rows={filtered} locale={locale} onMove={move} selected={selected} onToggleSelected={toggleSelected} onOpenContact={openContactDetails} />
                        ) : (
                                <PipelineView rows={filtered} onMove={move} />
                        )}

                        {footer && view === 'list' ? footer : null}

                        <ContactDetailSheet
                                contactId={detailContactId ?? null}
                                preview={selectedPreview}
                                locale={locale}
                                returnTo={detailReturnTo}
                                triggerRef={detailTriggerRef}
                                onClose={closeContactDetails}
                        />

                </div>
                </LiveArrivalProvider>
        )
}

function ContactSearchField({
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
                                <Loader2 className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--text-muted)] motion-reduce:animate-none" aria-hidden="true" />
                        ) : (
                                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
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

function ActiveFilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
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

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
        return (
                <div>
                        <span className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">{label}</span>
                        {children}
                </div>
        )
}

function ToggleBtn({
        active,
        onClick,
        icon,
        label,
}: {
        active: boolean
        onClick: () => void
        icon: React.ReactNode
        label: string
}) {
        return (
                <button
                        onClick={onClick}
                        className={cn(
                                'flex min-h-11 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm transition-colors',
                                active
                                        ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                        )}
                >
                        {icon}
                        {label}
                </button>
        )
}

function StageSelect({
        value,
        onChange,
}: {
        value: string
        onChange: (s: Stage) => void
}) {
        const t = useTranslations('contacts')
        return (
                <MaterialSelect
                        value={STAGES.includes(value as Stage) ? value : 'lead'}
                        onValueChange={(next) => onChange(next as Stage)}
                        ariaLabel={t('stage')}
                        buttonClassName="min-h-11 rounded-xl px-2 text-xs"
                        options={STAGES.map((stage) => ({ value: stage, label: t(STAGE_KEY[stage]) }))}
                />
        )
}

function ListView({
        rows,
        locale,
        onMove,
        selected,
        onToggleSelected,
        onOpenContact,
}: {
        rows: ContactRow[]
        locale: 'fa' | 'en'
        onMove: (id: string, s: Stage) => void
        selected: Set<string>
        onToggleSelected: (id: string) => void
        onOpenContact: (id: string, trigger: HTMLElement) => void
}) {
        const t = useTranslations('contacts')
        const nf = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US')
        return (
                <div>
                        <div className="space-y-3 md:hidden">
                                <div className="flex items-end justify-between gap-3 px-1">
                                        <div className="min-w-0">
                                                <h2 className="text-base font-bold tracking-tight text-[var(--text-primary)]">{locale === 'fa' ? 'فهرست مشتریان' : 'Customer list'}</h2>
                                                <p className="mt-1 text-xs text-[var(--text-muted)]">{t('customersOnPage', { count: nf.format(rows.length) })}</p>
                                        </div>
                                        <span className="shrink-0 text-[11px] font-medium text-[var(--text-muted)]">{t('latestActivity')}</span>
                                </div>

                                {rows.map((c) => {
                                        const name = rowDisplayName(c, t('anonymous'))
                                        const normalizedStage = STAGES.includes(c.stage as Stage) ? c.stage as Stage : 'lead'
                                        return (
                                                <LiveArrivalItem key={`mobile-${c.id}`} itemId={c.id}>
                                                        <article
                                                                className={cn(
                                                                        'spatial-surface overflow-hidden rounded-[1.35rem] transition-[border-color,box-shadow] duration-150',
                                                                        selected.has(c.id) && 'border-black/25 shadow-[0_14px_34px_rgba(0,0,0,0.1)]',
                                                                )}
                                                        >
                                                                <button
                                                                        type="button"
                                                                        onClick={(event) => onOpenContact(c.id, event.currentTarget)}
                                                                        aria-haspopup="dialog"
                                                                        aria-label={`${t('openDetails')}: ${name}`}
                                                                        className="spatial-press block w-full p-4 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/60"
                                                                >
                                                                        <div className="flex min-w-0 items-start gap-3">
                                                                                <ContactAvatar
                                                                                        src={c.avatarUrl}
                                                                                        fallbackSrc={c.avatarFallbackUrl}
                                                                                        alt={name}
                                                                                        size="md"
                                                                                />
                                                                                <div className="min-w-0 flex-1">
                                                                                        <div className="flex min-w-0 items-start justify-between gap-2">
                                                                                                <span className="min-w-0 truncate text-[15px] font-bold text-[var(--text-primary)]">{name}</span>
                                                                                                <ContactStageBadge stage={c.stage} label={t(STAGE_KEY[normalizedStage])} />
                                                                                        </div>
                                                                                        {c.phone && (
                                                                                                <span dir="ltr" className="mt-1 block truncate text-start text-xs text-[var(--text-secondary)]">{displayPhone(c.phone)}</span>
                                                                                        )}
                                                                                </div>
                                                                                <ChevronLeft className="mt-1 h-4 w-4 shrink-0 text-[var(--text-hint)] ltr:rotate-180" aria-hidden="true" />
                                                                        </div>

                                                                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                                                                                {c.channels.map((channel) => <ChannelBadge key={channel} type={channel} />)}
                                                                                <SourceTagBadges tags={c.tags} />
                                                                                {c.tags.slice(0, 2).map((tag) => (
                                                                                        <span key={tag} className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">{tag}</span>
                                                                                ))}
                                                                        </div>

                                                                        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-black/[0.025] p-3 text-xs">
                                                                                <div>
                                                                                        <span className="block text-[10px] text-[var(--text-muted)]">{t('conversations')}</span>
                                                                                        <span className="mt-1 block font-semibold tabular-nums text-[var(--text-primary)]">{nf.format(c.conversationCount)}</span>
                                                                                </div>
                                                                                <div>
                                                                                        <span className="block text-[10px] text-[var(--text-muted)]">{t('latestActivity')}</span>
                                                                                        <span className="mt-1 block truncate font-semibold text-[var(--text-primary)]">{relativeTime(c.lastActivity, locale)}</span>
                                                                                </div>
                                                                        </div>

                                                                        {c.marketingOptIn && (
                                                                                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                                                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                                                                                        {t('marketingConsent')}
                                                                                </span>
                                                                        )}
                                                                </button>

                                                                <div className="flex items-center gap-2 border-t border-[var(--border-subtle)] bg-black/[0.012] p-2.5">
                                                                        <label className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl px-2 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">
                                                                                <input
                                                                                        type="checkbox"
                                                                                        checked={selected.has(c.id)}
                                                                                        onChange={() => onToggleSelected(c.id)}
                                                                                        className="h-4 w-4 accent-black"
                                                                                        aria-label={`${t('selectCustomer')}: ${name}`}
                                                                                />
                                                                                {t('selectCustomer')}
                                                                        </label>
                                                                        <div className="min-w-0 flex-1">
                                                                                <StageSelect value={c.stage} onChange={(nextStage) => onMove(c.id, nextStage)} />
                                                                        </div>
                                                                </div>
                                                        </article>
                                                </LiveArrivalItem>
                                        )
                                })}
                        </div>

                        <div className="spatial-surface hidden divide-y divide-[var(--border-subtle)] overflow-hidden rounded-[1.5rem] md:block">
                                <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3.5 sm:px-5">
                                        <div className="min-w-0">
                                                <h2 className="text-base font-bold tracking-tight text-[var(--text-primary)]">{locale === 'fa' ? 'فهرست مشتریان' : 'Customer list'}</h2>
                                                <p className="mt-1 text-xs text-[var(--text-muted)]">{t('customersOnPage', { count: nf.format(rows.length) })}</p>
                                        </div>
                                        <span className="shrink-0 rounded-full bg-[var(--bg-muted)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">{t('latestActivity')}</span>
                                </div>
                                {rows.map((c) => (
                                        <LiveArrivalItem
                                                key={`desktop-${c.id}`}
                                                itemId={c.id}
                                                className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-hover)]"
                                        >
                                                <label className="grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors hover:bg-[var(--bg-hover)]">
                                                        <input
                                                                type="checkbox"
                                                                checked={selected.has(c.id)}
                                                                onChange={() => onToggleSelected(c.id)}
                                                                className="h-4 w-4 accent-black"
                                                                aria-label={`${t('selectCustomer')}: ${rowDisplayName(c, t('anonymous'))}`}
                                                        />
                                                </label>
                                                <Link
                                                        href={`/contacts/${c.id}`}
                                                        className="flex min-w-0 flex-1 items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60"
                                                        aria-label={rowDisplayName(c, t('anonymous'))}
                                                >
                                                        <ContactAvatar
                                                                src={c.avatarUrl}
                                                                fallbackSrc={c.avatarFallbackUrl}
                                                                alt={rowDisplayName(c, t('anonymous'))}
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                        <span className="truncate text-sm font-medium text-[var(--text-primary)]">{rowDisplayName(c, t('anonymous'))}</span>
                                                                        {c.channels.map((ch) => {
                                                                                const handle = c.channelUsernames?.[ch]
                                                                                return (
                                                                                        <span key={ch} className="inline-flex items-center gap-1">
                                                                                                <ChannelBadge type={ch} />
                                                                                                {handle && <span dir="ltr" className="text-[11px] text-[var(--text-muted)]">@{handle}</span>}
                                                                                        </span>
                                                                                )
                                                                        })}
                                                                        <SourceTagBadges tags={c.tags} />
                                                                </div>
                                                                <p className="truncate text-xs text-[var(--text-secondary)]">
                                                                        {c.conversationCount} {t('conversations')} · {t('lastSeen')} {relativeTime(c.lastActivity, locale)}
                                                                </p>
                                                                {c.marketingOptIn && <span className="mt-1 inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-600">{t('marketingConsent')}</span>}
                                                        </div>
                                                </Link>
                                                <div onClick={(event) => event.stopPropagation()} className="shrink-0">
                                                        <StageSelect value={c.stage} onChange={(nextStage) => onMove(c.id, nextStage)} />
                                                </div>
                                        </LiveArrivalItem>
                                ))}
                        </div>
                </div>
        )
}

function PipelineView({
        rows,
        onMove,
}: {
        rows: ContactRow[]
        onMove: (id: string, s: Stage) => void
}) {
        const t = useTranslations('contacts')
        const [dragId, setDragId] = useState<string | null>(null)
        const [overStage, setOverStage] = useState<Stage | null>(null)

        function stageOf(r: ContactRow): Stage {
                return STAGES.includes(r.stage as Stage) ? (r.stage as Stage) : 'lead'
        }

        function handleDrop(stage: Stage) {
                if (dragId) {
                        const cur = rows.find((r) => r.id === dragId)
                        if (cur && stageOf(cur) !== stage) onMove(dragId, stage)
                }
                setDragId(null)
                setOverStage(null)
        }

        return (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {STAGES.map((stage) => {
                                const items = rows.filter((r) => stageOf(r) === stage)
                                const isOver = overStage === stage
                                return (
                                        <div
                                                key={stage}
                                                onDragOver={(e) => {
                                                        if (!dragId) return
                                                        e.preventDefault()
                                                        if (overStage !== stage) setOverStage(stage)
                                                }}
                                                onDragLeave={(e) => {
                                                        if (e.currentTarget.contains(e.relatedTarget as Node)) return
                                                        if (overStage === stage) setOverStage(null)
                                                }}
                                                onDrop={(e) => {
                                                        e.preventDefault()
                                                        handleDrop(stage)
                                                }}
                                                className={cn(
                                                        'flex flex-col rounded-2xl border bg-[var(--bg-surface)] transition-colors',
                                                        isOver
                                                                ? 'border-[var(--border-strong)] bg-[var(--bg-hover)]'
                                                                : 'border-[var(--border-default)]',
                                                )}
                                        >
                                                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
                                                        <span className="text-sm font-medium text-[var(--text-primary)]">
                                                                {t(STAGE_KEY[stage])}
                                                        </span>
                                                        <span className="text-xs text-[var(--text-muted)]">{items.length}</span>
                                                </div>
                                                <div className="flex flex-1 flex-col gap-2 p-3">
                                                        {items.length === 0 ? (
                                                                <p className="py-6 text-center text-xs text-[var(--text-muted)]">
                                                                        {isOver ? t('dropHere') : t('noStage')}
                                                                </p>
                                                        ) : (
                                                                items.map((c) => (
                                                                        <LiveArrivalItem key={c.id} itemId={c.id}>
                                                                        <div
                                                                                draggable
                                                                                onDragStart={(e) => {
                                                                                        setDragId(c.id)
                                                                                        e.dataTransfer.effectAllowed = 'move'
                                                                                }}
                                                                                onDragEnd={() => {
                                                                                        setDragId(null)
                                                                                        setOverStage(null)
                                                                                }}
                                                                                className={cn(
                                                                                        'group cursor-grab rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 transition-opacity active:cursor-grabbing',
                                                                                        dragId === c.id && 'opacity-40',
                                                                                )}
                                                                        >
                                                                                <div className="flex items-center gap-2">
                                                                                        <GripVertical className="h-4 w-4 shrink-0 text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
                                                                                        <ContactAvatar
                                                                                                src={c.avatarUrl}
                                                                                                fallbackSrc={c.avatarFallbackUrl}
                                                                                                alt={rowDisplayName(c, t('anonymous'))}
                                                                                                size="xs"
                                                                                        />
                                                                                        <Link
                                                                                                href={`/contacts/${c.id}`}
                                                                                                className="truncate text-sm font-medium text-[var(--text-primary)]"
                                                                                        >
                                                                                                {rowDisplayName(c, t('anonymous'))}
                                                                                        </Link>
                                                                                </div>
                                                                                <Link
                                                                                        href={`/contacts/${c.id}`}
                                                                                        className="mt-1 flex flex-wrap items-center gap-1"
                                                                                        aria-label={rowDisplayName(c, t('anonymous'))}
                                                                                >
                                                                                        {c.channels.map((ch) => (
                                                                                                <ChannelBadge key={ch} type={ch} />
                                                                                        ))}
                                                                                        <SourceTagBadges tags={c.tags} />
                                                                                </Link>
                                                                                <div className="mt-2 flex items-center justify-between">
                                                                                        <Link
                                                                                                href={`/contacts/${c.id}`}
                                                                                                className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                                                                                        >
                                                                                                {c.conversationCount} {t('conversations')}
                                                                                        </Link>
                                                                                        <div onClick={(e) => e.stopPropagation()}>
                                                                                                <StageSelect value={c.stage} onChange={(s) => onMove(c.id, s)} />
                                                                                        </div>
                                                                                </div>
                                                                        </div>
                                                                        </LiveArrivalItem>
                                                                ))
                                                        )}
                                                </div>
                                        </div>
                                )
                        })}
                </div>
        )
}
