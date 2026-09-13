'use client'

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
    Package,
    ShoppingBag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatWooSyncResult } from '@/components/integrations/format-sync-result'
import { PlanLimitNotice, type PlanLimitInfo } from '@/components/billing/plan-limit-notice'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

/**
 * Integrations page — "WordPress/WooCommerce" section.
 * Uses the same `spatial-surface rounded-[1.5rem]` design as the Products page.
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
    locale = 'fa',
}: {
    integrations: StoreIntegrationItem[]
    planLimits?: PlanLimitInfo[]
    locale?: 'fa' | 'en'
}) {
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

    async function submit(storeUrl: string, onDone: () => void) {
        const res = await fetch('/api/integrations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'WOOCOMMERCE', storeUrl, credentials: {} }),
        })
        if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            setNotice({ type: 'err', msg: data.error === 'INVALID' ? 'آدرس نامعتبر است.' : 'خطا در ایجاد اتصال.' })
            return
        }
        onDone()
        router.refresh()
    }

    async function syncNow(integration: StoreIntegrationItem) {
        setSyncingId(integration.id)
        setNotice(null)
        try {
            const res = await fetch(`/api/sync/woocommerce?integrationId=${integration.id}`, { method: 'POST' })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setNotice({ type: 'err', msg: 'خطا در هم‌گام‌سازی.' })
                return
            }

            setNotice(formatWooSyncResult(data))
            router.refresh()
        } catch {
            setNotice({ type: 'err', msg: 'خطا در ارتباط با سرور.' })
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
                    ? 'فعال‌سازی اتصال انجام نشد؛ دوباره تلاش کنید.'
                    : 'غیرفعال‌سازی اتصال انجام نشد؛ دوباره تلاش کنید.',
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
            setNotice({ type: 'err', msg: 'حذف اتصال انجام نشد؛ دوباره تلاش کنید.' })
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <div id="online-store" className="scroll-mt-24 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--text-secondary)]">سایت (وردپرس/ووکامرس)</h2>
                {integrations.length > 0 && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        افزودن سایت
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
                    notice.type === 'ok' ? 'border border-[var(--green)]/30 bg-[var(--green)]/5 text-[var(--green)]' : 'border border-danger/30 bg-danger/5 text-danger',
                )}>
                    {notice.type === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    {notice.msg}
                </div>
            )}

            {planLimits.map((limit) => (
                <PlanLimitNotice
                    key={limit.resource}
                    limit={limit}
                    locale={locale}
                    syncContext
                    compact
                />
            ))}

            {/* Form */}
            {showForm && (
                <AddSiteForm
                    onDone={() => { setShowForm(false); router.refresh() }}
                    onSubmit={submit}
                />
            )}

            {/* Empty state */}
            {integrations.length === 0 && !showForm && (
                <section className="spatial-surface overflow-hidden rounded-[1.5rem] p-5 sm:p-6 text-center">
                    <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-[var(--text-primary)] text-[var(--bg-base)] shadow-[var(--shadow-control)]">
                        <Globe className="h-5 w-5" />
                    </span>
                    <h3 className="mt-4 text-base font-bold tracking-tight text-[var(--text-primary)]">سایت خود را وصل کنید</h3>
                    <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-[var(--text-secondary)]">
                        فقط آدرس سایت را وارد کنید — محصولات و سفارش‌ها خودکار همگام می‌شوند.
                    </p>
                    <button
                        onClick={() => setShowForm(true)}
                        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-sm font-bold text-[var(--bg-base)] shadow-[var(--shadow-control)] transition-opacity hover:opacity-90"
                    >
                        <Plus className="h-4 w-4" />
                        اتصال سایت
                    </button>
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
                />
            ))}

            {/* Footer help */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4">
                <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-[var(--text-muted)]">
                        افزونه را در وردپرس نصب و دکمه «اتصال» را بزنید — همه چیز خودکار است.
                    </p>
                    <Link
                        href="/docs/woocommerce"
                        className="shrink-0 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                        راهنما
                    </Link>
                </div>
            </div>

            {/* Branded confirm for removing a store connection (replaces the
                native confirm(): focus trap, Esc, scroll lock, focus return). */}
            <ConfirmDialog
                open={deleteTarget !== null}
                title="حذف اتصال سایت"
                description={
                    deleteTarget
                        ? `اتصال به ${deleteTarget.storeUrl} حذف می‌شود؛ سفارش‌ها و تنظیمات هم‌گام‌سازی آن از پنل خارج می‌شوند.`
                        : undefined
                }
                confirmLabel="حذف اتصال"
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
    onDone,
    onSubmit,
}: {
    onDone: () => void
    onSubmit: (url: string, onDone: () => void) => Promise<void>
}) {
    const [storeUrl, setStoreUrl] = useState('')
    const [submitting, setSubmitting] = useState(false)

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        setSubmitting(true)
        await onSubmit(storeUrl.trim(), onDone)
        setSubmitting(false)
    }

    return (
        <form onSubmit={submit} className="spatial-surface rounded-[1.5rem] p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">آدرس سایت را وارد کنید</h3>
                <button type="button" onClick={onDone} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                    <X className="h-4 w-4" />
                </button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
                <input
                    dir="ltr"
                    type="url"
                    required
                    value={storeUrl}
                    onChange={(e) => setStoreUrl(e.target.value)}
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
                    {submitting ? 'در حال ایجاد…' : 'ایجاد اتصال'}
                </button>
            </div>
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
}: {
    integration: StoreIntegrationItem
    syncing: boolean
    deleting: boolean
    toggling: boolean
    onSync: () => void
    onToggle: () => void
    onDelete: () => void
    planLimits: PlanLimitInfo[]
}) {
    const limitFromError = planLimitFromError(integration.lastSyncError, planLimits)
    const hasPlanLimitError = isResourceLimitError(integration.lastSyncError)
    const isPluginConfigured = isIntegrationConnected(integration) || hasPlanLimitError
    const syncPausedByPlan = limitFromError !== null
    const statusLabel = !integration.active
        ? 'غیرفعال'
        : syncPausedByPlan
            ? 'متصل · محدودیت پلن'
        : isPluginConfigured
            ? 'متصل'
            : 'در انتظار اتصال افزونه'

    return (
        <section className="spatial-surface overflow-hidden rounded-[1.5rem] p-5 sm:p-6">
            {/* Top row */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <span className={cn(
                        'grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[var(--bg-base)] shadow-[var(--shadow-control)]',
                        syncPausedByPlan ? 'bg-amber-500' : isPluginConfigured ? 'bg-green-600' : 'bg-[var(--text-primary)]',
                    )}>
                        {isPluginConfigured ? <CheckCircle2 className="h-5 w-5" /> : <Globe className="h-5 w-5" />}
                    </span>
                    <div className="min-w-0">
                        <p dir="ltr" className="truncate text-base font-bold tracking-tight text-[var(--text-primary)]" title={integration.storeUrl}>
                            {integration.storeUrl}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span className={cn(
                                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
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
                                <span className="text-xs tabular-nums text-[var(--text-muted)]">
                                    {integration._count.orders.toLocaleString('fa-IR')} سفارش · {integration._count.syncLogs.toLocaleString('fa-IR')} رویداد اخیر
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
                        بروزرسانی
                    </button>
                    <button
                        type="button"
                        onClick={onToggle}
                        disabled={toggling}
                        aria-busy={toggling || undefined}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-50"
                    >
                        {toggling && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {integration.active ? 'غیرفعال' : 'فعال'}
                    </button>
                    <button
                        type="button"
                        onClick={onDelete}
                        disabled={deleting}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-danger/30 hover:bg-danger/5 hover:text-danger disabled:opacity-50"
                    >
                        {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        حذف
                    </button>
                </div>
            </div>

            <nav
                aria-label="مدیریت اطلاعات فروشگاه"
                className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-4"
            >
                <Link
                    href="/products"
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-default)] px-3.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
                >
                    <Package className="h-4 w-4" />
                    مشاهده محصولات
                </Link>
                <Link
                    href="/products/orders"
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-default)] px-3.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
                >
                    <ShoppingBag className="h-4 w-4" />
                    مشاهده سفارش‌ها
                </Link>
            </nav>

            {/* Pending state */}
            {!isPluginConfigured && integration.active && (
                <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
                    <p className="text-sm font-semibold text-yellow-800">در انتظار اتصال افزونه</p>
                    <p className="mt-1 text-xs leading-relaxed text-yellow-700">
                        افزونه را در وردپرس نصب و دکمه «اتصال» را بزنید — پس از اتصال، وضعیت خودکار به‌روز می‌شود.
                    </p>
                </div>
            )}

            {/* Recent logs — last 3 days */}
            {isPluginConfigured && integration.syncLogs.length > 0 && (
                <div className="mt-4">
                    <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">
                        رویدادهای اخیر (۳ روز)
                        <span className="mr-2 text-[var(--text-muted)]">— {integration.syncLogs.length} رویداد</span>
                    </p>
                    <div className="max-h-64 space-y-1 overflow-y-auto">
                        {integration.syncLogs.map((log) => (
                            <div key={log.id} className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs">
                                {log.outcome === 'ok' ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
                                ) : (
                                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                                )}
                                <span className="text-[var(--text-secondary)]">{entityLabel(log.entity)}</span>
                                <span className="text-[var(--text-muted)]">·</span>
                                <span className="text-[var(--text-muted)]">{log.count} مورد</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Error */}
            {integration.lastSyncStatus === 'error' && integration.lastSyncError && !hasPlanLimitError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs leading-relaxed text-red-700">
                    <strong>خطا:</strong> {integration.lastSyncError}
                </div>
            )}
        </section>
    )
}

function entityLabel(entity: string): string {
    const map: Record<string, string> = {
        products: 'محصولات',
        orders: 'سفارش‌ها',
        product_update: 'محصول',
        order_update: 'سفارش',
        content_update: 'محتوا',
    }
    return map[entity] ?? entity
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
