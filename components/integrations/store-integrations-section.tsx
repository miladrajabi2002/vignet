'use client'

import { useLocale } from 'next-intl'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    Plus,
    Loader2,
    RefreshCw,
    Trash2,
    CheckCircle2,
    AlertCircle,
    X,
    Globe,
    Download,
    Package,
    ShieldCheck,
    ShoppingBag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatWooSyncResult } from '@/components/integrations/format-sync-result'
import { PlanLimitsNotice, type PlanLimitInfo } from '@/components/billing/plan-limit-notice'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
    WOO_PLUGIN_DOWNLOAD_HREF,
    WooPluginDownloadLink,
    WooPluginSetup,
    normalizeStoreUrlInput,
    wooCreateErrorMessage,
} from '@/components/integrations/woo-plugin-setup'

/**
 * Integrations page — "WordPress/WooCommerce" section.
 * Uses the same `spatial-surface rounded-card` design as the Products page.
 */

interface SyncLogEntry {
    id: string
    direction: string
    entity: string
    outcome: string
    count: number
    message: string | null
    createdAt: string
}

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
    _count: { orders: number; syncLogs: number }
    syncLogs: SyncLogEntry[]
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
                setNotice({ type: 'err', msg: (fa ? 'خطا در هم‌گام‌سازی.' : 'Sync failed.') })
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
                    ? (fa ? 'فعال‌سازی اتصال انجام نشد؛ دوباره تلاش کنید.' : 'The connection could not be enabled. Try again.')
                    : (fa ? 'غیرفعال‌سازی اتصال انجام نشد؛ دوباره تلاش کنید.' : 'The connection could not be disabled. Try again.'),
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
        <div id="online-store" className="scroll-mt-24 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[var(--text-secondary)]">{fa ? 'سایت (وردپرس/ووکامرس)' : 'Website (WordPress/WooCommerce)'}</h2>
                {integrations.length > 0 && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        {fa ? 'افزودن سایت' : 'Add a site'}
                    </button>
                )}
            </div>

            {/* Notice */}
            {notice && (
                <div
                    role={notice.type === 'err' ? 'alert' : 'status'}
                    aria-live="polite"
                    className={cn(
                    'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm',
                    notice.type === 'ok' ? 'border border-[color:color-mix(in_srgb,var(--ok)_25%,transparent)] bg-[var(--ok-soft)] text-[var(--ok)]' : 'border border-danger/30 bg-danger/5 text-danger',
                )}>
                    {notice.type === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    {notice.msg}
                </div>
            )}

            <PlanLimitsNotice limits={planLimits} locale={locale} syncContext compact />

            {/* Form */}
            {showForm && (
                <AddSiteForm
                    onClose={() => setShowForm(false)}
                    onSubmit={submit}
                />
            )}

            {/* Empty state */}
            {integrations.length === 0 && !showForm && (
                <section className="spatial-surface overflow-hidden rounded-card p-5 sm:p-6 text-center">
                    <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-[var(--text-primary)] text-[var(--bg-base)] shadow-[var(--shadow-control)]">
                        <Globe className="h-5 w-5" />
                    </span>
                    <h3 className="mt-4 text-base font-bold tracking-tight text-[var(--text-primary)]">{fa ? 'سایت خود را وصل کنید' : 'Connect your site'}</h3>
                    <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-[var(--text-secondary)]">
                        {fa ? 'آدرس سایت را وارد کنید، افزونه ویجنت را در وردپرس نصب کنید و «اتصال» را بزنید — محصولات و سفارش‌ها خودکار همگام می‌شوند.' : 'Enter your site address, install the Vigent plugin in WordPress and press “Connect”. Products and orders sync automatically.'}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowForm(true)}
                            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-sm font-bold text-[var(--bg-base)] shadow-[var(--shadow-control)] transition-opacity hover:opacity-90"
                        >
                            <Plus className="h-4 w-4" />
                            {fa ? 'اتصال سایت' : 'Connect site'}
                        </button>
                        <WooPluginDownloadLink variant="quiet" />
                    </div>
                </section>
            )}

            {/* Integration cards */}
            {integrations.map((integration) => (
                <IntegrationCard
                    key={integration.id}
                    integration={integration}
                    syncing={syncingId === integration.id}
                    deleting={deletingId === integration.id}
                    toggling={togglingId === integration.id}
                    onSync={() => syncNow(integration)}
                    onToggle={() => toggleActive(integration)}
                    onDelete={() => setDeleteTarget(integration)}
                    planLimits={planLimits}
                    storeAccessHref={storeAccessHref}
                />
            ))}

            {/* Footer help */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <p className="min-w-0 text-xs leading-relaxed text-[var(--text-muted)]">
                        {fa ? 'افزونه را در وردپرس نصب و دکمه «اتصال» را بزنید — همه چیز خودکار است.' : 'Install the plugin in WordPress and press “Connect”. The rest is automatic.'}
                    </p>
                    <div className="flex shrink-0 items-center gap-4">
                        <a
                            href={WOO_PLUGIN_DOWNLOAD_HREF}
                            download
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] hover:opacity-80"
                        >
                            <Download className="h-3.5 w-3.5" />
                            {fa ? 'دانلود افزونه' : 'Download plugin'}
                        </a>
                        <Link
                            href="/docs/woocommerce"
                            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                            {fa ? 'راهنما' : 'Guide'}
                        </Link>
                    </div>
                </div>
            </div>

            {/* Branded confirm for removing a store connection (replaces the
                native confirm(): focus trap, Esc, scroll lock, focus return). */}
            <ConfirmDialog
                open={deleteTarget !== null}
                title={fa ? 'حذف اتصال سایت' : 'Delete site connection'}
                description={
                    deleteTarget
                        ? (fa ? `اتصال به ${deleteTarget.storeUrl} حذف می‌شود؛ سفارش‌ها و تنظیمات هم‌گام‌سازی آن از پنل خارج می‌شوند.` : `The connection to ${deleteTarget.storeUrl} will be deleted; its orders and sync settings leave the panel.`)
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

// ─── Add site form (spatial-surface style) ───────────────────────────────

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

    return (
        <form onSubmit={submit} noValidate className="spatial-surface rounded-card p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">{fa ? 'آدرس سایت را وارد کنید' : 'Enter your site address'}</h3>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={fa ? 'بستن' : 'Close'}
                    className="-m-2 grid h-9 w-9 place-items-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
                <input
                    dir="ltr"
                    type="text"
                    inputMode="url"
                    autoComplete="url"
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-label={fa ? 'آدرس سایت' : 'Site address'}
                    aria-invalid={error ? true : undefined}
                    value={storeUrl}
                    onChange={(e) => { setStoreUrl(e.target.value); if (error) setError(null) }}
                    placeholder="https://example.com"
                    className="input flex-1 font-mono text-sm"
                    autoFocus
                />
                <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-5 text-sm font-bold text-[var(--bg-base)] shadow-[var(--shadow-control)] transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {submitting ? (fa ? 'در حال ایجاد…' : 'Creating…') : (fa ? 'ایجاد اتصال' : 'Create connection')}
                </button>
            </div>
            {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
            <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
                {fa ? 'پس از ایجاد اتصال، دکمه دانلود افزونه و مراحل نصب همین‌جا نمایش داده می‌شود.' : 'After the connection is created, the plugin download button and the install steps appear right here.'}
            </p>
        </form>
    )
}

// ─── Integration card (spatial-surface style) ────────────────────────────

function IntegrationCard({
    integration,
    syncing,
    deleting,
    toggling,
    onSync,
    onToggle,
    onDelete,
    planLimits,
    storeAccessHref,
}: {
    integration: StoreIntegrationItem
    syncing: boolean
    deleting: boolean
    toggling: boolean
    onSync: () => void
    onToggle: () => void
    onDelete: () => void
    planLimits: PlanLimitInfo[]
    storeAccessHref: string | null
}) {
    const fa = useLocale() !== 'en'
    const limitFromError = planLimitFromError(integration.lastSyncError, planLimits)
    const visibleLogs = integration.syncLogs.filter((log) => log.outcome !== 'ok' || log.count > 0)
    const hasPlanLimitError = isResourceLimitError(integration.lastSyncError)
    const isPluginConfigured = isIntegrationConnected(integration) || hasPlanLimitError
    const syncPausedByPlan = limitFromError !== null
    const statusLabel = !integration.active
        ? (fa ? 'غیرفعال' : 'Disabled')
        : syncPausedByPlan
            ? (fa ? 'متصل · محدودیت پلن' : 'Connected · plan limit')
        : isPluginConfigured
            ? (fa ? 'متصل' : 'Connected')
            : (fa ? 'در انتظار اتصال افزونه' : 'Waiting for the plugin')

    return (
        <section className="spatial-surface overflow-hidden rounded-card p-5 sm:p-6">
            {/* Top row */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <span className={cn(
                        'grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[var(--bg-base)] shadow-[var(--shadow-control)]',
                        syncPausedByPlan ? 'bg-amber-500' : !integration.active ? 'bg-black/30' : isPluginConfigured ? 'bg-emerald-600' : 'bg-[var(--text-primary)]',
                    )}>
                        {isPluginConfigured && integration.active ? <CheckCircle2 className="h-5 w-5" /> : <Globe className="h-5 w-5" />}
                    </span>
                    <div className="min-w-0">
                        <p dir="ltr" className="truncate text-base font-bold tracking-tight text-[var(--text-primary)]" title={integration.storeUrl}>
                            {integration.storeUrl}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span className={cn(
                                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold',
                                !integration.active
                                    ? 'bg-gray-100 text-gray-600'
                                    : syncPausedByPlan
                                        ? 'bg-amber-100 text-amber-800'
                                    : isPluginConfigured
                                        ? 'bg-green-50 text-green-700'
                                        : 'bg-yellow-50 text-yellow-700',
                            )}>
                                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                {statusLabel}
                            </span>
                            {isPluginConfigured && (
                                <span suppressHydrationWarning className="text-xs tabular-nums text-[var(--text-muted)]">
                                    {fa ? `${integration._count.orders.toLocaleString('fa-IR')} سفارش` : `${integration._count.orders.toLocaleString('en-US')} orders`}
                                    {integration.lastSyncAt ? (fa ? ` · آخرین همگام‌سازی ${relativeTime(integration.lastSyncAt, fa)}` : ` · last synced ${relativeTime(integration.lastSyncAt, fa)}`) : ''}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={onSync}
                        disabled={syncing || !integration.active || !isPluginConfigured}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--text-primary)] px-3 text-xs font-bold text-[var(--bg-base)] shadow-[var(--shadow-control)] transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                        {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        {fa ? 'بروزرسانی' : 'Sync now'}
                    </button>
                    <button
                        type="button"
                        onClick={onToggle}
                        disabled={toggling}
                        aria-busy={toggling || undefined}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-50"
                    >
                        {toggling && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {integration.active ? (fa ? 'غیرفعال کردن' : 'Disable') : (fa ? 'فعال کردن' : 'Enable')}
                    </button>
                    <button
                        type="button"
                        onClick={onDelete}
                        disabled={deleting}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-danger/30 hover:bg-danger/5 hover:text-danger disabled:opacity-50"
                    >
                        {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        {fa ? 'حذف' : 'Delete'}
                    </button>
                </div>
            </div>

            {/* Pending state — the install guide, with the plugin download */}
            {!isPluginConfigured && integration.active && (
                <WooPluginSetup storeUrl={integration.storeUrl} className="mt-4" />
            )}

            {/* Nothing to manage until the plugin has delivered its first data. */}
            {isPluginConfigured && (
                <nav
                    aria-label={fa ? 'مدیریت اطلاعات فروشگاه' : 'Manage store data'}
                    className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-4"
                >
                    <Link
                        href="/products"
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-default)] px-3.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
                    >
                        <Package className="h-4 w-4" />
                        {fa ? 'مشاهده محصولات' : 'View products'}
                    </Link>
                    <Link
                        href="/products/orders"
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-default)] px-3.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
                    >
                        <ShoppingBag className="h-4 w-4" />
                        {fa ? 'مشاهده سفارش‌ها' : 'View orders'}
                    </Link>
                    {storeAccessHref && (
                        <Link
                            href={storeAccessHref}
                            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-default)] px-3.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
                        >
                            <ShieldCheck className="h-4 w-4" />
                            {fa ? 'دسترسی ایجنت به فروشگاه' : 'Agent store access'}
                        </Link>
                    )}
                </nav>
            )}

            {/* Recent sync activity — last 3 days. Deliveries that changed
                nothing (plugin pings, unchanged items) are noise and hidden. */}
            {isPluginConfigured && visibleLogs.length > 0 && (
                <div className="mt-4">
                    <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">
                        {fa ? 'تغییرات دریافت‌شده از سایت' : 'Changes received from the site'}
                        <span className="ms-2 text-[var(--text-muted)]">{fa ? '· ۳ روز اخیر' : '· last 3 days'}</span>
                    </p>
                    <div className="max-h-64 space-y-1 overflow-y-auto">
                        {visibleLogs.map((log) => (
                            <div key={log.id} className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs">
                                {log.outcome === 'ok' ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
                                ) : (
                                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                                )}
                                <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">{logLabel(log, fa)}</span>
                                <time suppressHydrationWarning dateTime={log.createdAt} className="shrink-0 tabular-nums text-[var(--text-muted)]">{relativeTime(log.createdAt, fa)}</time>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Error */}
            {integration.lastSyncStatus === 'error' && integration.lastSyncError && !hasPlanLimitError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs leading-relaxed text-red-700">
                    <strong>{fa ? 'خطا:' : 'Error:'}</strong> {integration.lastSyncError}
                </div>
            )}
        </section>
    )
}

function logLabel(log: SyncLogEntry, fa: boolean): string {
    const count = log.count.toLocaleString(fa ? 'fa-IR' : 'en-US')
    const entity = entityLabel(log.entity, fa)
    if (log.outcome !== 'ok') {
        if (log.entity === 'batch') return fa ? 'دریافت تغییرات از سایت ناموفق بود' : 'Receiving changes from the site failed'
        return fa ? `همگام‌سازی ${entity} ناموفق بود` : `Syncing ${entity} failed`
    }
    if (log.entity === 'batch') return fa ? `${count} تغییر از سایت اعمال شد` : `${count} changes from the site applied`
    return fa ? `${count} ${entity} همگام شد` : `${count} ${entity} synced`
}

function relativeTime(iso: string, fa: boolean): string {
    const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
    if (minutes < 1) return fa ? 'همین حالا' : 'just now'
    if (minutes < 60) return fa ? `${minutes.toLocaleString('fa-IR')} دقیقه پیش` : `${minutes} min ago`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return fa ? `${hours.toLocaleString('fa-IR')} ساعت پیش` : `${hours} h ago`
    const days = Math.round(hours / 24)
    return fa ? `${days.toLocaleString('fa-IR')} روز پیش` : `${days} d ago`
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
