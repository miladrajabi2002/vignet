'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { ChannelType } from '@prisma/client'
import { Users, Search, LayoutList, Columns3, User, GripVertical, Filter, Megaphone, X } from 'lucide-react'
import { ChannelBadge } from '@/components/crm/channel-badge'
import { relativeTime } from '@/lib/format'
import { contactDisplayName } from '@/lib/crm/display'
import { cn } from '@/lib/utils'
import { CampaignComposer } from '@/components/crm/campaign-composer'
import type { CampaignAudienceInput } from '@/lib/campaigns/audience'
import { MaterialSelect } from '@/components/ui/material-select'

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
        channelUsernames?: Partial<Record<ChannelType, string | null>>
        marketingOptIn: boolean
}

const STAGES = ['lead', 'qualified', 'customer', 'lost'] as const
type Stage = (typeof STAGES)[number]

const STAGE_KEY: Record<Stage, string> = {
        lead: 'stageLead',
        qualified: 'stageQualified',
        customer: 'stageCustomer',
        lost: 'stageLost',
}

const CHANNEL_LABEL: Record<string, readonly [string, string]> = {
        INSTAGRAM: ['اینستاگرام', 'Instagram'], WHATSAPP: ['واتساپ', 'WhatsApp'], TELEGRAM: ['تلگرام', 'Telegram'], BALE: ['بله', 'Bale'], RUBIKA: ['روبیکا', 'Rubika'],
}

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
        footer,
}: {
        initial: ContactRow[]
        locale: 'fa' | 'en'
        footer?: React.ReactNode
}) {
        const t = useTranslations('contacts')
        const [rows, setRows] = useState(initial)
        const [view, setView] = useState<'list' | 'pipeline'>('list')
        const [query, setQuery] = useState('')
        const [stageFilter, setStageFilter] = useState<Stage | ''>('')
        const [channelFilter, setChannelFilter] = useState<ChannelType | ''>('')
        const [tagFilter, setTagFilter] = useState('')
        const [selected, setSelected] = useState<Set<string>>(() => new Set())
        const [campaignOpen, setCampaignOpen] = useState(false)

        const availableTags = useMemo(
                () => [...new Set(rows.flatMap((row) => row.tags))].sort((a, b) => a.localeCompare(b)),
                [rows],
        )

        const filtered = useMemo(() => {
                const q = query.trim().toLowerCase()
                return rows.filter((r) => {
                        if (stageFilter && r.stage !== stageFilter) return false
                        if (channelFilter && !r.channels.includes(channelFilter)) return false
                        if (tagFilter && !r.tags.includes(tagFilter)) return false
                        if (!q) return true
                        return (
                                (r.name ?? '').toLowerCase().includes(q) ||
                                (r.phone ?? '').toLowerCase().includes(q) ||
                                r.tags.some((tag) => tag.toLowerCase().includes(q)) ||
                                Object.values(r.channelUsernames ?? {}).some((handle) => (handle ?? '').toLowerCase().includes(q))
                        )
                })
        }, [rows, query, stageFilter, channelFilter, tagFilter])

        const campaignAudience = useMemo<CampaignAudienceInput>(() => {
                if (selected.size > 0) return { selectedContactIds: [...selected] }
                return {
                        filters: {
                                ...(stageFilter ? { stage: stageFilter } : {}),
                                ...(channelFilter && ['TELEGRAM', 'WHATSAPP', 'INSTAGRAM', 'RUBIKA', 'BALE'].includes(channelFilter)
                                        ? { channel: channelFilter as 'TELEGRAM' | 'WHATSAPP' | 'INSTAGRAM' | 'RUBIKA' | 'BALE' }
                                        : {}),
                                ...(tagFilter ? { tag: tagFilter } : {}),
                                ...(query.trim() ? { query: query.trim() } : {}),
                        },
                }
        }, [selected, stageFilter, channelFilter, tagFilter, query])

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
                <div className="mx-auto max-w-6xl space-y-6">
                        {/* Action bar — campaign + view toggle (title is rendered by the
                            parent page's PageHeader, so we only keep the actions here). */}
                        <div className="flex flex-wrap items-center justify-end gap-2">
                                <button
                                        type="button"
                                        onClick={() => setCampaignOpen(true)}
                                        disabled={filtered.length === 0}
                                        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-500 px-4 text-sm font-medium text-white transition-colors hover:bg-violet-400 disabled:opacity-50"
                                >
                                        <Megaphone className="h-4 w-4" />
                                        {locale === 'fa'
                                                ? selected.size > 0 ? `پیام به ${selected.size.toLocaleString('fa-IR')} انتخاب` : 'پیام به فیلتر فعلی'
                                                : selected.size > 0 ? `Message ${selected.size} selected` : 'Message filtered audience'}
                                </button>
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

                        <div className="spatial-surface grid gap-2 rounded-[1.5rem] p-3 sm:grid-cols-2 lg:grid-cols-[1fr_160px_170px_170px_auto]">
                                <div className="relative">
                                        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                                        <input
                                                value={query}
                                                onChange={(e) => setQuery(e.target.value)}
                                                placeholder={t('search')}
                                                className="min-h-11 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] py-2.5 pe-3 ps-9 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-strong)] focus:outline-none"
                                        />
                                </div>
                                <MaterialSelect value={stageFilter} onValueChange={(value) => setStageFilter(value as Stage | '')} ariaLabel={locale === 'fa' ? 'فیلتر مرحله مشتری' : 'Filter customer stage'} options={[{ value: '', label: locale === 'fa' ? 'همه مراحل' : 'All stages' }, ...STAGES.map((stage) => ({ value: stage, label: t(STAGE_KEY[stage]) }))]} />
                                <MaterialSelect value={channelFilter} onValueChange={(value) => setChannelFilter(value as ChannelType | '')} ariaLabel={locale === 'fa' ? 'فیلتر کانال' : 'Filter channel'} options={[{ value: '', label: locale === 'fa' ? 'همه کانال‌ها' : 'All channels' }, ...['INSTAGRAM', 'WHATSAPP', 'TELEGRAM', 'BALE', 'RUBIKA'].map((channel) => ({ value: channel, label: CHANNEL_LABEL[channel][locale === 'fa' ? 0 : 1] }))]} />
                                <MaterialSelect value={tagFilter} onValueChange={setTagFilter} ariaLabel={locale === 'fa' ? 'فیلتر تگ' : 'Filter tag'} options={[{ value: '', label: locale === 'fa' ? 'همه تگ‌ها' : 'All tags' }, ...availableTags.map((tag) => ({ value: tag, label: tag }))]} />
                                <button type="button" onClick={clearFilters} disabled={!hasFilters && selected.size === 0} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-default)] px-3 text-xs text-[var(--text-secondary)] disabled:opacity-40"><X className="h-3.5 w-3.5" />{locale === 'fa' ? 'پاک‌کردن' : 'Clear'}</button>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                                <span className="inline-flex items-center gap-1.5"><Filter className="h-3.5 w-3.5" />{locale === 'fa' ? `${filtered.length.toLocaleString('fa-IR')} نتیجه در این صفحه` : `${filtered.length} results on this page`}</span>
                                {view === 'list' && filtered.length > 0 && <button type="button" onClick={() => setSelected(new Set(filtered.map((row) => row.id)))} className="min-h-11 rounded-xl px-2.5 hover:bg-[var(--bg-hover)]">{locale === 'fa' ? 'انتخاب همه نتایج این صفحه' : 'Select all results on this page'}</button>}
                        </div>

                        {filtered.length === 0 ? (
                                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-16 text-center">
                                        <Users className="h-8 w-8 text-[var(--text-muted)]" />
                                        <p className="mt-4 text-sm text-[var(--text-secondary)]">{t('empty')}</p>
                                </div>
                        ) : view === 'list' ? (
                                <ListView rows={filtered} locale={locale} onMove={move} selected={selected} onToggleSelected={toggleSelected} />
                        ) : (
                                <PipelineView rows={filtered} onMove={move} />
                        )}

                        {/* Pagination only makes sense for the flat list; the pipeline drags
          across stages within the loaded page and a search hides the controls. */}
                        {footer && view === 'list' && !query ? footer : null}

                        {campaignOpen && (
                                <CampaignComposer audience={campaignAudience} locale={locale} onClose={() => setCampaignOpen(false)} />
                        )}
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

function Avatar({ url, name }: { url?: string | null; name?: string | null }) {
        const [broken, setBroken] = useState(false)
        if (url && !broken) {
                return (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                                src={url}
                                alt={name ?? ''}
                                width={36}
                                height={36}
                                loading="lazy"
                                decoding="async"
                                referrerPolicy="no-referrer"
                                onError={() => setBroken(true)}
                                className="h-9 w-9 shrink-0 rounded-full border border-[var(--border-default)] object-cover"
                        />
                )
        }
        return (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] text-[var(--text-secondary)]">
                        <User className="h-4 w-4" />
                </div>
        )
}

function ListView({
        rows,
        locale,
        onMove,
        selected,
        onToggleSelected,
}: {
        rows: ContactRow[]
        locale: 'fa' | 'en'
        onMove: (id: string, s: Stage) => void
        selected: Set<string>
        onToggleSelected: (id: string) => void
}) {
        const t = useTranslations('contacts')
        return (
                <div className="spatial-surface divide-y divide-[var(--border-subtle)] overflow-hidden rounded-[1.5rem]">
                        {rows.map((c) => (
                                // ── Whole row is clickable: wrap avatar + content in a Link so a single
                                //    click anywhere on the row (except the stage dropdown) opens the
                                //    customer detail page. The <StageSelect> stays outside the Link and
                                //    stops click propagation so changing stage doesn't navigate. ──
                                <div
                                        key={c.id}
                                        className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-hover)]"
                                >
                                        <label className="grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors hover:bg-[var(--bg-hover)]">
                                                <input
                                                        type="checkbox"
                                                        checked={selected.has(c.id)}
                                                        onChange={() => onToggleSelected(c.id)}
                                                        className="h-4 w-4 accent-violet-500"
                                                        aria-label={locale === 'fa' ? `انتخاب ${rowDisplayName(c, t('anonymous'))}` : `Select ${rowDisplayName(c, t('anonymous'))}`}
                                                />
                                        </label>
                                        <Link
                                                href={`/contacts/${c.id}`}
                                                className="flex min-w-0 flex-1 items-center gap-3"
                                                aria-label={rowDisplayName(c, t('anonymous'))}
                                        >
                                                <Avatar url={c.avatarUrl} name={c.name} />
                                                <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                                <span className="truncate text-sm font-medium text-[var(--text-primary)] group-hover:underline">
                                                                        {rowDisplayName(c, t('anonymous'))}
                                                                </span>
                                                                {c.channels.map((ch) => {
                                                                        const handle = c.channelUsernames?.[ch]
                                                                        return (
                                                                                <span
                                                                                        key={ch}
                                                                                        className="inline-flex items-center gap-1"
                                                                                >
                                                                                        <ChannelBadge type={ch} />
                                                                                        {handle && (
                                                                                                <span
                                                                                                        dir="ltr"
                                                                                                        className="text-[10px] text-[var(--text-muted)]"
                                                                                                >
                                                                                                        @{handle}
                                                                                                </span>
                                                                                        )}
                                                                                </span>
                                                                        )
                                                                })}
                                                        </div>
                                                        <p className="truncate text-xs text-[var(--text-secondary)]">
                                                                {c.conversationCount} {t('conversations')} · {t('lastSeen')}{' '}
                                                                {relativeTime(new Date(c.lastActivity), locale)}
                                                        </p>
                                                        {c.marketingOptIn && <span className="mt-1 inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] text-emerald-500">{locale === 'fa' ? 'رضایت پیام' : 'Opted in'}</span>}
                                                </div>
                                        </Link>
                                        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                                                <StageSelect value={c.stage} onChange={(s) => onMove(c.id, s)} />
                                        </div>
                                </div>
                        ))}
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
                                                                        <div
                                                                                key={c.id}
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
                                                                                        <Link
                                                                                                href={`/contacts/${c.id}`}
                                                                                                className="truncate text-sm font-medium text-[var(--text-primary)] hover:underline"
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
                                                                ))
                                                        )}
                                                </div>
                                        </div>
                                )
                        })}
                </div>
        )
}
