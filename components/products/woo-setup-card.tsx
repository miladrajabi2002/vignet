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
    Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatLocalizedDateTime } from '@/lib/localized-date'

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
        setIntegration(initial)

        if (!initial || initial._count.syncLogs === 0) {
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
                                    lastSyncAt: woo.lastSyncAt,
                                    lastSyncStatus: woo.lastSyncStatus,
                                    lastSyncError: woo.lastSyncError,
                                    hasCredentials: woo.credentials && Object.keys(woo.credentials).length > 0,
                                    _count: woo._count || { orders: 0, syncLogs: 0 },
                                    syncLogs: woo.syncLogs || [],
                                }
                                setIntegration(mapped)
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

            // Build a useful, context-aware message instead of the old
            // generic "X محصول و Y سفارش هم‌گام شد" which often showed
            // "0 محصول و 0 سفارش" and left the user wondering if anything
            // actually happened. The new message explains what the sync
            // actually did (or didn't do) and why.
            const pcount = data.products?.count ?? 0
            const ocount = data.orders?.count ?? 0
            const pErrors = data.products?.errors?.length ?? 0
            const skipped = data.products?.skipped === true || data.orders?.skipped === true
            const now = new Date()
            const timeStr = now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })

            let msg: string
            if (skipped) {
                // webhook-only mode — no REST credentials configured, so
                // the manual "sync now" couldn't actually pull anything.
                // Webhook push from the plugin still works.
                msg = `بررسی هم‌گام‌سازی در ساعت ${timeStr} انجام شد. این اتصال در حالت webhook-only است — هم‌گام‌سازی کششی فعال نیست، اما افزونه تغییرات محصولات و سفارش‌ها را به‌صورت لحظه‌ای از طریق webhook ارسال می‌کند.`
            } else if (pcount === 0 && ocount === 0 && pErrors === 0) {
                // The server returned 0/0 with no errors. This usually means
                // the store has no published products / recent orders, OR
                // the WooCommerce REST API is reachable but empty.
                msg = `بررسی در ساعت ${timeStr} انجام شد. هیچ محصول یا سفارش جدیدی برای هم‌گام‌سازی یافت نشد. اگر انتظار دارید محصولاتی وجود دارند، مطمئن شوید در ووکامرس وضعیت «منتشر شده» دارند.`
            } else {
                // We got some real counts. Build a clear summary.
                const parts: string[] = []
                if (pcount > 0) parts.push(`${pcount} محصول`)
                if (ocount > 0) parts.push(`${ocount} سفارش`)
                const okMsg = parts.length > 0
                    ? `${parts.join(' و ')} هم‌گام شد.`
                    : 'هیچ مورد جدیدی برای هم‌گام‌سازی نبود.'
                msg = `${okMsg} (ساعت ${timeStr}${pErrors > 0 ? ` · ${pErrors} خطا` : ''})`
            }
            setNotice({ type: 'ok', msg })
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
            <section className="spatial-surface overflow-hidden rounded-[1.5rem] p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--text-primary)] text-[var(--bg-base)] shadow-[var(--shadow-control)]">
                            <Globe className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                            <h2 className="text-base font-bold tracking-tight text-[var(--text-primary)]">
                                سایت وردپرسی یا ووکامرسی خود را وصل کنید
                            </h2>
                            <p className="mt-1 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)]">
                                محصولات و سفارش‌ها به‌صورت خودکار با ویجنت همگام می‌شوند. فقط آدرس سایت را وارد کنید.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowForm(true)}
                        className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-sm font-bold text-[var(--bg-base)] shadow-[var(--shadow-control)] transition-opacity hover:opacity-90"
                    >
                        <Plus className="h-4 w-4" />
                        اتصال سایت
                    </button>
                </div>

                {showForm && (
                    <form onSubmit={submit} className="mt-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
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
                                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-5 text-sm font-bold text-[var(--bg-base)] shadow-[var(--shadow-control)] transition-opacity hover:opacity-90 disabled:opacity-50"
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                {submitting ? 'در حال ایجاد…' : 'ایجاد اتصال'}
                            </button>
                        </div>
                        {formError && <p className="mt-2 text-xs text-danger">{formError}</p>}
                        <p className="mt-2 text-xs text-[var(--text-muted)]">
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

    return (
        <section className="spatial-surface overflow-hidden rounded-[1.5rem] p-5 sm:p-6">
            {/* Top row: URL + status + actions */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <span className={cn(
                        'grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[var(--bg-base)] shadow-[var(--shadow-control)]',
                        isPluginConfigured ? 'bg-green-600' : 'bg-[var(--text-primary)]',
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
                                    : isPluginConfigured
                                        ? 'bg-green-50 text-green-700'
                                        : 'bg-yellow-50 text-yellow-700',
                            )}>
                                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                {statusLabel}
                            </span>
                            {isPluginConfigured && (
                                <span className="text-xs text-[var(--text-muted)]">
                                    {integration._count.orders} سفارش
                                    {integration.lastSyncAt ? ` · ${formatDate(integration.lastSyncAt)}` : ''}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <button
                        type="button"
                        onClick={syncNow}
                        disabled={syncing || !integration.active || !isPluginConfigured}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[var(--text-primary)] px-3 text-xs font-bold text-[var(--bg-base)] shadow-[var(--shadow-control)] transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                        {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        بروزرسانی
                    </button>
                    <button
                        type="button"
                        onClick={toggleActive}
                        className="inline-flex min-h-9 items-center rounded-xl border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                    >
                        {integration.active ? 'غیرفعال' : 'فعال'}
                    </button>
                    <button
                        type="button"
                        onClick={remove}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-danger/30 hover:bg-danger/5 hover:text-danger"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        حذف
                    </button>
                </div>
            </div>

            {/* Notice */}
            {notice && (
                <div className={cn(
                    'mt-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm',
                    notice.type === 'ok' ? 'border border-[var(--green)]/30 bg-[var(--green)]/5 text-[var(--green)]' : 'border border-danger/30 bg-danger/5 text-danger',
                )}>
                    {notice.type === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    {notice.msg}
                </div>
            )}

            {/* Pending state — guide user to install plugin */}
            {!isPluginConfigured && integration.active && (
                <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
                    <div className="flex items-start gap-3">
                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-yellow-800">در انتظار اتصال افزونه</p>
                            <p className="mt-1 text-xs leading-relaxed text-yellow-700">
                                افزونه را در وردپرس نصب کنید و دکمه «اتصال» را در آن بزنید. پس از اتصال، اینجا خودکار به‌روز می‌شود.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <a
                                    href={`/api/downloads/wordpress-plugin?v=${Date.now()}`}
                                    download
                                    className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-yellow-600 px-3 text-xs font-bold text-white transition-colors hover:bg-yellow-700"
                                >
                                    <Download className="h-3.5 w-3.5" />
                                    دانلود افزونه
                                </a>
                                <Link
                                    href="/docs/woocommerce"
                                    className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-yellow-300 px-3 text-xs font-medium text-yellow-800 transition-colors hover:bg-yellow-100"
                                >
                                    راهنما
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Error */}
            {integration.lastSyncStatus === 'error' && integration.lastSyncError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs leading-relaxed text-red-700">
                    <strong>خطای هم‌گام‌سازی:</strong> {integration.lastSyncError}
                </div>
            )}
        </section>
    )
}

function formatDate(iso: string): string {
    try {
        return formatLocalizedDateTime(iso, 'fa')
    } catch {
        return iso
    }
}
