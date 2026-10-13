'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import QRCode from 'qrcode'
import { BarChart3, Check, Download, ExternalLink, Link2, Loader2, Plus, QrCode, Share2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CopyButton } from '@/components/ui/copy-button'
import { AutoSaveStatus } from '@/components/ui/auto-save-status'
import { StatusChip } from '@/components/ui/status-chip'
import { Switch } from '@/components/ui/switch'
import { ImageField } from '@/components/menu/menu-design'
import { useAutoSave } from '@/lib/hooks/use-auto-save'
import {
        normalizeChatLinkSettings,
        normalizeSlug,
        CHAT_LINK_BACKGROUNDS,
        MAX_CHAT_LINK_SOURCES,
        type ChatLinkSettings,
        type ChatLinkSource,
} from '@/lib/chat-link/config'
import {
        ChatLinkPreview,
        type ChatLinkPreviewProduct,
        type ChatLinkPreviewState,
} from './chat-link-preview'
import { ChatLinkStatsPanel } from './chat-link-stats'
import { ChannelLayout, ChannelLead } from './channel-stage'

const COLOR_PRESETS = [
        '#0F0F10', '#2563EB', '#7C3AED', '#DB2777',
        '#E11D48', '#EA580C', '#16A34A', '#0D9488',
]

const INPUT =
        'w-full rounded-lg border border-[var(--border-default)] bg-white px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)] focus:shadow-[0_0_0_3px_rgba(91,61,232,0.22)] disabled:cursor-not-allowed disabled:opacity-70'

const TABS = ['link', 'look', 'content', 'behavior', 'stats'] as const
type Tab = (typeof TABS)[number]
const TAB_LABEL: Record<Tab, string> = {
        link: 'tabLink',
        look: 'tabLook',
        content: 'tabContent',
        behavior: 'tabBehavior',
        stats: 'tabStats',
}

/** Ready-made tracking links for the places a chat link usually goes. */
const SOURCE_PRESETS: { key: string; labelKey: string }[] = [
        { key: 'ig', labelKey: 'sourcePresetIg' },
        { key: 'qr', labelKey: 'sourcePresetQr' },
        { key: 'sms', labelKey: 'sourcePresetSms' },
        { key: 'tg', labelKey: 'sourcePresetTg' },
]

type LinkState = {
        slug: string
        enabled: boolean
        settings: ChatLinkSettings
        views: number
        url: string
}

/**
 * Chat Link inside its side sheet. «ساخت لینک» publishes at once; from then on
 * appearance and behaviour save by themselves. Only the address has its own
 * confirm step, because changing it breaks the link people already have.
 */
export function ChatLinkChannel({
        agentId,
        agentName,
        agentAvatar,
        agentWelcome,
        appUrl,
        initialLink,
        suggestedSlug,
        customerIdentificationRequired,
        customerIdentificationMessage,
        productAccess,
        showcase,
}: {
        agentId: string
        agentName: string
        agentAvatar: string | null
        agentWelcome: string | null
        appUrl: string
        initialLink: LinkState | null
        suggestedSlug: string
        customerIdentificationRequired: boolean
        customerIdentificationMessage: string | null
        /** The agent may show products at all (the showcase needs it). */
        productAccess: boolean
        /** What the product shelf would show right now. */
        showcase: ChatLinkPreviewProduct[]
}) {
        const t = useTranslations('chatLink')
        const tc = useTranslations('channels')
        const common = useTranslations('common')
        const router = useRouter()

        const [link, setLink] = useState<LinkState | null>(initialLink)
        const [slug, setSlug] = useState(initialLink?.slug ?? suggestedSlug)
        const [settings, setSettings] = useState<ChatLinkSettings>(
                initialLink?.settings ?? normalizeChatLinkSettings(null),
        )
        const [tab, setTab] = useState<Tab>('look')
        const [screen, setScreen] = useState<ChatLinkPreviewState>('intro')
        const [busy, setBusy] = useState<'create' | 'slug' | 'pause' | 'remove' | null>(null)
        const [error, setError] = useState<string | null>(null)
        const [qr, setQr] = useState<string | null>(null)
        const [slugConfirmOpen, setSlugConfirmOpen] = useState(false)
        const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false)

        const origin = appUrl.replace(/\/+$/, '')
        const host = origin.replace(/^https?:\/\//, '')
        // Every share action points at the published address, never at the one
        // still being typed — an unsaved address answers 404.
        const publicUrl = `${origin}/c/${link?.slug ?? ''}`
        const nextSlug = normalizeSlug(slug)
        const slugDirty = !!link && nextSlug !== link.slug

        const linkRef = useRef(link)
        linkRef.current = link
        const auto = useAutoSave({
                value: settings,
                valid: !!link,
                save: async (next) => {
                        const current = linkRef.current
                        if (!current) return
                        const res = await fetch(`/api/agents/${agentId}/chat-link`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ slug: current.slug, settings: next }),
                        })
                        if (!res.ok) throw new Error('SAVE_FAILED')
                        // The sheet reads its starting values from the server on every open.
                        router.refresh()
                },
        })

        function patch(p: Partial<ChatLinkSettings>, show?: ChatLinkPreviewState) {
                setSettings((s) => ({ ...s, ...p }))
                if (show) setScreen(show)
        }

        const effectiveSettings: ChatLinkSettings = {
                ...settings,
                leadCapture: customerIdentificationRequired || settings.leadCapture,
                leadCaptureRequired: customerIdentificationRequired || settings.leadCaptureRequired,
                leadCaptureMessage: customerIdentificationRequired && customerIdentificationMessage?.trim()
                        ? customerIdentificationMessage.trim().slice(0, 200)
                        : settings.leadCaptureMessage,
        }

        const failure = useCallback(
                (code: unknown) =>
                        code === 'SLUG_TAKEN'
                                ? t('slugTaken')
                                : code === 'INVALID_SLUG'
                                        ? t('slugInvalid')
                                        : code === 'CHANNEL_LIMIT'
                                                ? tc('channelLimitError')
                                                : t('saveError'),
                [t, tc],
        )

        // «ساخت لینک» publishes at once with the defaults, so the address works the
        // moment the editor appears; everything after is an edit of a live link.
        const create = useCallback(async () => {
                setError(null)
                setBusy('create')
                try {
                        const base = normalizeSlug(slug) ?? suggestedSlug
                        // The suggested address can already be taken; a short suffix settles it.
                        for (let attempt = 0; attempt < 4; attempt++) {
                                const candidate = attempt === 0
                                        ? base
                                        : `${base.slice(0, 27)}-${Math.random().toString(36).slice(2, 6)}`
                                const res = await fetch(`/api/agents/${agentId}/chat-link`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ slug: candidate, enabled: true, settings }),
                                })
                                if (res.status === 409) continue
                                const data = await res.json().catch(() => null)
                                if (!res.ok || !data?.link) {
                                        setError(failure(data?.error))
                                        return
                                }
                                setLink(data.link)
                                setSlug(data.link.slug)
                                router.refresh()
                                return
                        }
                        setError(t('slugTaken'))
                } catch {
                        setError(t('saveError'))
                } finally {
                        setBusy(null)
                }
        }, [agentId, slug, suggestedSlug, settings, t, failure, router])

        const changeSlug = useCallback(async () => {
                if (!nextSlug) return
                setError(null)
                setBusy('slug')
                try {
                        const res = await fetch(`/api/agents/${agentId}/chat-link`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ slug: nextSlug, settings }),
                        })
                        const data = await res.json().catch(() => null)
                        if (!res.ok || !data?.link) {
                                setError(failure(data?.error))
                                return
                        }
                        setLink(data.link)
                        setSlug(data.link.slug)
                        setSlugConfirmOpen(false)
                        router.refresh()
                } catch {
                        setError(t('saveError'))
                } finally {
                        setBusy(null)
                }
        }, [agentId, nextSlug, settings, t, failure, router])

        const setEnabled = useCallback(async (enabled: boolean) => {
                setError(null)
                setBusy('pause')
                try {
                        const res = await fetch(`/api/agents/${agentId}/chat-link`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ enabled }),
                        })
                        if (!res.ok) {
                                const data = await res.json().catch(() => null)
                                setError(failure(data?.error))
                                return
                        }
                        setLink((current) => (current ? { ...current, enabled } : current))
                        router.refresh()
                } catch {
                        setError(t('saveError'))
                } finally {
                        setBusy(null)
                }
        }, [agentId, t, failure, router])

        const remove = useCallback(async () => {
                setError(null)
                setBusy('remove')
                try {
                        const res = await fetch(`/api/agents/${agentId}/chat-link`, { method: 'DELETE' })
                        if (!res.ok) {
                                setError(t('saveError'))
                                return
                        }
                        setLink(null)
                        setRemoveConfirmOpen(false)
                        router.refresh()
                } catch {
                        setError(t('saveError'))
                } finally {
                        setBusy(null)
                }
        }, [agentId, t, router])

        // A printed code is its own place, so it carries the «qr» tracking link when there is one.
        const qrTracked = settings.sources.some((source) => source.key === 'qr')
        const qrUrl = qrTracked ? `${publicUrl}?src=qr` : publicUrl
        const showQr = !!link && tab === 'link'
        useEffect(() => {
                if (!showQr) return
                let cancelled = false
                QRCode.toDataURL(qrUrl, {
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
        }, [showQr, qrUrl])

        function downloadQr() {
                if (!qr || !link) return
                const a = document.createElement('a')
                a.href = qr
                a.download = `chat-link-${link.slug}.png`
                a.click()
        }

        const sources = settings.sources
        function setSource(index: number, next: Partial<ChatLinkSource>) {
                patch({ sources: sources.map((source, i) => (i === index ? { ...source, ...next } : source)) })
        }
        const freePresets = useMemo(
                () => SOURCE_PRESETS.filter((preset) => !sources.some((source) => source.key === preset.key)),
                [sources],
        )

        // ── Not created yet ────────────────────────────────────────────────────
        // The address is chosen here and the page it will open is already on show,
        // so «ساخت لینک» is a decision about something seen, not a leap.
        if (!link) {
                return (
                        <ChannelLayout
                                stage={
                                        <ChatLinkPreview
                                                name={settings.displayName || agentName}
                                                avatar={settings.logoUrl ?? agentAvatar}
                                                welcomeMessage={settings.welcomeMessage ?? agentWelcome}
                                                settings={effectiveSettings}
                                                showcase={productAccess ? showcase : []}
                                                state={screen}
                                                onState={setScreen}
                                        />
                                }
                        >
                                <ChannelLead title={t('emptyTitle')} body={t('desc')} />

                                <form
                                        className="space-y-3"
                                        onSubmit={(event) => {
                                                event.preventDefault()
                                                void create()
                                        }}
                                >
                                        <div>
                                                <label htmlFor="chat-link-new-slug" className="ui-field-label">{t('yourLink')}</label>
                                                <div dir="ltr" className="flex items-stretch overflow-hidden rounded-xl border border-[var(--border-default)] bg-white transition-shadow focus-within:border-[var(--border-strong)] focus-within:shadow-[0_0_0_3px_rgba(91,61,232,0.22)]">
                                                        <span className="flex items-center whitespace-nowrap border-e border-[var(--border-default)] bg-[var(--bg-muted)] px-3 text-xs text-[var(--text-muted)]">
                                                                {host}/c/
                                                        </span>
                                                        <input
                                                                id="chat-link-new-slug"
                                                                dir="ltr"
                                                                value={slug}
                                                                autoComplete="off"
                                                                autoCapitalize="off"
                                                                spellCheck={false}
                                                                onChange={(e) => {
                                                                        setSlug(e.target.value.toLowerCase())
                                                                        setError(null)
                                                                }}
                                                                placeholder={suggestedSlug}
                                                                className="min-h-11 min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold text-[var(--text-primary)] outline-none"
                                                        />
                                                </div>
                                                <p className="mt-1.5 text-xs leading-6 text-[var(--text-muted)]">
                                                        {slug.trim() && !nextSlug ? t('slugInvalid') : t('slugHint')}
                                                </p>
                                        </div>

                                        {error && <p role="alert" className="text-sm leading-6 text-danger">{error}</p>}

                                        <Button type="submit" loading={busy === 'create'} className="w-full sm:w-auto">
                                                {busy !== 'create' && <Link2 className="h-4 w-4" />}
                                                {busy === 'create' ? t('creating') : t('create')}
                                        </Button>
                                        <p className="text-xs leading-6 text-[var(--text-muted)]">{t('emptyBody')}</p>
                                </form>

                                <ul className="grid gap-2.5 border-t border-[var(--border-subtle)] pt-5 sm:grid-cols-3">
                                        {([
                                                { icon: Share2, text: t('emptyPointShare') },
                                                { icon: QrCode, text: t('emptyPointQr') },
                                                { icon: BarChart3, text: t('emptyPointStats') },
                                        ] as const).map((point) => (
                                                <li key={point.text} className="flex items-start gap-2.5 text-xs leading-6 text-[var(--text-secondary)] sm:flex-col sm:gap-2">
                                                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--bg-muted)] text-[var(--text-primary)]">
                                                                <point.icon className="h-4 w-4" />
                                                        </span>
                                                        {point.text}
                                                </li>
                                        ))}
                                </ul>
                        </ChannelLayout>
                )
        }

        return (
                <div className="space-y-5">
                        {/* ── Link bar: state, address, share actions, save status ── */}
                        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] p-2.5">
                                <StatusChip tone={link.enabled ? 'ok' : 'warn'} dot>
                                        {link.enabled ? t('live') : t('paused')}
                                </StatusChip>
                                <span dir="ltr" className="min-w-[9rem] flex-1 truncate text-start text-sm font-semibold text-[var(--text-primary)]">
                                        {host}/c/{link.slug}
                                </span>
                                <CopyButton value={publicUrl} label={t('copyLink')} copiedLabel={t('copied')} showLabel className="bg-white" />
                                <a
                                        href={publicUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-default)] bg-white px-3 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                                >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        {t('openLink')}
                                </a>
                                <AutoSaveStatus status={auto.status} onRetry={auto.flush} errorLabel={t('saveError')} />
                        </div>

                        {!link.enabled && (
                                <div className="flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                        <span className="min-w-0 flex-1">{t('pausedNote')}</span>
                                        <Button type="button" variant="outline" onClick={() => void setEnabled(true)} disabled={busy === 'pause'}>
                                                {t('resume')}
                                        </Button>
                                </div>
                        )}

                        {error && <p role="alert" className="text-sm text-danger">{error}</p>}

                        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                                <div className="min-w-0">
                                        <div role="tablist" aria-label={t('title')} className="-mx-1 mb-5 flex gap-1 overflow-x-auto px-1 pb-1">
                                                {TABS.map((item) => (
                                                        <button
                                                                key={item}
                                                                type="button"
                                                                role="tab"
                                                                id={`chat-link-tab-${item}`}
                                                                aria-selected={tab === item}
                                                                aria-controls="chat-link-panel"
                                                                onClick={() => setTab(item)}
                                                                className={`min-h-10 whitespace-nowrap rounded-xl px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                                                                        tab === item
                                                                                ? 'bg-[#111] text-white'
                                                                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                                                                }`}
                                                        >
                                                                {t(TAB_LABEL[item])}
                                                        </button>
                                                ))}
                                        </div>

                                        <div id="chat-link-panel" role="tabpanel" aria-labelledby={`chat-link-tab-${tab}`} className="space-y-6" onBlur={auto.flush}>
                                                {tab === 'link' && (
                                                        <>
                                                                <Section title={t('yourLink')}>
                                                                        <div className="flex flex-wrap items-stretch gap-2">
                                                                                <div dir="ltr" className="flex min-w-[14rem] flex-1 items-stretch overflow-hidden rounded-xl border border-[var(--border-default)] bg-white">
                                                                                        <span className="flex items-center whitespace-nowrap border-e border-[var(--border-default)] bg-[var(--bg-muted)] px-3 text-xs text-[var(--text-muted)]">
                                                                                                {host}/c/
                                                                                        </span>
                                                                                        <input
                                                                                                dir="ltr"
                                                                                                value={slug}
                                                                                                onChange={(e) => {
                                                                                                        setSlug(e.target.value.toLowerCase())
                                                                                                        setError(null)
                                                                                                }}
                                                                                                aria-label={t('yourLink')}
                                                                                                placeholder="my-shop"
                                                                                                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
                                                                                        />
                                                                                </div>
                                                                                <Button type="button" variant="outline" disabled={!slugDirty || !nextSlug || busy === 'slug'} onClick={() => setSlugConfirmOpen(true)}>
                                                                                        {t('changeSlug')}
                                                                                </Button>
                                                                        </div>
                                                                        <p className="text-xs text-[var(--text-secondary)]">
                                                                                {slugDirty && !nextSlug ? t('slugInvalid') : slugDirty ? t('slugUnsaved') : t('slugHint')}
                                                                                {slugDirty && nextSlug && <span dir="ltr"> /c/{link.slug}</span>}
                                                                        </p>
                                                                </Section>

                                                                <Section title={t('qrCode')}>
                                                                        <div className="flex items-center gap-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-4">
                                                                                {qr ? (
                                                                                        // eslint-disable-next-line @next/next/no-img-element
                                                                                        <img src={qr} alt="QR" width={112} height={112} decoding="async" className="h-28 w-28 rounded-lg bg-white p-1" />
                                                                                ) : (
                                                                                        <div className="flex h-28 w-28 items-center justify-center rounded-lg bg-[var(--bg-muted)]">
                                                                                                <Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" />
                                                                                        </div>
                                                                                )}
                                                                                <div className="min-w-0 flex-1">
                                                                                        <p className="text-sm text-[var(--text-primary)]">{t('qrHint')}</p>
                                                                                        {qrTracked && <p className="mt-1 text-xs text-[var(--text-secondary)]">{t('qrTracked')}</p>}
                                                                                        <button
                                                                                                type="button"
                                                                                                onClick={downloadQr}
                                                                                                disabled={!qr}
                                                                                                className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white px-3 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-50"
                                                                                        >
                                                                                                <Download className="h-3.5 w-3.5" />
                                                                                                {t('downloadQr')}
                                                                                        </button>
                                                                                </div>
                                                                        </div>
                                                                </Section>

                                                                <Section title={t('sources')} hint={t('sourcesHint')}>
                                                                        <div className="space-y-2">
                                                                                {sources.map((source, index) => (
                                                                                        <div key={index} className="space-y-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-3">
                                                                                                <div className="flex items-center gap-2">
                                                                                                        <input
                                                                                                                value={source.label}
                                                                                                                maxLength={40}
                                                                                                                placeholder={t('sourceLabelPh')}
                                                                                                                aria-label={t('sourceLabelPh')}
                                                                                                                onChange={(e) => setSource(index, { label: e.target.value })}
                                                                                                                className={INPUT}
                                                                                                        />
                                                                                                        <input
                                                                                                                dir="ltr"
                                                                                                                value={source.key}
                                                                                                                maxLength={24}
                                                                                                                placeholder="key"
                                                                                                                aria-label={t('sourceKeyPh')}
                                                                                                                onChange={(e) => setSource(index, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                                                                                                                className={`${INPUT} w-24 shrink-0`}
                                                                                                        />
                                                                                                        <button
                                                                                                                type="button"
                                                                                                                aria-label={t('remove')}
                                                                                                                onClick={() => patch({ sources: sources.filter((_, i) => i !== index) })}
                                                                                                                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[var(--text-muted)] transition-colors hover:text-danger"
                                                                                                        >
                                                                                                                <X className="h-4 w-4" />
                                                                                                        </button>
                                                                                                </div>
                                                                                                {source.key && (
                                                                                                        <div className="flex items-center gap-2">
                                                                                                                <code dir="ltr" className="min-w-0 flex-1 truncate text-start text-xs text-[var(--text-secondary)]">
                                                                                                                        {host}/c/{link.slug}?src={source.key}
                                                                                                                </code>
                                                                                                                <CopyButton value={`${publicUrl}?src=${source.key}`} label={t('copyLink')} copiedLabel={t('copied')} className="bg-white" />
                                                                                                        </div>
                                                                                                )}
                                                                                        </div>
                                                                                ))}
                                                                        </div>
                                                                        {sources.length < MAX_CHAT_LINK_SOURCES && (
                                                                                <div className="flex flex-wrap gap-2">
                                                                                        {freePresets.map((preset) => (
                                                                                                <AddChip key={preset.key} onClick={() => patch({ sources: [...sources, { key: preset.key, label: t(preset.labelKey) }] })}>
                                                                                                        {t(preset.labelKey)}
                                                                                                </AddChip>
                                                                                        ))}
                                                                                        <AddChip onClick={() => patch({ sources: [...sources, { key: '', label: '' }] })}>{t('sourceAddCustom')}</AddChip>
                                                                                </div>
                                                                        )}
                                                                </Section>

                                                                <Section title={t('shareCard')} hint={t('shareCardHint')}>
                                                                        <Field label={`${t('shareTitle')} · ${t('optional')}`}>
                                                                                <input
                                                                                        value={settings.shareTitle ?? ''}
                                                                                        maxLength={70}
                                                                                        placeholder={`گفتگو با ${settings.displayName || agentName}`}
                                                                                        onChange={(e) => patch({ shareTitle: e.target.value || null })}
                                                                                        className={INPUT}
                                                                                />
                                                                        </Field>
                                                                        <Field label={`${t('shareDescription')} · ${t('optional')}`}>
                                                                                <textarea
                                                                                        rows={2}
                                                                                        value={settings.shareDescription ?? ''}
                                                                                        maxLength={160}
                                                                                        placeholder={settings.tagline ?? t('taglinePh')}
                                                                                        onChange={(e) => patch({ shareDescription: e.target.value || null })}
                                                                                        className={`${INPUT} resize-none`}
                                                                                />
                                                                        </Field>
                                                                        {/* How the link looks once pasted into a messenger. */}
                                                                        <div className="max-w-xs overflow-hidden rounded-xl border border-[var(--border-default)] bg-white">
                                                                                {(settings.coverUrl ?? settings.logoUrl) && (
                                                                                        // eslint-disable-next-line @next/next/no-img-element
                                                                                        <img src={settings.coverUrl ?? settings.logoUrl ?? ''} alt="" className="aspect-[16/8] w-full object-cover" />
                                                                                )}
                                                                                <div className="border-s-2 border-[var(--text-primary)] px-3 py-2">
                                                                                        <p className="truncate text-sm font-bold text-[var(--text-primary)]">
                                                                                                {settings.shareTitle ?? `گفتگو با ${settings.displayName || agentName}`}
                                                                                        </p>
                                                                                        <p className="line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">
                                                                                                {settings.shareDescription ?? settings.tagline ?? t('taglinePh')}
                                                                                        </p>
                                                                                        <p dir="ltr" className="mt-1 text-start text-[11px] text-[var(--text-muted)]">{host}</p>
                                                                                </div>
                                                                        </div>
                                                                </Section>

                                                                <Section title={t('manage')}>
                                                                        <Toggle
                                                                                label={t('pauseLabel')}
                                                                                hint={t('pauseHint')}
                                                                                checked={!link.enabled}
                                                                                pending={busy === 'pause'}
                                                                                onChange={(paused) => void setEnabled(!paused)}
                                                                        />
                                                                        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border-default)] p-3">
                                                                                <p className="min-w-0 flex-1 text-xs leading-6 text-[var(--text-secondary)]">{t('removeHint')}</p>
                                                                                <Button type="button" variant="outline" className="hover:text-danger" onClick={() => setRemoveConfirmOpen(true)}>
                                                                                        {t('remove')}
                                                                                </Button>
                                                                        </div>
                                                                </Section>
                                                        </>
                                                )}

                                                {tab === 'look' && (
                                                        <>
                                                                <Section title={t('identity')}>
                                                                        <Field label={`${t('displayName')} · ${t('optional')}`}>
                                                                                <input
                                                                                        value={settings.displayName ?? ''}
                                                                                        maxLength={60}
                                                                                        placeholder={agentName}
                                                                                        onChange={(e) => patch({ displayName: e.target.value || null }, 'intro')}
                                                                                        className={INPUT}
                                                                                />
                                                                        </Field>
                                                                        <Field label={`${t('tagline')} · ${t('optional')}`}>
                                                                                <input
                                                                                        value={settings.tagline ?? ''}
                                                                                        maxLength={90}
                                                                                        placeholder={t('taglinePh')}
                                                                                        onChange={(e) => patch({ tagline: e.target.value || null }, 'intro')}
                                                                                        className={INPUT}
                                                                                />
                                                                        </Field>
                                                                        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                                                                                <ImageField label={t('cover')} value={settings.coverUrl ?? ''} onChange={(value) => patch({ coverUrl: value || null }, 'intro')} wide />
                                                                                <ImageField label={t('logo')} value={settings.logoUrl ?? ''} onChange={(value) => patch({ logoUrl: value || null }, 'intro')} />
                                                                        </div>
                                                                </Section>

                                                                <Section title={t('appearance')}>
                                                                        <Field label={t('brandColor')}>
                                                                                <div className="space-y-2">
                                                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                                                                {COLOR_PRESETS.map((hex) => {
                                                                                                        const active = settings.primaryColor.toLowerCase() === hex.toLowerCase()
                                                                                                        return (
                                                                                                                <button
                                                                                                                        key={hex}
                                                                                                                        type="button"
                                                                                                                        onClick={() => patch({ primaryColor: hex })}
                                                                                                                        aria-label={hex}
                                                                                                                        aria-pressed={active}
                                                                                                                        className={`h-8 w-8 rounded-full transition-transform hover:scale-110 ${
                                                                                                                                active ? 'ring-2 ring-[var(--white)] ring-offset-2 ring-offset-white' : ''
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
                                                                                                        aria-label={t('brandColor')}
                                                                                                        className="h-10 w-12 cursor-pointer rounded-lg border border-[var(--border-default)] bg-transparent p-1"
                                                                                                />
                                                                                                <input
                                                                                                        type="text"
                                                                                                        dir="ltr"
                                                                                                        value={settings.primaryColor}
                                                                                                        onChange={(e) => patch({ primaryColor: e.target.value })}
                                                                                                        aria-label={t('brandColor')}
                                                                                                        className={`${INPUT} w-28`}
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
                                                                                                                aria-pressed={active}
                                                                                                                className={`min-h-10 rounded-lg border px-3 text-sm transition-colors ${
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
                                                                                onChange={(v) => patch({ showAiBadge: v }, 'intro')}
                                                                        />
                                                                </Section>
                                                        </>
                                                )}

                                                {tab === 'content' && (
                                                        <>
                                                                <Section title={t('welcome')} hint={t('welcomeHint')}>
                                                                        <textarea
                                                                                rows={3}
                                                                                value={settings.welcomeMessage ?? ''}
                                                                                maxLength={500}
                                                                                placeholder={agentWelcome ?? ''}
                                                                                aria-label={t('welcome')}
                                                                                onChange={(e) => patch({ welcomeMessage: e.target.value || null }, 'intro')}
                                                                                className={`${INPUT} resize-none`}
                                                                        />
                                                                </Section>

                                                                <Section title={t('quickReplies')} hint={t('quickRepliesHint')}>
                                                                        <div className="space-y-2">
                                                                                {settings.quickReplies.map((q, i) => (
                                                                                        <div key={i} className="flex items-center gap-2">
                                                                                                <input
                                                                                                        value={q}
                                                                                                        maxLength={80}
                                                                                                        placeholder={t('quickRepliesPh')}
                                                                                                        aria-label={t('quickRepliesPh')}
                                                                                                        onChange={(e) => {
                                                                                                                const next = [...settings.quickReplies]
                                                                                                                next[i] = e.target.value
                                                                                                                patch({ quickReplies: next }, 'intro')
                                                                                                        }}
                                                                                                        className={INPUT}
                                                                                                />
                                                                                                <button
                                                                                                        type="button"
                                                                                                        aria-label={t('remove')}
                                                                                                        onClick={() => patch({ quickReplies: settings.quickReplies.filter((_, j) => j !== i) })}
                                                                                                        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[var(--text-muted)] transition-colors hover:text-danger"
                                                                                                >
                                                                                                        <X className="h-4 w-4" />
                                                                                                </button>
                                                                                        </div>
                                                                                ))}
                                                                        </div>
                                                                        {settings.quickReplies.length < 6 && (
                                                                                <AddChip onClick={() => patch({ quickReplies: [...settings.quickReplies, ''] }, 'intro')}>{t('quickRepliesAdd')}</AddChip>
                                                                        )}
                                                                </Section>

                                                                <Section title={t('actionsTitle')} hint={t('actionsHint')}>
                                                                        <div className="grid gap-3 sm:grid-cols-2">
                                                                                <Field label={t('phone')}>
                                                                                        <input dir="ltr" inputMode="tel" value={settings.phone ?? ''} maxLength={24} placeholder="021 1234 5678" onChange={(e) => patch({ phone: e.target.value || null }, 'intro')} className={INPUT} />
                                                                                </Field>
                                                                                <Field label={t('instagram')}>
                                                                                        <input dir="ltr" value={settings.instagram ?? ''} maxLength={41} placeholder="@yourpage" onChange={(e) => patch({ instagram: e.target.value || null }, 'intro')} className={INPUT} />
                                                                                </Field>
                                                                                <Field label={t('mapUrl')}>
                                                                                        <input dir="ltr" inputMode="url" value={settings.mapUrl ?? ''} maxLength={600} placeholder="https://…" onChange={(e) => patch({ mapUrl: e.target.value || null }, 'intro')} className={INPUT} />
                                                                                </Field>
                                                                                <Field label={t('website')}>
                                                                                        <input dir="ltr" inputMode="url" value={settings.website ?? ''} maxLength={600} placeholder="https://…" onChange={(e) => patch({ website: e.target.value || null }, 'intro')} className={INPUT} />
                                                                                </Field>
                                                                        </div>
                                                                        {[settings.mapUrl, settings.website].some((url) => url && !/^https:\/\//.test(url)) && (
                                                                                <p className="text-xs text-danger">{t('httpsOnly')}</p>
                                                                        )}
                                                                </Section>

                                                                <Section title={t('showcase')}>
                                                                        <Toggle
                                                                                label={t('showcase')}
                                                                                hint={!productAccess ? t('showcaseNoAccess') : showcase.length === 0 ? t('showcaseEmpty') : t('showcaseHint')}
                                                                                checked={productAccess && settings.showcase}
                                                                                disabled={!productAccess}
                                                                                onChange={(v) => patch({ showcase: v }, 'intro')}
                                                                        />
                                                                </Section>
                                                        </>
                                                )}

                                                {tab === 'behavior' && (
                                                        <>
                                                                <Section title={t('leadCapture')}>
                                                                        <Toggle
                                                                                label={t('leadCapture')}
                                                                                hint={customerIdentificationRequired ? t('customerIdentificationManaged') : t('leadCaptureHint')}
                                                                                checked={effectiveSettings.leadCapture}
                                                                                onChange={(v) => patch({ leadCapture: v }, v ? 'lead' : 'intro')}
                                                                                disabled={customerIdentificationRequired}
                                                                        />
                                                                        {effectiveSettings.leadCapture && (
                                                                                <>
                                                                                        <Field label={`${t('leadCaptureMessage')} · ${t('optional')}`}>
                                                                                                <textarea
                                                                                                        rows={2}
                                                                                                        value={effectiveSettings.leadCaptureMessage ?? ''}
                                                                                                        maxLength={200}
                                                                                                        placeholder={t('leadCaptureMessagePh')}
                                                                                                        disabled={customerIdentificationRequired}
                                                                                                        onChange={(e) => patch({ leadCaptureMessage: e.target.value || null }, 'lead')}
                                                                                                        className={`${INPUT} resize-none`}
                                                                                                />
                                                                                        </Field>
                                                                                        <Toggle
                                                                                                label={t('leadCaptureRequired')}
                                                                                                hint={customerIdentificationRequired ? t('customerIdentificationManaged') : t('leadCaptureRequiredHint')}
                                                                                                checked={effectiveSettings.leadCaptureRequired}
                                                                                                onChange={(v) => patch({ leadCaptureRequired: v }, 'lead')}
                                                                                                disabled={customerIdentificationRequired}
                                                                                        />
                                                                                </>
                                                                        )}
                                                                </Section>

                                                                <Section title={t('hours')}>
                                                                        <Toggle
                                                                                label={t('hours')}
                                                                                hint={t('hoursHint')}
                                                                                checked={settings.hoursEnabled}
                                                                                onChange={(v) => patch({ hoursEnabled: v }, v ? 'closed' : 'intro')}
                                                                        />
                                                                        {settings.hoursEnabled && (
                                                                                <>
                                                                                        <div className="grid grid-cols-2 gap-3">
                                                                                                <Field label={t('openAt')}>
                                                                                                        <input type="time" value={settings.openAt} onChange={(e) => patch({ openAt: e.target.value }, 'closed')} className={INPUT} />
                                                                                                </Field>
                                                                                                <Field label={t('closeAt')}>
                                                                                                        <input type="time" value={settings.closeAt} onChange={(e) => patch({ closeAt: e.target.value }, 'closed')} className={INPUT} />
                                                                                                </Field>
                                                                                        </div>
                                                                                        {(!settings.openAt || !settings.closeAt) && (
                                                                                                <p className="text-xs text-[var(--text-secondary)]">{t('hoursIncomplete')}</p>
                                                                                        )}
                                                                                        <Field label={`${t('closedMessage')} · ${t('optional')}`}>
                                                                                                <textarea
                                                                                                        rows={2}
                                                                                                        value={settings.closedMessage ?? ''}
                                                                                                        maxLength={200}
                                                                                                        placeholder={t('closedMessagePh')}
                                                                                                        onChange={(e) => patch({ closedMessage: e.target.value || null }, 'closed')}
                                                                                                        className={`${INPUT} resize-none`}
                                                                                                />
                                                                                        </Field>
                                                                                </>
                                                                        )}
                                                                </Section>
                                                        </>
                                                )}

                                                {tab === 'stats' && <ChatLinkStatsPanel agentId={agentId} />}
                                        </div>
                                </div>

                                <div className="lg:sticky lg:top-0 lg:self-start">
                                        <ChatLinkPreview
                                                name={settings.displayName || agentName}
                                                avatar={settings.logoUrl ?? agentAvatar}
                                                welcomeMessage={settings.welcomeMessage ?? agentWelcome}
                                                settings={effectiveSettings}
                                                showcase={productAccess ? showcase : []}
                                                state={screen}
                                                onState={setScreen}
                                        />
                                </div>
                        </div>

                        <ConfirmDialog
                                open={slugConfirmOpen}
                                title={t('changeSlugTitle')}
                                description={t('changeSlugBody', { old: `/c/${link.slug}`, next: `/c/${nextSlug ?? ''}` })}
                                confirmLabel={t('changeSlug')}
                                cancelLabel={common('cancel')}
                                tone="primary"
                                icon={<Check className="h-5 w-5" />}
                                busy={busy === 'slug'}
                                error={error}
                                onConfirm={() => void changeSlug()}
                                onClose={() => {
                                        if (busy !== 'slug') setSlugConfirmOpen(false)
                                }}
                        />
                        <ConfirmDialog
                                open={removeConfirmOpen}
                                title={t('remove')}
                                description={t('confirmRemove')}
                                confirmLabel={t('remove')}
                                cancelLabel={common('cancel')}
                                busy={busy === 'remove'}
                                error={error}
                                onConfirm={() => void remove()}
                                onClose={() => {
                                        if (busy !== 'remove') setRemoveConfirmOpen(false)
                                }}
                        />
                </div>
        )
}

// ─── Local primitives ────────────────────────────────────────────────────────

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
        return (
                <section className="space-y-3">
                        <div>
                                <h4 className="text-sm font-bold text-[var(--text-primary)]">{title}</h4>
                                {hint && <p className="mt-0.5 text-xs leading-6 text-[var(--text-secondary)]">{hint}</p>}
                        </div>
                        {children}
                </section>
        )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
        return (
                <label className="block">
                        <span className="ui-field-label">{label}</span>
                        {children}
                </label>
        )
}

function AddChip({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
        return (
                <button
                        type="button"
                        onClick={onClick}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-dashed border-[var(--border-default)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                        <Plus className="h-3.5 w-3.5" />
                        {children}
                </button>
        )
}

function Toggle({
        label,
        hint,
        checked,
        onChange,
        disabled = false,
        pending = false,
}: {
        label: string
        hint: string
        checked: boolean
        onChange: (v: boolean) => void
        disabled?: boolean
        pending?: boolean
}) {
        return (
                <div className="flex items-start gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-3">
                        <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-[var(--text-primary)]">{label}</div>
                                <div className="text-xs leading-6 text-[var(--text-secondary)]">{hint}</div>
                        </div>
                        <Switch checked={checked} onChange={onChange} disabled={disabled || pending} pending={pending} aria-label={label} />
                </div>
        )
}
