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
    Download,
    AlertCircle,
    CheckCircle2,
    X,
    ChevronDown,
    ChevronUp,
    Settings2,
    KeyRound,
    FileText,
    BookOpen,
    Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatLocalizedDateTime } from '@/lib/localized-date'

/**
 * WooCommerce setup + management card for the Products page.
 *
 * Replaces the simple "connect/disconnect" banner with a richer flow that:
 *  1. Lets the admin create a webhook-only integration (no REST keys needed
 *     for push from the WP plugin).
 *  2. Auto-generates the webhook URL + secret on the Vigent side and shows
 *     them with copy buttons so the user can paste them into the WP plugin.
 *  3. Provides a refresh button + checklist of what gets synced.
 *  4. Optionally lets the user add REST API credentials for two-way sync.
 *
 * Server passes the initial integration state; this component owns the
 * interactive bits (add form, sync-now, toggle, copy, delete).
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
    integration,
}: {
    integration: WooIntegrationState | null
}) {
    const router = useRouter()
    const [showForm, setShowForm] = useState(false)
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [showCreds, setShowCreds] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [pinging, setPinging] = useState(false)
    const [syncError, setSyncError] = useState<string | null>(null)
    const [syncOk, setSyncOk] = useState<string | null>(null)

    // ── form state ──────────────────────────────────────────────────────
    const [storeUrl, setStoreUrl] = useState('')
    const [consumerKey, setConsumerKey] = useState('')
    const [consumerSecret, setConsumerSecret] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        setFormError(null)
        setSubmitting(true)
        try {
            // In webhook-only mode (no advanced creds), credentials is {}.
            // When advanced creds are provided, we send them along so Vigent
            // can also POLL the WC REST API.
            const credentials: Record<string, string> =
                showAdvanced && consumerKey.trim() && consumerSecret.trim()
                    ? { consumerKey: consumerKey.trim(), consumerSecret: consumerSecret.trim() }
                    : {}

            const res = await fetch('/api/integrations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'WOOCOMMERCE',
                    storeUrl: storeUrl.trim(),
                    credentials,
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
            setConsumerKey('')
            setConsumerSecret('')
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
        setSyncError(null)
        setSyncOk(null)
        try {
            const res = await fetch(
                `/api/sync/woocommerce?integrationId=${integration.id}`,
                { method: 'POST' },
            )
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setSyncError(
                    data.error === 'NOT_FOUND'
                        ? 'اتصال پیدا نشد.'
                        : 'خطا در هم‌گام‌سازی.',
                )
                return
            }
            if (data.mode === 'webhook-only') {
                setSyncOk('این اتصال فقط webhook است — داده‌ها به‌صورت لحظه‌ای از افزونه می‌آیند.')
            } else {
                const pcount = data.products?.count ?? 0
                const ocount = data.orders?.count ?? 0
                setSyncOk(`${pcount} محصول و ${ocount} سفارش هم‌گام شد.`)
            }
            router.refresh()
        } catch {
            setSyncError('خطا در ارتباط با سرور.')
        } finally {
            setSyncing(false)
        }
    }

    async function pingPlugin() {
        if (!integration || !integration.storeUrl || !integration.webhookSecret) return
        setPinging(true)
        setSyncError(null)
        setSyncOk(null)
        try {
            // Hit the plugin's REST endpoint to verify it's installed and active.
            const url = `${integration.storeUrl.replace(/\/+$/, '')}/wp-json/vigent-woo/v1/ping?token=${encodeURIComponent(integration.webhookSecret)}`
            const res = await fetch(url, { method: 'GET' })
            const data = await res.json().catch(() => ({}))
            if (res.ok && data.ok) {
                setSyncOk(`افزونه نصب و فعال است — نسخه ${data.plugin_version}، ووکامرس: ${data.has_woocommerce ? 'فعال' : 'غیرفعال'}.`)
            } else if (res.status === 401 || res.status === 403) {
                setSyncError('افزونه نصب است اما کلید امنیتی در افزونه با پنل ویجنت مطابقت ندارد.')
            } else if (res.status === 404) {
                setSyncError('افزونه روی وردپرس نصب یا فعال نیست.')
            } else {
                setSyncError(`پاسخ غیرمنتظره (کد ${res.status}).`)
            }
        } catch {
            setSyncError('خطا در ارتباط با سایت وردپرس. آیا URL صحیح است و سایت در دسترس است؟')
        } finally {
            setPinging(false)
        }
    }

    async function toggleActive(next: boolean) {
        if (!integration) return
        await fetch(`/api/integrations/${integration.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: next }),
        })
        router.refresh()
    }

    async function remove() {
        if (!integration) return
        if (!confirm('این اتصال فروشگاه حذف شود؟ سفارش‌های ذخیره‌شده هم پاک می‌شوند.')) return
        await fetch(`/api/integrations/${integration.id}`, { method: 'DELETE' })
        router.refresh()
    }

    // ── Render: not connected yet ───────────────────────────────────────
    if (!integration) {
        return (
            <section className="spatial-surface overflow-hidden rounded-[1.5rem] p-5 sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-black text-white shadow-[var(--shadow-control)]">
                            <ShoppingBag className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                            <h2 className="text-base font-bold text-[var(--text-primary)]">
                                سایت ووکامرسی دارید و می‌خواهید محصولات خودکار به‌روز شوند؟
                            </h2>
                            <p className="mt-1 max-w-2xl text-xs leading-6 text-[var(--text-secondary)]">
                                افزونهٔ ویجنت را روی وردپرس نصب کنید؛ محصول جدید، تغییر قیمت، موجودی و سفارش‌ها
                                بدون ورود دستی به ویجنت می‌رسند و ایجنت همیشه با اطلاعات واقعی پاسخ می‌دهد.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-muted)]">
                                <span>۱. اتصال فروشگاه (این صفحه)</span>
                                <span>۲. نصب افزونه در وردپرس</span>
                                <span>۳. جای‌گذاری لینک و کلید در افزونه</span>
                                <span>۴. هم‌گام‌سازی اولیه</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <a
                            href="/downloads/vigent-wordpress.zip"
                            download
                            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-default)] bg-white px-4 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--border-hover)]"
                        >
                            <Download className="h-3.5 w-3.5" />
                            دانلود افزونه
                        </a>
                        <button
                            onClick={() => setShowForm(true)}
                            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-black px-4 text-xs font-bold text-white shadow-[var(--shadow-control)] hover:opacity-90"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            اتصال ووکامرس
                        </button>
                    </div>
                </div>

                {showForm && (
                    <form
                        onSubmit={submit}
                        className="mt-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5"
                    >
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-sm font-medium text-[var(--text-primary)]">
                                راه‌اندازی اتصال ووکامرس
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-6 text-blue-800">
                            <p className="font-semibold mb-1">راه‌اندازی ساده در ۳ گام:</p>
                            <ol className="list-decimal pr-4 space-y-1">
                                <li>آدرس سایت ووکامرسی خود را وارد و «ایجاد اتصال» بزنید.</li>
                                <li>ویجنت به‌صورت خودکار یک <strong>لینک webhook</strong> و یک <strong>کلید امنیتی</strong> تصادفی می‌سازد.</li>
                                <li>افزونه را در وردپرس نصب کنید و این لینک و کلید را در تنظیمات آن جای‌گذاری کنید.</li>
                            </ol>
                        </div>

                        <div className="grid gap-3">
                            <div>
                                <label className="mb-1.5 block text-xs text-[var(--text-secondary)]">
                                    آدرس فروشگاه <span className="text-danger">*</span>
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
                                <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                                    آدرس کامل سایت وردپرسی/ووکامرسی شما — بدون اسلش در انتها.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowAdvanced((v) => !v)}
                                className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            >
                                {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                تنظیمات پیشرفته (Consumer Key/Secret برای هم‌گام‌سازی دوطرفه)
                            </button>

                            {showAdvanced && (
                                <div className="grid gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3 sm:grid-cols-2">
                                    <div>
                                        <label className="mb-1.5 block text-xs text-[var(--text-secondary)]">
                                            Consumer Key
                                        </label>
                                        <input
                                            dir="ltr"
                                            type="text"
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
                                            value={consumerSecret}
                                            onChange={(e) => setConsumerSecret(e.target.value)}
                                            placeholder="cs_..."
                                            className="input font-mono text-sm"
                                        />
                                    </div>
                                    <p className="text-[11px] text-[var(--text-muted)] sm:col-span-2">
                                        این کلیدها فقط برای هم‌گام‌سازی کششی (poll) از سمت ویجنت لازم‌اند.
                                        بدون آن‌ها، افزونه وردپرس همچنان داده‌ها را از طریق webhook به ویجنت می‌فرستد.
                                        برای ساخت: ووکامرس ← تنظیمات ← پیشرفته ← REST API.
                                    </p>
                                </div>
                            )}

                            {formError && <p className="text-sm text-danger">{formError}</p>}

                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                >
                                    انصراف
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="inline-flex items-center gap-2 rounded-xl bg-[var(--white)] px-5 py-2 text-sm font-medium text-[var(--bg-base)] transition-transform hover:scale-[1.02] disabled:opacity-50"
                                >
                                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {submitting ? 'در حال ایجاد…' : 'ایجاد اتصال'}
                                </button>
                            </div>
                        </div>
                    </form>
                )}
            </section>
        )
    }

    // ── Render: connected ───────────────────────────────────────────────
    const webhookUrl = integration.webhookSecret
        ? `${typeof window !== 'undefined' ? window.location.origin : ''}/api/sync/woocommerce?token=${integration.webhookSecret}`
        : null

    return (
        <section className="spatial-surface overflow-hidden rounded-[1.5rem] p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-black text-white shadow-[var(--shadow-control)]">
                        <CheckCircle2 className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-bold text-[var(--text-primary)]">
                                فروشگاه ووکامرس متصل است
                            </h2>
                            <span
                                className={cn(
                                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                                    integration.active
                                        ? 'bg-green-50 text-green-700'
                                        : 'bg-gray-100 text-gray-600',
                                )}
                            >
                                ● {integration.active ? 'فعال' : 'غیرفعال'}
                            </span>
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                                {integration.hasCredentials ? 'هم‌گام‌سازی کامل' : 'webhook-only'}
                            </span>
                        </div>
                        <p
                            dir="ltr"
                            className="mt-1 truncate text-xs text-[var(--text-secondary)]"
                            title={integration.storeUrl}
                        >
                            {integration.storeUrl}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                            {integration._count.orders} سفارش · {integration._count.syncLogs} لاگ هم‌گام‌سازی
                            {integration.pollIntervalMinutes > 0
                                ? ` · هر ${integration.pollIntervalMinutes} دقیقه poll`
                                : ' · فقط webhook'}
                            {integration.lastSyncAt
                                ? ` · آخرین همگام‌سازی: ${formatDate(integration.lastSyncAt)}`
                                : ' · هم‌گام‌سازی نشده'}
                        </p>
                        {integration.lastSyncStatus === 'error' && integration.lastSyncError && (
                            <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                                <strong>خطای آخرین هم‌گام‌سازی:</strong> {integration.lastSyncError}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => toggleActive(!integration.active)}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                    >
                        <Settings2 className="h-3.5 w-3.5" />
                        {integration.active ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                    </button>
                    <button
                        type="button"
                        onClick={pingPlugin}
                        disabled={pinging || !integration.active}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-transform hover:scale-[1.02] disabled:opacity-50"
                        title="بررسی نصب و فعال بودن افزونه روی وردپرس"
                    >
                        {pinging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                        بررسی افزونه
                    </button>
                    <button
                        type="button"
                        onClick={syncNow}
                        disabled={syncing || !integration.active}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--white)] px-3 py-1.5 text-xs font-medium text-[var(--bg-base)] transition-transform hover:scale-[1.02] disabled:opacity-50"
                    >
                        {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        بروزرسانی محصولات
                    </button>
                    <button
                        type="button"
                        onClick={remove}
                        className="inline-flex min-h-9 items-center rounded-lg border border-[var(--border-default)] p-1.5 text-[var(--text-muted)] transition-colors hover:text-danger"
                        aria-label="حذف اتصال"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {syncOk && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--green)]/30 bg-[var(--green)]/5 px-4 py-2.5 text-sm text-[var(--green)]">
                    <CheckCircle2 className="h-4 w-4" />
                    {syncOk}
                </div>
            )}
            {syncError && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/5 px-4 py-2.5 text-sm text-danger">
                    <AlertCircle className="h-4 w-4" />
                    {syncError}
                </div>
            )}

            {/* Webhook URL + Secret copy panel */}
            {webhookUrl && integration.webhookSecret && (
                <div className="mt-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                            مقادیر زیر را در افزونه وردپرس جای‌گذاری کنید
                        </h3>
                        <Link
                            href="/docs/woocommerce"
                            className="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                            <BookOpen className="h-3 w-3" />
                            راهنمای کامل
                        </Link>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                        <CopyField label="۱. آدرس webhook" value={webhookUrl} />
                        <CopyField label="۲. کلید امنیتی" value={integration.webhookSecret} />
                    </div>
                    <ol className="mt-3 space-y-1.5 text-[11px] text-[var(--text-secondary)]">
                        <li>۱. افزونه را از <a href="/downloads/vigent-wordpress.zip" download className="text-[var(--text-primary)] underline">اینجا</a> دانلود و در وردپرس نصب کنید.</li>
                        <li>۲. در پیشخوان وردپرس به <strong>«ویجنت ← تنظیمات»</strong> بروید.</li>
                        <li>۳. مقادیر بالا را در فیلدهای مربوطه جای‌گذاری و «ذخیره» بزنید.</li>
                        <li>۴. دکمهٔ «تست اتصال» را بزنید و سپس به تب «هم‌گام‌سازی» بروید.</li>
                    </ol>
                </div>
            )}

            {/* Checklist */}
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4">
                    <h3 className="mb-2 text-xs font-semibold text-[var(--text-primary)]">
                        چک‌لیست هم‌گام‌سازی
                    </h3>
                    <ul className="space-y-1.5 text-[11px] text-[var(--text-secondary)]">
                        <ChecklistItem done={!!webhookUrl} label="اتصال webhook برقرار است" />
                        <ChecklistItem done={integration._count.syncLogs > 0} label="حداقل یک رویداد از افزونه دریافت شده" />
                        <ChecklistItem
                            done={integration.hasCredentials}
                            label="Consumer Key/Secret تنظیم شده (برای poll)"
                            optional
                        />
                        <ChecklistItem
                            done={integration._count.orders > 0}
                            label="سفارش‌ها در حال هم‌گام‌سازی هستند"
                            optional
                        />
                    </ul>
                    <p className="mt-3 text-[10px] text-[var(--text-muted)]">
                        برای بررسی نصب و فعال بودن افزونه روی وردپرس، از دکمهٔ «بررسی افزونه» در بالا استفاده کنید.
                    </p>
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4">
                    <h3 className="mb-2 text-xs font-semibold text-[var(--text-primary)]">
                        چه داده‌هایی همگام می‌شوند؟
                    </h3>
                    <ul className="space-y-1 text-[11px] text-[var(--text-muted)]">
                        <li>• محصولات: نام، SKU، قیمت، موجودی، تصاویر، توضیحات</li>
                        <li>• سفارش‌ها: شماره، وضعیت، مبلغ، اطلاعات مشتری، آیتم‌ها</li>
                        <li>• محتوا: نوشته‌ها و برگه‌ها به پایگاه دانش</li>
                        <li>• تغییرات به‌صورت لحظه‌ای از طریق webhook</li>
                    </ul>
                </div>
            </div>

            {/* Recent sync logs */}
            {integration.syncLogs.length > 0 && (
                <div className="mt-4">
                    <p className="mb-2 text-xs text-[var(--text-secondary)]">آخرین رویدادهای هم‌گام‌سازی</p>
                    <ul className="space-y-1">
                        {integration.syncLogs.slice(0, 5).map((log) => (
                            <li
                                key={log.id}
                                className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-1.5 text-xs"
                            >
                                {log.outcome === 'ok' ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[var(--green)]" />
                                ) : (
                                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-danger" />
                                )}
                                <span className="text-[var(--text-secondary)]">{entityLabel(log.entity)}</span>
                                <span className="text-[var(--text-muted)]">·</span>
                                <span className="text-[var(--text-muted)]">{directionLabel(log.direction)}</span>
                                <span className="text-[var(--text-muted)]">·</span>
                                <span className="text-[var(--text-muted)]">{log.count} مورد</span>
                                <span className="ms-auto text-[var(--text-muted)]">{formatDate(log.createdAt)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    )
}

function ChecklistItem({
    done,
    label,
    optional,
}: {
    done: boolean
    label: string
    optional?: boolean
}) {
    return (
        <li className="flex items-start gap-2">
            <span
                className={cn(
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                    done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400',
                )}
            >
                {done ? <Check className="h-2.5 w-2.5" /> : <span className="h-1 w-1 rounded-full bg-current" />}
            </span>
            <span>
                {label}
                {optional && !done && (
                    <span className="mr-1 text-[10px] text-[var(--text-muted)]">(اختیاری)</span>
                )}
            </span>
        </li>
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
        <div className="rounded-lg border border-[var(--border-subtle)] bg-white px-3 py-2">
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
                    className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                    aria-label="کپی"
                >
                    {copied ? <Check className="h-3.5 w-3.5 text-[var(--green)]" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
            </div>
        </div>
    )
}

function entityLabel(entity: string): string {
    const map: Record<string, string> = {
        products: 'محصولات',
        orders: 'سفارش‌ها',
        product_update: 'به‌روزرسانی محصول',
        order_update: 'به‌روزرسانی سفارش',
        content_update: 'محتوای سایت',
    }
    return map[entity] ?? entity
}

function directionLabel(direction: string): string {
    const map: Record<string, string> = {
        push: 'دریافت از فروشگاه',
        poll: 'کشش از ویجنت',
    }
    return map[direction] ?? direction
}

function formatDate(iso: string): string {
    try {
        return formatLocalizedDateTime(iso, 'fa')
    } catch {
        return iso
    }
}
