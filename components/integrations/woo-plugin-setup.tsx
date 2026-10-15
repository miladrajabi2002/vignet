'use client'

import { useLocale } from 'next-intl'
import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { BookOpen, Check, Download, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    CopyLinkButton,
    ListeningRow,
    WOO_BTN_GHOST,
    WOO_BTN_PRIMARY,
    WOO_BTN_SECONDARY,
    WOO_NOTE,
} from '@/components/integrations/woo-ui'

/**
 * Shared "install the plugin" guide for a store connection that exists in
 * Vigent but has not heard from the WordPress plugin yet. Rendered by the
 * WooCommerce tab and the onboarding wizard so the two never drift apart.
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
            return fa ? 'آدرس سایت درست نیست. مثلاً: https://example.com' : 'The site address is not valid. Example: https://example.com'
        case 'UNSAFE_STORE_URL':
            return fa ? 'این آدرس را به‌خاطر مسائل امنیتی نمی‌توانیم قبول کنیم.' : 'This site address cannot be accepted for security reasons.'
        case 'PLAN_BLOCKED':
            return fa ? 'پلن شما اجازه اتصال سایت را نمی‌دهد.' : 'Your plan does not include a site connection.'
        case 'UNAUTHORIZED':
            return fa ? 'از حسابتان خارج شده‌اید؛ دوباره وارد شوید.' : 'Your session has expired. Sign in again.'
        default:
            return fa ? 'اتصال ساخته نشد؛ دوباره امتحان کنید.' : 'The connection could not be created. Try again.'
    }
}

/** A wp-admin deep link for the store, or null when the URL is not plain http(s). */
export function wpAdminUrl(storeUrl: string, path: string): string | null {
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
    onClick,
}: {
    variant?: 'primary' | 'quiet'
    className?: string
    onClick?: () => void
}) {
    const fa = useLocale() !== 'en'
    return (
        <a
            href={WOO_PLUGIN_DOWNLOAD_HREF}
            download
            onClick={onClick}
            className={cn(variant === 'primary' ? WOO_BTN_PRIMARY : WOO_BTN_SECONDARY, className)}
        >
            <Download className="h-4 w-4" />
            {fa ? 'دانلود افزونه' : 'Download plugin'}
        </a>
    )
}

type StepState = 'done' | 'current' | 'next'

/** Remembers, per store, which of the steps the owner already took (the server cannot see a download). */
function useSetupProgress(storeUrl: string) {
    const key = `vigent:woo-setup:${storeUrl}`
    const [progress, setProgress] = useState({ downloaded: false, installed: false })
    useEffect(() => {
        try {
            const saved = JSON.parse(window.localStorage.getItem(key) ?? 'null')
            if (saved && typeof saved === 'object') setProgress({ downloaded: Boolean(saved.downloaded), installed: Boolean(saved.installed) })
        } catch {
            // Storage blocked: start from step one.
        }
    }, [key])
    function update(patch: Partial<typeof progress>) {
        setProgress((prev) => {
            const next = { ...prev, ...patch }
            try {
                window.localStorage.setItem(key, JSON.stringify(next))
            } catch {
                // Storage blocked: progress lasts for this visit only.
            }
            return next
        })
    }
    return [progress, update] as const
}

/**
 * The install guide as a stepper: done steps collapse to one line with a
 * check, the current step opens with its explanation and one ink button,
 * the steps ahead stay dim with a plain link. A neutral "listening" row
 * replaces the old amber spinner — waiting for the owner is not a problem.
 */
export function WooPluginSetup({
    storeUrl,
    className,
    status,
}: {
    storeUrl: string
    className?: string
    /** Replaces the default "waiting for the plugin" row (e.g. when polling stopped). */
    status?: ReactNode
}) {
    const fa = useLocale() !== 'en'
    const uploadUrl = wpAdminUrl(storeUrl, 'plugin-install.php?tab=upload')
    const pluginPageUrl = wpAdminUrl(storeUrl, 'admin.php?page=vigent-woo')
    const [progress, update] = useSetupProgress(storeUrl)
    const current = !progress.downloaded ? 0 : !progress.installed ? 1 : 2
    const state = (index: number): StepState => (index < current ? 'done' : index === current ? 'current' : 'next')
    const markDownloaded = () => update({ downloaded: true })
    const quietLink = 'inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--text-secondary)] underline decoration-[var(--border-strong)] underline-offset-4 hover:text-[var(--text-primary)]'

    return (
        <div className={cn('flex flex-col gap-4', className)}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[14px] font-bold text-[var(--text-primary)]">{fa ? 'سه قدم تا اتصال' : 'Three steps to connect'}</p>
                <Link href="/docs/woocommerce" className={cn(WOO_BTN_GHOST, 'min-h-9 px-2.5 text-[12.5px]')}>
                    <BookOpen className="h-3.5 w-3.5" />
                    {fa ? 'راهنمای کامل' : 'Full guide'}
                </Link>
            </div>

            <ol>
                <SetupStep
                    index={0}
                    fa={fa}
                    state={state(0)}
                    title={state(0) === 'done' ? (fa ? 'افزونه دریافت شد' : 'Plugin downloaded') : (fa ? 'افزونه ویجنت را دریافت کنید' : 'Get the Vigent plugin')}
                    desc={fa
                        ? 'یک فایل zip است؛ آن را از حالت فشرده خارج نکنید. نصب روی کامپیوتر راحت‌تر است، برای همین روی گوشی لینکش را کپی کنید.'
                        : 'It is a zip file; do not unzip it. Installing is easier on a computer, so on a phone copy the link instead.'}
                    quiet={(
                        <a href={WOO_PLUGIN_DOWNLOAD_HREF} download onClick={markDownloaded} className={quietLink}>
                            <Download className="h-3.5 w-3.5" />
                            {fa ? 'دانلود دوباره' : 'Download again'}
                        </a>
                    )}
                >
                    <WooPluginDownloadLink onClick={markDownloaded} className="max-sm:hidden" />
                    <CopyLinkButton
                        path={WOO_PLUGIN_DOWNLOAD_HREF}
                        label={fa ? 'کپی لینک افزونه برای کامپیوتر' : 'Copy the plugin link for a computer'}
                        copiedLabel={fa ? 'لینک کپی شد' : 'Link copied'}
                        onCopied={markDownloaded}
                        className={cn(WOO_BTN_PRIMARY, 'w-full sm:hidden')}
                    />
                    <button type="button" onClick={markDownloaded} className={cn(WOO_BTN_GHOST, 'max-sm:w-full')}>
                        {fa ? 'قبلاً دانلود کرده‌ام' : 'I already have it'}
                    </button>
                </SetupStep>

                <SetupStep
                    index={1}
                    fa={fa}
                    state={state(1)}
                    title={state(1) === 'done' ? (fa ? 'افزونه در وردپرس نصب شد' : 'Installed in WordPress') : (fa ? 'افزونه را در وردپرس نصب و فعال کنید' : 'Install and activate it in WordPress')}
                    desc={fa
                        ? 'در پیشخوان وردپرس: افزونه‌ها ← افزودن ← بارگذاری افزونه. همان فایل zip را انتخاب و «فعال‌سازی» را بزنید.'
                        : 'In the WordPress admin: Plugins → Add New → Upload Plugin. Choose the zip file, then press “Activate”.'}
                    quiet={uploadUrl ? (
                        <a href={uploadUrl} target="_blank" rel="noopener noreferrer" className={quietLink}>
                            <ExternalLink className="h-3.5 w-3.5" />
                            {fa ? 'باز کردن صفحه بارگذاری افزونه' : 'Open the plugin upload page'}
                        </a>
                    ) : undefined}
                >
                    {uploadUrl && (
                        <a href={uploadUrl} target="_blank" rel="noopener noreferrer" className={cn(WOO_BTN_PRIMARY, 'max-sm:w-full')}>
                            <ExternalLink className="h-4 w-4" />
                            {fa ? 'باز کردن صفحه بارگذاری افزونه' : 'Open the plugin upload page'}
                        </a>
                    )}
                    <button type="button" onClick={() => update({ installed: true })} className={cn(WOO_BTN_GHOST, 'max-sm:w-full')}>
                        {fa ? 'نصب کردم' : 'I installed it'}
                    </button>
                </SetupStep>

                <SetupStep
                    index={2}
                    fa={fa}
                    state={state(2)}
                    title={fa ? 'در صفحه «ویجنت» وردپرس، «اتصال» را بزنید' : 'Press “Connect” on the Vigent page in WordPress'}
                    desc={fa
                        ? 'از منوی وردپرس صفحه «ویجنت» را باز کنید و دکمه «اتصال» را بزنید؛ محصولات و سفارش‌ها خودکار همگام می‌شوند.'
                        : 'Open the “Vigent” page in the WordPress menu and press “Connect”. Products and orders then sync automatically.'}
                    quiet={pluginPageUrl ? (
                        <a href={pluginPageUrl} target="_blank" rel="noopener noreferrer" className={quietLink}>
                            <ExternalLink className="h-3.5 w-3.5" />
                            {fa ? 'باز کردن صفحه ویجنت در وردپرس' : 'Open the Vigent page in WordPress'}
                        </a>
                    ) : undefined}
                    last
                >
                    {pluginPageUrl && (
                        <a href={pluginPageUrl} target="_blank" rel="noopener noreferrer" className={cn(WOO_BTN_PRIMARY, 'max-sm:w-full')}>
                            <ExternalLink className="h-4 w-4" />
                            {fa ? 'باز کردن صفحه ویجنت در وردپرس' : 'Open the Vigent page in WordPress'}
                        </a>
                    )}
                    <button type="button" onClick={() => update({ installed: false })} className={cn(WOO_BTN_GHOST, 'max-sm:w-full')}>
                        {fa ? 'برگشت به قدم ۲' : 'Back to step 2'}
                    </button>
                </SetupStep>
            </ol>

            {/* Phones: the listening row leads, so it never sits below the fold. */}
            <div className="max-sm:order-first">
                {status ?? <ListeningRow fa={fa} />}
            </div>
        </div>
    )
}

function SetupStep({
    index,
    fa,
    state,
    title,
    desc,
    quiet,
    last = false,
    children,
}: {
    index: number
    fa: boolean
    state: StepState
    title: string
    desc: string
    /** The step's link when it is not the current one. */
    quiet?: ReactNode
    last?: boolean
    children?: ReactNode
}) {
    return (
        <li aria-current={state === 'current' ? 'step' : undefined} className={cn('relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3', !last && 'pb-4')}>
            {!last && (
                <span aria-hidden className={cn('absolute bottom-1 start-[13px] top-9 w-0.5 rounded-full', state === 'done' ? 'bg-[var(--ok)]' : 'bg-[var(--bg-muted)]')} />
            )}
            <span
                className={cn(
                    'grid h-7 w-7 place-items-center rounded-full text-[12.5px] font-extrabold tabular-nums',
                    state === 'done' && 'bg-[var(--ok)] text-white',
                    state === 'current' && 'bg-[var(--text-primary)] text-white shadow-[0_0_0_4px_rgba(17,17,17,0.08)]',
                    state === 'next' && 'bg-white text-[var(--text-muted)] shadow-[inset_0_0_0_1.5px_var(--border-default)]',
                )}
            >
                {state === 'done' ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : (index + 1).toLocaleString(fa ? 'fa-IR' : 'en-US')}
                <span className="sr-only">{state === 'done' ? (fa ? ' (انجام شد)' : ' (done)') : ''}</span>
            </span>
            <div className={cn('min-w-0', state === 'next' && 'opacity-70')}>
                <p className="pt-0.5 text-[14px] font-bold leading-7 text-[var(--text-primary)]">{title}</p>
                {state === 'current' ? (
                    <div className="mt-2 rounded-2xl bg-[var(--bg-base)] p-3.5">
                        <p className={cn(WOO_NOTE, 'text-[13px] text-[var(--text-secondary)]')}>{desc}</p>
                        {children ? <div className="mt-3 flex flex-wrap items-center gap-2">{children}</div> : null}
                    </div>
                ) : quiet ? (
                    <div className="mt-0.5">{quiet}</div>
                ) : null}
            </div>
        </li>
    )
}
