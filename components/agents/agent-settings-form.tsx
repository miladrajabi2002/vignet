'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import {
        Loader2,
        Check,
        Trash2,
        Pencil,
        Plus,
        X,
        Eye,
        Sparkles,
        MessageSquare,
        ShieldAlert,
        HelpCircle,
        Type,
        ListChecks,
        Power,
        Mic,
        ImageIcon,
} from 'lucide-react'
import { ModelSelect } from '@/components/agent-builder/model-select'
import { Switch, SwitchCard } from '@/components/ui/switch'
import { resolveModelAlias, type ModelAlias } from '@/lib/ai/models'
import {
        buildLayeredPrompt,
        hasMeaningfulPromptConfig,
        normalizePromptConfig,
        type NormalizedPromptConfig,
        type PromptConfig,
        type PromptFormatConfig,
        type PromptQAPair,
} from '@/lib/ai/prompt-builder'
import { NaturalConversationControls } from '@/components/agent-builder/natural-conversation-controls'
import { PROMPT_SCOPE_RULE_LIMIT } from '@/lib/agents/prompt-config-limits'

const EMPTY_CONFIG: PromptConfig = {
        personality: '',
        tone: '',
        doSay: [],
        dontSay: [],
        fallbackBehavior: '',
        format: { bold: true, emoji: false, links: true, bullets: true, length: 'medium' },
        qaPairs: [],
}

type LayerTab = 'personality' | 'tone' | 'scope' | 'fallback' | 'format' | 'qa'

export interface AgentSettingsData {
        id: string
        name: string
        description: string | null
        systemPrompt: string
        model: string | null
        language: string
        welcomeMessage: string | null
        fallbackMessage: string | null
        handoffEnabled: boolean
        handoffMessage: string | null
        handoffKeywords: string[]
        active: boolean
        voiceInputEnabled: boolean
        imageInputEnabled: boolean
        // ─ F1: layered prompt
        promptConfig: PromptConfig | null
        roleTemplate: string | null
        // ─ F3: customer identification
        requireCustomerInfo: boolean
        customerInfoPrompt: string | null
}

export function AgentSettingsForm({
        section = 'general',
        storeAccess,
        agent,
        modelPolicy,
}: {
        section?: 'general' | 'behavior'
        storeAccess?: React.ReactNode
        agent: AgentSettingsData
        modelPolicy: {
                plan: 'TRIAL' | 'STARTER' | 'PRO' | 'BUSINESS'
                enabledModels: ModelAlias[]
                trialModel: ModelAlias
                creditBalanceIRR: number
                replyPricesIRR: Record<ModelAlias, number>
                sttPricePerMinuteIRR: number
                visionPricePerImageIRR: number
        }
}) {
        const tw = useTranslations('agents.wizard')
        const tf = useTranslations('agents.settingsForm')
        const tc = useTranslations('common')
        const ta = useTranslations('agents')
        const locale = useLocale() === 'en' ? 'en' : 'fa'
        const router = useRouter()

        const [form, setForm] = useState({
                name: agent.name,
                description: agent.description ?? '',
                systemPrompt: agent.systemPrompt,
                // Retired aliases (standard / balanced / premium) are saved back as today's mode.
                model: agent.model ? resolveModelAlias(agent.model) : '',
                welcomeMessage: agent.welcomeMessage ?? '',
                fallbackMessage: agent.fallbackMessage ?? '',
                handoffEnabled: agent.handoffEnabled,
                handoffMessage: agent.handoffMessage ?? '',
                handoffKeywords: agent.handoffKeywords.join(', '),
                active: agent.active,
                voiceInputEnabled: agent.voiceInputEnabled,
                imageInputEnabled: agent.imageInputEnabled,
        })

        const [promptConfig, setPromptConfig] = useState<NormalizedPromptConfig>(
                normalizePromptConfig(agent.promptConfig ?? EMPTY_CONFIG),
        )

        // Server-configured long-chat threshold (from LONG_CHAT_THRESHOLD env).
        // Used only to show a hint next to the handoff settings.
        const [longChatThreshold, setLongChatThreshold] = useState<number>(10)
        useEffect(() => {
                let cancelled = false
                fetch('/api/config')
                        .then((r) => r.json())
                        .then((d: { longChatThreshold?: number }) => {
                                if (!cancelled && typeof d.longChatThreshold === 'number') {
                                        setLongChatThreshold(d.longChatThreshold)
                                }
                        })
                        .catch(() => {})
                return () => {
                        cancelled = true
                }
        }, [])
        const [activeTab, setActiveTab] = useState<LayerTab>('personality')
        const [showPreview, setShowPreview] = useState(false)

        const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
        const [saveError, setSaveError] = useState('')

        // ─ F3: customer identification
        const [requireCustomerInfo, setRequireCustomerInfo] = useState(
                agent.requireCustomerInfo ?? false,
        )
        const [customerInfoPrompt, setCustomerInfoPrompt] = useState(
                agent.customerInfoPrompt ?? '',
        )

        const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
                setForm((f) => ({ ...f, [k]: v }))

        const previewPrompt = useMemo(
                () => buildLayeredPrompt(promptConfig, form.systemPrompt, locale === 'fa'),
                [promptConfig, form.systemPrompt, locale],
        )

        async function save() {
                if (status === 'saving') return
                setSaveError('')
                setStatus('saving')
                try {
                const keywords = form.handoffKeywords
                        .split(/[,\u060c]/)
                        .map((s) => s.trim())
                        .filter(Boolean)
                const hasStructured = hasMeaningfulPromptConfig(promptConfig)
                const res = await fetch(`/api/agents/${agent.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(section === 'behavior' ? {
                                promptConfig: hasStructured ? promptConfig : null,
                                roleTemplate: agent.roleTemplate,
                        } : {
                                ...form,
                                handoffKeywords: keywords,
                                description: form.description || undefined,
                                model: form.model || null,
                                welcomeMessage: form.welcomeMessage || undefined,
                                fallbackMessage: form.fallbackMessage || undefined,
                                handoffMessage: form.handoffMessage || undefined,
                                // ─ F3: customer identification
                                requireCustomerInfo,
                                customerInfoPrompt: customerInfoPrompt.trim() || null,
                        }),
                })
                if (res.ok) {
                        setStatus('saved')
                        router.refresh()
                        setTimeout(() => setStatus('idle'), 2000)
                } else {
                        throw new Error('SAVE_FAILED')
                }
                } catch {
                        setStatus('idle')
                        setSaveError(locale === 'fa' ? 'تنظیمات ذخیره نشد. دوباره تلاش کنید.' : 'Settings could not be saved. Please try again.')
                }
        }

        const [deleteOpen, setDeleteOpen] = useState(false)
        const [deleting, setDeleting] = useState(false)
        const [deleteError, setDeleteError] = useState<string | null>(null)
        // Danger-zone friction: the destructive button stays inert until the
        // user types the agent's exact name — more danger, more confirmation.
        const [deleteConfirmName, setDeleteConfirmName] = useState('')
        const reduceMotion = useReducedMotion()
        const deleteDialogRef = useRef<HTMLDivElement | null>(null)
        const cancelDeleteRef = useRef<HTMLButtonElement | null>(null)

        // Focus-trap for the delete modal.
        useEffect(() => {
                if (!deleteOpen) return
                function onKey(e: globalThis.KeyboardEvent) {
                        if (e.key === 'Escape') setDeleteOpen(false)
                }
                window.addEventListener('keydown', onKey)
                return () => window.removeEventListener('keydown', onKey)
        }, [deleteOpen])

        useEffect(() => {
                if (!showPreview) return
                function onKey(e: globalThis.KeyboardEvent) {
                        if (e.key === 'Escape') setShowPreview(false)
                }
                window.addEventListener('keydown', onKey)
                return () => window.removeEventListener('keydown', onKey)
        }, [showPreview])

        async function remove() {
                setDeleting(true)
                setDeleteError(null)
                try {
                        const res = await fetch(`/api/agents/${agent.id}`, { method: 'DELETE' })
                        if (!res.ok) throw new Error('DELETE_FAILED')
                        router.push('/agents')
                        router.refresh()
                } catch {
                        setDeleteError(tf('deleteError'))
                        setDeleting(false)
                }
        }

        const fa = locale === 'fa'
        const tabs: { key: LayerTab; label: string; icon: typeof Sparkles; hint: string; filled: boolean }[] = [
                { key: 'personality', label: tf('layerPersonality'), icon: Sparkles, hint: fa ? 'ایجنت کیست و در گفتگو چه نقشی دارد.' : 'Who the agent is and the role it plays.', filled: Boolean(promptConfig.personality?.trim()) },
                { key: 'tone', label: tf('layerTone'), icon: MessageSquare, hint: fa ? 'چطور حرف بزند: رسمی یا صمیمی، کوتاه یا مفصل.' : 'How it talks: formal or friendly, brief or detailed.', filled: Boolean(promptConfig.tone?.trim()) },
                { key: 'scope', label: tf('layerScope'), icon: ShieldAlert, hint: fa ? 'بایدها و نبایدهای پاسخ‌گویی.' : 'What it must and must never say.', filled: promptConfig.doSay.length + promptConfig.dontSay.length > 0 },
                { key: 'fallback', label: tf('layerFallback'), icon: HelpCircle, hint: fa ? 'وقتی جواب را نمی‌داند چه کند.' : 'What it does when it does not know.', filled: Boolean(promptConfig.fallbackBehavior?.trim()) },
                { key: 'format', label: tf('layerFormat'), icon: Type, hint: fa ? 'طول پاسخ، ایموجی، لینک و فهرست.' : 'Reply length, emoji, links and lists.', filled: true },
                { key: 'qa', label: tf('layerQA'), icon: ListChecks, hint: fa ? 'چند نمونه پاسخ تا سبک شما را یاد بگیرد.' : 'A few sample answers so it learns your style.', filled: promptConfig.qaPairs.some((pair) => pair.enabled !== false) },
        ]
        const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.key === activeTab))
        const filledCount = tabs.filter((tab) => tab.filled).length
        const layerNumber = (value: number) => value.toLocaleString(fa ? 'fa-IR' : 'en-US')

        return (
                <div className="space-y-6">
                        {section === 'behavior' ? (
                        <>
                        {/* ─ 6-LAYER PROMPT ENGINE ──────────────────────────────────── */}
                        <div id="behavior" className="scroll-mt-28 spatial-surface space-y-4 rounded-card p-4 sm:space-y-5 sm:p-6">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                                <h3 className="ui-h3">{tf('promptEngineTitle')}</h3>
                                                <div className="mt-1.5 flex items-center gap-2.5">
                                                        <span className="flex gap-1" aria-hidden="true">
                                                                {tabs.map((tab) => (
                                                                        <span key={tab.key} className={`h-1.5 w-5 rounded-full transition-colors ${tab.filled ? 'bg-[var(--text-primary)]' : 'bg-black/[0.09]'}`} />
                                                                ))}
                                                        </span>
                                                        <span className="text-[12px] font-medium tabular-nums text-[var(--text-muted)]">
                                                                {fa ? `${layerNumber(filledCount)} از ${layerNumber(tabs.length)} لایه تنظیم شده` : `${filledCount} of ${tabs.length} layers set`}
                                                        </span>
                                                </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                                                <button
                                                        type="button"
                                                        onClick={() => setShowPreview(true)}
                                                        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-default)] bg-white px-3.5 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                                >
                                                        <Eye className="h-4 w-4" />
                                                        {tf('previewPrompt')}
                                                </button>
                                                <button type="button" onClick={save} disabled={status === 'saving'} className="spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-black px-4 text-xs font-bold text-white shadow-[var(--shadow-control)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2">
                                                        {status === 'saving' ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Check className="h-4 w-4" strokeWidth={2.5} />}
                                                        {status === 'saved' ? tc('saved') : tc('save')}
                                                </button>
                                        </div>
                                </div>
                                {saveError && <p role="alert" className="text-sm text-danger">{saveError}</p>}

                                {/* Layer tabs — segmented, 3×2 on phones, one row on desktop */}
                                <div role="tablist" aria-label={fa ? 'لایه‌های رفتار ایجنت' : 'Agent behavior layers'} className="ui-seg grid-cols-3 sm:grid-cols-6">
                                        {tabs.map(({ key, label, icon: Icon, filled }, index) => (
                                                <button
                                                        key={key}
                                                        type="button"
                                                        role="tab"
                                                        id={`behavior-layer-tab-${key}`}
                                                        aria-controls="behavior-layer-panel"
                                                        aria-selected={activeTab === key}
                                                        tabIndex={activeTab === key ? 0 : -1}
                                                        onClick={() => setActiveTab(key)}
                                                        onKeyDown={(event) => {
                                                                let next: number | undefined
                                                                if (event.key === 'Home') next = 0
                                                                if (event.key === 'End') next = tabs.length - 1
                                                                if (event.key === 'ArrowRight') next = (index + (fa ? -1 : 1) + tabs.length) % tabs.length
                                                                if (event.key === 'ArrowLeft') next = (index + (fa ? 1 : -1) + tabs.length) % tabs.length
                                                                if (next === undefined) return
                                                                event.preventDefault()
                                                                setActiveTab(tabs[next].key)
                                                                document.getElementById(`behavior-layer-tab-${tabs[next].key}`)?.focus()
                                                        }}
                                                        className="ui-seg-tab min-h-[3.75rem] flex-col gap-1 px-1 py-1.5 text-[13px] sm:text-xs"
                                                >
                                                        <span className="relative">
                                                                <span className="ui-seg-icon h-7 w-7"><Icon className="h-3.5 w-3.5" aria-hidden="true" /></span>
                                                                {filled && key !== 'format' && <span aria-hidden className="absolute -end-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />}
                                                        </span>
                                                        <span className="max-w-full truncate">{label}</span>
                                                </button>
                                        ))}
                                </div>

                                <div className="flex items-start gap-2.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2.5">
                                        <span className="mt-0.5 shrink-0 rounded-full bg-[var(--text-primary)] px-2 py-0.5 text-[12px] font-bold tabular-nums text-white">
                                                {fa ? `لایه ${layerNumber(activeIndex + 1)}` : `Layer ${activeIndex + 1}`}
                                        </span>
                                        <p className="text-[13px] leading-6 text-[var(--text-secondary)]">{tabs[activeIndex].hint}</p>
                                </div>

                                {/* Layer editors */}
                                <div id="behavior-layer-panel" role="tabpanel" aria-labelledby={`behavior-layer-tab-${activeTab}`}>
                                        <LayerEditor
                                                tab={activeTab}
                                                config={promptConfig}
                                                onChange={setPromptConfig}
                                                isFa={locale === 'fa'}
                                                t={tf}
                                        />
                                </div>

                        </div>

                        </>
                        ) : (
                        <>
                        <div className="spatial-surface space-y-5 rounded-card p-5 sm:p-6">
                                <Field label={tw('name')}>
                                        <input
                                                value={form.name}
                                                onChange={(e) => set('name', e.target.value)}
                                                className="input"
                                        />
                                </Field>

                                {/* Columns follow the available width (not the viewport), so the
                                    cards never squeeze to one word per line beside the sidebar. */}
                                <div className="ui-switch-list divide-y divide-[var(--border-subtle)] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white">
                                        <SwitchCard
                                                icon={Power}
                                                title={tf('agentActive')}
                                                description={tf('agentActiveHint')}
                                                checked={form.active}
                                                onChange={(v) => set('active', v)}
                                                enabledLabel={ta('active')}
                                                disabledLabel={ta('inactive')}
                                        />
                                        <SwitchCard
                                                icon={Mic}
                                                title={tf('voiceInputEnabled')}
                                                description={form.voiceInputEnabled
                                                        ? tf('voiceInputEnabledActiveHint', {
                                                                price: new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US')
                                                                        .format(modelPolicy.sttPricePerMinuteIRR / 10),
                                                        })
                                                        : tf('voiceInputEnabledHint')}
                                                checked={form.voiceInputEnabled}
                                                onChange={(v) => set('voiceInputEnabled', v)}
                                                enabledLabel={ta('active')}
                                                disabledLabel={ta('inactive')}
                                        />
                                        <SwitchCard
                                                icon={ImageIcon}
                                                title={tf('imageInputEnabled')}
                                                description={form.imageInputEnabled
                                                        ? tf('imageInputEnabledActiveHint', {
                                                                price: new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US')
                                                                        .format(modelPolicy.visionPricePerImageIRR / 10),
                                                        })
                                                        : tf('imageInputEnabledHint')}
                                                checked={form.imageInputEnabled}
                                                onChange={(v) => set('imageInputEnabled', v)}
                                                enabledLabel={ta('active')}
                                                disabledLabel={ta('inactive')}
                                        />
                                </div>

                                <Field label={tw('model')}>
                                        <ModelSelect
                                                value={form.model}
                                                onChange={(v) => set('model', v)}
                                                availableModels={modelPolicy.enabledModels}
                                                trialModel={modelPolicy.trialModel}
                                                isTrial={modelPolicy.plan === 'TRIAL'}
                                                creditBalanceIRR={modelPolicy.creditBalanceIRR}
                                                replyPricesIRR={modelPolicy.replyPricesIRR}
                                        />
                                </Field>
                                <Field label={tw('welcomeMessage')}>
                                        <input
                                                value={form.welcomeMessage}
                                                onChange={(e) => set('welcomeMessage', e.target.value)}
                                                className="input"
                                        />
                                </Field>
                                <Field label={tw('fallbackMessage')}>
                                        <input
                                                value={form.fallbackMessage}
                                                onChange={(e) => set('fallbackMessage', e.target.value)}
                                                className="input"
                                        />
                                </Field>
                        </div>

                        {storeAccess}

                        <div className="grid items-start gap-4 xl:grid-cols-2">
                        {/* ─ CUSTOMER IDENTIFICATION (F3) ──────────────────────────── */}
                        <div className="spatial-surface space-y-4 rounded-card p-5 sm:p-6">
                                <div>
                                        <h3 className="text-base font-medium text-[var(--text-primary)]">
                                                {tf('customerIdentificationTitle')}
                                        </h3>
                                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                                                {tf('customerIdentificationDesc')}
                                        </p>
                                </div>
                                <Toggle
                                        label={tf('requireCustomerInfo')}
                                        checked={requireCustomerInfo}
                                        onChange={setRequireCustomerInfo}
                                />
                                {requireCustomerInfo && (
                                        <Field label={tf('customerInfoPrompt')}>
                                                <textarea
                                                        value={customerInfoPrompt}
                                                        onChange={(e) => setCustomerInfoPrompt(e.target.value)}
                                                        rows={3}
                                                        placeholder={tf('customerInfoPromptPlaceholder')}
                                                        className="input resize-none text-sm"
                                                />
                                                <p className="mt-1 text-xs text-[var(--text-muted)]">
                                                        {tf('customerInfoPromptHint')}
                                                </p>
                                        </Field>
                                )}
                        </div>

                        {/* ─ Handoff ─────────────────────────────────────────────────── */}
                        <div className="spatial-surface space-y-4 rounded-card p-5 sm:p-6">
                                <div>
                                        <h3 className="text-base font-medium text-[var(--text-primary)]">
                                                {tf('handoffTitle')}
                                        </h3>
                                        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                                                {tf('handoffDesc')}
                                        </p>
                                </div>
                                <Toggle
                                        label={tf('handoffEnabled')}
                                        checked={form.handoffEnabled}
                                        onChange={(v) => set('handoffEnabled', v)}
                                />
                                {form.handoffEnabled && (
                                        <>
                                                <Field label={tf('handoffMessage')}>
                                                        <input
                                                                value={form.handoffMessage}
                                                                onChange={(e) => set('handoffMessage', e.target.value)}
                                                                placeholder={tf('handoffMessagePlaceholder')}
                                                                className="input text-sm"
                                                        />
                                                </Field>
                                                <Field label={tf('handoffKeywords')}>
                                                        <input
                                                                value={form.handoffKeywords}
                                                                onChange={(e) => set('handoffKeywords', e.target.value)}
                                                                placeholder={tf('handoffKeywordsPlaceholder')}
                                                                className="input text-sm"
                                                        />
                                                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                                                                {tf('handoffKeywordsHint')}
                                                        </p>
                                                </Field>
                                                <p className="rounded-xl bg-[var(--bg-base)] p-3 text-xs text-[var(--text-secondary)]">
                                                        {tf('longChatAutoHandoffHint', { threshold: longChatThreshold })}
                                                </p>
                                        </>
                                )}
                        </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                                        <button
                                                onClick={save}
                                                disabled={status === 'saving'}
                                                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--white)] px-6 text-sm font-medium text-[var(--bg-base)] transition-transform hover:scale-[1.02] disabled:opacity-50"
                                        >
                                                {status === 'saving' && <Loader2 className="h-4 w-4 animate-spin" />}
                                                {status === 'saved' ? tc('saved') : tc('save')}
                                        </button>
                                        {saveError && <p role="alert" className="text-sm text-danger">{saveError}</p>}
                                        {status === 'saved' && (
                                                <span className="inline-flex items-center gap-1 text-sm text-success">
                                                        <Check className="h-4 w-4" />
                                                        {tf('saved')}
                                                </span>
                                        )}
                        </div>

                        {/* Danger zone — delete agent */}
                        <div className="spatial-surface rounded-card p-5 sm:p-6">
                                <div className="flex items-start gap-3">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger">
                                                <Trash2 className="h-4 w-4" />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                                <p className="text-sm font-bold text-[var(--text-primary)]">
                                                        {tf('delete')}
                                                </p>
                                                <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                                                        {tf('deleteHint') || tf('deleteConfirm')}
                                                </p>
                                        </div>
                                        <button
                                                type="button"
                                                onClick={() => { setDeleteConfirmName(''); setDeleteOpen(true) }}
                                                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-danger/30 bg-danger/5 px-4 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
                                        >
                                                <Trash2 className="h-4 w-4" />
                                                {tf('delete')}
                                        </button>
                                </div>
                        </div>

                        </>
                        )}

                        {typeof document !== 'undefined' && createPortal(
                                <AnimatePresence>
                                        {showPreview && (
                                                <motion.div
                                                        className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-4 backdrop-blur-md"
                                                        initial={reduceMotion ? false : { opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        exit={{ opacity: 0 }}
                                                        onMouseDown={(event) => {
                                                                if (event.target === event.currentTarget) setShowPreview(false)
                                                        }}
                                                >
                                                        <motion.div
                                                                role="dialog"
                                                                aria-modal="true"
                                                                aria-label={tf('previewPrompt')}
                                                                className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-card border border-black/10 bg-white shadow-[var(--elev-2)]"
                                                                initial={reduceMotion ? false : { opacity: 0, scale: 0.97, y: 10 }}
                                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                                exit={{ opacity: 0, scale: 0.98, y: 6 }}
                                                        >
                                                                <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
                                                                        <div>
                                                                                <h3 className="text-base font-bold text-neutral-900">{tf('previewPrompt')}</h3>
                                                                                <p className="mt-1 text-xs text-neutral-500">{tf('assembledPrompt')}</p>
                                                                        </div>
                                                                        <button
                                                                                type="button"
                                                                                onClick={() => setShowPreview(false)}
                                                                                aria-label={tf('close')}
                                                                                className="grid h-10 w-10 place-items-center rounded-xl text-neutral-500 transition-colors hover:bg-black/5 hover:text-neutral-900"
                                                                        >
                                                                                <X className="h-5 w-5" />
                                                                        </button>
                                                                </div>
                                                                <pre dir={locale === 'fa' ? 'rtl' : 'ltr'} className="overflow-y-auto whitespace-pre-wrap p-5 text-start font-mono text-xs leading-7 text-neutral-700">
                                                                        {previewPrompt || tf('emptyPrompt')}
                                                                </pre>
                                                        </motion.div>
                                                </motion.div>
                                        )}
                                </AnimatePresence>,
                                document.body,
                        )}

                        {/* Delete confirmation modal — uses the same portal + motion + backdrop-blur
                            pattern as the product/conversation delete dialogs so the visual layering
                            (z-index, blur strength, animation) stays consistent across the app. */}
                        {typeof document !== 'undefined' && createPortal(
                                <AnimatePresence>
                                        {deleteOpen && (
                                                <motion.div
                                                        className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-4 backdrop-blur-md"
                                                        initial={reduceMotion ? false : { opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        exit={{ opacity: 0 }}
                                                        transition={{ duration: reduceMotion ? 0 : 0.16, ease: 'easeOut' }}
                                                        onMouseDown={(event) => {
                                                                if (event.target === event.currentTarget && !deleting) setDeleteOpen(false)
                                                        }}
                                                >
                                                        <motion.div
                                                                ref={deleteDialogRef}
                                                                role="dialog"
                                                                aria-modal="true"
                                                                aria-label={tf('delete')}
                                                                className="w-full max-w-[27rem] overflow-hidden rounded-card border border-black/10 bg-white shadow-[var(--elev-2)]"
                                                                initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 12 }}
                                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                                exit={{ opacity: 0, scale: 0.98, y: 6 }}
                                                                transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
                                                        >
                                                                <div className="p-6 pb-5 text-center sm:text-start">
                                                                        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100 sm:mx-0">
                                                                                <Trash2 className="h-5 w-5" aria-hidden="true" />
                                                                        </span>
                                                                        <h2 className="mt-4 text-lg font-bold tracking-tight text-[var(--text-primary)]">
                                                                                {tf('delete')}
                                                                        </h2>
                                                                        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                                                                                {tf('deleteConfirm')}
                                                                        </p>
                                                                        <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
                                                                                {tf('deletePermanentHint')}
                                                                        </p>
                                                                        <label className="mt-4 block text-start">
                                                                                <span className="text-xs font-medium text-[var(--text-secondary)]">
                                                                                        {locale === 'fa' ? 'برای تأیید، نام ایجنت را دقیقاً بنویسید:' : 'Type the agent name to confirm:'}
                                                                                </span>
                                                                                <input
                                                                                        dir="auto"
                                                                                        value={deleteConfirmName}
                                                                                        onChange={(e) => setDeleteConfirmName(e.target.value)}
                                                                                        disabled={deleting}
                                                                                        autoComplete="off"
                                                                                        spellCheck={false}
                                                                                        className="input mt-1.5 font-mono text-sm"
                                                                                        placeholder={agent.name}
                                                                                />
                                                                        </label>
                                                                        {deleteError && (
                                                                                <p role="alert" className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-start text-sm text-red-700">
                                                                                        {deleteError}
                                                                                </p>
                                                                        )}
                                                                </div>

                                                                <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--bg-base)_60%,transparent)] p-4 sm:flex-row sm:justify-end">
                                                                        <button
                                                                                ref={cancelDeleteRef}
                                                                                type="button"
                                                                                onClick={() => setDeleteOpen(false)}
                                                                                disabled={deleting}
                                                                                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border-default)] bg-white px-4 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-50"
                                                                        >
                                                                                {tf('cancel')}
                                                                        </button>
                                                                        <button
                                                                                type="button"
                                                                                onClick={remove}
                                                                                disabled={deleting || deleteConfirmName.trim() !== agent.name.trim()}
                                                                                title={deleteConfirmName.trim() !== agent.name.trim() ? (locale === 'fa' ? 'نام ایجنت را دقیقاً وارد کنید تا دکمه فعال شود' : 'Type the exact agent name to enable this button') : undefined}
                                                                                className="inline-flex min-h-11 min-w-32 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                                                                        >
                                                                                {deleting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                                                                                {tf('delete')}
                                                                        </button>
                                                                </div>
                                                        </motion.div>
                                                </motion.div>
                                        )}
                                </AnimatePresence>,
                                document.body,
                        )}
                </div>
        )
}

/** Long free-text layers: tall enough to read a whole paragraph, and
 *  growing with the text where the browser supports field-sizing. */
const LAYER_TEXTAREA = 'input min-h-[200px] max-h-[560px] resize-y text-sm leading-7 [field-sizing:content] sm:min-h-[260px]'

// ─────────────────────────────────────────────────────────────────────
// LAYER EDITOR — renders the active layer's form
// ─────────────────────────────────────────────────────────────────────

function LayerEditor({
        tab,
        config,
        onChange,
        isFa,
        t,
}: {
        tab: LayerTab
        config: NormalizedPromptConfig
        onChange: (c: NormalizedPromptConfig) => void
        isFa: boolean
        t: (k: string) => string
}) {
        if (tab === 'personality') {
                return (
                        <Field label={t('personalityLabel')}>
                                <textarea
                                        value={config.personality}
                                        onChange={(e) => onChange({ ...config, personality: e.target.value })}
                                        rows={8}
                                        placeholder={
                                                isFa
                                                        ? 'مثلاً: تو یک مشاور فروش صبور و حرفه‌ای هستی...'
                                                        : 'e.g. You are a patient, professional sales consultant...'
                                        }
                                        className={LAYER_TEXTAREA}
                                />
                                <p className="mt-1 text-xs text-[var(--text-muted)]">{t('personalityHint')}</p>
                        </Field>
                )
        }

        if (tab === 'tone') {
                return (
                        <div className="space-y-4">
                                <Field label={t('toneLabel')}>
                                        <textarea
                                                value={config.tone}
                                                onChange={(e) => onChange({ ...config, tone: e.target.value })}
                                                rows={8}
                                                placeholder={
                                                        isFa
                                                                ? 'مثلاً: لحن گرم و صمیمی، از کلمات محترمانه «شما»...'
                                                                : 'e.g. Warm and friendly tone, use polite "you"...'
                                                }
                                                className={LAYER_TEXTAREA}
                                        />
                                        <p className="mt-1 text-xs text-[var(--text-muted)]">{t('toneHint')}</p>
                                </Field>
                                <NaturalConversationControls
                                        value={config.conversation}
                                        onChange={(conversation) => onChange({ ...config, conversation })}
                                />
                        </div>
                )
        }

        if (tab === 'scope') {
                return (
                        <div className="grid gap-4 sm:grid-cols-2">
                                <ListEditor
                                        label={t('doSayLabel')}
                                        hint={t('doSayHint')}
                                        items={config.doSay}
                                        onChange={(items) => onChange({ ...config, doSay: items })}
                                        placeholder={
                                                isFa ? 'مثلاً: اول نیاز مشتری را بپرس' : 'e.g. Ask the customer need first'
                                        }
                                        positive
                                        limit={PROMPT_SCOPE_RULE_LIMIT}
                                        isFa={isFa}
                                />
                                <ListEditor
                                        label={t('dontSayLabel')}
                                        hint={t('dontSayHint')}
                                        items={config.dontSay}
                                        onChange={(items) => onChange({ ...config, dontSay: items })}
                                        placeholder={isFa ? 'مثلاً: قیمت را حدس نزن' : "e.g. Don't guess prices"}
                                        positive={false}
                                        limit={PROMPT_SCOPE_RULE_LIMIT}
                                        isFa={isFa}
                                />
                        </div>
                )
        }

        if (tab === 'fallback') {
                return (
                        <Field label={t('fallbackLabel')}>
                                <textarea
                                        value={config.fallbackBehavior}
                                        onChange={(e) => onChange({ ...config, fallbackBehavior: e.target.value })}
                                        rows={8}
                                        placeholder={
                                                isFa
                                                        ? 'مثلاً: اگر محصولی در کاتالوگ نبود، صادقانه بگو و راه تماس بده...'
                                                        : 'e.g. If a product is not in the catalog, honestly say so and offer contact...'
                                        }
                                        className={LAYER_TEXTAREA}
                                />
                                <p className="mt-1 text-xs text-[var(--text-muted)]">{t('fallbackHint')}</p>
                        </Field>
                )
        }

        if (tab === 'format') {
                const fmt = config.format
                const setFmt = (patch: Partial<PromptFormatConfig>) =>
                        onChange({ ...config, format: { ...fmt, ...patch } })
                return (
                        <div className="space-y-4">
                                <div>
                                        <span className="mb-2 block text-sm text-[var(--text-secondary)]">
                                                {t('formatLength')}
                                        </span>
                                        <div className="flex gap-2">
                                                {(['short', 'medium', 'long'] as const).map((len) => (
                                                        <button
                                                                key={len}
                                                                type="button"
                                                                onClick={() => setFmt({ length: len })}
                                                                className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                                                                        fmt.length === len
                                                                                ? 'border-[var(--border-strong)] bg-[var(--bg-muted)] text-[var(--text-primary)]'
                                                                                : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]'
                                                                }`}
                                                        >
                                                                {t(`length_${len}`)}
                                                        </button>
                                                ))}
                                        </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                        <FormatToggle
                                                label={t('fmt_bold')}
                                                checked={fmt.bold}
                                                onChange={(v) => setFmt({ bold: v })}
                                        />
                                        <FormatToggle
                                                label={t('fmt_emoji')}
                                                checked={fmt.emoji}
                                                onChange={(v) => setFmt({ emoji: v })}
                                        />
                                        <FormatToggle
                                                label={t('fmt_links')}
                                                checked={fmt.links}
                                                onChange={(v) => setFmt({ links: v })}
                                        />
                                        <FormatToggle
                                                label={t('fmt_bullets')}
                                                checked={fmt.bullets}
                                                onChange={(v) => setFmt({ bullets: v })}
                                        />
                                </div>
                        </div>
                )
        }

        // qa
        return (
                <QAEditor
                        items={config.qaPairs}
                        onChange={(items) => onChange({ ...config, qaPairs: items })}
                        t={t}
                />
        )
}

function ListEditor({
        label,
        hint,
        items,
        onChange,
        placeholder,
        positive,
        limit,
        isFa,
}: {
        label: string
        hint: string
        items: string[]
        onChange: (items: string[]) => void
        placeholder: string
        positive: boolean
        limit: number
        isFa: boolean
}) {
        const fa = useLocale() !== 'en'
        const [draft, setDraft] = useState('')
        const limitReached = items.length >= limit
        function add() {
                const v = draft.trim()
                if (!v || limitReached) return
                onChange([...items, v])
                setDraft('')
        }
        return (
                <Field label={label}>
                        <div className="flex gap-2">
                                <input
                                        value={draft}
                                        onChange={(e) => setDraft(e.target.value)}
                                        onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                        e.preventDefault()
                                                        add()
                                                }
                                        }}
                                        placeholder={placeholder}
                                        disabled={limitReached}
                                        className="input text-sm"
                                />
                                <button
                                        type="button"
                                        onClick={add}
                                        disabled={limitReached || !draft.trim()}
                                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                                        aria-label={isFa ? 'افزودن قانون' : 'Add rule'}
                                >
                                        <Plus className="h-4 w-4" />
                                </button>
                        </div>
                        {items.length > 0 && (
                                <ul className="mt-2 space-y-1">
                                        {items.map((item, i) => (
                                                <li
                                                        key={i}
                                                        className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-muted)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)]"
                                                >
                                                        <span className={positive ? 'text-success' : 'text-danger'}>
                                                                {positive ? '✓' : '✕'}
                                                        </span>
                                                        <span className="flex-1">{item}</span>
                                                        <button
                                                                type="button"
                                                                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                                                                className="text-[var(--text-muted)] transition-colors hover:text-danger"
                                                                aria-label={fa ? `حذف «${item}»` : `Remove “${item}”`}
                                                        >
                                                                <X className="h-3 w-3" />
                                                        </button>
                                                </li>
                                        ))}
                                </ul>
                        )}
                        <div className="mt-1 flex items-start justify-between gap-3 text-xs text-[var(--text-muted)]">
                                <p>{hint}</p>
                                <span className="shrink-0 tabular-nums" aria-live="polite">
                                        {items.length}/{limit}
                                </span>
                        </div>
                </Field>
        )
}

function FormatToggle({
        label,
        checked,
        onChange,
}: {
        label: string
        checked: boolean
        onChange: (v: boolean) => void
}) {
        return (
                <button
                        type="button"
                        onClick={() => onChange(!checked)}
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors ${
                                checked
                                        ? 'border-[var(--border-strong)] bg-[var(--bg-muted)] text-[var(--text-primary)]'
                                        : 'border-[var(--border-default)] text-[var(--text-muted)]'
                        }`}
                >
                        <span>{label}</span>
                        <span
                                className={`h-3.5 w-3.5 rounded-full border ${
                                        checked
                                                ? 'border-[var(--border-strong)] bg-[var(--white)]'
                                                : 'border-[var(--border-default)]'
                                }`}
                        />
                </button>
        )
}

const QA_LIMIT = 20

function QAEditor({
        items,
        onChange,
        t,
}: {
        items: PromptQAPair[]
        onChange: (items: PromptQAPair[]) => void
        t: (k: string) => string
}) {
        const fa = useLocale() !== 'en'
        const num = (value: number) => value.toLocaleString(fa ? 'fa-IR' : 'en-US')
        // Examples read as a short exchange; the fields only appear while editing.
        const [editing, setEditing] = useState<number | null>(null)
        const full = items.length >= QA_LIMIT

        function add() {
                if (full) return
                onChange([...items, { question: '', answer: '' }])
                setEditing(items.length)
        }
        function update(i: number, patch: Partial<PromptQAPair>) {
                onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
        }
        function remove(i: number) {
                onChange(items.filter((_, idx) => idx !== i))
                setEditing((current) => (current === null || current === i ? null : current > i ? current - 1 : current))
        }

        return (
                <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                                <p className="text-[13px] font-bold text-[var(--text-primary)]">{fa ? 'نمونه‌های شما' : 'Your examples'}</p>
                                <span className="text-[12px] tabular-nums text-[var(--text-muted)]" aria-live="polite">
                                        {fa ? `${num(items.length)} از ${num(QA_LIMIT)}` : `${items.length} of ${QA_LIMIT}`}
                                </span>
                                <button
                                        type="button"
                                        onClick={add}
                                        disabled={full}
                                        className="spatial-press ms-auto inline-flex min-h-10 items-center gap-1.5 rounded-control border border-[var(--border-default)] bg-white px-3 text-[13px] font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-50"
                                >
                                        <Plus className="h-4 w-4" aria-hidden="true" />
                                        {fa ? 'نمونهٔ تازه' : 'New example'}
                                </button>
                        </div>

                        {items.length === 0 && (
                                <p className="rounded-xl border border-dashed border-[var(--border-default)] p-4 text-center text-xs text-[var(--text-muted)]">
                                        {t('qaEmpty')}
                                </p>
                        )}

                        <div className="grid items-start gap-3 lg:grid-cols-2">
                                {items.map((item, i) => {
                                        const on = item.enabled !== false
                                        const label = `${t('qaPair')} ${num(i + 1)}`
                                        const open = editing === i || !item.question.trim() || !item.answer.trim()
                                        return (
                                                <div key={i} className="rounded-xl border border-[var(--border-subtle)] bg-white p-3">
                                                        <div className="flex items-center gap-2">
                                                                <span className="text-[12px] font-medium text-[var(--text-muted)]">{label}</span>
                                                                {!on && <span className="ui-chip">{fa ? 'خاموش' : 'Off'}</span>}
                                                                <span className="ms-auto flex items-center gap-1">
                                                                        {!open && (
                                                                                <button
                                                                                        type="button"
                                                                                        onClick={() => setEditing(i)}
                                                                                        aria-label={fa ? `ویرایش ${label}` : `Edit ${label}`}
                                                                                        className="grid h-9 w-9 place-items-center rounded-control text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                                                                >
                                                                                        <Pencil className="h-4 w-4" aria-hidden="true" />
                                                                                </button>
                                                                        )}
                                                                        <button
                                                                                type="button"
                                                                                onClick={() => remove(i)}
                                                                                aria-label={fa ? `حذف ${label}` : `Remove ${label}`}
                                                                                className="grid h-9 w-9 place-items-center rounded-control text-[var(--text-muted)] transition-colors hover:bg-red-50 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                                                        >
                                                                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                                        </button>
                                                                        <Switch
                                                                                checked={on}
                                                                                onChange={(value) => update(i, { enabled: value })}
                                                                                aria-label={fa ? `استفاده از ${label}` : `Use ${label}`}
                                                                        />
                                                                </span>
                                                        </div>

                                                        {open ? (
                                                                <div className="mt-2.5 space-y-2.5">
                                                                        <label className="block">
                                                                                <span className="ui-field-label">{fa ? 'مشتری می‌پرسد' : 'Customer asks'}</span>
                                                                                <input
                                                                                        value={item.question}
                                                                                        onChange={(e) => update(i, { question: e.target.value })}
                                                                                        maxLength={500}
                                                                                        placeholder={t('qaQuestionPlaceholder')}
                                                                                        className="input text-sm"
                                                                                />
                                                                        </label>
                                                                        <label className="block">
                                                                                <span className="ui-field-label">{fa ? 'ایجنت جواب می‌دهد' : 'Agent answers'}</span>
                                                                                <textarea
                                                                                        value={item.answer}
                                                                                        onChange={(e) => update(i, { answer: e.target.value })}
                                                                                        rows={3}
                                                                                        maxLength={2000}
                                                                                        placeholder={t('qaAnswerPlaceholder')}
                                                                                        className="input resize-none text-sm"
                                                                                />
                                                                        </label>
                                                                        {editing === i && item.question.trim() && item.answer.trim() && (
                                                                                <button
                                                                                        type="button"
                                                                                        onClick={() => setEditing(null)}
                                                                                        className="inline-flex min-h-9 items-center rounded-control px-2 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                                                                >
                                                                                        {fa ? 'بستن ویرایش' : 'Done editing'}
                                                                                </button>
                                                                        )}
                                                                </div>
                                                        ) : (
                                                                // dir="ltr" pins the sides as in every Vigent chat: customer right, agent left.
                                                                <div dir="ltr" className={`mt-2.5 flex flex-col gap-1.5 transition-opacity ${on ? '' : 'opacity-50'}`}>
                                                                        <p dir="auto" className="max-w-[88%] self-end whitespace-pre-wrap rounded-2xl rounded-ee-md bg-[var(--bg-muted)] px-3 py-2 text-[13px] leading-6 text-[var(--text-primary)] [overflow-wrap:anywhere]">
                                                                                {item.question}
                                                                        </p>
                                                                        <p dir="auto" className="max-w-[88%] self-start whitespace-pre-wrap rounded-2xl rounded-es-md border border-[var(--signal-border)] bg-white px-3 py-2 text-[13px] leading-6 text-[var(--text-primary)] [overflow-wrap:anywhere]">
                                                                                {item.answer}
                                                                        </p>
                                                                </div>
                                                        )}
                                                </div>
                                        )
                                })}
                        </div>
                        <p className="ui-field-hint">
                                {fa
                                        ? 'نمونه‌ها فقط سبک جواب دادن را نشان می‌دهند. نمونهٔ خاموش ذخیره می‌ماند ولی ایجنت از آن استفاده نمی‌کند.'
                                        : 'Examples only show the answering style. A switched-off example stays saved but the agent does not use it.'}
                        </p>
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
        checked,
        onChange,
}: {
        label: string
        checked: boolean
        onChange: (v: boolean) => void
}) {
        return (
                <div className="flex min-h-11 items-center justify-between gap-4">
                        <span className={`text-sm ${checked ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                                {label}
                        </span>
                        <Switch checked={checked} onChange={onChange} aria-label={label} />
                </div>
        )
}
