'use client'

/**
 * Instagram media picker popup — the visual replacement for pasting post
 * permalinks by hand. Because the platform owns the page connection, we can
 * list the page's own media straight from the Graph API:
 *
 *   - kind="posts"   → published photos / videos / reels / carousels ONLY
 *                      (permanent), each tile carrying its live stats
 *                      (likes / comments).
 *   - kind="stories" → the page's LIVE stories ONLY (24h), each tile showing
 *                      a countdown so operators see exactly how long the
 *                      scenario will keep answering before it auto-deactivates.
 *   - kind="all"     → both, in ONE popup (story strip + posts grid).
 *
 * The caller decides which kind matches the scenario type (STORY scenarios
 * must never offer posts, COMMENT scenarios must never offer stories), so
 * the two never mix inside one scenario.
 *
 * Design mirrors the dashboard system: DialogShell + spatial-surface +
 * Instagram gradient accents, matching automation-form's visual language.
 * The confirm button is solid black (operator request) and the whole sheet
 * is mobile-first: it docks as a bottom sheet with a sticky action bar.
 * Thumbnails load through the same-origin CDN relay (igProxySrc) so Iranian
 * operators see images without a VPN.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
        Loader2,
        AlertCircle,
        Check,
        Heart,
        Image as ImageIcon,
        Film,
        Layers,
        MessageCircle,
        Clapperboard,
        RefreshCw,
        Clock,
        Camera,
        ChevronDown,
        Search,
        type LucideIcon,
} from 'lucide-react'
import { DialogShell } from '@/components/ui/dialog-shell'
import { igProxySrc } from '@/lib/instagram/media-proxy'
import { cn } from '@/lib/utils'

const IG_GRADIENT = 'linear-gradient(45deg, #f58529 0%, #dd2a7b 50%, #8134af 100%)'
/** Faded variant for decorative, non-interactive surfaces (skeleton rings). */
const IG_GRADIENT_SOFT = 'linear-gradient(45deg, rgba(245,133,41,0.18) 0%, rgba(221,42,123,0.18) 50%, rgba(129,52,175,0.18) 100%)'

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
        /** POST only — likes at fetch time (آمار هر پست). */
        likeCount?: number
        /** POST only — comments at fetch time (آمار هر پست). */
        commentsCount?: number
}

/** Which media the picker offers: posts only / stories only / both. */
export type MediaPickerKind = 'all' | 'posts' | 'stories'

/** Compact Persian number: ۱.۲ هزار / ۱۲ هزار / ۱.۲ میلیون. */
function faCompact(n: number | undefined): string | null {
        if (n === undefined || Number.isNaN(n)) return null
        const fa = (v: string | number) => (typeof v === 'number' ? v.toLocaleString('fa-IR') : v)
        if (n >= 1_000_000) return `${fa((n / 1_000_000).toFixed(1).replace(/\.0$/, ''))} میلیون`
        if (n >= 1_000) return `${fa((n / 1_000).toFixed(1).replace(/\.0$/, ''))} هزار`
        return fa(n)
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

/**
 * Type badge on each tile. Labels follow the operator's wording:
 * carousel → «اسلایدی», reels → «ریلز», plain video → «ویدیو».
 */
function MediaBadge({ item }: { item: InstagramMediaItem }) {
        let Icon: LucideIcon = ImageIcon
        let label = 'عکس'
        if (item.kind === 'STORY') {
                Icon = Clock
                label = 'استوری'
        } else if (item.mediaType === 'CAROUSEL_ALBUM') {
                Icon = Layers
                label = 'اسلایدی'
        } else if (item.mediaType === 'VIDEO') {
                const isReel = item.productType === 'REELS'
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

/** Post stats chip — likes + comments under/over the tile (آمار هر پست). */
function PostStats({ item }: { item: InstagramMediaItem }) {
        const likes = faCompact(item.likeCount)
        const comments = faCompact(item.commentsCount)
        if (!likes && !comments) return null
        return (
                <div className="flex items-center gap-2 text-[10px] font-bold text-white/95">
                        {likes && (
                                <span className="inline-flex items-center gap-0.5">
                                        <Heart aria-hidden="true" className="h-3 w-3 fill-current" />
                                        {likes}
                                </span>
                        )}
                        {comments && (
                                <span className="inline-flex items-center gap-0.5">
                                        <MessageCircle aria-hidden="true" className="h-3 w-3" />
                                        {comments}
                                </span>
                        )}
                </div>
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

/** A selectable square post tile (grid). */
function PostTile({
        item,
        isSelected,
        onToggle,
        now,
}: {
        item: InstagramMediaItem
        isSelected: boolean
        onToggle: () => void
        now: number
}) {
        return (
                <button
                        type="button"
                        onClick={onToggle}
                        aria-pressed={isSelected}
                        className="group text-start"
                >
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
                                                src={igProxySrc(item.mediaUrl)}
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
                        {/* Meta under the tile */}
                        <div className="mt-1.5 min-w-0 px-0.5">
                                <p className="truncate text-[12px] leading-5 text-[var(--text-primary)]">
                                        {(item.caption ?? '').split('\n')[0] || `پست ${item.id.slice(0, 10)}…`}
                                </p>
                                <div className="flex items-center justify-between gap-1">
                                        <p className="text-[11px] leading-4 text-[var(--text-muted)]">
                                                {faAgo(item.timestamp, now)}
                                        </p>
                                        <PostStats item={item} />
                                </div>
                        </div>
                </button>
        )
}

/** Compact remaining-time for the line UNDER a story tile: «۳ ساعت» / «۴۵ دقیقه».
 * Rounded to the biggest unit so the label never overflows a narrow tile. */
function faRemainingCompact(targetMs: number, nowMs: number): string | null {
        const diff = targetMs - nowMs
        if (diff <= 0) return null
        const hours = Math.floor(diff / 3_600_000)
        const minutes = Math.floor((diff % 3_600_000) / 60_000)
        const fa = (n: number) => n.toLocaleString('fa-IR')
        if (hours >= 1) return `${fa(hours)} ساعت مانده`
        if (minutes >= 1) return `${fa(minutes)} دقیقه مانده`
        return 'چند لحظه مانده'
}

/** A selectable 9:16 story tile (strip). */
function StoryTile({
        item,
        isSelected,
        onToggle,
        now,
}: {
        item: InstagramMediaItem
        isSelected: boolean
        onToggle: () => void
        now: number
}) {
        const remaining = item.expiresAt ? faRemainingCompact(new Date(item.expiresAt).getTime(), now) : null
        return (
                <button
                        type="button"
                        onClick={onToggle}
                        aria-pressed={isSelected}
                        className="group w-[84px] shrink-0 text-start sm:w-[100px]"
                >
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
                                                        src={igProxySrc(item.mediaUrl)}
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
                        {/* Countdown lives UNDER the tile (operator request: no overlay
                            on the image) — a clock glyph + compact time so a phone-width
                            tile never overflows its label. */}
                        <p
                                className={cn(
                                        'mt-1.5 flex items-center justify-center gap-1 truncate px-0.5 text-[11px] leading-5',
                                        remaining ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]',
                                )}
                        >
                                <Clock
                                        aria-hidden="true"
                                        className={cn('h-3 w-3 shrink-0', remaining ? 'text-[#dd2a7b]' : 'text-[var(--text-hint)]')}
                                />
                                {remaining ? remaining : 'منقضی'}
                        </p>
                </button>
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
        /** `posts` for COMMENT scenarios, `stories` for STORY scenarios, `all` only if a caller ever needs both. */
        kind: MediaPickerKind
        /** Ids already chosen (pre-checked when the popup opens). */
        selectedIds: string[]
        multiple?: boolean
        /** Called with the full selection when the operator confirms. */
        onConfirm: (items: InstagramMediaItem[]) => void
        accountUsername?: string
}) {
        const [posts, setPosts] = useState<InstagramMediaItem[]>([])
        const [stories, setStories] = useState<InstagramMediaItem[]>([])
        const [loading, setLoading] = useState(false)
        const [loadingMore, setLoadingMore] = useState(false)
        const [hasMore, setHasMore] = useState(false)
        const [pagesLoaded, setPagesLoaded] = useState(1)
        const [error, setError] = useState<string | null>(null)
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
                                // ONE request when a single kind, TWO in parallel when `all`.
                                const kinds: Array<'posts' | 'stories'> =
                                        kind === 'all' ? ['posts', 'stories'] : [kind]
                                const results = await Promise.all(
                                        kinds.map(async (k) => {
                                                const response = await fetch(
                                                        `/api/agents/${agentId}/instagram/media/list?kind=${k}&pages=${pages}`,
                                                        { cache: 'no-store' },
                                                )
                                                const data = (await response.json().catch(() => ({}))) as {
                                                        items?: InstagramMediaItem[]
                                                        hasMore?: boolean
                                                        error?: string
                                                }
                                                return { k, response, data }
                                        }),
                                )
                                if (seq !== requestSeq.current) return

                                const failed = results.find((r) => !r.response.ok || !Array.isArray(r.data.items))
                                if (failed) {
                                        const text =
                                                failed.data.error === 'PLAN_BLOCKED'
                                                        ? 'برای استفاده از این بخش، دورهٔ آزمایشی یا اشتراک فعال لازم است.'
                                                        : failed.data.error === 'IG_RECONNECT_REQUIRED'
                                                                ? 'اتصال اینستاگرام قطع شده است؛ یک‌بار دیگر آن را متصل کنید.'
                                                                : 'دریافت رسانه‌های پیج از اینستاگرام انجام نشد.'
                                        setError(text)
                                        return
                                }

                                let nextPosts: InstagramMediaItem[] | null = null
                                let nextStories: InstagramMediaItem[] | null = null
                                let nextHasMore = false
                                for (const { k, data } of results) {
                                        const items = data.items ?? []
                                        if (k === 'posts') {
                                                nextPosts = items
                                                nextHasMore = Boolean(data.hasMore)
                                        } else {
                                                nextStories = items
                                        }
                                }
                                if (nextPosts !== null) setPosts(nextPosts)
                                if (nextStories !== null) setStories(nextStories)
                                setHasMore(nextHasMore)
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
                setQuery('')
                // Selection resets on every open so the preselect effect re-syncs
                // with the LATEST picked ids from the form (chips may have been
                // removed while the popup was closed).
                setSelected(new Map())
                void fetchItems(1)
        }, [open, fetchItems])

        // Pre-check the already-selected items once data lands.
        useEffect(() => {
                if (!open) return
                setSelected((prev) => {
                        if (prev.size > 0) return prev
                        const next = new Map<string, InstagramMediaItem>()
                        for (const item of [...posts, ...stories]) {
                                if (selectedIds.includes(item.id)) next.set(item.id, item)
                        }
                        return next.size > 0 ? next : prev
                })
                // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [open, posts, stories])

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

        // One flat grid — no photo/video tabs (operator request): everything
        // shows together and the caption search narrows it down.
        const visiblePosts = useMemo(() => {
                const q = query.trim()
                if (!q) return posts
                return posts.filter((i) => (i.caption ?? '').includes(q) || i.id.includes(q))
        }, [posts, query])

        const showPosts = kind === 'all' || kind === 'posts'
        const showStories = kind === 'all' || kind === 'stories'
        const selectedCount = selected.size
        const anyLiveStory = stories.some((i) => (i.expiresAt ? new Date(i.expiresAt).getTime() > now : false))
        const nothingAtAll =
                !loading && !error && visiblePosts.length === 0 && (!showStories || stories.length === 0)

        // ── THE fix for "the popup never closes / no media loads" ─────────────
        // The component used to render <DialogShell> unconditionally, so the
        // dialog was permanently mounted: it appeared on page load, the X and
        // backdrop clicks flipped `open` to false but nothing unmounted, and the
        // fetch effect (gated on `open`) never ran — so no media ever loaded.
        // Returning null while closed (AFTER all hooks) unmounts the dialog
        // properly: X, backdrop and Escape all work, and each open re-fetches.
        if (!open) return null

        return (
                <DialogShell
                        wide
                        title={showPosts && showStories ? 'انتخاب پست یا استوری از پیج' : showStories ? 'انتخاب استوری از پیج' : 'انتخاب پست از پیج'}
                        subtitle={
                                accountUsername
                                        ? `رسانه‌های ${showPosts && showStories ? '' : showStories ? 'فعال' : 'منتشرشده'} @${accountUsername}${showStories ? ' — استوری‌ها فقط ۲۴ ساعت مهلت دارند' : ''}`
                                        : undefined
                        }
                        onClose={onClose}
                >
                        <div className="flex h-[min(58dvh,540px)] min-h-0 flex-col">
                                {/* Caption search — the single filter, per operator request */}
                                {showPosts && (
                                        <div className="relative">
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
                                )}

                                {/* Body states — ONE fixed-height scroll area so the panel
                                    keeps its exact size between the skeleton and the loaded
                                    grid (the desktop dialog used to jump when data landed). */}
                                <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
                                {loading ? (
                                        /* Layout-matched skeleton (operator request): mirrors the
                                           REAL layout — story strip + post grid with caption lines —
                                           so the jump when data lands is minimal. Uses the shared
                                           .skeleton-shimmer primitive, not a flat pulse box. */
                                        <div className="space-y-4" aria-hidden="true">
                                                {showStories && (
                                                        <section className="space-y-2">
                                                                {/* Banner + header + strip — every block mirrors the
                                                                    LOADED layout's exact height so nothing shifts. */}
                                                                <div className="skeleton-shimmer h-9 rounded-xl" />
                                                                <div className="skeleton-shimmer h-4 w-28 rounded-full" />
                                                                <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                                                        {Array.from({ length: 8 }).map((_, i) => (
                                                                                <div key={i} className="w-[84px] shrink-0 sm:w-[100px]">
                                                                                        <div
                                                                                                className="rounded-[1.25rem] p-[2.5px]"
                                                                                                style={{ background: i < 3 ? IG_GRADIENT_SOFT : 'var(--border-default)' }}
                                                                                        >
                                                                                                <div className="skeleton-shimmer aspect-[9/16] w-full rounded-[1.1rem]" />
                                                                                        </div>
                                                                                        <div className="skeleton-shimmer mx-auto mt-1.5 h-5 w-16 rounded-full" />
                                                                                </div>
                                                                        ))}
                                                                </div>
                                                        </section>
                                                )}
                                                {showPosts && (
                                                        <section className="space-y-2">
                                                                <div className="skeleton-shimmer h-4 w-36 rounded-full" />
                                                                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                                                                        {Array.from({ length: 16 }).map((_, i) => (
                                                                                <div key={i}>
                                                                                        <div
                                                                                                className={cn(
                                                                                                        'skeleton-shimmer aspect-square rounded-xl',
                                                                                                        i === 0 && 'shadow-[0_0_0_2.5px_var(--bg-base),0_0_0_5px_#dd2a7b]',
                                                                                                )}
                                                                                        />
                                                                                        <div className="mt-1.5 space-y-0.5 px-0.5">
                                                                                                <div className="skeleton-shimmer h-5 w-4/5 rounded-full" />
                                                                                                <div className="skeleton-shimmer h-4 w-2/5 rounded-full" />
                                                                                        </div>
                                                                                </div>
                                                                        ))}
                                                                </div>
                                                        </section>
                                                )}
                                        </div>
                                ) : error ? (
                                        <div className="flex min-h-full flex-col items-center justify-center gap-3 py-10 text-center">
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
                                ) : nothingAtAll ? (
                                        <div className="flex min-h-full flex-col items-center justify-center gap-3 py-10 text-center">
                                                <span
                                                        className="grid h-12 w-12 place-items-center rounded-2xl text-white"
                                                        style={{ background: IG_GRADIENT }}
                                                >
                                                        <Camera className="h-6 w-6" aria-hidden="true" />
                                                </span>
                                                <p className="max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
                                                        {showStories
                                                                ? 'در ۲۴ ساعت گذشته استوری‌ای منتشر نشده است. ابتدا در اینستاگرام استوری بگذارید، سپس این پنجره را دوباره باز کنید.'
                                                                : 'هیچ پست یا ریلزی یافت نشد.'}
                                                </p>
                                        </div>
                                ) : (
                                        <div className="space-y-4">
                                                {/* ── Stories strip ── */}
                                                {showStories && stories.length > 0 && (
                                                        <section className="space-y-2">
                                                                {anyLiveStory && (
                                                                        <p className="flex items-center gap-1.5 rounded-xl bg-[color:color-mix(in_srgb,#dd2a7b_7%,transparent)] px-3 py-2 text-[12px] leading-5 text-[var(--text-secondary)]">
                                                                                <Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#dd2a7b]" />
                                                                                استوری‌ها بعد از ۲۴ ساعت حذف می‌شوند؛ سناریو در پایان عمر استوری خودکار غیرفعال می‌شود.
                                                                        </p>
                                                                )}
                                                                <div className="flex items-center justify-between gap-2">
                                                                        <h3 className="text-xs font-bold text-[var(--text-secondary)]">
                                                                                استوری‌های فعال
                                                                                {stories.length > 0 && (
                                                                                        <span className="ms-1 text-[var(--text-muted)]">
                                                                                                ({stories.length.toLocaleString('fa-IR')})
                                                                                        </span>
                                                                                )}
                                                                        </h3>
                                                                </div>
                                                                <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                                                        {stories.map((item) => (
                                                                                <StoryTile
                                                                                        key={item.id}
                                                                                        item={item}
                                                                                        isSelected={selected.has(item.id)}
                                                                                        onToggle={() => toggle(item)}
                                                                                        now={now}
                                                                                />
                                                                        ))}
                                                                </div>
                                                        </section>
                                                )}

                                                {/* ── Posts grid ── */}
                                                {showPosts && visiblePosts.length > 0 && (
                                                        <section className="space-y-2">
                                                                <div className="flex items-center justify-between gap-2">
                                                                        <h3 className="text-xs font-bold text-[var(--text-secondary)]">
                                                                                پست‌ها و ریلزها
                                                                                <span className="ms-1 text-[var(--text-muted)]">
                                                                                        ({visiblePosts.length.toLocaleString('fa-IR')})
                                                                                </span>
                                                                        </h3>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                                                                        {visiblePosts.map((item) => (
                                                                                <PostTile
                                                                                        key={item.id}
                                                                                        item={item}
                                                                                        isSelected={selected.has(item.id)}
                                                                                        onToggle={() => toggle(item)}
                                                                                        now={now}
                                                                                />
                                                                        ))}
                                                                </div>
                                                                {hasMore && (
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
                                                        </section>
                                                )}

                                                {/* Stories-only picker with zero stories (posts hidden) */}
                                                {showStories && !showPosts && stories.length === 0 && (
                                                        <div className="flex min-h-full flex-col items-center justify-center gap-3 py-10 text-center">
                                                                <span
                                                                        className="grid h-12 w-12 place-items-center rounded-2xl text-white"
                                                                        style={{ background: IG_GRADIENT }}
                                                                >
                                                                        <Camera className="h-6 w-6" aria-hidden="true" />
                                                                </span>
                                                                <p className="max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
                                                                        در ۲۴ ساعت گذشته استوری‌ای منتشر نشده است. ابتدا در اینستاگرام استوری بگذارید، سپس این پنجره را دوباره باز کنید.
                                                                </p>
                                                        </div>
                                                )}
                                        </div>
                                )}
                                </div>
                        </div>

                        {/* Footer — selection summary + confirm (sticky at the sheet bottom) */}
                        <div className="sticky bottom-0 -mx-4 mt-4 flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] bg-white/95 px-4 pt-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] backdrop-blur sm:-mx-5 sm:px-5 [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]">
                                <p className="text-[12px] leading-5 text-[var(--text-secondary)]">
                                        {selectedCount === 0
                                                ? 'انتخاب اختیاری است — خالی بگذارید تا روی همه پست‌ها و استوری‌ها اجرا شود'
                                                : `${selectedCount.toLocaleString('fa-IR')} مورد انتخاب شد`}
                                </p>
                                <div className="flex shrink-0 items-center gap-2">
                                        <button
                                                type="button"
                                                onClick={onClose}
                                                className="spatial-press min-h-10 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-4 text-sm font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                                        >
                                                انصراف
                                        </button>
                                        <button
                                                type="button"
                                                disabled={false}
                                                onClick={() => onConfirm([...selected.values()])}
                                                className="spatial-press inline-flex min-h-10 items-center gap-2 rounded-xl bg-black px-5 text-sm font-bold text-white shadow-[0_8px_18px_-8px_rgba(0,0,0,0.8)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
                                        >
                                                <Check className="h-4 w-4" aria-hidden="true" />
                                                تأیید انتخاب
                                        </button>
                                </div>
                        </div>
                </DialogShell>
        )
}
