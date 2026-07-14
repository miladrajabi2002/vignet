'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import QRCode from 'qrcode'
import {
        Link2,
        Check,
        Copy,
        Loader2,
        Sparkles,
        ExternalLink,
        QrCode,
        Download,
        Plus,
        X,
        Palette,
        Send,
        User,
        Phone,
} from 'lucide-react'
import {
        normalizeChatLinkSettings,
        normalizeSlug,
        CHAT_LINK_BACKGROUNDS,
        type ChatLinkSettings,
} from '@/lib/chat-link/config'
import { contrastOn } from '@/lib/widget/config'

const COLOR_PRESETS = [
        '#0F0F10', '#2563EB', '#7C3AED', '#DB2777',
        '#E11D48', '#EA580C', '#16A34A', '#0D9488',
]

type LinkState = {
        slug: string
        enabled: boolean
        settings: ChatLinkSettings
        views: number
        url: string
}

export function ChatLinkChannel({
        agentId,
        agentName,
        appUrl,
        initialLink,
        suggestedSlug,
}: {
        agentId: string
        agentName: string
        appUrl: string
        initialLink: LinkState | null
        suggestedSlug: string
}) {
        const t = useTranslations('chatLink')
        const router = useRouter()

        const [link, setLink] = useState<LinkState | null>(initialLink)
        const [slug, setSlug] = useState(initialLink?.slug ?? suggestedSlug)
        const [settings, setSettings] = useState<ChatLinkSettings>(
                initialLink?.settings ?? normalizeChatLinkSettings(null),
        )
        const [showSettings, setShowSettings] = useState(!!initialLink)
        const [saving, setSaving] = useState(false)
        const [saved, setSaved] = useState(false)
        const [copied, setCopied] = useState(false)
        const [error, setError] = useState<string | null>(null)
        const [qr, setQr] = useState<string | null>(null)
        const [showQr, setShowQr] = useState(false)

        const publicUrl = useMemo(
                () => `${appUrl.replace(/\/+$/, '')}/c/${slug}`,
                [appUrl, slug],
        )
        const slugValid = normalizeSlug(slug) !== null

        function patch(p: Partial<ChatLinkSettings>) {
                setSettings((s) => ({ ...s, ...p }))
                setSaved(false)
        }

        const save = useCallback(async () => {
                setError(null)
                if (!slugValid) {
                        setError(t('slugInvalid'))
                        return
                }
                setSaving(true)
                setSaved(false)
                try {
                        const res = await fetch(`/api/agents/${agentId}/chat-link`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ slug: normalizeSlug(slug), enabled: true, settings }),
                        })
                        const data = await res.json().catch(() => null)
                        if (!res.ok) {
                                setError(
                                        data?.error === 'SLUG_TAKEN'
                                                ? t('slugTaken')
                                                : data?.error === 'INVALID_SLUG'
                                                        ? t('slugInvalid')
                                                        : t('saveError'),
                                )
                                return
                        }
                        setLink(data.link)
                        setSlug(data.link.slug)
                        setSettings(data.link.settings)
                        setSaved(true)
                        router.refresh()
                } catch {
                        setError(t('saveError'))
                } finally {
                        setSaving(false)
                }
        }, [agentId, slug, slugValid, settings, t, router])

        const remove = useCallback(async () => {
                if (!confirm(t('confirmRemove'))) return
                setSaving(true)
                try {
                        await fetch(`/api/agents/${agentId}/chat-link`, { method: 'DELETE' })
                        setLink(null)
                        setShowSettings(false)
                        router.refresh()
                } finally {
                        setSaving(false)
                }
        }, [agentId, t, router])

        function copy() {
                navigator.clipboard.writeText(publicUrl)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
        }

        // (Re)generate QR whenever the QR panel is open and the URL changes.
        useEffect(() => {
                if (!showQr) return
                let cancelled = false
                QRCode.toDataURL(publicUrl, {
                        width: 480,
                        margin: 1,
                        color: { dark: '#0F0F10', light: '#FFFFFF' },
                        errorCorrectionLevel: 'M',
                })
                        .then((url) => {
                                if (!cancelled) setQr(url)
                        })
                        .catch(() => {})
                return () => {
                        cancelled = true
                }
        }, [showQr, publicUrl])

        function downloadQr() {
                if (!qr) return
                const a = document.createElement('a')
                a.href = qr
                a.download = `chat-link-${slug}.png`
                a.click()
        }

        const isLive = !!link?.enabled

        return (
                <div className="spatial-surface rounded-[1.5rem] p-5 sm:p-6">
                        <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)]">
                                        <Link2 className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                                <span className="font-medium text-[var(--text-primary)]">{t('title')}</span>
                                                {isLive && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--green)]/10 px-2 py-0.5 text-[11px] text-[var(--green)]">
                                                                ● {t('live')}
                                                        </span>
                                                )}
                                        </div>
                                        <div className="text-sm text-[var(--text-secondary)]">{t('desc')}</div>
                                </div>
                                {link ? (
                                        <button
                                                onClick={remove}
                                                disabled={saving}
                                                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-danger disabled:opacity-50"
                                        >
                                                {t('remove')}
                                        </button>
                                ) : (
                                        <button
                                                onClick={() => setShowSettings(true)}
                                                className="inline-flex items-center gap-1 rounded-lg bg-[var(--white)] px-4 py-1.5 text-sm font-medium text-[var(--bg-base)]"
                                        >
                                                {t('create')}
                                        </button>
                                )}
                        </div>

                        {showSettings && (
                                <div className="mt-5 grid gap-6 lg:grid-cols-2">
                                        {/* ── Form ── */}
                                        <div className="space-y-5">
                                                {/* Slug + link */}
                                                <section className="space-y-3">
                                                        <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                                                                {t('yourLink')}
                                                        </h4>
                                                        <div>
                                                                <div
                                                                        dir="ltr"
                                                                        className="flex items-stretch overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)]"
                                                                >
                                                                        <span className="flex items-center whitespace-nowrap border-e border-[var(--border-default)] bg-[var(--bg-muted)] px-3 text-xs text-[var(--text-muted)]">
                                                                                {appUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '')}/c/
                                                                        </span>
                                                                        <input
                                                                                dir="ltr"
                                                                                value={slug}
                                                                                onChange={(e) => {
                                                                                        setSlug(e.target.value.toLowerCase())
                                                                                        setSaved(false)
                                                                                        setError(null)
                                                                                }}
                                                                                placeholder="my-shop"
                                                                                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
                                                                        />
                                                                </div>
                                                                <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
                                                                        {t('slugHint')}
                                                                </p>
                                                        </div>

                                                        {/* Copy / open / QR row */}
                                                        <div className="flex flex-wrap items-center gap-2">
                                                                <button
                                                                        onClick={copy}
                                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                                                                >
                                                                        {copied ? (
                                                                                <Check className="h-3.5 w-3.5 text-success" />
                                                                        ) : (
                                                                                <Copy className="h-3.5 w-3.5" />
                                                                        )}
                                                                        {copied ? t('copied') : t('copyLink')}
                                                                </button>
                                                                <a
                                                                        href={publicUrl}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                                                                >
                                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                                        {t('openLink')}
                                                                </a>
                                                                <button
                                                                        onClick={() => setShowQr((v) => !v)}
                                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                                                                >
                                                                        <QrCode className="h-3.5 w-3.5" />
                                                                        {t('qrCode')}
                                                                </button>
                                                        </div>

                                                        {showQr && (
                                                                <div className="flex items-center gap-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-4">
                                                                        {qr ? (
                                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                                <img
                                                                                        src={qr}
                                                                                        alt="QR"
                                                                                        width={112}
                                                                                        height={112}
                                                                                        decoding="async"
                                                                                        className="h-28 w-28 rounded-lg bg-white p-1"
                                                                                />
                                                                        ) : (
                                                                                <div className="flex h-28 w-28 items-center justify-center rounded-lg bg-[var(--bg-muted)]">
                                                                                        <Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" />
                                                                                </div>
                                                                        )}
                                                                        <div className="flex-1">
                                                                                <p className="text-sm text-[var(--text-primary)]">{t('qrHint')}</p>
                                                                                <button
                                                                                        onClick={downloadQr}
                                                                                        disabled={!qr}
                                                                                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-50"
                                                                                >
                                                                                        <Download className="h-3.5 w-3.5" />
                                                                                        {t('downloadQr')}
                                                                                </button>
                                                                        </div>
                                                                </div>
                                                        )}
                                                </section>

                                                {/* Appearance */}
                                                <section className="space-y-3">
                                                        <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                                                                <Palette className="h-3.5 w-3.5" />
                                                                {t('appearance')}
                                                        </h4>

                                                        <Field label={`${t('displayName')} · ${t('optional')}`}>
                                                                <input
                                                                        value={settings.displayName ?? ''}
                                                                        placeholder={agentName}
                                                                        onChange={(e) => patch({ displayName: e.target.value || null })}
                                                                        className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none"
                                                                />
                                                        </Field>

                                                        <Field label={`${t('tagline')} · ${t('optional')}`}>
                                                                <input
                                                                        value={settings.tagline ?? ''}
                                                                        placeholder={t('taglinePh')}
                                                                        onChange={(e) => patch({ tagline: e.target.value || null })}
                                                                        className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none"
                                                                />
                                                        </Field>

                                                        <Field label={t('brandColor')}>
                                                                <div className="space-y-2">
                                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                                                {COLOR_PRESETS.map((hex) => {
                                                                                        const active =
                                                                                                settings.primaryColor.toLowerCase() === hex.toLowerCase()
                                                                                        return (
                                                                                                <button
                                                                                                        key={hex}
                                                                                                        type="button"
                                                                                                        onClick={() => patch({ primaryColor: hex })}
                                                                                                        aria-label={hex}
                                                                                                        className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${
                                                                                                                active
                                                                                                                        ? 'ring-2 ring-[var(--white)] ring-offset-2 ring-offset-[var(--bg-surface)]'
                                                                                                                        : ''
                                                                                                        }`}
                                                                                                        style={{ background: hex }}
                                                                                                />
                                                                                        )
                                                                                })}
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                                <input
                                                                                        type="color"
                                                                                        value={settings.primaryColor}
                                                                                        onChange={(e) => patch({ primaryColor: e.target.value })}
                                                                                        className="h-9 w-12 cursor-pointer rounded-lg border border-[var(--border-default)] bg-transparent p-1"
                                                                                />
                                                                                <input
                                                                                        type="text"
                                                                                        dir="ltr"
                                                                                        value={settings.primaryColor}
                                                                                        onChange={(e) => patch({ primaryColor: e.target.value })}
                                                                                        className="w-28 rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none"
                                                                                />
                                                                        </div>
                                                                </div>
                                                        </Field>

                                                        <Field label={t('background')}>
                                                                <div className="grid grid-cols-2 gap-2">
                                                                        {CHAT_LINK_BACKGROUNDS.map((b) => {
                                                                                const active = settings.background === b.value
                                                                                return (
                                                                                        <button
                                                                                                key={b.value}
                                                                                                type="button"
                                                                                                onClick={() => patch({ background: b.value })}
                                                                                                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                                                                                                        active
                                                                                                                ? 'border-[var(--white)] bg-[var(--white)] font-medium text-[var(--bg-base)]'
                                                                                                                : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                                                                }`}
                                                                                        >
                                                                                                {b.labelFa}
                                                                                        </button>
                                                                                )
                                                                        })}
                                                                </div>
                                                        </Field>

                                                        <Toggle
                                                                label={t('aiBadge')}
                                                                hint={t('aiBadgeHint')}
                                                                checked={settings.showAiBadge}
                                                                onChange={(v) => patch({ showAiBadge: v })}
                                                        />
                                                </section>

                                                {/* Interaction */}
                                                <section className="space-y-3">
                                                        <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                                                                <Sparkles className="h-3.5 w-3.5" />
                                                                {t('interaction')}
                                                        </h4>

                                                        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-3">
                                                                <div className="text-sm text-[var(--text-primary)]">
                                                                        {t('quickReplies')}
                                                                </div>
                                                                <div className="text-xs text-[var(--text-secondary)]">
                                                                        {t('quickRepliesHint')}
                                                                </div>
                                                                <div className="mt-3 space-y-2">
                                                                        {settings.quickReplies.map((q, i) => (
                                                                                <div key={i} className="flex items-center gap-2">
                                                                                        <input
                                                                                                value={q}
                                                                                                maxLength={80}
                                                                                                placeholder={t('quickRepliesPh')}
                                                                                                onChange={(e) => {
                                                                                                        const next = [...settings.quickReplies]
                                                                                                        next[i] = e.target.value
                                                                                                        patch({ quickReplies: next })
                                                                                                }}
                                                                                                className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none"
                                                                                        />
                                                                                        <button
                                                                                                type="button"
                                                                                                aria-label={t('remove')}
                                                                                                onClick={() =>
                                                                                                        patch({
                                                                                                                quickReplies: settings.quickReplies.filter(
                                                                                                                        (_, j) => j !== i,
                                                                                                                ),
                                                                                                        })
                                                                                                }
                                                                                                className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:text-danger"
                                                                                        >
                                                                                                <X className="h-4 w-4" />
                                                                                        </button>
                                                                                </div>
                                                                        ))}
                                                                        {settings.quickReplies.length < 6 && (
                                                                                <button
                                                                                        type="button"
                                                                                        onClick={() =>
                                                                                                patch({ quickReplies: [...settings.quickReplies, ''] })
                                                                                        }
                                                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                                                                >
                                                                                        <Plus className="h-3.5 w-3.5" />
                                                                                        {t('quickRepliesAdd')}
                                                                                </button>
                                                                        )}
                                                                </div>
                                                        </div>

                                                        <Toggle
                                                                label={t('leadCapture')}
                                                                hint={t('leadCaptureHint')}
                                                                checked={settings.leadCapture}
                                                                onChange={(v) => patch({ leadCapture: v })}
                                                        />
                                                        {settings.leadCapture && (
                                                                <>
                                                                        <Field label={`${t('leadCaptureMessage')} · ${t('optional')}`}>
                                                                                <textarea
                                                                                        rows={2}
                                                                                        value={settings.leadCaptureMessage ?? ''}
                                                                                        placeholder={t('leadCaptureMessagePh')}
                                                                                        onChange={(e) =>
                                                                                                patch({ leadCaptureMessage: e.target.value || null })
                                                                                        }
                                                                                        className="w-full resize-none rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none"
                                                                                />
                                                                        </Field>
                                                                        <Toggle
                                                                                label={t('leadCaptureRequired')}
                                                                                hint={t('leadCaptureRequiredHint')}
                                                                                checked={settings.leadCaptureRequired}
                                                                                onChange={(v) => patch({ leadCaptureRequired: v })}
                                                                        />
                                                                </>
                                                        )}
                                                </section>

                                                {/* Save */}
                                                <div className="flex flex-wrap items-center gap-3">
                                                        <button
                                                                onClick={save}
                                                                disabled={saving || !slugValid}
                                                                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--white)] px-4 py-2 text-sm font-medium text-[var(--bg-base)] disabled:opacity-50"
                                                        >
                                                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                                                {saving ? t('saving') : link ? t('save') : t('publish')}
                                                        </button>
                                                        {saved && (
                                                                <span className="inline-flex items-center gap-1 text-sm text-success">
                                                                        <Check className="h-4 w-4" />
                                                                        {t('saved')}
                                                                </span>
                                                        )}
                                                        {error && <span className="text-sm text-danger">{error}</span>}
                                                        {link && (
                                                                <span className="ms-auto text-xs text-[var(--text-muted)]">
                                                                        {t('views', { count: link.views })}
                                                                </span>
                                                        )}
                                                </div>
                                        </div>

                                        {/* ── Live preview ── */}
                                        <div className="space-y-2">
                                                <span className="text-xs text-[var(--text-secondary)]">
                                                        {t('livePreview')}
                                                </span>
                                                <ChatLinkPreview
                                                        name={settings.displayName || agentName}
                                                        settings={settings}
                                                />
                                        </div>
                                </div>
                        )}
                </div>
        )
}

// ─── Mini phone preview ──────────────────────────────────────────────────────

function ChatLinkPreview({ name, settings }: { name: string; settings: ChatLinkSettings }) {
        const accent = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(settings.primaryColor)
                ? settings.primaryColor
                : '#0F0F10'
        const onAccent = contrastOn(accent)
        const monogram = (name || '؟').trim().charAt(0)

        return (
                <div className="mx-auto w-full max-w-[300px]">
                        <div className="relative overflow-hidden rounded-[2rem] border-[6px] border-neutral-800 bg-[#f2f2f0] shadow-xl">
                                {/* Ambient background blurs — match the actual /c/[slug] page */}
                                {settings.background !== 'minimal' && (
                                        <>
                                                <span
                                                        className="pointer-events-none absolute -start-10 -top-10 h-36 w-36 rounded-full blur-3xl"
                                                        style={{
                                                                backgroundColor: settings.background === 'mesh' ? accent : '#94a3b8',
                                                                opacity: 0.18,
                                                        }}
                                                />
                                                <span
                                                        className="pointer-events-none absolute -end-10 bottom-20 h-32 w-32 rounded-full blur-3xl"
                                                        style={{ backgroundColor: accent, opacity: 0.14 }}
                                                />
                                        </>
                                )}

                                {/* App column — mirrors the actual page's white/55 backdrop-blur container */}
                                <div className="relative flex h-[460px] flex-col bg-white/55 backdrop-blur-sm">
                                        {/* Header — matches actual: larger avatar, "آنلاین — پاسخ فوری" with ping dot */}
                                        <div className="flex items-center gap-3 border-b border-black/[0.06] bg-white/82 px-3.5 py-3 backdrop-blur-2xl">
                                                <span
                                                        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1 ring-black/10"
                                                        style={{ backgroundColor: accent, color: onAccent }}
                                                >
                                                        {monogram}
                                                        <span className="absolute -bottom-0.5 -end-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                        <div className="truncate text-xs font-semibold leading-tight text-neutral-900">
                                                                {name}
                                                        </div>
                                                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-neutral-500">
                                                                <span className="relative flex h-1.5 w-1.5">
                                                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
                                                                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                                </span>
                                                                آنلاین — پاسخ فوری
                                                        </div>
                                                </div>
                                        </div>

                                        {/* Intro — matches actual: large avatar with ring, AI badge with shadow, semibold name */}
                                        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
                                                <span
                                                        className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold ring-1 ring-black/10"
                                                        style={{ backgroundColor: accent, color: onAccent }}
                                                >
                                                        {monogram}
                                                </span>
                                                {settings.showAiBadge && (
                                                        <span className="mt-4 inline-flex min-h-7 items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/85 px-3 text-[11px] tracking-wide text-neutral-600 shadow-[0_8px_24px_rgba(0,0,0,0.06)] backdrop-blur">
                                                                <Sparkles className="h-2.5 w-2.5" style={{ color: accent }} />
                                                                پاسخ فوری با هوش مصنوعی
                                                        </span>
                                                )}
                                                <div className="mt-2.5 text-lg font-semibold tracking-tight text-neutral-900">{name}</div>
                                                {settings.tagline && (
                                                        <div className="mt-1 max-w-[220px] text-[11px] leading-relaxed text-neutral-500">
                                                                {settings.tagline}
                                                        </div>
                                                )}
                                                {settings.quickReplies.filter(Boolean).length > 0 && (
                                                        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                                                                {settings.quickReplies
                                                                        .filter(Boolean)
                                                                        .slice(0, 3)
                                                                        .map((q, i) => (
                                                                                <span
                                                                                        key={i}
                                                                                        className="rounded-full border border-black/10 bg-white/85 px-2.5 py-1 text-[11px] text-neutral-700 shadow-sm backdrop-blur"
                                                                                >
                                                                                        {q}
                                                                                </span>
                                                                        ))}
                                                        </div>
                                                )}
                                        </div>

                                        {/* Composer — matches actual lead-capture card or message input */}
                                        <div className="border-t border-black/[0.06] bg-white/82 px-3 py-2.5 backdrop-blur-2xl">
                                                {settings.leadCapture ? (
                                                        <div className="space-y-2 rounded-[1.2rem] border border-black/[0.08] bg-white/90 p-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
                                                                <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-2.5 py-2">
                                                                        <User className="h-3 w-3 shrink-0 text-neutral-400" />
                                                                        <span className="text-[11px] text-neutral-400">نام شما</span>
                                                                </div>
                                                                <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-2.5 py-2">
                                                                        <Phone className="h-3 w-3 shrink-0 text-neutral-400" />
                                                                        <span className="text-[11px] text-neutral-400">شماره موبایل</span>
                                                                </div>
                                                                <div
                                                                        className="flex items-center justify-center rounded-xl py-2 text-[11px] font-medium"
                                                                        style={{ backgroundColor: accent, color: onAccent }}
                                                                >
                                                                        شروع گفتگو
                                                                </div>
                                                        </div>
                                                ) : (
                                                        <div className="flex items-center gap-2">
                                                                <div className="flex-1 rounded-full border border-black/10 bg-white px-3 py-2 text-[11px] text-neutral-400">
                                                                        پیام خود را بنویسید…
                                                                </div>
                                                                <span
                                                                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                                                                        style={{ backgroundColor: accent, color: onAccent }}
                                                                >
                                                                        <Send className="h-3.5 w-3.5" />
                                                                </span>
                                                        </div>
                                                )}
                                        </div>
                                </div>
                        </div>
                </div>
        )
}

// ─── Shared field primitives (local copies to keep this component standalone) ──

function Field({ label, children }: { label: string; children: React.ReactNode }) {
        return (
                <label className="block">
                        <span className="mb-1.5 block text-sm text-[var(--text-primary)]">{label}</span>
                        {children}
                </label>
        )
}

function Toggle({
        label,
        hint,
        checked,
        onChange,
}: {
        label: string
        hint: string
        checked: boolean
        onChange: (v: boolean) => void
}) {
        return (
                <button
                        type="button"
                        onClick={() => onChange(!checked)}
                        className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-3 text-start"
                >
                        <div className="flex-1">
                                <div className="text-sm text-[var(--text-primary)]">{label}</div>
                                <div className="text-xs text-[var(--text-secondary)]">{hint}</div>
                        </div>
                        <span
                                className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${
                                        checked
                                                ? 'border-[var(--white)] bg-[var(--white)]'
                                                : 'border-[var(--border-hover)] bg-[var(--bg-muted)]'
                                }`}
                        >
                                <span
                                        className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full shadow-sm transition-all ${
                                                checked
                                                        ? 'start-[18px] bg-[var(--bg-base)]'
                                                        : 'start-0.5 border border-[var(--border-hover)] bg-[var(--bg-base)]'
                                        }`}
                                />
                        </span>
                </button>
        )
}
