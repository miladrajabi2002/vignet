'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    Plus,
    Loader2,
    RefreshCw,
    Trash2,
    Check,
    Download,
    AlertCircle,
    CheckCircle2,
    X,
    Globe,
    Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatLocalizedDateTime } from '@/lib/localized-date'

/**
 * Vigent connection card — minimal & elegant.
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
    lastSyncAt: string | null
    lastSyncStatus: string | null
    lastSyncError: string | null
    hasCredentials: boolean
    _count: { orders: number; syncLogs: number }
    syncLogs: SyncLogEntry[]
}

export function WooSetupCard({
    integration: initial,
}: {
    integration: WooIntegrationState | null
}) {
    const router = useRouter()
    const [integration, setIntegration] = useState(initial)
    const [showForm, setShowForm] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [storeUrl, setStoreUrl] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)
    const [notice, setNotice] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

    // ── Auto-poll for state changes (every 4s when not connected) ──
    useEffect(() => {
        // Always update local state when the server prop changes.
        setIntegration(initial)

        // If not yet connected (no sync logs), poll more aggressively so the
        // "connected" state appears without a manual refresh once the plugin
        // sends its first event.
        if (!initial || initial._count.syncLogs === 0) {
            const interval = setInterval(() => {
                fetch('/api/integrations', { cache: 'no-store' })
                    .then((r) => r.json())
                    .then((data) => {
                        if (data.integrations && data.integrations.length > 0) {
                            const woo = data.integrations.find((i: { type: string }) => i.type === 'WOOCOMMERCE')
                            if (woo) {
                                // Map API shape → component shape.
                                const mapped: WooIntegrationState = {
                                    id: woo.id,
                                    storeUrl: woo.storeUrl,
                                    webhookSecret: woo.webhookSecret,
                                    pollIntervalMinutes: woo.pollIntervalMinutes,
                                    active: woo.active,
                                    lastSyncAt: woo.lastSyncAt,
                                    lastSyncStatus: woo.lastSyncStatus,
                                    lastSyncError: woo.lastSyncError,
                                    hasCredentials: woo.credentials && Object.keys(woo.credentials).length > 0,
                                    _count: woo._count || { orders: 0, syncLogs: 0 },
                                    syncLogs: woo.syncLogs || [],
                                }
                                setIntegration(mapped)
                                // If we just transitioned to connected, refresh router for full data.
                                if (mapped._count.syncLogs > 0 && (!initial || initial._count.syncLogs === 0)) {
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
        setFormError(null)
        setSubmitting(true)
        try {
            const res = await fetch('/api/integrations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'WOOCOMMERCE',
                    storeUrl: storeUrl.trim(),
                    credentials: {},
                }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setFormError(
                    data.error === 'INVALID'
                        ? 'آدرس سایت نامعتبر است.'
                        : data.error === 'UNSAFE_STORE_URL'
                            ? 'آدرس سایت به دلایل امنیتی قابل قبول نیست.'
                            : 'خطا در ساخت اتصال.',
                )
                return
            }
            setShowForm(false)
            setStoreUrl('')
            router.refresh()
        } catch {
            setFormError('خطا در ارتباط با سرور.')
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
            setSyncing(false)
        }
    }

    async function toggleActive() {
        if (!integration) return
        await fetch(`/api/integrations/${integration.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: !integration.active }),
        })
        router.refresh()
    }

    async function remove() {
        if (!integration) return
        if (!confirm('این اتصال حذف شود؟')) return
        await fetch(`/api/integrations/${integration.id}`, { method: 'DELETE' })
        router.refresh()
    }

    // ── Not connected yet ────────────────────────────────────────────────
    if (!integration) {
        return (
            <section className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black text-white">
                            <Globe className="h-5 w-5" />
                        </span>
                        <div>
                            <h2 className="text-sm font-bold text-[var(--text-primary)]">
                                سایت وردپرسی یا ووکامرسی خود را وصل کنید
                            </h2>
                            <p className="mt-1 max-w-md text-xs leading-5 text-[var(--text-secondary)]">
                                محصولات و سفارش‌ها به‌صورت خودکار با ویجنت همگام می‌شوند. فقط آدرس سایت را وارد کنید.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowForm(true)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-black px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        اتصال سایت
                    </button>
                </div>

                {showForm && (
                    <form onSubmit={submit} className="mt-5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-5">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-[var(--text-primary)]">آدرس سایت را وارد کنید</h3>
                            <button type="button" onClick={() => setShowForm(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
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
                        {formError && <p className="mt-2 text-xs text-danger">{formError}</p>}
                        <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                            پس از ایجاد اتصال، افزونه وردپرس را نصب کنید و دکمه «اتصال» را در آن بزنید — همه چیز خودکار است.
                        </p>
                    </form>
                )}
            </section>
        )
    }

    // ── Connected ────────────────────────────────────────────────────────
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
        <section className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 sm:p-6">
            {/* Top row: URL + status + actions */}
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
                                    {integration.lastSyncAt ? ` · ${formatDate(integration.lastSyncAt)}` : ''}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                    <button
                        type="button"
                        onClick={syncNow}
                        disabled={syncing || !integration.active || !isPluginConfigured}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                        {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        بروزرسانی
                    </button>
                    <button
                        type="button"
                        onClick={toggleActive}
                        className="rounded-lg border border-[var(--border-default)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                    >
                        {integration.active ? 'غیرفعال' : 'فعال'}
                    </button>
                    <button
                        type="button"
                        onClick={remove}
                        className="rounded-lg border border-[var(--border-default)] p-1.5 text-[var(--text-muted)] transition-colors hover:text-danger"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* Notice */}
            {notice && (
                <div className={cn(
                    'mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
                    notice.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
                )}>
                    {notice.type === 'ok' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                    {notice.msg}
                </div>
            )}

            {/* Pending state — guide user to install plugin */}
            {!isPluginConfigured && integration.active && (
                <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                    <div className="flex items-start gap-3">
                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
                        <div className="flex-1">
                            <p className="text-xs font-semibold text-yellow-800">در انتظار اتصال افزونه</p>
                            <p className="mt-1 text-[11px] leading-5 text-yellow-700">
                                افزونه را در وردپرس نصب کنید و دکمه «اتصال» را در آن بزنید. پس از اتصال، اینجا خودکار به‌روز می‌شود.
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <a
                                    href="/api/downloads/wordpress-plugin"
                                    download
                                    className="inline-flex items-center gap-1 rounded-md bg-yellow-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-yellow-700"
                                >
                                    <Download className="h-3 w-3" />
                                    دانلود افزونه
                                </a>
                                <Link
                                    href="/docs/woocommerce"
                                    className="inline-flex items-center gap-1 rounded-md border border-yellow-300 px-2.5 py-1 text-[11px] font-medium text-yellow-800 transition-colors hover:bg-yellow-100"
                                >
                                    راهنما
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Connected — show recent events */}
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
                                <span className="ml-auto text-[var(--text-muted)]">{formatDate(log.createdAt)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Error */}
            {integration.lastSyncStatus === 'error' && integration.lastSyncError && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] leading-5 text-red-700">
                    <strong>خطای هم‌گام‌سازی:</strong> {integration.lastSyncError}
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

function formatDate(iso: string): string {
    try {
        return formatLocalizedDateTime(iso, 'fa')
    } catch {
        return iso
    }
}
