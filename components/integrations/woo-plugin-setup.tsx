'use client'

import { useLocale } from 'next-intl'
import Link from 'next/link'
import { BookOpen, Download, ExternalLink, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Shared "install the plugin" guide for a store connection that exists in
 * Vigent but has not heard from the WordPress plugin yet. Rendered by both
 * the Integrations page and the Products page so the two never drift apart
 * (the download button used to exist on only one of them).
 */

/** The route sends `no-store`, so the link needs no cache-busting query. */
export const WOO_PLUGIN_DOWNLOAD_HREF = '/api/downloads/wordpress-plugin'

/**
 * People type `example.com` far more often than `https://example.com`.
 * Add the scheme for them instead of failing validation.
 */
export function normalizeStoreUrlInput(raw: string): string {
    const value = raw.trim()
    if (!value) return ''
    return /^https?:\/\//i.test(value) ? value : `https://${value.replace(/^\/+/, '')}`
}

/** One wording for `POST /api/integrations` failures wherever a site is added. */
export function wooCreateErrorMessage(code: unknown, fa: boolean): string {
    switch (code) {
        case 'INVALID':
            return fa ? 'آدرس سایت نامعتبر است. مثال: https://example.com' : 'The site address is not valid. Example: https://example.com'
        case 'UNSAFE_STORE_URL':
            return fa ? 'آدرس سایت به دلایل امنیتی قابل قبول نیست.' : 'This site address cannot be accepted for security reasons.'
        case 'PLAN_BLOCKED':
            return fa ? 'پلن شما اجازه اتصال سایت را نمی‌دهد.' : 'Your plan does not include a site connection.'
        case 'UNAUTHORIZED':
            return fa ? 'نشست شما منقضی شده؛ دوباره وارد شوید.' : 'Your session has expired. Sign in again.'
        default:
            return fa ? 'خطا در ساخت اتصال؛ دوباره تلاش کنید.' : 'The connection could not be created. Try again.'
    }
}

/** A wp-admin deep link for the store, or null when the URL is not plain http(s). */
function wpAdminUrl(storeUrl: string, path: string): string | null {
    try {
        const url = new URL(storeUrl)
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
        return `${url.origin}${url.pathname.replace(/\/+$/, '')}/wp-admin/${path}`
    } catch {
        return null
    }
}

export function WooPluginDownloadLink({
    variant = 'primary',
    className,
}: {
    variant?: 'primary' | 'quiet'
    className?: string
}) {
    const fa = useLocale() !== 'en'
    return (
        <a
            href={WOO_PLUGIN_DOWNLOAD_HREF}
            download
            className={cn(
                'inline-flex items-center gap-1.5 font-bold transition-[opacity,color,background-color]',
                variant === 'primary'
                    ? 'min-h-11 rounded-xl bg-[var(--text-primary)] px-4 text-xs text-[var(--bg-base)] shadow-[var(--shadow-control)] hover:opacity-90'
                    : 'min-h-11 rounded-xl border border-[var(--border-default)] px-3.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]',
                className,
            )}
        >
            <Download className="h-3.5 w-3.5" />
            {fa ? 'دانلود افزونه' : 'Download plugin'}
        </a>
    )
}

export function WooPluginSetup({ storeUrl, className }: { storeUrl: string; className?: string }) {
    const fa = useLocale() !== 'en'
    const uploadUrl = wpAdminUrl(storeUrl, 'plugin-install.php?tab=upload')
    const pluginPageUrl = wpAdminUrl(storeUrl, 'admin.php?page=vigent-woo')
    const externalLink =
        'inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--border-default)] px-3 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]'

    return (
        <div className={cn('rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 sm:p-5', className)}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-[var(--text-primary)]">
                    {fa ? 'فقط سه قدم تا اتصال' : 'Three steps to connect'}
                </p>
                <Link
                    href="/docs/woocommerce"
                    className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                >
                    <BookOpen className="h-3.5 w-3.5" />
                    {fa ? 'راهنمای کامل' : 'Full guide'}
                </Link>
            </div>

            <ol className="mt-4 space-y-4">
                <SetupStep
                    num={1}
                    fa={fa}
                    title={fa ? 'افزونه ویجنت را دانلود کنید' : 'Download the Vigent plugin'}
                    desc={fa ? 'یک فایل zip دریافت می‌کنید؛ آن را از حالت فشرده خارج نکنید.' : 'You get a zip file. Do not unzip it.'}
                >
                    <WooPluginDownloadLink />
                </SetupStep>
                <SetupStep
                    num={2}
                    fa={fa}
                    title={fa ? 'افزونه را در وردپرس نصب و فعال کنید' : 'Install and activate it in WordPress'}
                    desc={fa ? 'در پیشخوان وردپرس: افزونه‌ها ← افزودن ← بارگذاری افزونه، سپس همان فایل را انتخاب و «فعال‌سازی» را بزنید.' : 'In the WordPress admin: Plugins → Add New → Upload Plugin, choose that file, then press “Activate”.'}
                >
                    {uploadUrl && (
                        <a href={uploadUrl} target="_blank" rel="noopener noreferrer" className={externalLink}>
                            <ExternalLink className="h-3.5 w-3.5" />
                            {fa ? 'باز کردن صفحه بارگذاری افزونه' : 'Open the plugin upload page'}
                        </a>
                    )}
                </SetupStep>
                <SetupStep
                    num={3}
                    fa={fa}
                    title={fa ? 'در افزونه دکمه «اتصال» را بزنید' : 'Press “Connect” in the plugin'}
                    desc={fa ? 'از منوی وردپرس صفحه «ویجنت» را باز کنید و دکمه «اتصال» را بزنید؛ محصولات و سفارش‌ها خودکار همگام می‌شوند.' : 'Open the “Vigent” page in the WordPress menu and press “Connect”. Products and orders then sync automatically.'}
                >
                    {pluginPageUrl && (
                        <a href={pluginPageUrl} target="_blank" rel="noopener noreferrer" className={externalLink}>
                            <ExternalLink className="h-3.5 w-3.5" />
                            {fa ? 'باز کردن صفحه ویجنت در وردپرس' : 'Open the Vigent page in WordPress'}
                        </a>
                    )}
                </SetupStep>
            </ol>

            {/* The parent card polls /api/integrations; this row only says so. */}
            <div
                role="status"
                aria-live="polite"
                className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--warn-soft)] px-3 py-2.5 text-xs font-medium text-[var(--warn-ink)]"
            >
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin motion-reduce:animate-none" />
                {fa ? 'در انتظار اتصال افزونه… این صفحه پس از اتصال خودکار به‌روز می‌شود.' : 'Waiting for the plugin… This page updates by itself once it connects.'}
            </div>
        </div>
    )
}

function SetupStep({
    num,
    fa,
    title,
    desc,
    children,
}: {
    num: number
    fa: boolean
    title: string
    desc: string
    children?: React.ReactNode
}) {
    return (
        <li className="flex items-start gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--text-primary)] text-[12px] font-bold tabular-nums text-[var(--bg-base)]">
                {num.toLocaleString(fa ? 'fa-IR' : 'en-US')}
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[var(--text-primary)]">{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-muted)]">{desc}</p>
                {children ? <div className="mt-2.5 flex flex-wrap gap-2">{children}</div> : null}
            </div>
        </li>
    )
}
