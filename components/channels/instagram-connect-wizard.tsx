'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Camera, ChevronRight, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react'

/**
 * Instagram connection wizard — a guided 3-step flow that replaces the old
 * "paste a token and pray" single-field form:
 *
 *   STEP 1 — operator pastes a User Access Token (EAA… from Graph API Explorer)
 *   STEP 2 — we list their Facebook Pages + the IG account linked to each;
 *            operator picks the right page (the IG username + avatar makes it
 *            obvious, so they can't accidentally wire up the wrong account)
 *   STEP 3 — we POST the chosen Page's Page Access Token to the existing
 *            messenger-channel connect API, which persists it.
 *
 * This exists because the #1 Instagram support ticket is "I connected the token
 * but DMs don't work" — caused by using a User/IGAA token instead of a Page
 * token. The wizard makes the right token type the only path.
 */
interface InstagramPage {
        pageId: string
        pageName: string
        pageAccessToken: string
        pageCategory?: string
        instagram: {
                igBusinessAccountId: string
                username: string
                name?: string
                profilePictureUrl?: string
                followersCount?: number
                biography?: string
        } | null
        instagramError?: string
}

interface PagesResponse {
        tokenType: 'PAGE' | 'USER' | 'INSTAGRAM_USER' | 'UNKNOWN'
        pages: InstagramPage[]
        error?: string
        resolvedUsername?: string
        resolvedHost?: string
}

type Step = 'token' | 'pages' | 'connecting' | 'done' | 'error'

export function InstagramConnectWizard({
        agentId,
        onDone,
}: {
        agentId: string
        onDone: (botUsername: string) => void
}) {
        const t = useTranslations('channels')
        const [step, setStep] = useState<Step>('token')
        const [userToken, setUserToken] = useState('')
        const [pages, setPages] = useState<InstagramPage[]>([])
        const [lookupError, setLookupError] = useState<string | null>(null)
        const [busy, setBusy] = useState(false)
        const [connectError, setConnectError] = useState<string | null>(null)
        const [selectedPageId, setSelectedPageId] = useState<string | null>(null)

        async function lookupPages() {
                if (!userToken.trim()) return
                setBusy(true)
                setLookupError(null)
                try {
                        const res = await fetch(`/api/agents/${agentId}/channels/instagram-pages`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userToken: userToken.trim() }),
                        })
                        const data: PagesResponse = await res.json().catch(() => ({ tokenType: 'UNKNOWN', pages: [] }))
                        if (!res.ok || data.error) {
                                setLookupError(data.error ?? t('connectError'))
                                setStep('error')
                                return
                        }
                        setPages(data.pages)
                        setStep('pages')
                } catch (e) {
                        setLookupError(e instanceof Error ? e.message : String(e))
                        setStep('error')
                } finally {
                        setBusy(false)
                }
        }

        async function connectWithPage(page: InstagramPage) {
                if (!page.instagram) {
                        setConnectError(
                                'این Page اکانت اینستاگرام متصل ندارد. اول در اپ اینستاگرام: Settings → Business → Connect a Facebook Page.',
                        )
                        return
                }
                setBusy(true)
                setSelectedPageId(page.pageId)
                setConnectError(null)
                setStep('connecting')
                try {
                        // POST the Page Access Token to the shared messenger connect endpoint,
                        // exactly as the old single-field form did — only now we know it's a
                        // real Page token (EAA…) tied to the IG account the operator just picked.
                        const res = await fetch(`/api/agents/${agentId}/channels/messenger`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                        type: 'INSTAGRAM',
                                        botToken: page.pageAccessToken,
                                }),
                        })
                        const data = await res.json().catch(() => ({}))
                        if (!res.ok) {
                                setConnectError(data.error === 'INVALID_TOKEN' ? t('invalidToken') : t('connectError'))
                                setStep('pages')
                                return
                        }
                        setStep('done')
                        onDone(data.botUsername ?? page.instagram.username)
                } catch (e) {
                        setConnectError(e instanceof Error ? e.message : String(e))
                        setStep('pages')
                } finally {
                        setBusy(false)
                        setSelectedPageId(null)
                }
        }

        function reset() {
                setStep('token')
                setUserToken('')
                setPages([])
                setLookupError(null)
                setConnectError(null)
                setSelectedPageId(null)
        }

        // ─── STEP: TOKEN ENTRY ────────────────────────────────────────────
        if (step === 'token' || step === 'error') {
                return (
                        <div className="mt-4 space-y-3">
                                <DevModeWarning />
                                <WizardGuide />
                                <div className="space-y-1">
                                        <label className="text-xs font-medium text-[var(--text-primary)]">
                                                {t('fieldPageToken')}
                                        </label>
                                        <input
                                                dir="ltr"
                                                value={userToken}
                                                onChange={(e) => setUserToken(e.target.value)}
                                                placeholder="EAA…"
                                                className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
                                        />
                                        <p className="text-[11px] leading-relaxed text-[var(--text-tertiary)]">
                                                یک <b>User Access Token</b> با پیشوند <code dir="ltr">EAA</code> از Graph API Explorer وارد کنید.
                                                ما خودمان Page Access Token را از روی آن می‌سازیم.
                                        </p>
                                </div>
                                {lookupError && (
                                        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-2.5 text-xs text-danger">
                                                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                                <span className="leading-relaxed">{lookupError}</span>
                                        </div>
                                )}
                                <div className="flex justify-end">
                                        <button
                                                onClick={lookupPages}
                                                disabled={busy || !userToken.trim()}
                                                className="inline-flex items-center gap-1 rounded-lg bg-[var(--white)] px-4 py-1.5 text-sm font-medium text-[var(--bg-base)] disabled:opacity-50"
                                        >
                                                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                                                {t('next')}
                                        </button>
                                </div>
                        </div>
                )
        }

        // ─── STEP: PAGE PICKER ────────────────────────────────────────────
        if (step === 'pages' || step === 'connecting') {
                const igPages = pages.filter((p) => p.instagram)
                const noIgPages = pages.filter((p) => !p.instagram)
                return (
                        <div className="mt-4 space-y-3">
                                <div className="flex items-center justify-between">
                                        <p className="text-xs font-medium text-[var(--text-primary)]">
                                                {t('igWizardPickPageTitle', { n: pages.length })}
                                        </p>
                                        <button
                                                onClick={reset}
                                                className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                        >
                                                <RefreshCw className="h-3 w-3" />
                                                {t('igWizardStartOver')}
                                        </button>
                                </div>

                                {connectError && (
                                        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-2.5 text-xs text-danger">
                                                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                                <span className="leading-relaxed">{connectError}</span>
                                        </div>
                                )}

                                {igPages.length === 0 && (
                                        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] p-3 text-xs text-[var(--text-secondary)]">
                                                هیچ‌یک از Page‌های شما اکانت اینستاگرام متصل ندارد. برای وصل کردن:
                                                <ol className="mt-1.5 list-decimal space-y-0.5 ps-4">
                                                        <li>اپ اینستاگرام را باز کنید</li>
                                                        <li>Settings → Business (یا Creator)</li>
                                                        <li>«Switch to Professional Account» (اگر قبلاً نکرده‌اید)</li>
                                                        <li>«Connect a Facebook Page» را بزنید و Page خود را انتخاب کنید</li>
                                                </ol>
                                        </div>
                                )}

                                <div className="max-h-72 space-y-2 overflow-y-auto pe-1">
                                        {igPages.map((p) => (
                                                <button
                                                        key={p.pageId}
                                                        onClick={() => connectWithPage(p)}
                                                        disabled={busy}
                                                        className={`flex w-full items-center gap-3 rounded-xl border p-3 text-right transition-colors disabled:opacity-50 ${
                                                                selectedPageId === p.pageId
                                                                        ? 'border-[var(--border-strong)] bg-[var(--bg-surface)]'
                                                                        : 'border-[var(--border-default)] bg-[var(--bg-base)] hover:bg-[var(--bg-surface)]'
                                                        }`}
                                                >
                                                        {p.instagram?.profilePictureUrl ? (
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                <img
                                                                        src={p.instagram.profilePictureUrl}
                                                                        alt={p.instagram.username}
                                                                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                                                                />
                                                        ) : (
                                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)]">
                                                                        <Camera className="h-5 w-5 text-[var(--text-tertiary)]" />
                                                                </div>
                                                        )}
                                                        <div className="min-w-0 flex-1">
                                                                <div className="truncate text-sm font-medium text-[var(--text-primary)]">
                                                                        @{p.instagram?.username ?? '(unknown)'}
                                                                </div>
                                                                <div className="truncate text-xs text-[var(--text-secondary)]">
                                                                        {p.pageName}
                                                                        {p.instagram?.followersCount != null
                                                                                ? ` · ${p.instagram.followersCount.toLocaleString('fa-IR')} فالوور`
                                                                                : ''}
                                                                </div>
                                                        </div>
                                                        {selectedPageId === p.pageId && busy ? (
                                                                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--text-secondary)]" />
                                                        ) : (
                                                                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
                                                        )}
                                                </button>
                                        ))}

                                        {noIgPages.length > 0 && (
                                                <details className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-3">
                                                        <summary className="cursor-pointer text-xs text-[var(--text-tertiary)]">
                                                                {noIgPages.length} Page بدون اکانت اینستاگرام (نمایش)
                                                        </summary>
                                                        <ul className="mt-2 space-y-1 text-xs text-[var(--text-tertiary)]">
                                                                {noIgPages.map((p) => (
                                                                        <li key={p.pageId}>
                                                                                {p.pageName} — {p.instagramError ?? 'اکانت IG متصل ندارد'}
                                                                        </li>
                                                                ))}
                                                        </ul>
                                                </details>
                                        )}
                                </div>
                        </div>
                )
        }

        // ─── STEP: DONE ───────────────────────────────────────────────────
        return (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 p-3 text-sm text-success">
                        <CheckCircle2 className="h-5 w-5 shrink-0" />
                        <span>{t('igWizardDone')}</span>
                </div>
        )
}

/**
 * Persistent warning banner explaining the Development Mode / App Review
 * limitation — shown at the top of the Instagram connect wizard so the
 * operator understands BEFORE connecting that:
 *   - connecting works (token is valid, webhooks fire, messages are received)
 *   - BUT replying to DMs requires instagram_manage_messages Advanced Access,
 *     which needs Meta's App Review (2-5 business days)
 *   - Until review is approved, only tester/admin accounts can DM with the bot
 *
 * This is the single most common Instagram support ticket; surfacing it
 * upfront prevents a frustrating "I connected but it doesn't reply" loop.
 */
function DevModeWarning() {
        const [open, setOpen] = useState(false)
        return (
                <div className="rounded-xl border border-amber-400/40 bg-amber-50/80 p-3 dark:bg-amber-950/30">
                        <button
                                type="button"
                                onClick={() => setOpen((v) => !v)}
                                className="flex w-full items-start gap-2 text-right"
                        >
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                <span className="flex-1 text-xs font-medium leading-relaxed text-amber-900 dark:text-amber-200">
                                        تذکر مهم — قبل از اتصال بخوانید: محدودیت Development Mode
                                </span>
                                <span className="text-[10px] text-amber-700 dark:text-amber-400">
                                        {open ? 'بستن' : 'بیشتر'}
                                </span>
                        </button>
                        {open && (
                                <div className="mt-2 space-y-2 border-t border-amber-300/50 pt-2 text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
                                        <p>
                                                اپ متا شما در حالت <b>Development</b> است. در این حالت:
                                        </p>
                                        <ul className="list-disc space-y-0.5 ps-4">
                                                <li>✅ اتصال کانال کار می‌کند (توکن معتبر است)</li>
                                                <li>✅ پیام‌های دریافتی در داشبورد نمایش داده می‌شوند</li>
                                                <li>❌ <b>پاسخ خودکار به دایرکت کار نمی‌کند</b> — خطای 230 از متا</li>
                                        </ul>
                                        <p className="mt-1.5">
                                                <b>دلیل:</b> متا برای ارسال پاسخ به DM نیاز به <code dir="ltr">instagram_manage_messages</code> با
                                                <b> Advanced Access</b> دارد که فقط با <b>App Review</b> به‌دست می‌آید.
                                        </p>
                                        <p className="mt-1.5">
                                                <b>راه‌حل (برای کار کردن کامل):</b>
                                        </p>
                                        <ol className="list-decimal space-y-0.5 ps-4">
                                                <li>developers.facebook.com → اپ شما → <b>App Review</b> → Permissions and Features</li>
                                                <li>برای <code dir="ltr">instagram_manage_messages</code> روی «Request Advanced Access» بزنید</li>
                                                <li>Use case بنویسید + اسکرین‌شات پنل vigent آپلود کنید</li>
                                                <li>Submit (۲-۵ روز کاری)</li>
                                                <li>بعد از approval: اپ را <b>Live</b> کنید (toggle بالای صفحه)</li>
                                        </ol>
                                        <p className="mt-1.5">
                                                <b>تا Approval (تست موقت):</b> فقط اکانت‌های tester/admin می‌توانند پیام بفرستند و پاسخ بگیرند.
                                                اکانت تست را در App Roles → Instagram Testers اضافه کنید.
                                        </p>
                                        <p className="mt-1.5 text-amber-700 dark:text-amber-400">
                                                💡 اگر فقط می‌خواهید پاسخ به کامنت‌ها را تست کنید، نیازی به App Review نیست —
                                                کامنت‌ها با Standard Access هم کار می‌کنند.
                                        </p>
                                </div>
                        )}
                </div>
        )
}

/**
 * The setup-guide panel shown above the token input. Walks the operator through
 * getting the right User Access Token, since this is the step that goes wrong
 * most often. Mirrors the `guide.INSTAGRAM` array in messages/*.json but with
 * live links and tighter formatting.
 */
function WizardGuide() {
        const t = useTranslations('channels')
        const [open, setOpen] = useState(false)
        const guideSteps = t.raw(`guide.INSTAGRAM`) as unknown
        const steps = Array.isArray(guideSteps) ? (guideSteps as string[]) : []
        if (!steps.length) return null
        return (
                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)]">
                        <button
                                type="button"
                                onClick={() => setOpen((v) => !v)}
                                className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-[var(--text-secondary)]"
                        >
                                <span>{t('setupGuide')}</span>
                        </button>
                        {open && (
                                <div className="space-y-3 px-3 pb-3 text-xs text-[var(--text-secondary)]">
                                        <ol className="list-decimal space-y-1.5 ps-5 marker:text-[var(--text-tertiary)]">
                                                {steps.map((s, i) => (
                                                        <li key={i} className="leading-relaxed">{s}</li>
                                                ))}
                                        </ol>
                                        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-2.5">
                                                <p className="font-medium text-[var(--text-primary)]">دسترسی‌های لازم (Permissions):</p>
                                                <p className="mt-1 leading-relaxed">
                                                        هنگام Generate Token در Graph API Explorer، این تیک‌ها را بزنید:
                                                </p>
                                                <code dir="ltr" className="mt-1.5 block text-[11px] text-[var(--text-primary)]">
                                                        pages_show_list, pages_read_engagement, pages_messaging,<br />
                                                        instagram_basic, instagram_manage_messages, instagram_manage_comments
                                                </code>
                                        </div>
                                        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-2.5">
                                                <p className="font-medium text-[var(--text-primary)]">لینک‌های مفید:</p>
                                                <ul className="mt-1 space-y-0.5">
                                                        <li>
                                                                <a
                                                                        href="https://developers.facebook.com/tools/explorer/"
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-[var(--text-secondary)] underline hover:text-[var(--text-primary)]"
                                                                >
                                                                        Graph API Explorer
                                                                </a>
                                                        </li>
                                                        <li>
                                                                <a
                                                                        href="https://www.facebook.com/pages/create"
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-[var(--text-secondary)] underline hover:text-[var(--text-primary)]"
                                                                >
                                                                        ساخت Facebook Page (اگر ندارید)
                                                                </a>
                                                        </li>
                                                </ul>
                                        </div>
                                        <p className="text-[11px] leading-relaxed text-[var(--text-tertiary)]">
                                                نکته: توکن‌های User معمولاً ۱ ساعته‌اند. برای دایرکت‌های مداوم، بعد از اتصال،
                                                توکن Page (که دائمی است) خودکار ذخیره می‌شود — نیازی به کار اضافه نیست.
                                        </p>
                                </div>
                        )}
                </div>
        )
}
