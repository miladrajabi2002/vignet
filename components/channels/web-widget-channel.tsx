'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAutoSave } from '@/lib/hooks/use-auto-save'
import { Slider } from '@/components/ui/slider'
import { useTranslations, useLocale } from 'next-intl'
import {
        AlertTriangle,
        Clock,
        Code,
        MessageSquarePlus,
        Plus,
        Puzzle,
        RotateCw,
        ShoppingBag,
        Tag,
        UserRoundPlus,
        X,
} from 'lucide-react'
import {
        normalizeWidgetSettings,
        normalizeDomains,
        WIDGET_ICONS,
        WIDGET_FONTS,
        type WidgetSettings,
        type WidgetFont,
} from '@/lib/widget/config'
import { WidgetPreview, WIDGET_ICON_COMPONENTS } from './widget-preview'
import { ChannelLayout, ChannelLead, ChannelSection, StepList } from './channel-stage'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CopyButton } from '@/components/ui/copy-button'
import { AutoSaveStatus } from '@/components/ui/auto-save-status'

/** Curated brand-color presets — one tap instead of fiddling with the picker. */
const COLOR_PRESETS = [
        '#0F0F10', // ink
        '#2563EB', // blue
        '#7C3AED', // violet
        '#DB2777', // pink
        '#E11D48', // rose
        '#EA580C', // orange
        '#16A34A', // green
        '#0D9488', // teal
]

const TABS = ['install', 'look', 'behavior', 'security'] as const
type Tab = (typeof TABS)[number]
const TAB_LABEL: Record<Tab, string> = {
        install: 'widgetTabInstall',
        look: 'widgetTabLook',
        behavior: 'widgetTabBehavior',
        security: 'widgetTabSecurity',
}

const TAB_BASE =
        'min-h-10 whitespace-nowrap rounded-xl px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]'
const TAB_ON = 'bg-[#111] text-white'
const TAB_OFF = 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'

/** What a site gains from the widget — shown before it is switched on. */
const WIDGET_POINTS = [
        { icon: Clock, textKey: 'widgetPointAnswer' },
        { icon: ShoppingBag, textKey: 'widgetPointProducts' },
        { icon: UserRoundPlus, textKey: 'widgetPointLeads' },
] as const

/** Where the snippet goes, for the three ways a site is usually built. */
const INSTALL_PLACES = [
        { icon: Code, titleKey: 'installHtmlTitle', bodyKey: 'installHtmlBody' },
        { icon: Puzzle, titleKey: 'installWordpressTitle', bodyKey: 'installWordpressBody' },
        { icon: Tag, titleKey: 'installBuilderTitle', bodyKey: 'installBuilderBody' },
] as const

export function WebWidgetChannel({
        agentId,
        agentName,
        agentWelcome,
        baseUrl,
        enabled,
        channelId,
        config,
        customerIdentificationRequired,
        customerIdentificationMessage,
        weekConversations = 0,
}: {
        agentId: string
        agentName: string
        /** The agent's own welcome message — what the preview opens with. */
        agentWelcome?: string | null
        baseUrl: string
        enabled: boolean
        channelId: string | null
        config: Record<string, unknown> | null
        customerIdentificationRequired: boolean
        customerIdentificationMessage: string | null
        /** Widget conversations that had a message in the last 7 days. */
        weekConversations?: number
}) {
        const t = useTranslations('channels')
        const locale = useLocale()
        const isRtl = locale === 'fa'
        const router = useRouter()

        const [busy, setBusy] = useState(false)
        const [disableOpen, setDisableOpen] = useState(false)
        const [tab, setTab] = useState<Tab>('install')
        // Phones have no room for the preview beside the form, so it takes a tab there.
        const [mobilePreview, setMobilePreview] = useState(false)
        const [error, setError] = useState<string | null>(null)

        const initial = normalizeWidgetSettings(config)
        const [settings, setSettings] = useState<WidgetSettings>(initial)
        const [domainsText, setDomainsText] = useState(initial.allowedDomains.join('\n'))
        // The allow-list only counts once its field is left: a half-typed domain
        // must never lock the live widget out of the site it is running on.
        const [domains, setDomains] = useState(initial.allowedDomains)

        // Widget settings save by themselves, on a pause in editing or on leaving a field.
        const enabledRef = useRef(enabled)
        enabledRef.current = enabled
        const auto = useAutoSave({
                value: { ...settings, allowedDomains: domains },
                save: async (config) => {
                        // Saving posts the channel; a widget switched off meanwhile must stay off.
                        if (!enabledRef.current) return
                        setError(null)
                        try {
                                const res = await fetch(`/api/agents/${agentId}/channels`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ type: 'WEB_WIDGET', config }),
                                })
                                if (!res.ok) throw new Error('save failed')
                                // Cache invalidation happens server-side in the POST /channels route.
                                router.refresh()
                        } catch (cause) {
                                setError(t('saveError'))
                                throw cause
                        }
                },
        })

        const snippet = `<script src="${baseUrl}/widget/loader.js" data-agent-id="${agentId}"></script>`

        function patch(p: Partial<WidgetSettings>) {
                setSettings((s) => ({ ...s, ...p }))
        }

        async function enable() {
                setBusy(true)
                setError(null)
                try {
                        const res = await fetch(`/api/agents/${agentId}/channels`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ type: 'WEB_WIDGET' }),
                        })
                        if (!res.ok) {
                                const data = await res.json().catch(() => ({}))
                                setError(data.error === 'CHANNEL_LIMIT' ? t('channelLimitError') : t('connectError'))
                                return
                        }
                        router.refresh()
                } catch {
                        setError(t('connectError'))
                } finally {
                        setBusy(false)
                }
        }

        async function disable() {
                if (!channelId) return
                setBusy(true)
                setError(null)
                try {
                        const res = await fetch(`/api/agents/${agentId}/channels/${channelId}`, { method: 'DELETE' })
                        if (!res.ok) {
                                setError(t('saveError'))
                                return
                        }
                        setDisableOpen(false)
                        router.refresh()
                } catch {
                        setError(t('saveError'))
                } finally {
                        setBusy(false)
                }
        }

        const effectiveLeadCapture = customerIdentificationRequired || settings.leadCapture
        const effectiveLeadCaptureRequired = customerIdentificationRequired || settings.leadCaptureRequired
        const liveSettings: WidgetSettings = {
                ...settings,
                leadCapture: effectiveLeadCapture,
                leadCaptureRequired: effectiveLeadCaptureRequired,
                leadCaptureMessage: customerIdentificationRequired && customerIdentificationMessage?.trim()
                        ? customerIdentificationMessage.trim().slice(0, 200)
                        : settings.leadCaptureMessage,
                allowedDomains: normalizeDomains(domainsText),
        }
        const unprotected = liveSettings.allowedDomains.length === 0

        const nf = new Intl.NumberFormat(isRtl ? 'fa-IR' : 'en-US')
        const preview = (
                <WidgetPreview
                        settings={liveSettings}
                        agentName={agentName}
                        welcomeMessage={agentWelcome}
                        isRtl={isRtl}
                        // Before it is switched on, the first thing to see is the agent's own hello.
                        initialView={enabled ? 'chat' : 'intro'}
                />
        )

        // ── Not enabled yet ────────────────────────────────────────────────────
        // The widget itself is on show before it is switched on, with this agent's
        // name and welcome — the owner sees what a visitor will, then decides.
        if (!enabled) {
                return (
                        <ChannelLayout
                                stageWidth="md"
                                stage={
                                        <figure className="m-0">
                                                {preview}
                                                <figcaption className="mt-2.5 text-center text-xs leading-6 text-[var(--text-muted)]">
                                                        {t('widgetPreviewCaption')}
                                                </figcaption>
                                        </figure>
                                }
                        >
                                <ChannelLead title={t('widgetLeadTitle')} body={t('widgetLeadBody')} />
                                <StepList
                                        steps={[
                                                { text: t('widgetStepEnable') },
                                                { text: t('widgetStepPaste') },
                                                { text: t('widgetStepStyle') },
                                        ]}
                                />
                                {error && (
                                        <p role="alert" className="text-sm leading-6 text-danger">
                                                {error}
                                        </p>
                                )}
                                <div className="space-y-2.5">
                                        <Button onClick={() => void enable()} loading={busy} className="w-full sm:w-auto">
                                                {t('enableWidget')}
                                        </Button>
                                        <p className="text-xs leading-6 text-[var(--text-muted)]">{t('widgetQuotaNote')}</p>
                                </div>
                                <ul className="grid gap-2.5 border-t border-[var(--border-subtle)] pt-5 sm:grid-cols-3">
                                        {WIDGET_POINTS.map((point) => (
                                                <li key={point.textKey} className="flex items-start gap-2.5 text-xs leading-6 text-[var(--text-secondary)] sm:flex-col sm:gap-2">
                                                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--bg-muted)] text-[var(--text-primary)]">
                                                                <point.icon className="h-4 w-4" />
                                                        </span>
                                                        {t(point.textKey)}
                                                </li>
                                        ))}
                                </ul>
                        </ChannelLayout>
                )
        }

        return (
                <div id="web-widget-details" className="space-y-5">
                        {/* ── Is it on a site yet, and how did the last save go ── */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] py-1.5 pe-2 ps-4">
                                <p className="flex min-w-[12rem] flex-1 items-center gap-2 py-1.5 text-sm leading-6 text-[var(--text-secondary)]">
                                        <span
                                                aria-hidden
                                                className={`h-2 w-2 shrink-0 rounded-full ${weekConversations > 0 ? 'bg-success' : 'bg-[var(--text-hint)]'}`}
                                        />
                                        {weekConversations > 0
                                                ? t('widgetWeek', { count: nf.format(weekConversations) })
                                                : t('widgetWaiting')}
                                </p>
                                <AutoSaveStatus status={auto.status} onRetry={auto.flush} errorLabel={t('saveError')} />
                        </div>

                        {error && (
                                <p role="alert" className="text-sm leading-6 text-danger">
                                        {error}
                                </p>
                        )}

                        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22.5rem] lg:gap-7">
                                <div className="min-w-0">
                                        <div role="tablist" aria-label={t('webWidget')} className="-mx-1 mb-5 flex gap-1 overflow-x-auto px-1 pb-1">
                                                {TABS.map((item) => (
                                                        <button
                                                                key={item}
                                                                type="button"
                                                                role="tab"
                                                                id={`web-widget-tab-${item}`}
                                                                aria-selected={tab === item}
                                                                aria-controls="web-widget-panel"
                                                                onClick={() => {
                                                                        setTab(item)
                                                                        setMobilePreview(false)
                                                                }}
                                                                className={`${TAB_BASE} ${
                                                                        tab !== item
                                                                                ? TAB_OFF
                                                                                : mobilePreview
                                                                                        ? 'text-[var(--text-secondary)] lg:bg-[#111] lg:text-white'
                                                                                        : TAB_ON
                                                                }`}
                                                        >
                                                                {t(TAB_LABEL[item])}
                                                        </button>
                                                ))}
                                                <button
                                                        type="button"
                                                        aria-pressed={mobilePreview}
                                                        onClick={() => setMobilePreview(true)}
                                                        className={`${TAB_BASE} lg:hidden ${mobilePreview ? TAB_ON : TAB_OFF}`}
                                                >
                                                        {t('widgetTabPreview')}
                                                </button>
                                        </div>

                                        <div
                                                id="web-widget-panel"
                                                role="tabpanel"
                                                aria-labelledby={`web-widget-tab-${tab}`}
                                                className={`space-y-6 ${mobilePreview ? 'hidden lg:block' : ''}`}
                                                onBlur={auto.flush}
                                        >
                                                {tab === 'install' && (
                                                        <>
                                                                <ChannelSection title={t('embedCode')} hint={t('widgetDesc')}>
                                                                        <div className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)]">
                                                                                <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] py-1.5 pe-1.5 ps-3.5">
                                                                                        <span dir="ltr" className="font-mono text-[11px] font-semibold text-[var(--text-muted)]">
                                                                                                HTML
                                                                                        </span>
                                                                                        <CopyButton
                                                                                                value={snippet}
                                                                                                label={t('copyCode')}
                                                                                                copiedLabel={t('copied')}
                                                                                                showLabel
                                                                                                className="bg-white"
                                                                                        />
                                                                                </div>
                                                                                <pre dir="ltr" className="overflow-x-auto p-3.5 text-xs leading-6 text-[var(--text-primary)]">
                                                                                        <code>{snippet}</code>
                                                                                </pre>
                                                                        </div>
                                                                </ChannelSection>

                                                                {unprotected && (
                                                                        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5">
                                                                                <p className="flex min-w-0 flex-1 basis-56 items-start gap-2 text-xs leading-6 text-[var(--text-primary)]">
                                                                                        <AlertTriangle className="mt-1 h-3.5 w-3.5 shrink-0 text-amber-600" />
                                                                                        {t('unprotectedWarning')}
                                                                                </p>
                                                                                <Button variant="secondary" size="sm" onClick={() => setTab('security')}>
                                                                                        {t('addSiteAddress')}
                                                                                </Button>
                                                                        </div>
                                                                )}

                                                                <ChannelSection title={t('installWhereTitle')}>
                                                                        <ul className="divide-y divide-[var(--border-subtle)] rounded-2xl border border-[var(--border-default)]">
                                                                                {INSTALL_PLACES.map((place) => (
                                                                                        <li key={place.titleKey} className="flex items-start gap-3 p-3.5">
                                                                                                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--bg-muted)] text-[var(--text-primary)]">
                                                                                                        <place.icon className="h-4 w-4" />
                                                                                                </span>
                                                                                                <div className="min-w-0">
                                                                                                        <p className="text-sm font-semibold text-[var(--text-primary)]">{t(place.titleKey)}</p>
                                                                                                        <p className="mt-0.5 text-xs leading-6 text-[var(--text-secondary)]">{t(place.bodyKey)}</p>
                                                                                                </div>
                                                                                        </li>
                                                                                ))}
                                                                        </ul>
                                                                        <p className="text-xs leading-6 text-[var(--text-muted)]">{t('installCheck')}</p>
                                                                </ChannelSection>

                                                                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-5">
                                                                        <p className="min-w-0 flex-1 basis-56 text-xs leading-6 text-[var(--text-muted)]">{t('disableWidgetBody')}</p>
                                                                        <button
                                                                                type="button"
                                                                                onClick={() => setDisableOpen(true)}
                                                                                disabled={busy}
                                                                                className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-[var(--border-default)] px-4 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-danger/40 hover:text-danger disabled:opacity-50"
                                                                        >
                                                                                {t('disable')}
                                                                        </button>
                                                                </div>
                                                        </>
                                                )}

                                                {tab === 'look' && (
                                                        <section className="space-y-4">
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
                                                                                                className="w-28 rounded-lg border border-[var(--border-default)] bg-white px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)] focus:shadow-[0_0_0_3px_rgba(91,61,232,0.22)]"
                                                                                        />
                                                                                </div>
                                                                        </div>
                                                                </Field>

                                                                <Field label={t('headerStyle')}>
                                                                        <Segmented
                                                                                value={settings.headerStyle}
                                                                                onChange={(v) =>
                                                                                        patch({ headerStyle: v as WidgetSettings['headerStyle'] })
                                                                                }
                                                                                options={[
                                                                                        { value: 'gradient', label: t('headerStyleGradient') },
                                                                                        { value: 'flat', label: t('headerStyleFlat') },
                                                                                ]}
                                                                        />
                                                                </Field>

                                                                {/* Theme + Position side-by-side (compact) */}
                                                                <div className="grid grid-cols-2 gap-3">
                                                                        <Field label={t('theme')}>
                                                                                <Segmented
                                                                                        value={settings.theme}
                                                                                        onChange={(v) => patch({ theme: v as WidgetSettings['theme'] })}
                                                                                        options={[
                                                                                                { value: 'dark', label: t('themeDark') },
                                                                                                { value: 'light', label: t('themeLight') },
                                                                                        ]}
                                                                                />
                                                                        </Field>
                                                                        <Field label={t('position')}>
                                                                                <Segmented
                                                                                        value={settings.position}
                                                                                        onChange={(v) =>
                                                                                                patch({ position: v as WidgetSettings['position'] })
                                                                                        }
                                                                                        options={[
                                                                                                { value: 'right', label: t('posRight') },
                                                                                                { value: 'left', label: t('posLeft') },
                                                                                        ]}
                                                                                />
                                                                        </Field>
                                                                </div>

                                                                <Field label={t('font')}>
                                                                        <div className="flex flex-wrap gap-2">
                                                                                {WIDGET_FONTS.map((f) => {
                                                                                        const active = settings.font === f.value
                                                                                        return (
                                                                                                <button
                                                                                                        key={f.value}
                                                                                                        type="button"
                                                                                                        onClick={() => patch({ font: f.value as WidgetFont })}
                                                                                                        className={`rounded-xl border px-3.5 py-1.5 text-sm transition-colors ${
                                                                                                                active
                                                                                                                        ? 'border-[var(--white)] bg-[var(--white)] font-medium text-[var(--bg-base)]'
                                                                                                                        : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                                                                        }`}
                                                                                                        style={{
                                                                                                                fontFamily: f.value === 'inherit' ? undefined : f.family,
                                                                                                        }}
                                                                                                >
                                                                                                        {isRtl ? f.labelFa : f.labelEn}
                                                                                                </button>
                                                                                        )
                                                                                })}
                                                                        </div>
                                                                </Field>

                                                                <Field label={`${t('headerTitle')} · ${t('optional')}`}>
                                                                        <input
                                                                                type="text"
                                                                                value={settings.headerTitle ?? ''}
                                                                                placeholder={t('headerTitlePh')}
                                                                                onChange={(e) => patch({ headerTitle: e.target.value || null })}
                                                                                className="w-full rounded-lg border border-[var(--border-default)] bg-white px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)] focus:shadow-[0_0_0_3px_rgba(91,61,232,0.22)]"
                                                                        />
                                                                </Field>

                                                                <Field label={`${t('launcherLabel')} · ${t('optional')}`}>
                                                                        <input
                                                                                type="text"
                                                                                value={settings.launcherLabel ?? ''}
                                                                                placeholder={t('launcherLabelPh')}
                                                                                onChange={(e) => patch({ launcherLabel: e.target.value || null })}
                                                                                className="w-full rounded-lg border border-[var(--border-default)] bg-white px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)] focus:shadow-[0_0_0_3px_rgba(91,61,232,0.22)]"
                                                                        />
                                                                </Field>

                                                                <Field label={`${t('subtitle')} · ${t('optional')}`}>
                                                                        <input
                                                                                type="text"
                                                                                value={settings.subtitle ?? ''}
                                                                                placeholder={t('subtitlePh')}
                                                                                onChange={(e) => patch({ subtitle: e.target.value || null })}
                                                                                className="w-full rounded-lg border border-[var(--border-default)] bg-white px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)] focus:shadow-[0_0_0_3px_rgba(91,61,232,0.22)]"
                                                                        />
                                                                </Field>

                                                                <Field label={t('icon')}>
                                                                        <div className="flex flex-wrap gap-2">
                                                                                {WIDGET_ICONS.map((key) => {
                                                                                        const Ico = WIDGET_ICON_COMPONENTS[key]
                                                                                        const active = settings.icon === key
                                                                                        return (
                                                                                                <button
                                                                                                        key={key}
                                                                                                        type="button"
                                                                                                        onClick={() => patch({ icon: key })}
                                                                                                        className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
                                                                                                                active
                                                                                                                        ? 'border-[var(--white)] bg-[var(--white)] text-[var(--bg-base)]'
                                                                                                                        : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                                                                        }`}
                                                                                                >
                                                                                                        <Ico className="h-5 w-5" />
                                                                                                </button>
                                                                                        )
                                                                                })}
                                                                        </div>
                                                                </Field>

                                                                {/* Corners — range slider for flexibility */}
                                                                <Field
                                                                        label={`${t('corners')} · ${settings.cornerRadius || settings.corners === 'soft' ? settings.cornerRadius || 17 : settings.corners === 'round' ? 20 : settings.corners === 'sharp' ? 9 : 17}px`}
                                                                >
                                                                        <div className="space-y-2">
                                                                                <Slider
                                                                                        aria-label={t('corners')}
                                                                                        min={0}
                                                                                        max={30}
                                                                                        step={1}
                                                                                        value={settings.cornerRadius}
                                                                                        onChange={(cornerRadius) => patch({ cornerRadius })}
                                                                                        formatValue={(v) => `${v}px`}
                                                                                />
                                                                                <div className="flex items-center gap-1.5">
                                                                                        <RotateCw className="h-3 w-3 text-[var(--text-muted)]" />
                                                                                        <span className="text-[12px] text-[var(--text-muted)]">
                                                                                                {isRtl
                                                                                                        ? '۰ یعنی پیش‌فرض (ملایم). از ۱ تا ۳۰ می‌توانید عوضش کنید.'
                                                                                                        : '0 = use preset (soft). Drag 1–30 for a custom radius.'}
                                                                                        </span>
                                                                                </div>
                                                                                <div className="flex gap-1.5 pt-1">
                                                                                        {(['sharp', 'soft', 'round'] as const).map((preset) => (
                                                                                                <button
                                                                                                        key={preset}
                                                                                                        type="button"
                                                                                                        onClick={() => patch({ cornerRadius: 0, corners: preset })}
                                                                                                        className={`rounded-md border px-2 py-1 text-[12px] transition-colors ${
                                                                                                                settings.cornerRadius === 0 && settings.corners === preset
                                                                                                                        ? 'border-[var(--white)] bg-[var(--white)] text-[var(--bg-base)]'
                                                                                                                        : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                                                                        }`}
                                                                                                >
                                                                                                        {t(
                                                                                                                `corners${preset.charAt(0).toUpperCase()}${preset.slice(1)}` as Parameters<
                                                                                                                        typeof t
                                                                                                                >[0],
                                                                                                        )}
                                                                                                </button>
                                                                                        ))}
                                                                                </div>
                                                                        </div>
                                                                </Field>
                                                        </section>
                                                )}

                                                {tab === 'behavior' && (
                                                        <section className="space-y-4">
                                                                <Toggle
                                                                        label={t('autoGreetLabel')}
                                                                        hint={t('autoGreetHint')}
                                                                        checked={settings.autoGreet}
                                                                        onChange={(v) => patch({ autoGreet: v })}
                                                                />
                                                                {settings.autoGreet && (
                                                                        <Field
                                                                                label={`${t('autoGreetDelayLabel')} · ${(settings.autoGreetDelayMs / 1000).toFixed(1)}s`}
                                                                        >
                                                                                <Slider
                                                                                        aria-label={t('autoGreetDelayLabel')}
                                                                                        min={1000}
                                                                                        max={15000}
                                                                                        step={500}
                                                                                        value={settings.autoGreetDelayMs}
                                                                                        onChange={(autoGreetDelayMs) => patch({ autoGreetDelayMs })}
                                                                                        formatValue={(v) => `${(v / 1000).toFixed(1)}s`}
                                                                                />
                                                                        </Field>
                                                                )}

                                                                {/* Quick replies */}
                                                                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-3">
                                                                        <div className="flex items-center gap-2">
                                                                                <MessageSquarePlus className="h-4 w-4 text-[var(--text-secondary)]" />
                                                                                <div className="flex-1">
                                                                                        <div className="text-sm text-[var(--text-primary)]">
                                                                                                {t('quickReplies')}
                                                                                        </div>
                                                                                        <div className="text-xs text-[var(--text-secondary)]">
                                                                                                {t('quickRepliesHint')}
                                                                                        </div>
                                                                                </div>
                                                                        </div>
                                                                        <div className="mt-3 space-y-2">
                                                                                {settings.quickReplies.map((q, i) => (
                                                                                        <div key={i} className="flex items-center gap-2">
                                                                                                <input
                                                                                                        type="text"
                                                                                                        value={q}
                                                                                                        maxLength={80}
                                                                                                        placeholder={t('quickRepliesPh')}
                                                                                                        onChange={(e) => {
                                                                                                                const next = [...settings.quickReplies]
                                                                                                                next[i] = e.target.value
                                                                                                                patch({ quickReplies: next })
                                                                                                        }}
                                                                                                        className="flex-1 rounded-lg border border-[var(--border-default)] bg-white px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)] focus:shadow-[0_0_0_3px_rgba(91,61,232,0.22)]"
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
                                                                                {settings.quickReplies.length < 4 && (
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

                                                                {/* Lead capture */}
                                                                <Toggle
                                                                        label={t('leadCaptureLabel')}
                                                                        hint={customerIdentificationRequired ? t('customerIdentificationManaged') : t('leadCaptureHint')}
                                                                        checked={effectiveLeadCapture}
                                                                        onChange={(v) => patch({ leadCapture: v })}
                                                                        disabled={customerIdentificationRequired}
                                                                />
                                                                {effectiveLeadCapture && (
                                                                        <>
                                                                                <Field label={`${t('leadCaptureMessage')} · ${t('optional')}`}>
                                                                                        <textarea
                                                                                        rows={2}
                                                                                        value={liveSettings.leadCaptureMessage ?? ''}
                                                                                        placeholder={t('leadCaptureMessagePh')}
                                                                                        disabled={customerIdentificationRequired}
                                                                                        onChange={(e) =>
                                                                                                patch({ leadCaptureMessage: e.target.value || null })
                                                                                        }
                                                                                        className="w-full resize-none rounded-lg border border-[var(--border-default)] bg-white px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)] focus:shadow-[0_0_0_3px_rgba(91,61,232,0.22)] disabled:cursor-not-allowed disabled:opacity-70"
                                                                                        />
                                                                                </Field>
                                                                                <Toggle
                                                                                        label={t('leadCaptureRequiredLabel')}
                                                                                        hint={customerIdentificationRequired ? t('customerIdentificationManaged') : t('leadCaptureRequiredHint')}
                                                                                        checked={effectiveLeadCaptureRequired}
                                                                                        onChange={(v) => patch({ leadCaptureRequired: v })}
                                                                                        disabled={customerIdentificationRequired}
                                                                                />
                                                                        </>
                                                                )}
                                                        </section>
                                                )}

                                                {tab === 'security' && (
                                                        <section className="space-y-4">
                                                                <div>
                                                                        <h4 className="text-sm font-bold text-[var(--text-primary)]">{t('security')}</h4>
                                                                        <p className="mt-0.5 text-xs leading-6 text-[var(--text-secondary)]">{t('securityHint')}</p>
                                                                </div>
                                                                <Field label={t('allowedDomains')}>
                                                                        <textarea
                                                                                dir="ltr"
                                                                                rows={3}
                                                                                value={domainsText}
                                                                                placeholder={t('allowedDomainsPh')}
                                                                                onChange={(e) => {
                                                                                        setDomainsText(e.target.value)
                                                                                }}
                                                                                onBlur={() => {
                                                                                        const next = normalizeDomains(domainsText)
                                                                                        setDomains(next)
                                                                                        setDomainsText(next.join('\n'))
                                                                                }}
                                                                                className="w-full rounded-lg border border-[var(--border-default)] bg-white px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)] focus:shadow-[0_0_0_3px_rgba(91,61,232,0.22)]"
                                                                        />
                                                                        <p className="mt-1 text-xs text-[var(--text-secondary)]">
                                                                                {t('allowedDomainsHint')}
                                                                        </p>
                                                                </Field>
                                                                {unprotected && (
                                                                        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-[var(--text-primary)]">
                                                                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                                                                                {t('unprotectedWarning')}
                                                                        </div>
                                                                )}
                                                        </section>
                                                )}
                                        </div>
                                </div>

                                {/* Live preview: beside the form on desktop, its own tab on a phone. */}
                                <div className={`min-w-0 space-y-2 lg:sticky lg:top-0 lg:block lg:self-start ${mobilePreview ? '' : 'hidden'}`}>
                                        <p className="hidden text-xs text-[var(--text-secondary)] lg:block">{t('livePreview')}</p>
                                        {preview}
                                </div>
                        </div>

                        <ConfirmDialog
                                open={disableOpen}
                                title={t('disableWidgetTitle')}
                                description={t('disableWidgetBody')}
                                confirmLabel={t('disable')}
                                busy={busy}
                                onConfirm={() => void disable()}
                                onClose={() => {
                                        if (!busy) setDisableOpen(false)
                                }}
                        />
                </div>
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

function Toggle({
        label,
        hint,
        checked,
        onChange,
        disabled = false,
}: {
        label: string
        hint: string
        checked: boolean
        onChange: (v: boolean) => void
        disabled?: boolean
}) {
        return (
                <button
                        type="button"
                        onClick={() => onChange(!checked)}
                        disabled={disabled}
                        className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-3 text-start disabled:cursor-not-allowed disabled:opacity-70"
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

function Segmented({
        value,
        onChange,
        options,
}: {
        value: string
        onChange: (v: string) => void
        options: { value: string; label: string }[]
}) {
        return (
                <div className="inline-flex w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] p-0.5">
                        {options.map((o) => (
                                <button
                                        key={o.value}
                                        onClick={() => onChange(o.value)}
                                        className={`flex-1 rounded-md px-3 py-1.5 text-sm transition-colors ${
                                                value === o.value
                                                        ? 'bg-[var(--white)] font-medium text-[var(--bg-base)]'
                                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                        }`}
                                >
                                        {o.label}
                                </button>
                        ))}
                </div>
        )
}
