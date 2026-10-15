'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState, type ComponentType, type ReactNode } from 'react'
import {
    AlertCircle,
    Check,
    ChevronLeft,
    ClipboardPaste,
    Copy,
    ExternalLink,
    MoreHorizontal,
    Package,
    Power,
    ShieldCheck,
    ShoppingBag,
    Store,
    Trash2,
    X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'
import { WOO_BTN_SECONDARY, WOO_TINT, storeHost } from '@/components/integrations/woo-styles'

/**
 * Building blocks of the WooCommerce surfaces (the «ووکامرس» tab, the
 * onboarding wizard). One look for the store everywhere:
 *
 *  - cards carry a three-layer shadow (hairline ring, contact shadow, soft
 *    depth) so they lift off the warm canvas instead of fading into it;
 *  - one ink button per view; everything else is secondary or ghost;
 *  - the store wears a faint WooCommerce violet on its avatar only.
 */

// ─── Surfaces & buttons (see woo-styles.ts) ─────────────────────────────

export {
    WOO_BTN_GHOST,
    WOO_BTN_PRIMARY,
    WOO_BTN_SECONDARY,
    WOO_CARD,
    WOO_LINK_CARD,
    WOO_NOTE,
    WOO_TEXT,
    WOO_TINT,
    storeHost,
} from '@/components/integrations/woo-styles'

export function StoreAvatar({ storeUrl, className }: { storeUrl?: string; className?: string }) {
    const letter = storeUrl ? storeHost(storeUrl).replace(/^www\./i, '').charAt(0).toUpperCase() : ''
    return (
        <span aria-hidden className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-[14px] text-[17px] font-extrabold', WOO_TINT, className)}>
            {letter || <Store className="h-5 w-5" />}
        </span>
    )
}

// ─── The three steps, as a preview ──────────────────────────────────────

export function WooStepsPreview({ fa, current = 0 }: { fa: boolean; current?: number }) {
    const steps = fa
        ? ['آدرس سایت را وارد کنید', 'افزونه را در وردپرس نصب کنید', 'در افزونه «اتصال» را بزنید']
        : ['Enter your site address', 'Install the plugin in WordPress', 'Press “Connect” in the plugin']
    return (
        <ol className="space-y-2.5">
            {steps.map((label, index) => (
                <li key={label} className={cn('flex items-center gap-2.5 text-[13px]', index === current ? 'font-bold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]')}>
                    <span className={cn(
                        'grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[12px] font-extrabold tabular-nums',
                        index === current ? 'bg-[var(--text-primary)] text-white' : 'bg-white text-[var(--text-muted)] shadow-[inset_0_0_0_1px_var(--border-default)]',
                    )}>
                        {(index + 1).toLocaleString(fa ? 'fa-IR' : 'en-US')}
                    </span>
                    {label}
                </li>
            ))}
        </ol>
    )
}

// ─── Site address field ─────────────────────────────────────────────────

/** Does the typed address look like a real site? (Shape only — no request.) */
export function isPlausibleStoreUrl(raw: string): boolean {
    const value = raw.trim()
    if (!value || /\s/.test(value)) return false
    try {
        const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value.replace(/^\/+/, '')}`)
        // `URL` turns an IDN host into punycode, so a Latin TLD check covers every site.
        return /^[^.]+(\.[^.]+)*\.[a-z0-9-]{2,}$/i.test(url.hostname)
    } catch {
        return false
    }
}

/**
 * The store address with the scheme as a fixed prefix (people rarely know
 * whether to type it), a paste button and a live shape check. `value` keeps
 * whatever the person entered; a pasted `http://` is respected.
 */
export function StoreUrlField({
    value,
    onChange,
    error,
    fa,
    autoFocus,
    onFocus,
}: {
    value: string
    onChange: (value: string) => void
    error?: string | null
    fa: boolean
    autoFocus?: boolean
    onFocus?: () => void
}) {
    const id = useId()
    const [canPaste, setCanPaste] = useState(false)
    const scheme = value.match(/^https?:\/\//i)?.[0] ?? null
    const shown = scheme ? value.slice(scheme.length) : value
    const valid = !error && isPlausibleStoreUrl(value)

    useEffect(() => {
        setCanPaste(typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function')
    }, [])

    function set(next: string) {
        onChange(/^https?:\/\//i.test(next) ? next : (scheme ?? '') + next)
    }

    async function paste() {
        try {
            const text = (await navigator.clipboard.readText()).trim()
            if (text) set(text)
        } catch {
            // Permission refused: the field still takes a normal paste.
        }
    }

    return (
        <div>
            <label htmlFor={id} className="sr-only">{fa ? 'آدرس سایت' : 'Site address'}</label>
            <div
                dir="ltr"
                className={cn(
                    'flex min-h-12 items-center gap-1.5 rounded-2xl bg-white pe-1.5 ps-3.5 transition-shadow',
                    error
                        ? 'shadow-[0_0_0_1px_var(--danger),0_0_0_4px_var(--danger-soft)]'
                        : valid
                            ? 'shadow-[0_0_0_1px_color-mix(in_srgb,var(--ok)_55%,transparent),0_0_0_4px_color-mix(in_srgb,var(--ok)_12%,transparent)]'
                            : 'shadow-[0_0_0_1px_var(--border-default),0_1px_2px_rgba(17,17,17,0.04)] focus-within:shadow-[0_0_0_1px_var(--text-primary),0_0_0_4px_rgba(17,17,17,0.08)]',
                )}
            >
                <span aria-hidden className="select-none font-mono text-[13px] text-[var(--text-hint)]">{scheme?.toLowerCase() ?? 'https://'}</span>
                <input
                    id={id}
                    type="text"
                    inputMode="url"
                    enterKeyHint="go"
                    autoComplete="url"
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-invalid={error ? true : undefined}
                    value={shown}
                    onChange={(e) => set(e.target.value)}
                    onFocus={onFocus}
                    placeholder="example.com"
                    className="min-w-0 flex-1 bg-transparent py-2 font-mono text-[14px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-hint)] focus-visible:outline-none"
                    autoFocus={autoFocus}
                />
                {canPaste && !shown && (
                    <button
                        type="button"
                        dir={fa ? 'rtl' : 'ltr'}
                        onClick={paste}
                        className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-[10px] bg-[var(--bg-base)] px-2.5 text-[12px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                        <ClipboardPaste className="h-3.5 w-3.5" />
                        {fa ? 'چسباندن' : 'Paste'}
                    </button>
                )}
            </div>
            {error ? (
                <p role="alert" className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--danger-ink)]">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {error}
                </p>
            ) : valid ? (
                <p className="mt-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--ok)]">
                    <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />
                    {fa ? 'آدرس درست است' : 'The address looks right'}
                </p>
            ) : null}
        </div>
    )
}

// ─── Copy a link (phones cannot install a WordPress plugin) ─────────────

export function CopyLinkButton({
    path,
    label,
    copiedLabel,
    className,
    onCopied,
}: {
    path: string
    label: string
    copiedLabel: string
    className?: string
    onCopied?: () => void
}) {
    const [copied, setCopied] = useState(false)
    useEffect(() => {
        if (!copied) return
        const timer = window.setTimeout(() => setCopied(false), 1800)
        return () => window.clearTimeout(timer)
    }, [copied])

    async function copy() {
        const value = new URL(path, window.location.origin).toString()
        let ok = false
        try {
            await navigator.clipboard.writeText(value)
            ok = true
        } catch {
            const area = document.createElement('textarea')
            area.value = value
            area.style.position = 'fixed'
            area.style.opacity = '0'
            document.body.appendChild(area)
            area.select()
            ok = document.execCommand('copy')
            area.remove()
        }
        if (ok) {
            setCopied(true)
            onCopied?.()
        }
    }

    return (
        <button type="button" onClick={copy} className={className}>
            {copied ? <Check className="h-4 w-4" strokeWidth={3} /> : <Copy className="h-4 w-4" />}
            <span aria-live="polite">{copied ? copiedLabel : label}</span>
        </button>
    )
}

// ─── Numbers of a connected store ───────────────────────────────────────

export function StoreStats({
    fa,
    productCount,
    orderCount,
    lastSyncAt,
    failedCount,
}: {
    fa: boolean
    productCount: number | null
    orderCount: number
    lastSyncAt: string | null
    failedCount: number
}) {
    const num = (n: number) => n.toLocaleString(fa ? 'fa-IR' : 'en-US')
    const tiles: { value: string; label: string; tone?: 'ok' | 'danger' }[] = [
        ...(productCount !== null ? [{ value: num(productCount), label: fa ? 'محصول همگام' : 'products synced' }] : []),
        { value: num(orderCount), label: fa ? 'سفارش' : 'orders' },
        {
            value: lastSyncAt ? relativeTime(lastSyncAt, fa, true) : '—',
            label: fa ? 'از آخرین همگام‌سازی' : 'since the last sync',
        },
        // The Persian zero (۰) reads as a dot at this size, so "none" is a word.
        { value: failedCount > 0 ? num(failedCount) : (fa ? 'هیچ' : 'None'), label: fa ? 'خطا در ۳ روز اخیر' : 'errors in 3 days', tone: failedCount > 0 ? 'danger' : 'ok' },
    ]
    return (
        <dl className={cn('grid grid-cols-2 gap-2', tiles.length === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3')}>
            {tiles.map((tile) => (
                <div key={tile.label} className="min-w-0 rounded-2xl bg-[var(--bg-base)] px-3.5 py-3">
                    <dd
                        suppressHydrationWarning
                        className={cn(
                            'truncate text-[19px] font-extrabold leading-snug tabular-nums text-[var(--text-primary)]',
                            tile.tone === 'ok' && 'text-[var(--ok)]',
                            tile.tone === 'danger' && 'text-[var(--danger-ink)]',
                        )}
                    >
                        {tile.value}
                    </dd>
                    <dt className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]">{tile.label}</dt>
                </div>
            ))}
        </dl>
    )
}

// ─── Where to manage the store's data ───────────────────────────────────

export function StoreLinks({
    fa,
    productCount,
    orderCount,
    storeAccessHref,
}: {
    fa: boolean
    productCount: number | null
    orderCount: number
    storeAccessHref: string | null
}) {
    const num = (n: number) => n.toLocaleString(fa ? 'fa-IR' : 'en-US')
    const links: { href: string; icon: ComponentType<{ className?: string }>; title: string; hint: string }[] = [
        {
            href: '/products',
            icon: Package,
            title: fa ? 'محصولات' : 'Products',
            hint: productCount !== null ? (fa ? `${num(productCount)} مورد` : `${num(productCount)} items`) : (fa ? 'فهرست و موجودی' : 'Catalog and stock'),
        },
        {
            href: '/products/orders',
            icon: ShoppingBag,
            title: fa ? 'سفارش‌ها' : 'Orders',
            hint: fa ? `${num(orderCount)} سفارش` : `${num(orderCount)} orders`,
        },
        ...(storeAccessHref
            ? [{ href: storeAccessHref, icon: ShieldCheck, title: fa ? 'دسترسی ایجنت' : 'Agent access', hint: fa ? 'ایجنت چه چیزی ببیند' : 'What the agent may see' }]
            : []),
    ]
    return (
        <nav
            aria-label={fa ? 'مدیریت اطلاعات فروشگاه' : 'Manage store data'}
            className={cn(
                // Phones: one grouped list (rows are easier to hit than wrapped pills).
                'overflow-hidden rounded-2xl bg-white shadow-[0_0_0_1px_var(--border-subtle)] max-sm:divide-y max-sm:divide-[var(--border-subtle)]',
                'sm:grid sm:gap-2 sm:overflow-visible sm:bg-transparent sm:shadow-none',
                links.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
            )}
        >
            {links.map(({ href, icon: Icon, title, hint }) => (
                <Link
                    key={href}
                    href={href}
                    className="group flex min-h-[3.25rem] min-w-0 items-center gap-3 px-3.5 py-3 transition-[transform,box-shadow,background-color] hover:bg-[var(--bg-hover)] sm:rounded-2xl sm:bg-white sm:shadow-[0_0_0_1px_var(--border-default)] sm:hover:-translate-y-px sm:hover:bg-white sm:hover:shadow-[0_0_0_1px_var(--border-hover),0_8px_18px_-10px_rgba(17,17,17,0.25)] motion-reduce:transform-none"
                >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--bg-base)] text-[var(--text-primary)]">
                        <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-bold leading-6 text-[var(--text-primary)]">{title}</span>
                        <span suppressHydrationWarning className="block truncate text-[12px] text-[var(--text-muted)]">{hint}</span>
                    </span>
                    <ChevronLeft aria-hidden className="h-4 w-4 shrink-0 text-[var(--text-hint)] transition-transform group-hover:-translate-x-0.5 ltr:rotate-180 ltr:group-hover:translate-x-0.5" />
                </Link>
            ))}
        </nav>
    )
}

// ─── Rare & risky actions: a menu (desktop) or a sheet (phones) ─────────

export function StoreActionsMenu({
    fa,
    storeUrl,
    wpAdminHref,
    active,
    busy,
    onToggle,
    onDelete,
}: {
    fa: boolean
    storeUrl: string
    wpAdminHref: string | null
    active: boolean
    busy: boolean
    onToggle: () => void
    onDelete: () => void
}) {
    const [menuOpen, setMenuOpen] = useState(false)
    const [sheetOpen, setSheetOpen] = useState(false)
    const wrapRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const menuId = useId()

    useEffect(() => {
        if (!menuOpen) return
        const first = wrapRef.current?.querySelector<HTMLElement>('[role="menuitem"]')
        first?.focus()
        function onPointer(event: MouseEvent) {
            if (!wrapRef.current?.contains(event.target as Node)) setMenuOpen(false)
        }
        function onKey(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                setMenuOpen(false)
                triggerRef.current?.focus()
                return
            }
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
            event.preventDefault()
            const items = Array.from(wrapRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
            const at = items.indexOf(document.activeElement as HTMLElement)
            const next = event.key === 'ArrowDown' ? (at + 1) % items.length : (at - 1 + items.length) % items.length
            items[next]?.focus()
        }
        document.addEventListener('mousedown', onPointer)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onPointer)
            document.removeEventListener('keydown', onKey)
        }
    }, [menuOpen])

    function open() {
        if (window.matchMedia('(min-width: 768px)').matches) setMenuOpen((value) => !value)
        else setSheetOpen(true)
    }

    function run(action: () => void) {
        setMenuOpen(false)
        setSheetOpen(false)
        action()
    }

    const toggleLabel = active ? (fa ? 'توقف موقت همگام‌سازی' : 'Pause syncing') : (fa ? 'از سرگیری همگام‌سازی' : 'Resume syncing')
    const wpLabel = fa ? 'باز کردن پیشخوان وردپرس' : 'Open the WordPress admin'
    const deleteLabel = fa ? 'حذف اتصال…' : 'Delete connection…'

    const menuItem = 'flex min-h-10 w-full items-center gap-2.5 rounded-[10px] px-3 text-start text-[13px] font-medium text-[var(--text-primary)] outline-none hover:bg-[var(--bg-base)] focus-visible:bg-[var(--bg-base)] focus-visible:outline-none disabled:opacity-50'
    const sheetRow = 'flex min-h-[3.25rem] w-full items-center gap-3 px-4 text-start text-[14px] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-50'
    const sheetIcon = 'grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[var(--bg-base)]'

    return (
        <div ref={wrapRef} className="relative">
            <button
                ref={triggerRef}
                type="button"
                onClick={open}
                aria-label={fa ? 'گزینه‌های بیشتر' : 'More options'}
                aria-haspopup="menu"
                aria-expanded={menuOpen || sheetOpen}
                aria-controls={menuOpen ? menuId : undefined}
                className={cn(WOO_BTN_SECONDARY, 'w-11 px-0', menuOpen && 'shadow-[0_0_0_1px_var(--border-strong),0_0_0_4px_rgba(17,17,17,0.06)]')}
            >
                <MoreHorizontal className="h-5 w-5" />
            </button>

            {menuOpen && (
                <div
                    id={menuId}
                    role="menu"
                    aria-label={storeHost(storeUrl)}
                    className="absolute end-0 top-full z-30 mt-2 w-60 rounded-2xl bg-white p-1.5 shadow-[0_0_0_1px_rgba(17,17,17,0.08),0_4px_8px_-2px_rgba(17,17,17,0.06),0_18px_36px_-10px_rgba(17,17,17,0.22)]"
                >
                    {wpAdminHref && (
                        <a role="menuitem" href={wpAdminHref} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)} className={menuItem}>
                            <ExternalLink className="h-4 w-4 text-[var(--text-secondary)]" />
                            {wpLabel}
                        </a>
                    )}
                    <button role="menuitem" type="button" disabled={busy} onClick={() => run(onToggle)} className={menuItem}>
                        <Power className="h-4 w-4 text-[var(--text-secondary)]" />
                        {toggleLabel}
                    </button>
                    <div role="separator" className="mx-2 my-1 h-px bg-[var(--border-subtle)]" />
                    <button role="menuitem" type="button" disabled={busy} onClick={() => run(onDelete)} className={cn(menuItem, 'text-[var(--danger-ink)] hover:bg-[var(--danger-soft)] focus-visible:bg-[var(--danger-soft)]')}>
                        <Trash2 className="h-4 w-4" />
                        {deleteLabel}
                    </button>
                </div>
            )}

            <MobileBottomSheet
                open={sheetOpen}
                title={storeHost(storeUrl)}
                closeLabel={fa ? 'بستن' : 'Close'}
                triggerRef={triggerRef}
                onClose={() => setSheetOpen(false)}
            >
                <div className="space-y-2 pb-1">
                    <div className="overflow-hidden rounded-2xl bg-white shadow-[0_0_0_1px_var(--border-subtle)] divide-y divide-[var(--border-subtle)]">
                        {wpAdminHref && (
                            <a href={wpAdminHref} target="_blank" rel="noopener noreferrer" onClick={() => setSheetOpen(false)} className={sheetRow}>
                                <span className={sheetIcon}><ExternalLink className="h-4 w-4" /></span>
                                {wpLabel}
                            </a>
                        )}
                        <button type="button" disabled={busy} onClick={() => run(onToggle)} className={sheetRow}>
                            <span className={sheetIcon}><Power className="h-4 w-4" /></span>
                            {toggleLabel}
                        </button>
                    </div>
                    <div className="overflow-hidden rounded-2xl bg-white shadow-[0_0_0_1px_var(--border-subtle)]">
                        <button type="button" disabled={busy} onClick={() => run(onDelete)} className={cn(sheetRow, 'text-[var(--danger-ink)]')}>
                            <span className={cn(sheetIcon, 'bg-[var(--danger-soft)]')}><Trash2 className="h-4 w-4" /></span>
                            {deleteLabel}
                        </button>
                    </div>
                </div>
            </MobileBottomSheet>
        </div>
    )
}

// ─── Recent sync activity, as a timeline ────────────────────────────────

export interface WooSyncLogEntry {
    id: string
    direction: string
    entity: string
    outcome: string
    count: number
    message: string | null
    createdAt: string
}

const ACTIVITY_PREVIEW = 4
const ACTIVITY_EXPANDED = 20

/**
 * The latest changes from the site grouped by day. Deliveries that changed
 * nothing are filtered out by the caller. A failure says what went wrong in
 * plain words and offers a retry; the raw message stays in the tooltip.
 */
export function SyncTimeline({
    logs,
    fa,
    onRetry,
    retrying = false,
}: {
    logs: WooSyncLogEntry[]
    fa: boolean
    onRetry?: () => void
    retrying?: boolean
}) {
    const [expanded, setExpanded] = useState(false)
    const shown = logs.slice(0, expanded ? ACTIVITY_EXPANDED : ACTIVITY_PREVIEW)
    const applied = logs.reduce((sum, log) => sum + (log.outcome === 'ok' ? log.count : 0), 0)
    const failed = logs.filter((log) => log.outcome !== 'ok').length
    const num = (n: number) => n.toLocaleString(fa ? 'fa-IR' : 'en-US')
    const hiddenCount = Math.min(logs.length, ACTIVITY_EXPANDED) - ACTIVITY_PREVIEW
    const firstFailureId = logs.find((log) => log.outcome !== 'ok')?.id

    const groups: { day: string; logs: WooSyncLogEntry[] }[] = []
    for (const log of shown) {
        const day = dayLabel(log.createdAt, fa)
        const last = groups[groups.length - 1]
        if (last && last.day === day) last.logs.push(log)
        else groups.push({ day, logs: [log] })
    }

    return (
        <section aria-label={fa ? 'تغییرات از سایت' : 'Changes from the site'}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[14px] font-bold text-[var(--text-primary)]">
                    {fa ? 'تغییرات از سایت' : 'Changes from the site'}
                    <span className="ms-2 text-[12px] font-medium text-[var(--text-muted)]">{fa ? '۳ روز اخیر' : 'last 3 days'}</span>
                </h3>
                <div className="flex items-center gap-1.5">
                    <span className="ui-chip ui-chip-neutral tabular-nums">{fa ? `${num(applied)} همگام` : `${num(applied)} synced`}</span>
                    {failed > 0 && (
                        <span className="ui-chip ui-chip-danger tabular-nums">
                            <span className="ui-chip-dot" />
                            {fa ? `${num(failed)} خطا` : `${num(failed)} errors`}
                        </span>
                    )}
                </div>
            </div>

            <div className="mt-2">
                {groups.map((group) => (
                    <div key={group.day}>
                        <p suppressHydrationWarning className="mb-1 mt-2 text-[12px] font-bold text-[var(--text-hint)]">{group.day}</p>
                        <ol>
                            {group.logs.map((log, index) => {
                                const isFailure = log.outcome !== 'ok'
                                const friendly = isFailure ? friendlySyncError(log.message, fa) : null
                                const last = index === group.logs.length - 1
                                return (
                                    <li key={log.id} className="relative flex gap-3 py-2">
                                        {!last && <span aria-hidden className="absolute bottom-[-0.5rem] top-7 start-[8px] w-px bg-[var(--border-default)]" />}
                                        <span
                                            aria-hidden
                                            className={cn(
                                                'mt-1 grid h-[17px] w-[17px] shrink-0 place-items-center rounded-full',
                                                isFailure ? 'bg-[var(--danger-soft)] text-[var(--danger-ink)]' : 'bg-[var(--ok-soft)] text-[var(--ok)]',
                                            )}
                                        >
                                            {isFailure ? <X className="h-2.5 w-2.5" strokeWidth={3.5} /> : <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[13px] leading-7 text-[var(--text-primary)]">{logLabel(log, fa)}</p>
                                            {isFailure && (friendly || log.message) && (
                                                <p title={log.message ?? undefined} className="line-clamp-2 text-[12.5px] leading-6 text-[var(--danger-ink)]">
                                                    {friendly ?? log.message}
                                                </p>
                                            )}
                                            {isFailure && onRetry && log.id === firstFailureId && (
                                                <button
                                                    type="button"
                                                    onClick={onRetry}
                                                    disabled={retrying}
                                                    className={cn(WOO_BTN_SECONDARY, 'mt-1.5 min-h-9 px-3 text-[12.5px] sm:min-h-8')}
                                                >
                                                    {fa ? 'دوباره امتحان کن' : 'Try again'}
                                                </button>
                                            )}
                                            <time suppressHydrationWarning dateTime={log.createdAt} title={absoluteTime(log.createdAt, fa)} className="block text-[12px] tabular-nums text-[var(--text-muted)] sm:hidden">
                                                {shortTime(log.createdAt, fa)}
                                            </time>
                                        </div>
                                        <time suppressHydrationWarning dateTime={log.createdAt} title={absoluteTime(log.createdAt, fa)} className="hidden shrink-0 pt-1 text-[12px] tabular-nums text-[var(--text-muted)] sm:block">
                                            {shortTime(log.createdAt, fa)}
                                        </time>
                                    </li>
                                )
                            })}
                        </ol>
                    </div>
                ))}
            </div>

            {logs.length > ACTIVITY_PREVIEW && (
                <button
                    type="button"
                    onClick={() => setExpanded((value) => !value)}
                    aria-expanded={expanded}
                    className="mt-1 inline-flex min-h-10 items-center text-[12.5px] font-semibold text-[var(--text-secondary)] underline decoration-[var(--border-strong)] underline-offset-4 hover:text-[var(--text-primary)]"
                >
                    {expanded ? (fa ? 'نمایش کمتر' : 'Show less') : (fa ? `نمایش ${num(hiddenCount)} مورد بیشتر` : `Show ${num(hiddenCount)} more`)}
                </button>
            )}
        </section>
    )
}

/** A plain sentence for the sync failures people actually hit; null when unknown. */
export function friendlySyncError(message: string | null, fa: boolean): string | null {
    if (!message) return null
    const m = message
    if (/(?:PRODUCT|ORDER|CUSTOMER)_LIMIT/.test(m)) return fa ? 'سقف پلن پر شده است؛ بقیه موارد بعد از ارتقا همگام می‌شوند.' : 'The plan limit is reached; the rest syncs after an upgrade.'
    if (/timed? ?out|cURL error 28|ETIMEDOUT/i.test(m)) return fa ? 'سایت به‌موقع جواب نداد. معمولاً موقتی است؛ اگر تکرار شد سرعت هاست را بررسی کنید.' : 'The site did not answer in time. This is usually temporary; if it repeats, check the hosting speed.'
    if (/ENOTFOUND|getaddrinfo|could not resolve|ECONNREFUSED|connection refused/i.test(m)) return fa ? 'به سایت وصل نشدیم؛ آدرس سایت یا روشن بودن هاست را بررسی کنید.' : 'Could not reach the site; check the address and that the hosting is up.'
    if (/\b40[13]\b|unauthori[sz]ed|forbidden|signature|invalid secret/i.test(m)) return fa ? 'سایت درخواست را رد کرد؛ در افزونه یک بار دیگر «اتصال» را بزنید.' : 'The site refused the request; press “Connect” in the plugin once more.'
    if (/\b404\b|not found|rest_no_route/i.test(m)) return fa ? 'افزونه روی سایت پیدا نشد؛ مطمئن شوید افزونه ویجنت فعال است.' : 'The plugin was not found on the site; make sure the Vigent plugin is active.'
    if (/\b5\d\d\b|internal server error|bad gateway|service unavailable/i.test(m)) return fa ? 'سایت خطای داخلی داد. معمولاً موقتی است.' : 'The site returned a server error. This is usually temporary.'
    return null
}

function logLabel(log: WooSyncLogEntry, fa: boolean): string {
    const count = log.count.toLocaleString(fa ? 'fa-IR' : 'en-US')
    const entity = entityLabel(log.entity, fa)
    if (log.outcome !== 'ok') {
        if (log.entity === 'batch') return fa ? 'دریافت تغییرات از سایت انجام نشد' : 'Receiving changes from the site failed'
        return fa ? `همگام‌سازی ${entity} انجام نشد` : `Syncing ${entity} failed`
    }
    if (log.entity === 'batch') return fa ? `${count} تغییر از سایت اعمال شد` : `${count} changes from the site applied`
    return fa ? `${count} ${entity} همگام شد` : `${count} ${entity} synced`
}

function entityLabel(entity: string, fa: boolean): string {
    const map: Record<string, [string, string]> = {
        products: ['محصولات', 'products'],
        orders: ['سفارش‌ها', 'orders'],
        product_update: ['محصول', 'product'],
        order_update: ['سفارش', 'order'],
        content_update: ['محتوا', 'content'],
    }
    return map[entity]?.[fa ? 0 : 1] ?? entity
}

// ─── Time ───────────────────────────────────────────────────────────────

const DAY = 24 * 60 * 60 * 1000

function startOfDay(date: Date): number {
    const copy = new Date(date)
    copy.setHours(0, 0, 0, 0)
    return copy.getTime()
}

function dayLabel(iso: string, fa: boolean): string {
    const diff = Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / DAY)
    if (diff <= 0) return fa ? 'امروز' : 'Today'
    if (diff === 1) return fa ? 'دیروز' : 'Yesterday'
    return new Date(iso).toLocaleDateString(fa ? 'fa-IR' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

/** Today: "۲ ساعت پیش"; earlier days: the clock time (the day is the group heading). */
function shortTime(iso: string, fa: boolean): string {
    if (startOfDay(new Date(iso)) === startOfDay(new Date())) return relativeTime(iso, fa)
    return new Date(iso).toLocaleTimeString(fa ? 'fa-IR' : 'en-US', { hour: '2-digit', minute: '2-digit' })
}

function absoluteTime(iso: string, fa: boolean): string {
    return new Date(iso).toLocaleString(fa ? 'fa-IR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

/** "۲ ساعت پیش" — or, with `bare`, "۲ ساعت" for a tile whose label says "since". */
export function relativeTime(iso: string, fa: boolean, bare = false): string {
    const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
    const ago = (value: string) => (bare ? value : fa ? `${value} پیش` : `${value} ago`)
    if (minutes < 1) return fa ? (bare ? 'لحظه‌ای' : 'همین حالا') : (bare ? 'a moment' : 'just now')
    if (minutes < 60) return ago(fa ? `${minutes.toLocaleString('fa-IR')} دقیقه` : `${minutes} min`)
    const hours = Math.round(minutes / 60)
    if (hours < 24) return ago(fa ? `${hours.toLocaleString('fa-IR')} ساعت` : `${hours} h`)
    const days = Math.round(hours / 24)
    return ago(fa ? `${days.toLocaleString('fa-IR')} روز` : `${days} d`)
}

/** A row that says the page is listening for the plugin — not an error, not a spinner. */
export function ListeningRow({ fa, children, className }: { fa: boolean; children?: ReactNode; className?: string }) {
    return (
        <div role="status" aria-live="polite" className={cn('flex items-center gap-3 rounded-2xl bg-[var(--bg-base)] px-3.5 py-3 text-[13px] text-[var(--text-secondary)]', className)}>
            <span aria-hidden className="relative inline-flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inset-0 animate-ping rounded-full bg-[var(--text-secondary)] opacity-30 [animation-duration:1.8s] motion-reduce:animate-none" />
                <span className="relative h-2.5 w-2.5 rounded-full bg-[var(--text-secondary)]" />
            </span>
            {children ?? (fa ? 'منتظر افزونه‌ایم. به محض اتصال، این صفحه خودش عوض می‌شود.' : 'Waiting for the plugin. This page updates by itself once it connects.')}
        </div>
    )
}
