'use client'

/**
 * Instagram media picker popup — the visual replacement for pasting post
 * permalinks by hand. Because the platform owns the page connection, we can
 * list the page's own media straight from the Graph API:
 *
 *   - POSTS   → published photos / videos / reels / carousels (permanent)
 *   - STORIES → only the stories still live (24h), each tile showing a
 *               countdown so operators see exactly how long the scenario
 *               will keep answering before it auto-deactivates.
 *
 * Design mirrors the dashboard system: DialogShell + spatial-surface +
 * Instagram gradient accents, matching automation-form's visual language.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
        Loader2,
        AlertCircle,
        Check,
        Image as ImageIcon,
        Film,
        Layers,
        Clapperboard,
        RefreshCw,
        Clock,
        Camera,
        ChevronDown,
        Search,
        type LucideIcon,
} from 'lucide-react'
import { DialogShell } from '@/components/ui/dialog-shell'
import { cn } from '@/lib/utils'

const IG_GRADIENT = 'linear-gradient(45deg, #f58529 0%, #dd2a7b 50%, #8134af 100%)'

/** One media entry returned by /api/agents/{id}/instagram/media/list. */
export interface InstagramMediaItem {
        id: string
        kind: 'POST' | 'STORY'
        mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
        productType?: string
        mediaUrl?: string
        permalink?: string
        caption?: string
        timestamp: string
        /** STORY only — when it disappears from the page. */
        expiresAt?: string
}

type PostTab = 'ALL' | 'PHOTO' | 'VIDEO' | 'REEL'

const POST_TABS: { value: PostTab; label: string }[] = [
        { value: 'ALL', label: 'همه' },
        { value: 'PHOTO', label: 'عکس' },
        { value: 'VIDEO', label: 'ویدیو' },
        { value: 'REEL', label: 'ریلز' },
]

/** Remaining-time label in Persian: «۳ ساعت و ۱۲ دقیقه». */
function faRemaining(targetMs: number, nowMs: number): string | null {
        const diff = targetMs - nowMs
        if (diff <= 0) return null
        const hours = Math.floor(diff / 3_600_000)
        const minutes = Math.floor((diff % 3_600_000) / 60_000)
        const fa = (n: number) => n.toLocaleString('fa-IR')
        if (hours >= 1) {
                return minutes > 0 ? `${fa(hours)} ساعت و ${fa(minutes)} دقیقه` : `${fa(hours)} ساعت`
        }
        if (minutes >= 1) return `${fa(minutes)} دقیقه`
        return 'کمتر از یک دقیقه'
}

/** Persian relative date for a post's timestamp: «۳ روز پیش». */
function faAgo(iso: string, nowMs: number): string {
        const diff = nowMs - new Date(iso).getTime()
        if (Number.isNaN(diff)) return ''
        const days = Math.floor(diff / 86_400_000)
        const hours = Math.floor(diff / 3_600_000)
        const fa = (n: number) => n.toLocaleString('fa-IR')
        if (days >= 7) return new Date(iso).toLocaleDateString('fa-IR')
        if (days >= 1) return `${fa(days)} روز پیش`
        if (hours >= 1) return `${fa(hours)} ساعت پیش`
        return 'چند دقیقه پیش'
}

function MediaBadge({ item }: { item: InstagramMediaItem }) {
        let Icon: LucideIcon = ImageIcon
        let label = 'عکس'
        if (item.kind === 'STORY') {
                Icon = Clock
                label = 'استوری'
        } else if (item.mediaType === 'CAROUSEL_ALBUM') {
                Icon = Layers
                label = 'چندتایی'
        } else if (item.mediaType === 'VIDEO') {
                const isReel = item.productType === 'ADS' ? false : item.productType === 'REELS'
                if (isReel) {
                        Icon = Clapperboard
                        label = 'ریلز'
                } else {
                        Icon = Film
                        label = 'ویدیو'
                }
        }
        return (
                <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                        <Icon aria-hidden="true" className="h-3 w-3" />
                        {label}
                </span>
        )
}

/** Story tile wrapper — Instagram-style gradient ring while the story is live. */
function StoryRing({ live, children }: { live: boolean; children: React.ReactNode }) {
        return (
                <div
                        className={cn(
                                'relative rounded-[1.25rem] p-[2.5px] transition-shadow',
                                live ? 'shadow-[0_10px_30px_-14px_rgba(221,42,123,0.55)]' : '',
                        )}
                        style={live ? { background: IG_GRADIENT } : { background: 'var(--border-default)' }}
                >
                        {children}
                </div>
        )
}

export function InstagramMediaPicker({
        open,
        onClose,
        agentId,
        kind,
        selectedIds,
        multiple = true,
        onConfirm,
        accountUsername,
}: {
        open: boolean
        onClose: () => void
        agentId: string
        kind: 'posts' | 'stories'
        /** Ids already chosen (pre-checked when the popup opens). */
        selectedIds: string[]
        multiple?: boolean
        /** Called with the full selection when the operator confirms. */
        onConfirm: (items: InstagramMediaItem[]) => void
        accountUsername?: string
}) {
        const [items, setItems] = useState<InstagramMediaItem[]>([])
        const [loading, setLoading] = useState(false)
        const [loadingMore, setLoadingMore] = useState(false)
        const [hasMore, setHasMore] = useState(false)
        const [pagesLoaded, setPagesLoaded] = useState(1)
        const [error, setError] = useState<string | null>(null)
        const [tab, setTab] = useState<PostTab>('ALL')
        const [query, setQuery] = useState('')
        const [selected, setSelected] = useState<Map<string, InstagramMediaItem>>(new Map())
        // Live clock so story countdowns tick every minute.
        const [now, setNow] = useState(() => Date.now())
        const requestSeq = useRef(0)

        useEffect(() => {
                if (!open) return
                const id = window.setInterval(() => setNow(Date.now()), 60_000)
                return () => window.clearInterval(id)
        }, [open])

        const fetchItems = useCallback(
                async (pages: number) => {
                        const seq = ++requestSeq.current
                        const isFirst = pages === 1
                        if (isFirst) setLoading(true)
                        else setLoadingMore(true)
                        setError(null)
                        try {
                                const response = await fetch(
                                        `/api/agents/${agentId}/instagram/media/list?kind=${kind}&pages=${pages}`,
                                        { cache: 'no-store' },
                                )
                                const data = (await response.json().catch(() => ({}))) as {
                                        items?: InstagramMediaItem[]
                                        hasMore?: boolean
                                        error?: string
                                }
                                if (seq !== requestSeq.current) return
                                if (!response.ok || !Array.isArray(data.items)) {
                                        const text =
                                                data.error === 'PLAN_BLOCKED'
                                                        ? 'برای استفاده از این بخش، دورهٔ آزمایشی یا اشتراک فعال لازم است.'
                                                        : data.error === 'IG_RECONNECT_REQUIRED'
                                                                ? 'اتصال اینستاگرام قطع شده است؛ یک‌بار دیگر آن را متصل کنید.'
                                                                : 'دریافت رسانه‌های پیج از اینستاگرام انجام نشد.'
                                        setError(text)
                                        return
                                }
                                setItems(data.items)
                                setHasMore(Boolean(data.hasMore))
                                setPagesLoaded(pages)
                        } catch {
                                if (seq !== requestSeq.current) return
                                setError('ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید.')
                        } finally {
                                if (seq === requestSeq.current) {
                                        setLoading(false)
                                        setLoadingMore(false)
                                }
                        }
                },
                [agentId, kind],
        )

        // Fetch whenever the popup opens (cheap: the Graph call is no-store but
        // bounded to one 30-item page for posts / the whole live set for stories).
        useEffect(() => {
                if (!open) return
                setTab('ALL')
                setQuery('')
                setSelected(new Map())
                void fetchItems(1)
        }, [open, fetchItems])

        function toggle(item: InstagramMediaItem) {
                setSelected((prev) => {
                        const next = new Map(prev)
                        if (next.has(item.id)) {
                                next.delete(item.id)
                        } else {
                                if (!multiple) next.clear()
                                next.set(item.id, item)
                        }
                        return next
                })
        }

        const visible = useMemo(() => {
                let out = items
                if (kind === 'posts') {
                        if (tab === 'PHOTO') out = out.filter((i) => i.mediaType === 'IMAGE')
                        else if (tab === 'VIDEO') out = out.filter((i) => i.mediaType === 'VIDEO' && i.productType !== 'REELS')
                        else if (tab === 'REEL') out = out.filter((i) => i.mediaType === 'VIDEO' && i.productType === 'REELS')
                }
                const q = query.trim()
                if (q) {
                        out = out.filter((i) => (i.caption ?? '').includes(q) || i.id.includes(q))
                }
                return out
        }, [items, kind, tab, query])

        const isStory = kind === 'stories'
        const selectedCount = selected.size
        const confirmDisabled = selectedCount === 0
        const anyLiveStory = isStory && items.some((i) => (i.expiresAt ? new Date(i.expiresAt).getTime() > now : false))

        return (
                <DialogShell
                        wide
                        title={isStory ? 'انتخاب استوری' : 'انتخاب پست از پیج'}
                        subtitle={
                                accountUsername
                                        ? `رسانه‌های ${isStory ? 'فعال' : 'منتشرشده'} @${accountUsername}${isStory ? ' — فقط استوری‌های ۲۴ ساعت اخیر' : ''}`
                                        : undefined
                        }
                        onClose={onClose}
                >
                        <div className="space-y-3">
                                {/* Filters */}
                                {!isStory && (
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                                <div className="ui-seg grid-flow-col [grid-auto-columns:minmax(0,1fr)] sm:w-auto" role="radiogroup">
                                                        {POST_TABS.map((t) => (
                                                                <button
                                                                        key={t.value}
                                                                        type="button"
                                                                        role="radio"
                                                                        aria-checked={tab === t.value}
                                                                        data-active={tab === t.value}
                                                                        onClick={() => setTab(t.value)}
                                                                        className="ui-seg-tab min-h-9 px-3 text-xs"
                                                                >
                                                                        {t.label}
                                                                </button>
                                                        ))}
                                                </div>
                                                <div className="relative flex-1">
                                                        <Search
                                                                aria-hidden="true"
                                                                className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
                                                        />
                                                        <input
                                                                dir="rtl"
                                                                value={query}
                                                                onChange={(e) => setQuery(e.target.value)}
                                                                placeholder="جستجو در کپشن…"
                                                                className="input pe-10"
                                                                maxLength={80}
                                                        />
                                                </div>
                                        </div>
                                )}

                                {/* Body states */}
                                {loading ? (
                                        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                                                {Array.from({ length: 8 }).map((_, i) => (
                                                        <div
                                                                key={i}
                                                                className="aspect-square animate-pulse rounded-xl bg-[var(--bg-muted)]"
                                                        />
                                                ))}
                                        </div>
                                ) : error ? (
                                        <div className="flex flex-col items-center gap-3 py-10 text-center">
                                                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-500">
                                                        <AlertCircle className="h-6 w-6" aria-hidden="true" />
                                                </span>
                                                <p className="max-w-sm text-sm leading-6 text-[var(--text-secondary)]">{error}</p>
                                                <button
                                                        type="button"
                                                        onClick={() => void fetchItems(1)}
                                                        className="spatial-press inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-4 text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                                                >
                                                        <RefreshCw className="h-4 w-4" aria-hidden="true" />
                                                        تلاش مجدد
                                                </button>
                                        </div>
                                ) : visible.length === 0 ? (
                                        <div className="flex flex-col items-center gap-3 py-10 text-center">
                                                <span
                                                        className="grid h-12 w-12 place-items-center rounded-2xl text-white"
                                                        style={{ background: IG_GRADIENT }}
                                                >
                                                        <Camera className="h-6 w-6" aria-hidden="true" />
                                                </span>
                                                <p className="max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
                                                        {isStory
                                                                ? 'در ۲۴ ساعت گذشته استوری‌ای منتشر نشده است. ابتدا در اینستاگرام استوری بگذارید، سپس این پنجره را دوباره باز کنید.'
                                                                : 'هیچ پست یا ریلزی یافت نشد.'}
                                                </p>
                                        </div>
                                ) : (
                                        <>
                                                {isStory && anyLiveStory && (
                                                        <p className="flex items-center gap-1.5 rounded-xl bg-[color:color-mix(in_srgb,#dd2a7b_7%,transparent)] px-3 py-2 text-[12px] leading-5 text-[var(--text-secondary)]">
                                                                <Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#dd2a7b]" />
                                                                استوری‌ها بعد از ۲۴ ساعت حذف می‌شوند؛ سناریو در پایان عمر استوری خودکار غیرفعال می‌شود.
                                                        </p>
                                                )}
                                                <div
                                                        className={cn(
                                                                'grid gap-2.5 pb-1',
                                                                isStory
                                                                        ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
                                                                        : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4',
                                                        )}
                                                >
                                                        {visible.map((item) => {
                                                                const isSelected = selected.has(item.id)
                                                                const remaining = item.expiresAt
                                                                        ? faRemaining(new Date(item.expiresAt).getTime(), now)
                                                                        : null
                                                                return (
                                                                        <button
                                                                                key={item.id}
                                                                                type="button"
                                                                                onClick={() => toggle(item)}
                                                                                aria-pressed={isSelected}
                                                                                className="group text-start"
                                                                                data-dialog-initial-focus={undefined}
                                                                        >
                                                                                {isStory ? (
                                                                                        <StoryRing live={Boolean(remaining)}>
                                                                                                <div
                                                                                                        className={cn(
                                                                                                                'relative aspect-[9/16] overflow-hidden rounded-[1.1rem] bg-[var(--bg-muted)]',
                                                                                                                !remaining && 'opacity-55 saturate-50',
                                                                                                        )}
                                                                                                >
                                                                                                        {item.mediaUrl ? (
                                                                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                                                                <img
                                                                                                                        src={item.mediaUrl}
                                                                                                                        alt={`استوری ${item.id}`}
                                                                                                                        loading="lazy"
                                                                                                                        decoding="async"
                                                                                                                        referrerPolicy="no-referrer"
                                                                                                                        className="h-full w-full object-cover"
                                                                                                                />
                                                                                                        ) : (
                                                                                                                <div className="grid h-full w-full place-items-center text-[var(--text-hint)]">
                                                                                                                        <Clock className="h-7 w-7" aria-hidden="true" />
                                                                                                                </div>
                                                                                                        )}
                                                                                                        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 bg-gradient-to-t from-black/70 via-black/25 to-transparent p-2">
                                                                                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white/95">
                                                                                                                        <Clock aria-hidden="true" className="h-3 w-3" />
                                                                                                                        {remaining ?? 'منقضی'}
                                                                                                                </span>
                                                                                                                <MediaBadge item={item} />
                                                                                                        </div>
                                                                                                        {isSelected && (
                                                                                                                <span
                                                                                                                        className="absolute inset-0 z-10 grid place-items-center bg-black/35"
                                                                                                                        aria-hidden="true"
                                                                                                                >
                                                                                                                        <span
                                                                                                                                className="grid h-9 w-9 place-items-center rounded-full text-white shadow-lg"
                                                                                                                                style={{ background: IG_GRADIENT }}
                                                                                                                        >
                                                                                                                                <Check className="h-5 w-5" />
                                                                                                                        </span>
                                                                                                                </span>
                                                                                                        )}
                                                                                                </div>
                                                                                        </StoryRing>
                                                                                ) : (
                                                                                        <div
                                                                                                className={cn(
                                                                                                        'relative aspect-square overflow-hidden rounded-xl bg-[var(--bg-muted)] transition-shadow',
                                                                                                        isSelected
                                                                                                                ? 'shadow-[0_0_0_2.5px_var(--bg-base),0_0_0_5px_#dd2a7b]'
                                                                                                                : 'ring-1 ring-[var(--border-subtle)] group-hover:ring-[var(--border-hover)]',
                                                                                                )}
                                                                                        >
                                                                                                {item.mediaUrl ? (
                                                                                                        // eslint-disable-next-line @next/next/no-img-element
                                                                                                        <img
                                                                                                                src={item.mediaUrl}
                                                                                                                alt={(item.caption ?? 'پست اینستاگرام').slice(0, 80)}
                                                                                                                loading="lazy"
                                                                                                                decoding="async"
                                                                                                                referrerPolicy="no-referrer"
                                                                                                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                                                                                                        />
                                                                                                ) : (
                                                                                                        <div className="grid h-full w-full place-items-center text-[var(--text-hint)]">
                                                                                                                <ImageIcon className="h-7 w-7" aria-hidden="true" />
                                                                                                        </div>
                                                                                                )}
                                                                                                <div className="absolute start-1.5 top-1.5">
                                                                                                        <MediaBadge item={item} />
                                                                                                </div>
                                                                                                {isSelected && (
                                                                                                        <span
                                                                                                                className="absolute end-1.5 top-1.5 z-10 grid h-7 w-7 place-items-center rounded-full text-white shadow-lg"
                                                                                                                style={{ background: IG_GRADIENT }}
                                                                                                                aria-hidden="true"
                                                                                                        >
                                                                                                                <Check className="h-4 w-4" />
                                                                                                        </span>
                                                                                                )}
                                                                                        </div>
                                                                                )}
                                                                                {/* Meta under the tile */}
                                                                                <div className="mt-1.5 min-w-0 px-0.5">
                                                                                        <p className="truncate text-[12px] leading-5 text-[var(--text-primary)]">
                                                                                                {isStory
                                                                                                        ? remaining
                                                                                                                ? `مانده: ${remaining}`
                                                                                                                : 'منقضی شده'
                                                                                                        : (item.caption ?? '').split('\n')[0] || `پست ${item.id.slice(0, 10)}…`}
                                                                                        </p>
                                                                                        <p className="text-[11px] leading-4 text-[var(--text-muted)]">
                                                                                                {faAgo(item.timestamp, now)}
                                                                                        </p>
                                                                                </div>
                                                                        </button>
                                                                )
                                                        })}
                                                </div>

                                                {!isStory && hasMore && (
                                                        <button
                                                                type="button"
                                                                onClick={() => void fetchItems(pagesLoaded + 1)}
                                                                disabled={loadingMore}
                                                                className="spatial-press mx-auto flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-4 text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-60"
                                                        >
                                                                {loadingMore ? (
                                                                        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                        <ChevronDown aria-hidden="true" className="h-4 w-4" />
                                                                )}
                                                                نمایش پست‌های بیشتر
                                                        </button>
                                                )}
                                        </>
                                )}
                        </div>

                        {/* Footer — selection summary + confirm */}
                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
                                <p className="text-[12px] leading-5 text-[var(--text-secondary)]">
                                        {selectedCount === 0
                                                ? isStory
                                                        ? 'یک استوری را انتخاب کنید'
                                                        : 'یکی یا چند پست را انتخاب کنید'
                                                : `${selectedCount.toLocaleString('fa-IR')} مورد انتخاب شد`}
                                </p>
                                <div className="flex items-center gap-2">
                                        <button
                                                type="button"
                                                onClick={onClose}
                                                className="spatial-press min-h-10 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-4 text-sm font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                                        >
                                                انصراف
                                        </button>
                                        <button
                                                type="button"
                                                disabled={confirmDisabled}
                                                onClick={() => onConfirm([...selected.values()])}
                                                className="spatial-press inline-flex min-h-10 items-center gap-2 rounded-xl px-5 text-sm font-bold text-white shadow-[0_8px_18px_-8px_rgba(221,42,123,0.7)] transition-opacity disabled:opacity-50"
                                                style={{ background: IG_GRADIENT }}
                                        >
                                                <Check className="h-4 w-4" aria-hidden="true" />
                                                تأیید انتخاب
                                        </button>
                                </div>
                        </div>
                </DialogShell>
        )
}
