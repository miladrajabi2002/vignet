'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import type { ChannelType } from '@prisma/client'
import { ChevronLeft, Columns3, Download, Filter, GripVertical, LayoutList, Loader2, MoreVertical, Search, SlidersHorizontal, Users, X } from 'lucide-react'
import { useUrlSearchInput } from '@/lib/hooks/use-url-search-input'
import { ChannelBadge, ChannelGlyph, SourceTagBadges, isSourceTag } from '@/components/crm/channel-badge'
import { smartTime, formatDateTime } from '@/lib/format'
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
import { UNDO_RESTORED_EVENT } from '@/lib/undo-queue'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'
import { ContactDetailSheet } from '@/components/crm/contact-detail-sheet'
import { ContactQuickAdd } from '@/components/crm/contact-quick-add'
import {
        CONTACT_STAGES,
        ContactStageBadge,
        type ContactStage,
} from '@/components/crm/contact-stage-badge'
import { LiveEmptyState } from '@/components/ui/live-empty-state'

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
        /** Last thing said in the customer's latest conversation. */
        lastMessage?: string | null
        /** 0–100 likelihood of buying, across all conversations and real outcomes. */
        buyerProbability?: number | null
        buyerLevel?: 'customer' | 'hot' | 'warm' | 'exploring' | 'cold' | null
        /** Strongest evidence behind the score (shown as the tooltip). */
        buyerReason?: 'paid_order' | 'booking' | 'enrollment' | 'filed_order' | 'checkout' | 'cart' | 'conversation' | null
}

const BUYER_REASON: Record<NonNullable<ContactRow['buyerReason']>, readonly [string, string]> = {
        paid_order: ['سفارش پرداخت‌شده دارد', 'Has a paid order'],
        booking: ['نوبت رزروشده دارد', 'Has a booked appointment'],
        enrollment: ['در دوره ثبت‌نام کرده', 'Enrolled in a course'],
        filed_order: ['پیش‌سفارش ثبت کرده', 'Filed a pre-order'],
        checkout: ['لینک پرداخت گرفته و منتظر پرداخت است', 'Has an unpaid payment link'],
        cart: ['سبد خرید در حال تکمیل دارد', 'Has a cart in progress'],
        conversation: ['از روی گفتگوهای اخیرش', 'From recent conversations'],
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
        limitNotice,
        customerLimitReached = false,
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
        limitNotice?: React.ReactNode
        customerLimitReached?: boolean
        footer?: React.ReactNode
}) {
        const t = useTranslations('contacts')
        const router = useRouter()
        const [rows, setRows] = useState(initial)
        const [view, setView] = useState<'list' | 'pipeline'>('list')
        const [query, setQuery, markQuerySent] = useUrlSearchInput(serverQuery)
        const [isSearching, startSearchTransition] = useTransition()
        const [stageFilter, setStageFilter] = useState<Stage | ''>(initialStageFilter)
        const [channelFilter, setChannelFilter] = useState<ChannelType | ''>(initialChannelFilter)
        const [tagFilter, setTagFilter] = useState(initialTagFilter)
        const [filterSheetOpen, setFilterSheetOpen] = useState(false)
        const [selected, setSelected] = useState<Set<string>>(() => new Set())
        const filterTriggerRef = useRef<HTMLButtonElement>(null)
        const detailTriggerRef = useRef<HTMLElement | null>(null)
        const detailOpenedLocallyRef = useRef(false)

        useEffect(() => {
                setRows(initial)
        }, [initial])

        // When a deleted selection is restored via the global undo toast the
        // row ids are stale — drop the local selection.
        useEffect(() => {
                function onRestored() {
                        setSelected(new Set())
                }
                window.addEventListener(UNDO_RESTORED_EVENT, onRestored)
                return () => window.removeEventListener(UNDO_RESTORED_EVENT, onRestored)
        }, [])

        useEffect(() => {
                setStageFilter(initialStageFilter)
                setChannelFilter(initialChannelFilter)
                setTagFilter(initialTagFilter)
        }, [initialStageFilter, initialChannelFilter, initialTagFilter])

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
                                if (nextQuery !== serverQuery) markQuerySent(nextQuery)
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
                markQuerySent,
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

        // ── Row selection: simple Set — plain checkboxes, no shift/ranges.
        // (Reverted from the tri-state experiment per user request.)

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

        const exportLink = (
                <a
                        href={exportHref}
                        download
                        title={t('exportDescription')}
                        aria-label={t('exportExcel')}
                        className="spatial-press inline-flex min-h-11 w-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-white px-0 text-xs font-semibold text-[var(--text-secondary)] shadow-[var(--shadow-xs)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] sm:w-auto sm:px-4 sm:text-sm"
                >
                        <Download className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden sm:inline">{t('exportExcel')}</span>
                </a>
        )

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
                                                {/* At the limit the notice below carries the upgrade; no second button for it here. */}
                                                {!customerLimitReached && <ContactQuickAdd locale={locale} />}
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
                                                {exportLink}
                                                <BulkDeleteButton
                                                        countEndpoint="/api/contacts/bulk"
                                                        deleteEndpoint="/api/contacts/bulk"
                                                        restoreEndpoint="/api/contacts/bulk/restore"
                                                        entityLabel={locale === 'fa' ? 'مشتری' : 'contact'}
                                                        entitySingularLabel={locale === 'fa' ? 'مشتری' : 'contact'}
                                                        buttonLabel={selected.size > 0
                                                                ? locale === 'fa'
                                                                        ? `حذف ${selected.size.toLocaleString('fa-IR')} مشتری`
                                                                        : `Delete ${selected.size} customers`
                                                                : locale === 'fa' ? 'حذف همه مشتریان' : 'Delete all customers'}
                                                        dialogTitle={selected.size > 0
                                                                ? locale === 'fa'
                                                                        ? `حذف ${selected.size.toLocaleString('fa-IR')} مشتری؟`
                                                                        : `Delete ${selected.size} customers?`
                                                                : undefined}
                                                        countOverride={selected.size > 0 ? selected.size : undefined}
                                                        deleteBody={selected.size > 0 ? { ids: [...selected] } : undefined}
                                                        extraWarning={locale === 'fa'
                                                                ? 'گفتگوهای مشتریان حفظ می‌شوند؛ با حذف یا بازگردانی، لینک گفتگوها هم به همان شکل برمی‌گردد.'
                                                                : 'Conversations are preserved; restoring also brings their links back.'}
                                                        compactOnMobile
                                                        undoKind="contact"
                                                        onDeleted={() => setSelected(new Set())}
                                                />
                                        </>
                                }
                        />

                        {limitNotice}

                        <div className="flex flex-wrap items-center justify-end gap-2">
                                <div className="ui-seg grid-flow-col" role="group">
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
                                <div className="ui-fbar spatial-surface rounded-card p-2.5 shadow-[var(--elev-1)] md:rounded-card md:p-4 md:shadow-[var(--shadow-card)]">
                                        <div className="ui-fbar-compact flex items-center gap-2">
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
                                                                'spatial-press relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
                                                                activeFacetCount > 0
                                                                        ? 'border-black bg-black text-white'
                                                                        : 'border-[var(--border-default)] text-[var(--text-secondary)]',
                                                        )}
                                                        aria-label={t('filters')}
                                                >
                                                        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                                                        {activeFacetCount > 0 && (
                                                                <span className="absolute -end-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-amber-400 px-1 text-[12px] font-bold tabular-nums text-black">
                                                                        {activeFacetCount.toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')}
                                                                </span>
                                                        )}
                                                </button>
                                        </div>

                                        {activeFacetCount > 0 && (
                                                <div className="ui-fbar-compact mt-2 flex flex-wrap gap-2" aria-label={t('filters')}>
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

                                        <div className="ui-fbar-full flex-wrap items-center gap-2">
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
                                                <MaterialSelect value={channelFilter} onValueChange={(value) => setChannelFilter(value as ChannelType | '')} ariaLabel={locale === 'fa' ? 'فیلتر برنامه' : 'Filter channel'} className="min-w-40" options={[{ value: '', label: t('allChannels') }, ...FILTER_CHANNELS.map((channel) => ({ value: channel, label: CHANNEL_LABEL[channel][locale === 'fa' ? 0 : 1] }))]} />
                                                <MaterialSelect value={tagFilter} onValueChange={setTagFilter} ariaLabel={locale === 'fa' ? 'فیلتر تگ' : 'Filter tag'} className="min-w-40" options={[{ value: '', label: t('allTags') }, ...availableTags.map((tag) => ({ value: tag, label: tag }))]} />
                                                {hasFilters && (
                                                        <button type="button" onClick={clearFilters} className="inline-flex h-11 w-11 items-center justify-center rounded-control border border-[var(--border-default)] bg-white text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" aria-label={t('clearFilters')}><X className="h-4 w-4" /></button>
                                                )}
                                        </div>
                                </div>
                        </div>

                        <MobileBottomSheet
                                mobileOnly={false}
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
                                                        className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--border-default)] px-4 text-xs font-semibold text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-40"
                                                >
                                                        {t('clearFilters')}
                                                </button>
                                                <button
                                                        type="button"
                                                        onClick={() => setFilterSheetOpen(false)}
                                                        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
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
                                        <FilterField label={locale === 'fa' ? 'برنامهٔ ارتباطی' : 'Channel'}>
                                                <MaterialSelect value={channelFilter} onValueChange={(value) => setChannelFilter(value as ChannelType | '')} ariaLabel={locale === 'fa' ? 'فیلتر برنامه' : 'Filter channel'} options={[{ value: '', label: t('allChannels') }, ...FILTER_CHANNELS.map((channel) => ({ value: channel, label: CHANNEL_LABEL[channel][locale === 'fa' ? 0 : 1] }))]} />
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
                                <LiveEmptyState
                                icon={Users}
                                preview={rows.length === 0 && !serverQuery ? 'people' : 'none'}
                                title={t('empty')}
                                description={rows.length === 0 && !serverQuery
                                ? (locale === 'fa' ? 'از اولین پیام هر مشتری، پرونده‌اش خودکار این‌جا ساخته می‌شود.' : 'Each customer’s record builds itself here from their first message.')
                                : (locale === 'fa' ? 'فیلترها یا جستجو را تغییر دهید.' : 'Change the filters or search.')}
                                />
                        ) : view === 'list' ? (
                                        <ListView rows={filtered} locale={locale} onMove={move} selected={selected} onToggleSelected={toggleSelected} onOpenContact={openContactDetails} />
                        ) : (
                                <PipelineView rows={filtered} onMove={move} />
                        )}

                        {footer && view === 'list' ? footer : null}

                        {/* Charts sit under the list: people come here for the customers, not the summary. */}
                        {insights}

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
                                        className="absolute end-0 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
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
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
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
                        type="button"
                        onClick={onClick}
                        aria-pressed={active}
                        data-active={active}
                        className="ui-seg-tab min-h-9 gap-1.5 px-3 text-[13px]"
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
                                        <span className="shrink-0 text-[12px] font-medium text-[var(--text-muted)]">{t('latestActivity')}</span>
                                </div>

                                {rows.map((c) => {
                                        const name = rowDisplayName(c, t('anonymous'))
                                        const normalizedStage = STAGES.includes(c.stage as Stage) ? c.stage as Stage : 'lead'
                                        return (
                                                <LiveArrivalItem key={`mobile-${c.id}`} itemId={c.id}>
                                                        <article
                                                                className={cn(
                                                                        'spatial-surface overflow-hidden rounded-card transition-[border-color,box-shadow] duration-150',
                                                                        selected.has(c.id) && 'border-black/25 shadow-[var(--elev-1)]',
                                                                )}
                                                        >
                                                                <button
                                                                        type="button"
                                                                        onClick={(event) => onOpenContact(c.id, event.currentTarget)}
                                                                        aria-haspopup="dialog"
                                                                        aria-label={`${t('openDetails')}: ${name}`}
                                                                        className="spatial-press block w-full p-4 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
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
                                                                                {c.tags.filter((tag) => !isSourceTag(tag)).slice(0, 2).map((tag) => (
                                                                                        <span key={tag} className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[12px] text-[var(--text-secondary)]">{tag}</span>
                                                                                ))}
                                                                        </div>

                                                                        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-black/[0.025] p-3 text-xs">
                                                                                <div>
                                                                                        <span className="block text-[12px] text-[var(--text-muted)]">{t('conversations')}</span>
                                                                                        <span className="mt-1 block font-semibold tabular-nums text-[var(--text-primary)]">{nf.format(c.conversationCount)}</span>
                                                                                </div>
                                                                                <div>
                                                                                        <span className="block text-[12px] text-[var(--text-muted)]">{t('latestActivity')}</span>
                                                                                        <span className="mt-1 block truncate font-semibold tabular-nums text-[var(--text-primary)]" title={formatDateTime(c.lastActivity, locale)}>{smartTime(c.lastActivity, locale)}</span>
                                                                                </div>
                                                                        </div>

                                                                        {c.marketingOptIn && (
                                                                                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-700">
                                                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                                                                                        {t('marketingConsent')}
                                                                                </span>
                                                                        )}
                                                                </button>

                                                                <div className="flex items-center gap-2 border-t border-[var(--border-subtle)] bg-black/[0.012] p-2.5">
                                                                        <label className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl px-2 text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">
                                                                                <input
                                                                                        type="checkbox"
                                                                                        checked={selected.has(c.id)}
                                                                                        onChange={() => onToggleSelected(c.id)}
                                                                                        onClick={(event) => event.stopPropagation()}
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

                        <div className="spatial-surface hidden divide-y divide-[var(--border-subtle)] overflow-hidden rounded-card md:block">
                                <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3.5 sm:px-5">
                                        <div className="min-w-0">
                                                <h2 className="text-base font-bold tracking-tight text-[var(--text-primary)]">{locale === 'fa' ? 'فهرست مشتریان' : 'Customer list'}</h2>
                                                <p className="mt-1 text-xs text-[var(--text-muted)]">{t('customersOnPage', { count: nf.format(rows.length) })}</p>
                                        </div>
                                        <span className="shrink-0 rounded-full bg-[var(--bg-muted)] px-2.5 py-1 text-[12px] font-medium text-[var(--text-secondary)]">{t('latestActivity')}</span>
                                </div>
                                {rows.map((c) => {
                                        const name = rowDisplayName(c, t('anonymous'))
                                        return (
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
                                                                        aria-label={`${t('selectCustomer')}: ${name}`}
                                                                />
                                                        </label>
                                                        <Link
                                                                href={`/contacts/${c.id}`}
                                                                className="flex min-w-0 flex-1 items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                                                aria-label={name}
                                                        >
                                                                <ContactAvatar
                                                                        src={c.avatarUrl}
                                                                        fallbackSrc={c.avatarFallbackUrl}
                                                                        alt={name}
                                                                />
                                                                <div className="min-w-0 flex-1">
                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                                <span className="truncate text-sm font-medium text-[var(--text-primary)]" title={name}>{name}</span>
                                                                                {c.channels.map((ch) => {
                                                                                        const handle = c.channelUsernames?.[ch]
                                                                                        return (
                                                                                                <span key={ch} className="inline-flex items-center gap-1">
                                                                                                        <ChannelBadge type={ch} />
                                                                                                        {handle && <span dir="ltr" className="text-[12px] text-[var(--text-muted)]">@{handle}</span>}
                                                                                                </span>
                                                                                        )
                                                                                })}
                                                                                <SourceTagBadges tags={c.tags} />
                                                                        </div>
                                                                        <p className="truncate text-xs tabular-nums text-[var(--text-secondary)]" title={`${name} — ${nf.format(c.conversationCount)} ${t('conversations')}`}>
                                                                                {nf.format(c.conversationCount)} {t('conversations')} · {t('lastSeen')} <span className="tabular-nums" title={formatDateTime(c.lastActivity, locale)}>{smartTime(c.lastActivity, locale)}</span>
                                                                        </p>
                                                                        {c.marketingOptIn && <span className="mt-1 inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-[12px] text-emerald-600">{t('marketingConsent')}</span>}
                                                                </div>
                                                        </Link>
                                                        <div onClick={(event) => event.stopPropagation()} className="shrink-0">
                                                                <StageSelect value={c.stage} onChange={(nextStage) => onMove(c.id, nextStage)} />
                                                        </div>
                                                </LiveArrivalItem>
                                        )
                                })}
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
        const locale = useLocale()
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
                <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-4">
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
                                                        'flex w-[17rem] shrink-0 snap-start flex-col rounded-2xl border bg-[var(--bg-surface)] transition-colors md:w-auto',
                                                        isOver
                                                                ? 'border-[var(--border-strong)] bg-[var(--bg-hover)]'
                                                                : 'border-[var(--border-default)]',
                                                )}
                                        >
                                                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
                                                        <span className="text-sm font-medium text-[var(--text-primary)]">
                                                                {t(STAGE_KEY[stage])}
                                                        </span>
                                                        <span className="text-xs tabular-nums text-[var(--text-muted)]">{items.length.toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')}</span>
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
                                                                                        'cursor-grab rounded-xl border border-[var(--border-subtle)] bg-white p-3 shadow-[var(--shadow-xs)] transition-opacity active:cursor-grabbing',
                                                                                        dragId === c.id && 'opacity-40',
                                                                                )}
                                                                        >
                                                                                <div className="flex items-center gap-1.5">
                                                                                        <GripVertical className="h-4 w-4 shrink-0 text-[var(--text-hint)]" aria-hidden="true" />
                                                                                        <Link
                                                                                                href={`/contacts/${c.id}`}
                                                                                                className="min-w-0 truncate text-[13px] font-bold text-[var(--text-primary)]"
                                                                                        >
                                                                                                {rowDisplayName(c, t('anonymous'))}
                                                                                        </Link>
                                                                                        {c.channels.map((ch) => <ChannelGlyph key={ch} type={ch} />)}
                                                                                        {/* Dragging needs a mouse; this is the same move for touch and keyboard.
                                                                                            With a mouse the ⋮ is not drawn (drag does it), but it opens out
                                                                                            when a keyboard user tabs onto it. */}
                                                                                        <label className="relative ms-auto grid h-8 w-8 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-lg text-[var(--text-muted)] hover:bg-black/[0.05] hover:text-[var(--text-primary)] focus-within:ring-2 focus-within:ring-[var(--focus-ring)] [@media(pointer:fine)]:w-0 [@media(pointer:fine)]:opacity-0 [@media(pointer:fine)]:focus-within:w-8 [@media(pointer:fine)]:focus-within:opacity-100">
                                                                                                <MoreVertical className="h-4 w-4" aria-hidden="true" />
                                                                                                <select
                                                                                                        value={stageOf(c)}
                                                                                                        onChange={(e) => onMove(c.id, e.target.value as Stage)}
                                                                                                        aria-label={`${t('stage')}: ${rowDisplayName(c, t('anonymous'))}`}
                                                                                                        className="absolute inset-0 cursor-pointer opacity-0"
                                                                                                >
                                                                                                        {STAGES.map((option) => <option key={option} value={option}>{t(STAGE_KEY[option])}</option>)}
                                                                                                </select>
                                                                                        </label>
                                                                                </div>
                                                                                <Link href={`/contacts/${c.id}`} tabIndex={-1} aria-hidden="true" className="mt-1 block">
                                                                                        <p className="line-clamp-2 min-h-5 text-[12px] leading-5 text-[var(--text-secondary)]">
                                                                                                {c.lastMessage || (locale === 'fa' ? 'هنوز پیامی نیست' : 'No messages yet')}
                                                                                        </p>
                                                                                </Link>
                                                                                <div className="mt-1.5 flex items-center justify-between gap-2 text-[12px] text-[var(--text-muted)]">
                                                                                        <span className="whitespace-nowrap tabular-nums">{smartTime(c.lastActivity, locale === 'fa' ? 'fa' : 'en')}</span>
                                                                                        {typeof c.buyerProbability === 'number' && (
                                                                                                <span
                                                                                                        title={c.buyerReason ? BUYER_REASON[c.buyerReason][locale === 'fa' ? 0 : 1] : undefined}
                                                                                                        className={cn('whitespace-nowrap font-medium tabular-nums', c.buyerProbability >= 75 ? 'text-emerald-700' : '')}
                                                                                                >
                                                                                                        {c.buyerLevel === 'customer'
                                                                                                                ? (locale === 'fa' ? 'مشتری ✓' : 'Customer ✓')
                                                                                                                : `${Math.round(c.buyerProbability).toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')}${locale === 'fa' ? '٪' : '%'}`}
                                                                                                </span>
                                                                                        )}
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
