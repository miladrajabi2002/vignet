'use client'

import { useLocale } from 'next-intl'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    Plus,
    Loader2,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    X,
    BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatWooSyncResult } from '@/components/integrations/format-sync-result'
import { PlanLimitsNotice, type PlanLimitInfo } from '@/components/billing/plan-limit-notice'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { StatusChip } from '@/components/ui/status-chip'
import {
    WOO_PLUGIN_DOWNLOAD_HREF,
    WooPluginSetup,
    normalizeStoreUrlInput,
    wooCreateErrorMessage,
    wpAdminUrl,
} from '@/components/integrations/woo-plugin-setup'
import {
    CopyLinkButton,
    StoreActionsMenu,
    StoreAvatar,
    StoreLinks,
    StoreStats,
    StoreUrlField,
    SyncTimeline,
    WOO_BTN_GHOST,
    WOO_BTN_PRIMARY,
    WOO_BTN_SECONDARY,
    WOO_CARD,
    WOO_NOTE,
    WOO_TEXT,
    WooStepsPreview,
    friendlySyncError,
    relativeTime,
    storeHost,
    type WooSyncLogEntry,
} from '@/components/integrations/woo-ui'

/**
 * The WooCommerce tab's store section: the empty state, the add-site form
 * and one card per connected site (status, numbers, where to manage the
 * data, recent sync activity). Building blocks live in `woo-ui.tsx`.
 */

export interface StoreIntegrationItem {
    id: string
    type: string
    storeUrl: string
    webhookSecret: string | null
    pollIntervalMinutes: number
    active: boolean
    connectedAt: string | null
    lastWebhookAt: string | null
    lastSyncAt: string | null
    lastSyncStatus: string | null
    lastSyncError: string | null
    /** `products` is the number of catalog items this connection synced. */
    _count: { orders: number; syncLogs: number; products?: number }
    syncLogs: WooSyncLogEntry[]
}

export function StoreIntegrationsSection({
    integrations: initial,
    planLimits = [],
    storeAccessHref = null,
    locale = 'fa',
}: {
    integrations: StoreIntegrationItem[]
    planLimits?: PlanLimitInfo[]
    /** The agent's store-access settings; linked once the plugin is connected. */
    storeAccessHref?: string | null
    locale?: 'fa' | 'en'
}) {
    const fa = useLocale() !== 'en'
    const router = useRouter()
    const [integrations, setIntegrations] = useState(initial)
    const [showForm, setShowForm] = useState(false)
    const [syncingId, setSyncingId] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [togglingId, setTogglingId] = useState<string | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<StoreIntegrationItem | null>(null)
    const [notice, setNotice] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

    // Auto-poll when not connected.
    useEffect(() => {
        setIntegrations(initial)
        const hasUnconnected = initial.some((i) => !isIntegrationConnected(i))
        if (hasUnconnected || initial.length === 0) {
            const interval = setInterval(() => {
                fetch('/api/integrations', { cache: 'no-store' })
                    .then((r) => r.json())
                    .then((data) => {
                        if (data.integrations) {
                            const woo = data.integrations.filter((i: { type: string }) => i.type === 'WOOCOMMERCE')
                            const mapped = woo.map((i: StoreIntegrationItem) => ({
                                id: i.id,
                                type: i.type,
                                storeUrl: i.storeUrl,
                                webhookSecret: i.webhookSecret,
                                pollIntervalMinutes: i.pollIntervalMinutes,
                                active: i.active,
                                connectedAt: i.connectedAt,
                                lastWebhookAt: i.lastWebhookAt,
                                lastSyncAt: i.lastSyncAt,
                                lastSyncStatus: i.lastSyncStatus,
                                lastSyncError: i.lastSyncError,
                                _count: i._count,
                                syncLogs: i.syncLogs,
                            }))
                            setIntegrations(mapped)
                            const justConnected = mapped.some(isIntegrationConnected)
                            const wasUnconnected = initial.some((i) => !isIntegrationConnected(i))
                            if (justConnected && wasUnconnected) router.refresh()
                        }
                    })
                    .catch(() => {})
            }, 4000)
            return () => clearInterval(interval)
        }
    }, [initial, router])

    /** Creates the connection; resolves to an error message, or null on success. */
    async function submit(storeUrl: string): Promise<string | null> {
        setNotice(null)
        try {
            const res = await fetch('/api/integrations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'WOOCOMMERCE', storeUrl, credentials: {} }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                return wooCreateErrorMessage(data.error, fa)
            }
        } catch {
            return fa ? 'خطا در ارتباط با سرور.' : 'Could not reach the server.'
        }
        setShowForm(false)
        router.refresh()
        return null
    }

    async function syncNow(integration: StoreIntegrationItem) {
        setSyncingId(integration.id)
        setNotice(null)
        try {
            const res = await fetch(`/api/sync/woocommerce?integrationId=${integration.id}`, { method: 'POST' })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setNotice({ type: 'err', msg: (fa ? 'همگام‌سازی انجام نشد؛ چند دقیقه بعد دوباره امتحان کنید.' : 'The sync did not run. Try again in a few minutes.') })
                return
            }

            setNotice(formatWooSyncResult(data))
            router.refresh()
        } catch {
            setNotice({ type: 'err', msg: (fa ? 'خطا در ارتباط با سرور.' : 'Could not reach the server.') })
        } finally {
            setSyncingId(null)
        }
    }

    async function toggleActive(integration: StoreIntegrationItem) {
        if (togglingId) return
        setTogglingId(integration.id)
        setNotice(null)
        // Optimistic flip — connection toggling is low-risk and instantly
        // reversible, so the UI reacts first and rolls back on failure.
        const nextActive = !integration.active
        setIntegrations((prev) =>
            prev.map((item) => (item.id === integration.id ? { ...item, active: nextActive } : item)),
        )
        try {
            const res = await fetch(`/api/integrations/${integration.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: nextActive }),
            })
            if (!res.ok) throw new Error('toggle failed')
            router.refresh()
        } catch {
            setIntegrations((prev) =>
                prev.map((item) => (item.id === integration.id ? { ...item, active: integration.active } : item)),
            )
            setNotice({
                type: 'err',
                msg: nextActive
                    ? (fa ? 'از سرگیری همگام‌سازی انجام نشد؛ دوباره تلاش کنید.' : 'Syncing could not be resumed. Try again.')
                    : (fa ? 'توقف همگام‌سازی انجام نشد؛ دوباره تلاش کنید.' : 'Syncing could not be paused. Try again.'),
            })
        } finally {
            setTogglingId(null)
        }
    }

    async function remove(integration: StoreIntegrationItem) {
        setDeletingId(integration.id)
        try {
            const res = await fetch(`/api/integrations/${integration.id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('delete failed')
            setDeleteTarget(null)
            router.refresh()
        } catch {
            setDeleteTarget(null)
            setNotice({ type: 'err', msg: (fa ? 'حذف اتصال انجام نشد؛ دوباره تلاش کنید.' : 'The connection could not be deleted. Try again.') })
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <div id="online-store" className="scroll-mt-24 space-y-4 sm:space-y-5">
            {notice && (
                <div
                    role={notice.type === 'err' ? 'alert' : 'status'}
                    aria-live="polite"
                    className={cn(
                        'flex items-center gap-2.5 rounded-2xl px-4 py-3 text-[13px] font-medium',
                        notice.type === 'ok' ? 'bg-[var(--ok-soft)] text-[var(--ok-ink)]' : 'bg-[var(--danger-soft)] text-[var(--danger-ink)]',
                    )}
                >
                    {notice.type === 'ok' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                    <span className="min-w-0 flex-1">{notice.msg}</span>
                    <button type="button" onClick={() => setNotice(null)} aria-label={fa ? 'بستن' : 'Close'} className="-m-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg opacity-70 hover:opacity-100">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            <PlanLimitsNotice limits={planLimits} locale={locale} syncContext compact />

            {showForm && (
                <AddSiteForm
                    onClose={() => setShowForm(false)}
                    onSubmit={submit}
                />
            )}

            {integrations.length === 0 && !showForm && (
                <EmptyState fa={fa} onConnect={() => setShowForm(true)} />
            )}

            {integrations.map((integration) => (
                <IntegrationCard
                    key={integration.id}
                    integration={integration}
                    syncing={syncingId === integration.id}
                    busy={deletingId === integration.id || togglingId === integration.id}
                    onSync={() => syncNow(integration)}
                    onToggle={() => toggleActive(integration)}
                    onDelete={() => setDeleteTarget(integration)}
                    planLimits={planLimits}
                    storeAccessHref={storeAccessHref}
                />
            ))}

            {integrations.length > 0 && !showForm && (
                <button type="button" onClick={() => setShowForm(true)} className={cn(WOO_BTN_GHOST, 'min-h-10 text-[12.5px]')}>
                    <Plus className="h-4 w-4" />
                    {fa ? 'افزودن سایت دیگر' : 'Add another site'}
                </button>
            )}

            {/* Branded confirm for removing a store connection (replaces the
                native confirm(): focus trap, Esc, scroll lock, focus return). */}
            <ConfirmDialog
                open={deleteTarget !== null}
                title={fa ? 'حذف اتصال سایت' : 'Delete site connection'}
                description={
                    deleteTarget
                        ? (fa ? `اتصال به ${storeHost(deleteTarget.storeUrl)} حذف می‌شود؛ سفارش‌ها و تنظیمات هم‌گام‌سازی آن از پنل خارج می‌شوند.` : `The connection to ${storeHost(deleteTarget.storeUrl)} will be deleted; its orders and sync settings leave the panel.`)
                        : undefined
                }
                confirmLabel={fa ? 'حذف اتصال' : 'Delete connection'}
                tone="danger"
                busy={deletingId !== null}
                onConfirm={() => deleteTarget && remove(deleteTarget)}
                onClose={() => { if (deletingId === null) setDeleteTarget(null) }}
            />
        </div>
    )
}

// ─── Empty state: why, and the whole path up front ──────────────────────

function EmptyState({ fa, onConnect }: { fa: boolean; onConnect: () => void }) {
    return (
        <section className={cn(WOO_CARD, 'grid gap-5 p-5 sm:p-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:items-center md:gap-8')}>
            <div>
                <StoreAvatar />
                <h2 className="mt-3.5 text-[17px] font-bold leading-relaxed text-[var(--text-primary)] [text-wrap:balance]">
                    {fa ? 'فروشگاه ووکامرس‌تان را وصل کنید' : 'Connect your WooCommerce store'}
                </h2>
                <p className={cn(WOO_TEXT, 'mt-1 max-w-md')}>
                    {fa
                        ? 'محصولات، موجودی و سفارش‌ها خودکار به ویجنت می‌آیند و ایجنت می‌تواند در گفتگو بفروشد.'
                        : 'Products, stock and orders come into Vigent automatically, and the agent can sell in chat.'}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={onConnect} className={cn(WOO_BTN_PRIMARY, 'max-sm:w-full')}>
                        <Plus className="h-4 w-4" />
                        {fa ? 'اتصال سایت' : 'Connect site'}
                    </button>
                    {/* A WordPress plugin is installed from a computer; a phone gets the link. */}
                    <CopyLinkButton
                        path={WOO_PLUGIN_DOWNLOAD_HREF}
                        label={fa ? 'کپی لینک افزونه برای کامپیوتر' : 'Copy the plugin link for a computer'}
                        copiedLabel={fa ? 'لینک کپی شد' : 'Link copied'}
                        className={cn(WOO_BTN_SECONDARY, 'w-full sm:hidden')}
                    />
                    <Link href="/docs/woocommerce" className={cn(WOO_BTN_GHOST, 'max-sm:w-full')}>
                        <BookOpen className="h-4 w-4" />
                        {fa ? 'راهنمای کامل' : 'Full guide'}
                    </Link>
                </div>
            </div>
            <div className="rounded-2xl bg-[var(--bg-base)] p-4">
                <p className="mb-3 text-[12.5px] font-bold text-[var(--text-muted)]">{fa ? 'سه قدم تا اتصال' : 'Three steps to connect'}</p>
                <WooStepsPreview fa={fa} />
            </div>
        </section>
    )
}

// ─── Add site form ──────────────────────────────────────────────────────

function AddSiteForm({
    onClose,
    onSubmit,
}: {
    onClose: () => void
    onSubmit: (url: string) => Promise<string | null>
}) {
    const fa = useLocale() !== 'en'
    const [storeUrl, setStoreUrl] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const submitRef = useRef<HTMLButtonElement>(null)

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        if (submitting) return
        const url = normalizeStoreUrlInput(storeUrl)
        if (!url) {
            setError(fa ? 'آدرس سایت را وارد کنید.' : 'Enter your site address.')
            return
        }
        setError(null)
        setSubmitting(true)
        // On success the parent closes (unmounts) this form.
        const failure = await onSubmit(url)
        if (failure) {
            setError(failure)
            setSubmitting(false)
        }
    }

    // Phones: once the keyboard has slid up, bring the button above it.
    function keepButtonInView() {
        if (window.matchMedia('(min-width: 640px)').matches) return
        window.setTimeout(() => submitRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 350)
    }

    return (
        <form onSubmit={submit} noValidate className={cn(WOO_CARD, 'max-w-xl p-5 sm:p-6')}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[12.5px] font-bold text-[var(--text-muted)]">{fa ? 'قدم ۱ از ۳' : 'Step 1 of 3'}</p>
                    <h2 className="text-[16px] font-bold leading-relaxed text-[var(--text-primary)]">{fa ? 'آدرس فروشگاه' : 'Store address'}</h2>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={fa ? 'بستن' : 'Close'}
                    className={cn(WOO_BTN_GHOST, '-me-2 -mt-1 w-11 px-0')}
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
            <div className="mt-3">
                <StoreUrlField
                    fa={fa}
                    value={storeUrl}
                    onChange={(next) => { setStoreUrl(next); if (error) setError(null) }}
                    error={error}
                    onFocus={keepButtonInView}
                    autoFocus
                />
            </div>
            <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className={WOO_NOTE}>
                    {fa ? 'بعد از این، فایل افزونه و قدم‌های نصب را همین‌جا می‌بینید.' : 'Next, the plugin file and the install steps appear right here.'}
                </p>
                <button
                    ref={submitRef}
                    type="submit"
                    disabled={submitting}
                    className={cn(WOO_BTN_PRIMARY, 'shrink-0 px-6 max-sm:w-full')}
                >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {submitting ? (fa ? 'در حال ایجاد…' : 'Creating…') : (fa ? 'ادامه' : 'Continue')}
                </button>
            </div>
        </form>
    )
}

// ─── One connected site ─────────────────────────────────────────────────

function IntegrationCard({
    integration,
    syncing,
    busy,
    onSync,
    onToggle,
    onDelete,
    planLimits,
    storeAccessHref,
}: {
    integration: StoreIntegrationItem
    syncing: boolean
    busy: boolean
    onSync: () => void
    onToggle: () => void
    onDelete: () => void
    planLimits: PlanLimitInfo[]
    storeAccessHref: string | null
}) {
    const fa = useLocale() !== 'en'
    const limitFromError = planLimitFromError(integration.lastSyncError, planLimits)
    const visibleLogs = integration.syncLogs.filter((log) => log.outcome !== 'ok' || log.count > 0)
    const failedCount = integration.syncLogs.filter((log) => log.outcome !== 'ok').length
    const hasPlanLimitError = isResourceLimitError(integration.lastSyncError)
    const isPluginConfigured = isIntegrationConnected(integration) || hasPlanLimitError
    const syncPausedByPlan = limitFromError !== null
    const productCount = integration._count.products ?? null
    const showSyncError = integration.lastSyncStatus === 'error' && Boolean(integration.lastSyncError) && !hasPlanLimitError

    // One status, said once: the chip. Waiting for the plugin is not a problem,
    // so it stays neutral; only a full plan is amber.
    const status = !integration.active
        ? { tone: 'neutral' as const, label: fa ? 'همگام‌سازی متوقف' : 'Syncing paused', hollow: true }
        : syncPausedByPlan
            ? { tone: 'warn' as const, label: fa ? 'سقف پلن پر شده' : 'Plan limit reached', hollow: false }
            : isPluginConfigured
                ? { tone: 'ok' as const, label: fa ? 'متصل' : 'Connected', hollow: false }
                : { tone: 'neutral' as const, label: fa ? 'منتظر افزونه' : 'Waiting for the plugin', hollow: false }

    return (
        <section className={cn(WOO_CARD, 'p-4 sm:p-6')}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
                <StoreAvatar storeUrl={integration.storeUrl} />
                <div className="min-w-0 flex-1">
                    <p dir="ltr" className="truncate text-start text-[16px] font-extrabold leading-7 text-[var(--text-primary)] rtl:text-right" title={integration.storeUrl}>
                        {storeHost(integration.storeUrl)}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <StatusChip
                            tone={status.tone}
                            dot
                            className={status.hollow ? '[&_.ui-chip-dot]:bg-transparent [&_.ui-chip-dot]:shadow-[inset_0_0_0_1.5px_currentColor]' : undefined}
                        >
                            {status.label}
                        </StatusChip>
                        {isPluginConfigured && integration.active && integration.lastSyncAt && (
                            <span suppressHydrationWarning className="text-[12.5px] text-[var(--text-muted)]">
                                {fa ? `همگام‌سازی خودکار · ${relativeTime(integration.lastSyncAt, fa)}` : `Auto sync · ${relativeTime(integration.lastSyncAt, fa)}`}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 max-sm:w-full">
                    {isPluginConfigured && (
                        <button
                            type="button"
                            onClick={onSync}
                            disabled={syncing || !integration.active}
                            className={cn(WOO_BTN_SECONDARY, 'max-sm:flex-1')}
                        >
                            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            {fa ? 'همگام‌سازی' : 'Sync now'}
                        </button>
                    )}
                    <StoreActionsMenu
                        fa={fa}
                        storeUrl={integration.storeUrl}
                        wpAdminHref={wpAdminUrl(integration.storeUrl, '')}
                        active={integration.active}
                        busy={busy}
                        onToggle={onToggle}
                        onDelete={onDelete}
                    />
                </div>
            </div>

            {/* Pending state — the install guide, with the plugin download */}
            {!isPluginConfigured && integration.active && (
                <WooPluginSetup storeUrl={integration.storeUrl} className="mt-5 border-t border-[var(--border-subtle)] pt-5" />
            )}

            {isPluginConfigured && (
                <div className="mt-5 space-y-4">
                    <StoreStats
                        fa={fa}
                        productCount={productCount}
                        orderCount={integration._count.orders}
                        lastSyncAt={integration.lastSyncAt}
                        failedCount={failedCount}
                    />

                    {showSyncError && (
                        <SyncErrorCard
                            fa={fa}
                            message={integration.lastSyncError ?? ''}
                            retrying={syncing}
                            onRetry={integration.active ? onSync : undefined}
                        />
                    )}

                    <StoreLinks
                        fa={fa}
                        productCount={productCount}
                        orderCount={integration._count.orders}
                        storeAccessHref={storeAccessHref}
                    />

                    {visibleLogs.length > 0 && (
                        <div className="border-t border-[var(--border-subtle)] pt-4">
                            <SyncTimeline
                                logs={visibleLogs}
                                fa={fa}
                                retrying={syncing}
                                onRetry={integration.active && !showSyncError ? onSync : undefined}
                            />
                        </div>
                    )}
                </div>
            )}
        </section>
    )
}

/** What went wrong in plain words, one way out, and the raw text for support. */
function SyncErrorCard({
    fa,
    message,
    retrying,
    onRetry,
}: {
    fa: boolean
    message: string
    retrying: boolean
    onRetry?: () => void
}) {
    const friendly = friendlySyncError(message, fa)
    return (
        <div role="alert" className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-2xl bg-[var(--danger-soft)] p-3.5 sm:p-4">
            <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-white text-[var(--danger-ink)]">
                <AlertCircle className="h-4 w-4" />
            </span>
            <div className="min-w-0">
                <p className="text-[13.5px] font-bold leading-7 text-[var(--text-primary)]">{fa ? 'آخرین همگام‌سازی انجام نشد' : 'The last sync did not complete'}</p>
                <p className="text-[13px] leading-7 text-[var(--text-secondary)]">
                    {friendly ?? (fa ? 'سایت به درخواست همگام‌سازی جواب درستی نداد.' : 'The site did not answer the sync request properly.')}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    {onRetry && (
                        <button type="button" onClick={onRetry} disabled={retrying} className={cn(WOO_BTN_SECONDARY, 'min-h-9 px-3 text-[12.5px]')}>
                            {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            {fa ? 'دوباره امتحان کن' : 'Try again'}
                        </button>
                    )}
                    <details className="group min-w-0 open:basis-full">
                        <summary className={cn(WOO_BTN_GHOST, 'min-h-9 cursor-pointer list-none px-2.5 text-[12.5px] [&::-webkit-details-marker]:hidden')}>
                            {fa ? 'جزئیات فنی' : 'Technical details'}
                        </summary>
                        <p dir="ltr" className="mt-1 break-words rounded-xl bg-white/70 px-3 py-2 text-left font-mono text-[12px] leading-6 text-[var(--text-secondary)]">{message}</p>
                    </details>
                </div>
            </div>
        </div>
    )
}

function isIntegrationConnected(integration: StoreIntegrationItem): boolean {
    return Boolean(
        integration.connectedAt ||
        integration.lastWebhookAt ||
        integration.lastSyncAt,
    )
}

function isResourceLimitError(error: string | null): boolean {
    return Boolean(error && /(?:PRODUCT|ORDER|CUSTOMER)_LIMIT(?::\d+)?/.test(error))
}

function planLimitFromError(error: string | null, limits: PlanLimitInfo[]): PlanLimitInfo | null {
    if (!error) return null
    const resource = error.includes('PRODUCT_LIMIT')
        ? 'products'
        : error.includes('ORDER_LIMIT')
            ? 'orders'
            : error.includes('CUSTOMER_LIMIT')
                ? 'customers'
                : null
    return resource ? limits.find((limit) => limit.resource === resource) ?? null : null
}
