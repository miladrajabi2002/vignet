'use client'

import { useLocale } from 'next-intl'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    Plus,
    Loader2,
    RefreshCw,
    Trash2,
    CheckCircle2,
    AlertCircle,
    X,
    Globe,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatLocalizedDateTime } from '@/lib/localized-date'
import { formatWooSyncResult } from '@/components/integrations/format-sync-result'
import type { PlanLimitInfo } from '@/components/billing/plan-limit-notice'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
    WooPluginDownloadLink,
    WooPluginSetup,
    normalizeStoreUrlInput,
    wooCreateErrorMessage,
} from '@/components/integrations/woo-plugin-setup'

/**
 * Vigent connection card — uses the same `spatial-surface` design language
 * as the rest of the dashboard (matches DashboardPanel / PageHeader).
 *
 * Flow:
 *  1. User enters site URL → Vigent auto-creates webhook URL + secret
 *  2. User downloads & installs plugin in WordPress
 *  3. User clicks "اتصال" in the plugin → plugin auto-fetches credentials
 *  4. This card polls /api/integrations every few seconds → auto-shows "متصل"
 *
 * No manual copy-paste of webhook URL/secret. No "check plugin" button.
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

export interface WooIntegrationState {
    id: string
    storeUrl: string
    webhookSecret: string | null
    pollIntervalMinutes: number
    active: boolean
    connectedAt: string | null
    lastWebhookAt: string | null
    lastSyncAt: string | null
    lastSyncStatus: string | null
    lastSyncError: string | null
    hasCredentials: boolean
    _count: { orders: number; syncLogs: number }
    syncLogs: SyncLogEntry[]
}

export function WooSetupCard({
    integration: initial,
    productLimit = null,
}: {
    integration: WooIntegrationState | null
    productLimit?: PlanLimitInfo | null
}) {
    const fa = useLocale() !== 'en'
    const router = useRouter()
    const [integration, setIntegration] = useState(initial)
    const [showForm, setShowForm] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [toggling, setToggling] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [storeUrl, setStoreUrl] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)
    const [notice, setNotice] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

    // ── Auto-poll for state changes (every 4s when not connected) ──
    useEffect(() => {
        setIntegration(initial)

        if (!initial || !isWooConnected(initial)) {
            const interval = setInterval(() => {
                fetch('/api/integrations', { cache: 'no-store' })
                    .then((r) => r.json())
                    .then((data) => {
                        if (data.integrations && data.integrations.length > 0) {
                            const woo = data.integrations.find((i: { type: string }) => i.type === 'WOOCOMMERCE')
                            if (woo) {
                                const mapped: WooIntegrationState = {
                                    id: woo.id,
                                    storeUrl: woo.storeUrl,
                                    webhookSecret: woo.webhookSecret,
                                    pollIntervalMinutes: woo.pollIntervalMinutes,
                                    active: woo.active,
                                    connectedAt: woo.connectedAt,
                                    lastWebhookAt: woo.lastWebhookAt,
                                    lastSyncAt: woo.lastSyncAt,
                                    lastSyncStatus: woo.lastSyncStatus,
                                    lastSyncError: woo.lastSyncError,
                                    hasCredentials: woo.credentials && Object.keys(woo.credentials).length > 0,
                                    _count: woo._count || { orders: 0, syncLogs: 0 },
                                    syncLogs: woo.syncLogs || [],
                                }
                                setIntegration(mapped)
                                if (isWooConnected(mapped) && (!initial || !isWooConnected(initial))) {
                                    router.refresh()
                                }
                            }
                        }
                    })
                    .catch(() => {})
            }, 4000)
            return () => clearInterval(interval)
        }
    }, [initial, router])

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        if (submitting) return
        const url = normalizeStoreUrlInput(storeUrl)
        if (!url) {
            setFormError(fa ? 'آدرس سایت را وارد کنید.' : 'Enter your site address.')
            return
        }
        setFormError(null)
        setSubmitting(true)
        try {
            const res = await fetch('/api/integrations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'WOOCOMMERCE',
                    storeUrl: url,
                    credentials: {},
                }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setFormError(wooCreateErrorMessage(data.error, fa))
                return
            }
            setShowForm(false)
            setStoreUrl('')
            router.refresh()
        } catch {
            setFormError((fa ? 'خطا در ارتباط با سرور.' : 'Could not reach the server.'))
        } finally {
            setSubmitting(false)
        }
    }

    async function syncNow() {
        if (!integration) return
        setSyncing(true)
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
            setSyncing(false)
        }
    }

    async function toggleActive() {
        if (!integration || toggling) return
        const nextActive = !integration.active
        setToggling(true)
        setNotice(null)
        try {
            const res = await fetch(`/api/integrations/${integration.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: nextActive }),
            })
            if (!res.ok) throw new Error('toggle failed')
            setIntegration({ ...integration, active: nextActive })
            router.refresh()
        } catch {
            setNotice({
                type: 'err',
                msg: nextActive
                    ? (fa ? 'فعال‌سازی اتصال انجام نشد؛ دوباره تلاش کنید.' : 'The connection could not be enabled. Try again.')
                    : (fa ? 'غیرفعال‌سازی اتصال انجام نشد؛ دوباره تلاش کنید.' : 'The connection could not be disabled. Try again.'),
            })
        } finally {
            setToggling(false)
        }
    }

    async function remove() {
        if (!integration) return
        setDeleting(true)
        try {
            const res = await fetch(`/api/integrations/${integration.id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('delete failed')
            router.refresh()
        } catch {
            setNotice({ type: 'err', msg: (fa ? 'حذف اتصال انجام نشد؛ دوباره تلاش کنید.' : 'The connection could not be deleted. Try again.') })
        } finally {
            setConfirmDelete(false)
            setDeleting(false)
        }
    }

    // ── Not connected yet ────────────────────────────────────────────────
    if (!integration) {
        return (
            <section className="spatial-surface overflow-hidden rounded-card p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--text-primary)] text-[var(--bg-base)] shadow-[var(--shadow-control)]">
                            <Globe className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                            <h2 className="text-base font-bold tracking-tight text-[var(--text-primary)]">
                                {fa ? 'سایت وردپرسی یا ووکامرسی خود را وصل کنید' : 'Connect your WordPress or WooCommerce site'}
                            </h2>
                            <p className="mt-1 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)]">
                                {fa ? 'آدرس سایت را وارد کنید و افزونه ویجنت را در وردپرس نصب کنید؛ محصولات و سفارش‌ها خودکار همگام می‌شوند.' : 'Enter your site address and install the Vigent plugin in WordPress. Products and orders then sync automatically.'}
                            </p>
                        </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
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
                </div>

                {showForm && (
                    <form onSubmit={submit} noValidate className="mt-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-[var(--text-primary)]">{fa ? 'آدرس سایت را وارد کنید' : 'Enter your site address'}</h3>
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
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
                                aria-invalid={formError ? true : undefined}
                                value={storeUrl}
                                onChange={(e) => { setStoreUrl(e.target.value); if (formError) setFormError(null) }}
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
                        {formError && <p role="alert" className="mt-2 text-xs text-danger">{formError}</p>}
                        <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
                            {fa ? 'پس از ایجاد اتصال، دکمه دانلود افزونه و مراحل نصب همین‌جا نمایش داده می‌شود.' : 'After the connection is created, the plugin download button and the install steps appear right here.'}
                        </p>
                    </form>
                )}
            </section>
        )
    }

    // ── Connected ────────────────────────────────────────────────────────
    const hasPlanLimitError = isResourceLimitError(integration.lastSyncError)
    // A limit error can only be recorded after an authenticated webhook was
    // received. Treat it as proof of connection instead of telling the user
    // to reinstall an already working plugin.
    const isPluginConfigured = isWooConnected(integration) || hasPlanLimitError
    const syncPausedByPlan = hasPlanLimitError && productLimit !== null
    const statusLabel = !integration.active
        ? (fa ? 'غیرفعال' : 'Disabled')
        : syncPausedByPlan
            ? (fa ? 'متصل · محدودیت پلن' : 'Connected · plan limit')
        : isPluginConfigured
            ? (fa ? 'متصل' : 'Connected')
            : (fa ? 'در انتظار اتصال افزونه' : 'Waiting for the plugin')

    return (
        <section className="spatial-surface overflow-hidden rounded-card p-5 sm:p-6">
            {/* Top row: URL + status + actions */}
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
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-amber-50 text-amber-700',
                            )}>
                                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                {statusLabel}
                            </span>
                            {isPluginConfigured && (
                                <span className="text-xs text-[var(--text-muted)]">
                                    {fa ? `${integration._count.orders.toLocaleString('fa-IR')} سفارش` : `${integration._count.orders} orders`}
                                    {integration.lastSyncAt ? ` · ${formatDate(integration.lastSyncAt, fa ? 'fa' : 'en')}` : ''}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={syncNow}
                        disabled={syncing || !integration.active || !isPluginConfigured}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--text-primary)] px-3 text-xs font-bold text-[var(--bg-base)] shadow-[var(--shadow-control)] transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                        {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        {fa ? 'بروزرسانی' : 'Sync now'}
                    </button>
                    <button
                        type="button"
                        onClick={toggleActive}
                        disabled={toggling}
                        aria-busy={toggling || undefined}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-50"
                    >
                        {toggling && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {integration.active ? (fa ? 'غیرفعال کردن' : 'Disable') : (fa ? 'فعال کردن' : 'Enable')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        disabled={deleting}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-danger/30 hover:bg-danger/5 hover:text-danger disabled:opacity-50"
                    >
                        {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        {fa ? 'حذف' : 'Delete'}
                    </button>
                </div>
            </div>

            {/* Notice */}
            {notice && (
                <div
                    role={notice.type === 'err' ? 'alert' : 'status'}
                    aria-live="polite"
                    className={cn(
                    'mt-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm',
                    notice.type === 'ok' ? 'border border-[color:color-mix(in_srgb,var(--ok)_25%,transparent)] bg-[var(--ok-soft)] text-[var(--ok)]' : 'border border-danger/30 bg-danger/5 text-danger',
                )}>
                    {notice.type === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    {notice.msg}
                </div>
            )}

            {/* Pending state — the install guide, with the plugin download */}
            {!isPluginConfigured && integration.active && (
                <WooPluginSetup storeUrl={integration.storeUrl} className="mt-4" />
            )}

            {/* Error */}
            {integration.lastSyncStatus === 'error' && integration.lastSyncError && !hasPlanLimitError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs leading-relaxed text-red-700">
                    <strong>{fa ? 'خطای هم‌گام‌سازی:' : 'Sync error:'}</strong> {integration.lastSyncError}
                </div>
            )}

            <ConfirmDialog
                open={confirmDelete}
                title={fa ? 'حذف اتصال سایت' : 'Delete site connection'}
                description={fa ? `اتصال به ${integration.storeUrl} حذف می‌شود؛ سفارش‌ها و تنظیمات هم‌گام‌سازی آن از پنل خارج می‌شوند.` : `The connection to ${integration.storeUrl} will be deleted; its orders and sync settings leave the panel.`}
                confirmLabel={fa ? 'حذف اتصال' : 'Delete connection'}
                tone="danger"
                busy={deleting}
                onConfirm={remove}
                onClose={() => { if (!deleting) setConfirmDelete(false) }}
            />
        </section>
    )
}

function formatDate(iso: string, locale: 'fa' | 'en'): string {
    try {
        return formatLocalizedDateTime(iso, locale)
    } catch {
        return iso
    }
}

function isWooConnected(integration: WooIntegrationState): boolean {
    return Boolean(
        integration.connectedAt ||
        integration.lastWebhookAt ||
        integration.lastSyncAt,
    )
}

function isResourceLimitError(error: string | null): boolean {
    return Boolean(error && /(?:PRODUCT|ORDER|CUSTOMER)_LIMIT(?::\d+)?/.test(error))
}
