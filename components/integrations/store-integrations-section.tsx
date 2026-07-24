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
    Download,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Integrations page — "WordPress/WooCommerce" section.
 * Same minimal design as the Products page card.
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
    lastSyncAt: string | null
    lastSyncStatus: string | null
    lastSyncError: string | null
    _count: { orders: number; syncLogs: number }
    syncLogs: SyncLogEntry[]
}

export function StoreIntegrationsSection({
    integrations: initial,
}: {
    integrations: StoreIntegrationItem[]
}) {
    const router = useRouter()
    const [integrations, setIntegrations] = useState(initial)
    const [showForm, setShowForm] = useState(false)
    const [syncingId, setSyncingId] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [notice, setNotice] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

    // Auto-poll when not connected.
    useEffect(() => {
        setIntegrations(initial)
        const hasUnconnected = initial.some((i) => i._count.syncLogs === 0)
        if (hasUnconnected || initial.length === 0) {
            const interval = setInterval(() => {
                fetch('/api/integrations', { cache: 'no-store' })
                    .then((r) => r.json())
                    .then((data) => {
                        if (data.integrations) {
                            const woo = data.integrations.filter((i: { type: string }) => i.type === 'WOOCOMMERCE')
                            // Map and set.
                            const mapped = woo.map((i: StoreIntegrationItem & { credentials?: Record<string, unknown> }) => ({
                                id: i.id,
                                type: i.type,
                                storeUrl: i.storeUrl,
                                webhookSecret: i.webhookSecret,
                                pollIntervalMinutes: i.pollIntervalMinutes,
                                active: i.active,
                                lastSyncAt: i.lastSyncAt,
                                lastSyncStatus: i.lastSyncStatus,
                                lastSyncError: i.lastSyncError,
                                _count: i._count,
                                syncLogs: i.syncLogs,
                            }))
                            setIntegrations(mapped)
                            // If any just became connected, refresh for full data.
                            const justConnected = mapped.some((i: StoreIntegrationItem) => i._count.syncLogs > 0)
                            const wasUnconnected = initial.some((i) => i._count.syncLogs === 0)
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
            const pcount = data.products?.count ?? 0
            const ocount = data.orders?.count ?? 0
            setNotice({ type: 'ok', msg: `${pcount} محصول و ${ocount} سفارش هم‌گام شد.` })
            router.refresh()
        } catch {
            setNotice({ type: 'err', msg: 'خطا در ارتباط با سرور.' })
        } finally {
            setSyncingId(null)
        }
    }

    async function toggleActive(integration: StoreIntegrationItem) {
        await fetch(`/api/integrations/${integration.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: !integration.active }),
        })
        router.refresh()
    }

    async function remove(integration: StoreIntegrationItem) {
        if (!confirm('این اتصال حذف شود؟')) return
        setDeletingId(integration.id)
        try {
            await fetch(`/api/integrations/${integration.id}`, { method: 'DELETE' })
            router.refresh()
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <div id="online-store" className="scroll-mt-24 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">سایت (وردپرس/ووکامرس)</h2>
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
                <div className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
                    notice.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
                )}>
                    {notice.type === 'ok' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                    {notice.msg}
                </div>
            )}

            {/* Form */}
            {showForm && (
                <AddSiteForm
                    onDone={() => { setShowForm(false); router.refresh() }}
                    onSubmit={submit}
                />
            )}

            {/* Empty state */}
            {integrations.length === 0 && !showForm && (
                <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-6 text-center">
                    <Globe className="mx-auto mb-3 h-7 w-7 text-[var(--text-muted)]" />
                    <p className="text-sm font-medium text-[var(--text-primary)]">سایت خود را وصل کنید</p>
                    <p className="mx-auto mt-1 max-w-sm text-xs text-[var(--text-secondary)]">
                        فقط آدرس سایت را وارد کنید — محصولات و سفارش‌ها خودکار همگام می‌شوند.
                    </p>
                    <button
                        onClick={() => setShowForm(true)}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-black px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        اتصال سایت
                    </button>
                </div>
            )}

            {/* Integration cards */}
            {integrations.map((integration) => (
                <IntegrationCard
                    key={integration.id}
                    integration={integration}
                    syncing={syncingId === integration.id}
                    deleting={deletingId === integration.id}
                    onSync={() => syncNow(integration)}
                    onToggle={() => toggleActive(integration)}
                    onDelete={() => remove(integration)}
                />
            ))}

            {/* Footer help */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
                <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] text-[var(--text-muted)]">
                        افزونه را در وردپرس نصب و دکمه «اتصال» را بزنید — همه چیز خودکار است.
                    </p>
                    <Link
                        href="/docs/woocommerce"
                        className="shrink-0 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                        راهنما
                    </Link>
                </div>
            </div>
        </div>
    )
}

// ─── Add site form (minimal) ─────────────────────────────────────────────

function AddSiteForm({
    onDone,
    onSubmit,
}: {
    onDone: () => void
    onSubmit: (url: string, onDone: () => void) => Promise<void>
}) {
    const [storeUrl, setStoreUrl] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setSubmitting(true)
        await onSubmit(storeUrl.trim(), onDone)
        setSubmitting(false)
    }

    return (
        <form onSubmit={submit} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
            <div className="mb-3 flex items-center justify-between">
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
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-black px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {submitting ? 'در حال ایجاد…' : 'ایجاد اتصال'}
                </button>
            </div>
            {error && <p className="mt-2 text-xs text-danger">{error}</p>}
        </form>
    )
}

// ─── Integration card (same design as WooSetupCard) ──────────────────────

function IntegrationCard({
    integration,
    syncing,
    deleting,
    onSync,
    onToggle,
    onDelete,
}: {
    integration: StoreIntegrationItem
    syncing: boolean
    deleting: boolean
    onSync: () => void
    onToggle: () => void
    onDelete: () => void
}) {
    const isPluginConfigured = integration._count.syncLogs > 0
    const statusLabel = !integration.active
        ? 'غیرفعال'
        : isPluginConfigured
            ? 'متصل'
            : 'در انتظار اتصال افزونه'
    const statusColor = !integration.active
        ? 'bg-gray-100 text-gray-600'
        : isPluginConfigured
            ? 'bg-green-50 text-green-700'
            : 'bg-yellow-50 text-yellow-700'

    return (
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
            {/* Top row */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <span className={cn(
                        'grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white',
                        isPluginConfigured ? 'bg-green-600' : 'bg-black',
                    )}>
                        {isPluginConfigured ? <CheckCircle2 className="h-5 w-5" /> : <Globe className="h-5 w-5" />}
                    </span>
                    <div className="min-w-0">
                        <p dir="ltr" className="truncate text-sm font-bold text-[var(--text-primary)]" title={integration.storeUrl}>
                            {integration.storeUrl}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', statusColor)}>
                                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                {statusLabel}
                            </span>
                            {isPluginConfigured && (
                                <span className="text-[11px] text-[var(--text-muted)]">
                                    {integration._count.orders} سفارش · {integration._count.syncLogs} رویداد
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                    <button
                        type="button"
                        onClick={onSync}
                        disabled={syncing || !integration.active || !isPluginConfigured}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                        {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        بروزرسانی
                    </button>
                    <button
                        type="button"
                        onClick={onToggle}
                        className="rounded-lg border border-[var(--border-default)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                    >
                        {integration.active ? 'غیرفعال' : 'فعال'}
                    </button>
                    <button
                        type="button"
                        onClick={onDelete}
                        disabled={deleting}
                        className="rounded-lg border border-[var(--border-default)] p-1.5 text-[var(--text-muted)] transition-colors hover:text-danger"
                    >
                        {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                </div>
            </div>

            {/* Pending state */}
            {!isPluginConfigured && integration.active && (
                <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 p-3">
                    <p className="text-[11px] font-semibold text-yellow-800">در انتظار اتصال افزونه</p>
                    <p className="mt-1 text-[11px] leading-5 text-yellow-700">
                        افزونه را در وردپرس نصب و دکمه «اتصال» را بزنید.
                    </p>
                    <a
                        href="/api/downloads/wordpress-plugin"
                        download
                        className="mt-2 inline-flex items-center gap-1 rounded-md bg-yellow-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-yellow-700"
                    >
                        <Download className="h-3 w-3" />
                        دانلود افزونه
                    </a>
                </div>
            )}

            {/* Recent logs */}
            {isPluginConfigured && integration.syncLogs.length > 0 && (
                <div className="mt-4">
                    <p className="mb-2 text-[11px] font-medium text-[var(--text-secondary)]">رویدادهای اخیر</p>
                    <div className="space-y-1">
                        {integration.syncLogs.slice(0, 4).map((log) => (
                            <div key={log.id} className="flex items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2.5 py-1.5 text-[11px]">
                                {log.outcome === 'ok' ? (
                                    <CheckCircle2 className="h-3 w-3 shrink-0 text-green-600" />
                                ) : (
                                    <AlertCircle className="h-3 w-3 shrink-0 text-red-500" />
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
            {integration.lastSyncStatus === 'error' && integration.lastSyncError && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] leading-5 text-red-700">
                    <strong>خطا:</strong> {integration.lastSyncError}
                </div>
            )}
        </div>
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
