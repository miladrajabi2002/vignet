'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
        ShoppingBag,
        Plus,
        Loader2,
        RefreshCw,
        Trash2,
        Copy,
        Check,
        ExternalLink,
        AlertCircle,
        CheckCircle2,
        X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * "Online store" section of the integrations page (F2). Lists the workspace's
 * connected `StoreIntegration` rows, lets the admin add a new WooCommerce or
 * custom-URL store, run an on-demand sync, and inspect the recent sync log.
 *
 * Server passes the initial list + sync logs; this component owns the
 * interactive bits (add form, sync-now button, delete, copy webhook URL).
 */

type StoreType = 'WOOCOMMERCE' | 'CUSTOM_URL' | 'SHOPIFY'

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
        type: StoreType
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

const TYPE_LABEL: Record<StoreType, string> = {
        WOOCOMMERCE: 'WooCommerce',
        CUSTOM_URL: 'URL دلخواه',
        SHOPIFY: 'Shopify',
}

const ENTITY_LABEL: Record<string, string> = {
        products: 'محصولات',
        orders: 'سفارش‌ها',
        product_update: 'به‌روزرسانی محصول',
        order_update: 'به‌روزرسانی سفارش',
}

const DIRECTION_LABEL: Record<string, string> = {
        push: 'دریافت از فروشگاه',
        poll: 'کشش از ویجنت',
}

export function StoreIntegrationsSection({
        integrations,
}: {
        integrations: StoreIntegrationItem[]
}) {
        const router = useRouter()
        const [showForm, setShowForm] = useState(false)
        const [syncingId, setSyncingId] = useState<string | null>(null)
        const [deletingId, setDeletingId] = useState<string | null>(null)
        const [syncError, setSyncError] = useState<string | null>(null)
        const [syncOk, setSyncOk] = useState<string | null>(null)

        async function syncNow(integration: StoreIntegrationItem) {
                setSyncingId(integration.id)
                setSyncError(null)
                setSyncOk(null)
                try {
                        const res = await fetch(
                                `/api/sync/woocommerce?integrationId=${integration.id}`,
                                { method: 'GET' },
                        )
                        const data = await res.json().catch(() => ({}))
                        if (!res.ok) {
                                setSyncError(data.error === 'NOT_FOUND' ? 'فروشگاه پیدا نشد.' : 'خطا در هم‌گام‌سازی.')
                                return
                        }
                        const pcount = data.products?.count ?? 0
                        const ocount = data.orders?.count ?? 0
                        setSyncOk(`${pcount} محصول و ${ocount} سفارش هم‌گام شد.`)
                        router.refresh()
                } catch {
                        setSyncError('خطا در ارتباط با سرور.')
                } finally {
                        setSyncingId(null)
                }
        }

        async function remove(integration: StoreIntegrationItem) {
                if (!confirm('این اتصال فروشگاه حذف شود؟ سفارش‌های ذخیره‌شده هم پاک می‌شوند.')) return
                setDeletingId(integration.id)
                try {
                        await fetch(`/api/integrations/${integration.id}`, { method: 'DELETE' })
                        router.refresh()
                } finally {
                        setDeletingId(null)
                }
        }

        async function toggleActive(integration: StoreIntegrationItem, next: boolean) {
                await fetch(`/api/integrations/${integration.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ active: next }),
                })
                router.refresh()
        }

        return (
                <div className="space-y-5">
                        <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                        <ShoppingBag className="h-4 w-4 text-[var(--text-secondary)]" />
                                        <h2 className="text-sm font-medium text-[var(--text-secondary)]">
                                                فروشگاه آنلاین
                                        </h2>
                                </div>
                                <button
                                        onClick={() => setShowForm((v) => !v)}
                                        className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                                >
                                        {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                                        {showForm ? 'انصراف' : 'افزودن فروشگاه'}
                                </button>
                        </div>

                        {syncOk && (
                                <div className="flex items-center gap-2 rounded-xl border border-[var(--green)]/30 bg-[var(--green)]/5 px-4 py-2.5 text-sm text-[var(--green)]">
                                        <CheckCircle2 className="h-4 w-4" />
                                        {syncOk}
                                </div>
                        )}
                        {syncError && (
                                <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/5 px-4 py-2.5 text-sm text-danger">
                                        <AlertCircle className="h-4 w-4" />
                                        {syncError}
                                </div>
                        )}

                        {showForm && <AddStoreForm onDone={() => {
                                setShowForm(false)
                                router.refresh()
                        }} />}

                        {integrations.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-8 text-center">
                                        <ShoppingBag className="mx-auto mb-3 h-8 w-8 text-[var(--text-muted)]" />
                                        <p className="text-sm text-[var(--text-secondary)]">
                                                هنوز فروشگاهی متصل نشده است.
                                        </p>
                                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                                                برای هم‌گام‌سازی محصولات و سفارش‌ها، یک فروشگاه ووکامرس اضافه کنید.
                                        </p>
                                </div>
                        ) : (
                                <div className="space-y-4">
                                        {integrations.map((integration) => (
                                                <IntegrationCard
                                                        key={integration.id}
                                                        integration={integration}
                                                        syncing={syncingId === integration.id}
                                                        deleting={deletingId === integration.id}
                                                        onSync={() => syncNow(integration)}
                                                        onDelete={() => remove(integration)}
                                                        onToggle={(next) => toggleActive(integration, next)}
                                                />
                                        ))}
                                </div>
                        )}

                        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4">
                                <div className="flex items-start gap-3">
                                        <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                                        <div className="text-xs text-[var(--text-muted)]">
                                                <p>
                                                        برای اتصال ووکامرس، افزونهٔ PHP ما را نصب کنید و آدرس webhook و کلید
                                                        امنیتی بالا را در تنظیمات آن وارد کنید.
                                                </p>
                                                <Link
                                                        href="/docs/woocommerce"
                                                        className="mt-1 inline-flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                                >
                                                        مشاهدهٔ راهنمای نصب افزونه
                                                        <ExternalLink className="h-3 w-3" />
                                                </Link>
                                        </div>
                                </div>
                        </div>
                </div>
        )
}

// ─── add-store form ──────────────────────────────────────────────────────────

function AddStoreForm({ onDone }: { onDone: () => void }) {
        const [type, setType] = useState<StoreType>('WOOCOMMERCE')
        const [storeUrl, setStoreUrl] = useState('')
        const [consumerKey, setConsumerKey] = useState('')
        const [consumerSecret, setConsumerSecret] = useState('')
        const [pollInterval, setPollInterval] = useState('30')
        const [submitting, setSubmitting] = useState(false)
        const [error, setError] = useState<string | null>(null)

        async function submit(e: React.FormEvent) {
                e.preventDefault()
                setError(null)
                setSubmitting(true)
                try {
                        const credentials: Record<string, string> =
                                type === 'WOOCOMMERCE'
                                        ? { consumerKey: consumerKey.trim(), consumerSecret: consumerSecret.trim() }
                                        : {}
                        const res = await fetch('/api/integrations', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                        type,
                                        storeUrl: storeUrl.trim(),
                                        credentials,
                                        pollIntervalMinutes: parseInt(pollInterval, 10) || 30,
                                }),
                        })
                        const data = await res.json().catch(() => ({}))
                        if (!res.ok) {
                                setError(
                                        data.error === 'INVALID'
                                                ? 'ورودی نامعتبر است.'
                                                : 'خطا در افزودن فروشگاه.',
                                )
                                return
                        }
                        onDone()
                } catch {
                        setError('خطا در ارتباط با سرور.')
                } finally {
                        setSubmitting(false)
                }
        }

        return (
                <form
                        onSubmit={submit}
                        className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5"
                >
                        <h3 className="mb-4 text-sm font-medium text-[var(--text-primary)]">
                                افزودن فروشگاه جدید
                        </h3>

                        <div className="mb-4 flex gap-2">
                                {(['WOOCOMMERCE', 'CUSTOM_URL'] as StoreType[]).map((t) => (
                                        <button
                                                key={t}
                                                type="button"
                                                onClick={() => setType(t)}
                                                className={cn(
                                                        'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors',
                                                        type === t
                                                                ? 'border-[var(--border-strong)] text-[var(--text-primary)]'
                                                                : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                                                )}
                                        >
                                                {TYPE_LABEL[t]}
                                        </button>
                                ))}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                        <label className="mb-1.5 block text-xs text-[var(--text-secondary)]">
                                                آدرس فروشگاه
                                        </label>
                                        <input
                                                dir="ltr"
                                                type="url"
                                                required
                                                value={storeUrl}
                                                onChange={(e) => setStoreUrl(e.target.value)}
                                                placeholder="https://shop.example.com"
                                                className="input font-mono text-sm"
                                        />
                                </div>
                                <div>
                                        <label className="mb-1.5 block text-xs text-[var(--text-secondary)]">
                                                دورهٔ هم‌گام‌سازی (دقیقه)
                                        </label>
                                        <input
                                                dir="ltr"
                                                type="number"
                                                min="0"
                                                max="1440"
                                                value={pollInterval}
                                                onChange={(e) => setPollInterval(e.target.value)}
                                                className="input font-mono text-sm"
                                        />
                                </div>
                                {type === 'WOOCOMMERCE' && (
                                        <>
                                                <div>
                                                        <label className="mb-1.5 block text-xs text-[var(--text-secondary)]">
                                                                Consumer Key
                                                        </label>
                                                        <input
                                                                dir="ltr"
                                                                type="text"
                                                                required
                                                                value={consumerKey}
                                                                onChange={(e) => setConsumerKey(e.target.value)}
                                                                placeholder="ck_..."
                                                                className="input font-mono text-sm"
                                                        />
                                                </div>
                                                <div>
                                                        <label className="mb-1.5 block text-xs text-[var(--text-secondary)]">
                                                                Consumer Secret
                                                        </label>
                                                        <input
                                                                dir="ltr"
                                                                type="password"
                                                                required
                                                                value={consumerSecret}
                                                                onChange={(e) => setConsumerSecret(e.target.value)}
                                                                placeholder="cs_..."
                                                                className="input font-mono text-sm"
                                                        />
                                                </div>
                                        </>
                                )}
                        </div>

                        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

                        <div className="mt-4 flex justify-end gap-2">
                                <button
                                        type="submit"
                                        disabled={submitting}
                                        className="inline-flex items-center gap-2 rounded-xl bg-[var(--white)] px-5 py-2 text-sm font-medium text-[var(--bg-base)] transition-transform hover:scale-[1.02] disabled:opacity-50"
                                >
                                        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                        {submitting ? 'در حال افزودن…' : 'افزودن'}
                                </button>
                        </div>
                </form>
        )
}

// ─── integration card ────────────────────────────────────────────────────────

function IntegrationCard({
        integration,
        syncing,
        deleting,
        onSync,
        onDelete,
        onToggle,
}: {
        integration: StoreIntegrationItem
        syncing: boolean
        deleting: boolean
        onSync: () => void
        onDelete: () => void
        onToggle: (next: boolean) => void
}) {
        const webhookUrl = integration.webhookSecret
                ? `${typeof window !== 'undefined' ? window.location.origin : ''}/api/sync/woocommerce?token=${integration.webhookSecret}`
                : null

        return (
                <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                                <span className="rounded-lg bg-[var(--bg-base)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
                                                        {TYPE_LABEL[integration.type]}
                                                </span>
                                                <span
                                                        className={cn(
                                                                'inline-flex items-center gap-1 text-xs',
                                                                integration.active
                                                                        ? 'text-[var(--green)]'
                                                                        : 'text-[var(--text-muted)]',
                                                        )}
                                                >
                                                        ● {integration.active ? 'فعال' : 'غیرفعال'}
                                                </span>
                                        </div>
                                        <p
                                                dir="ltr"
                                                className="mt-1 truncate text-sm text-[var(--text-primary)]"
                                                title={integration.storeUrl}
                                        >
                                                {integration.storeUrl}
                                        </p>
                                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                                                {integration._count.orders} سفارش · {integration._count.syncLogs} لاگ هم‌گام‌سازی
                                                {integration.pollIntervalMinutes > 0
                                                        ? ` · هر ${integration.pollIntervalMinutes} دقیقه`
                                                        : ' · فقط webhook'}
                                                {integration.lastSyncAt
                                                        ? ` · آخرین هم‌گام‌سازی: ${formatDate(integration.lastSyncAt)}`
                                                        : ' · هم‌گام‌سازی نشده'}
                                        </p>
                                        {integration.lastSyncStatus === 'error' && integration.lastSyncError && (
                                                <p className="mt-1 text-xs text-danger">
                                                        خطای آخرین هم‌گام‌سازی: {integration.lastSyncError}
                                                </p>
                                        )}
                                </div>

                                <div className="flex items-center gap-2">
                                        <button
                                                type="button"
                                                onClick={() => onToggle(!integration.active)}
                                                className="rounded-lg border border-[var(--border-default)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                                        >
                                                {integration.active ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                                        </button>
                                        {integration.type === 'WOOCOMMERCE' && (
                                                <button
                                                        type="button"
                                                        onClick={onSync}
                                                        disabled={syncing || !integration.active}
                                                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--white)] px-3 py-1.5 text-xs font-medium text-[var(--bg-base)] transition-transform hover:scale-[1.02] disabled:opacity-50"
                                                >
                                                        {syncing ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                                <RefreshCw className="h-3.5 w-3.5" />
                                                        )}
                                                        هم‌گام‌سازی
                                                </button>
                                        )}
                                        <button
                                                type="button"
                                                onClick={onDelete}
                                                disabled={deleting}
                                                className="rounded-lg border border-[var(--border-default)] p-1.5 text-[var(--text-muted)] transition-colors hover:text-danger"
                                                aria-label="حذف"
                                        >
                                                {deleting ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                )}
                                        </button>
                                </div>
                        </div>

                        {integration.type === 'WOOCOMMERCE' && webhookUrl && integration.webhookSecret && (
                                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                        <CopyField label="آدرس webhook" value={webhookUrl} />
                                        <CopyField label="کلید امنیتی" value={integration.webhookSecret} />
                                </div>
                        )}

                        {integration.syncLogs.length > 0 && (
                                <div className="mt-4">
                                        <p className="mb-2 text-xs text-[var(--text-secondary)]">
                                                آخرین رویدادهای هم‌گام‌سازی
                                        </p>
                                        <ul className="space-y-1">
                                                {integration.syncLogs.slice(0, 10).map((log) => (
                                                        <li
                                                                key={log.id}
                                                                className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-1.5 text-xs"
                                                        >
                                                                {log.outcome === 'ok' ? (
                                                                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[var(--green)]" />
                                                                ) : (
                                                                        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-danger" />
                                                                )}
                                                                <span className="text-[var(--text-secondary)]">
                                                                        {ENTITY_LABEL[log.entity] ?? log.entity}
                                                                </span>
                                                                <span className="text-[var(--text-muted)]">·</span>
                                                                <span className="text-[var(--text-muted)]">
                                                                        {DIRECTION_LABEL[log.direction] ?? log.direction}
                                                                </span>
                                                                <span className="text-[var(--text-muted)]">·</span>
                                                                <span className="text-[var(--text-muted)]">{log.count} مورد</span>
                                                                <span className="ms-auto text-[var(--text-muted)]">
                                                                        {formatDate(log.createdAt)}
                                                                </span>
                                                        </li>
                                                ))}
                                        </ul>
                                </div>
                        )}
                </div>
        )
}

function CopyField({ label, value }: { label: string; value: string }) {
        const [copied, setCopied] = useState(false)
        async function copy() {
                try {
                        await navigator.clipboard.writeText(value)
                        setCopied(true)
                        setTimeout(() => setCopied(false), 1500)
                } catch {
                        // ignore — clipboard may be unavailable
                }
        }
        return (
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2">
                        <p className="mb-1 text-xs text-[var(--text-muted)]">{label}</p>
                        <div className="flex items-center gap-2">
                                <code
                                        dir="ltr"
                                        className="flex-1 truncate text-xs text-[var(--text-primary)]"
                                        title={value}
                                >
                                        {value}
                                </code>
                                <button
                                        type="button"
                                        onClick={copy}
                                        className="text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                                        aria-label="کپی"
                                >
                                        {copied ? <Check className="h-3.5 w-3.5 text-[var(--green)]" /> : <Copy className="h-3.5 w-3.5" />}
                                </button>
                        </div>
                </div>
        )
}

function formatDate(iso: string): string {
        try {
                const d = new Date(iso)
                return new Intl.DateTimeFormat('fa-IR', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                }).format(d)
        } catch {
                return iso
        }
}
