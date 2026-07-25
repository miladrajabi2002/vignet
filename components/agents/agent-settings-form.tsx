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
        Plus,
        X,
        Eye,
        Sparkles,
        MessageSquare,
        ShieldAlert,
        HelpCircle,
        Type,
        ListChecks,
} from 'lucide-react'
import { ModelSelect } from '@/components/agent-builder/model-select'
import { MaterialSelect } from '@/components/ui/material-select'
import type { ModelAlias } from '@/lib/ai/models'
import {
        buildLayeredPrompt,
        getRoleTemplate,
        getRoleTemplatesForBusiness,
        getSuggestedRoleTemplate,
        hasMeaningfulPromptConfig,
        normalizePromptConfig,
        type NormalizedPromptConfig,
        type PromptConfig,
        type PromptFormatConfig,
        type PromptQAPair,
        type RoleTemplate,
} from '@/lib/ai/prompt-builder'
import { getVerticalPack, type BusinessTypeValue } from '@/lib/verticals/registry'
import { NaturalConversationControls } from '@/components/agent-builder/natural-conversation-controls'

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
        temperature: number
        maxTokens: number
        language: string
        welcomeMessage: string | null
        fallbackMessage: string | null
        handoffEnabled: boolean
        handoffMessage: string | null
        handoffKeywords: string[]
        active: boolean
        // ─ F1: layered prompt
        promptConfig: PromptConfig | null
        roleTemplate: string | null
        // ─ F3: customer identification
        requireCustomerInfo: boolean
        customerInfoPrompt: string | null
}

export function AgentSettingsForm({
        agent,
        businessType,
        modelPolicy,
}: {
        agent: AgentSettingsData
        businessType?: BusinessTypeValue | null
        modelPolicy: {
                plan: 'TRIAL' | 'STARTER' | 'PRO' | 'BUSINESS'
                enabledModels: ModelAlias[]
                trialModel: ModelAlias
                creditBalanceIRR: number
                replyPricesIRR: Record<ModelAlias, number>
        }
}) {
        const t = useTranslations('agents')
        const tw = useTranslations('agents.wizard')
        const tf = useTranslations('agents.settingsForm')
        const tc = useTranslations('common')
        const locale = useLocale() === 'en' ? 'en' : 'fa'
        const router = useRouter()
        const roleTemplates = useMemo(() => getRoleTemplatesForBusiness(businessType), [businessType])
        const businessLabel = locale === 'fa'
                ? getVerticalPack(businessType).titleFa
                : getVerticalPack(businessType).titleEn

        const [form, setForm] = useState({
                name: agent.name,
                description: agent.description ?? '',
                systemPrompt: agent.systemPrompt,
                model: agent.model ?? '',
                temperature: agent.temperature,
                maxTokens: agent.maxTokens,
                language: agent.language as 'fa' | 'en',
                welcomeMessage: agent.welcomeMessage ?? '',
                fallbackMessage: agent.fallbackMessage ?? '',
                handoffEnabled: agent.handoffEnabled,
                handoffMessage: agent.handoffMessage ?? '',
                handoffKeywords: agent.handoffKeywords.join(', '),
                active: agent.active,
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
        const [activeRole, setActiveRole] = useState<RoleTemplate | null>(() => {
                if (agent.roleTemplate) {
                        const exact = getRoleTemplate(agent.roleTemplate)
                        if (exact && roleTemplates.some((role) => role.key === exact.key)) return exact
                        return getSuggestedRoleTemplate(businessType, agent.roleTemplate)
                }
                return null
        })
        const [activeTab, setActiveTab] = useState<LayerTab>('personality')
        const [showPreview, setShowPreview] = useState(false)

        const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

        // ─ F3: customer identification
        const [requireCustomerInfo, setRequireCustomerInfo] = useState(
                agent.requireCustomerInfo ?? false,
        )
        const [customerInfoPrompt, setCustomerInfoPrompt] = useState(
                agent.customerInfoPrompt ?? '',
        )

        const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
                setForm((f) => ({ ...f, [k]: v }))

        function applyRoleTemplate(role: RoleTemplate) {
                setActiveRole(role)
                setPromptConfig(normalizePromptConfig(role.config))
        }

        const previewPrompt = useMemo(() => {
                const isFa = form.language !== 'en'
                return buildLayeredPrompt(promptConfig, form.systemPrompt, isFa)
        }, [promptConfig, form.systemPrompt, form.language])

        async function save() {
                setStatus('saving')
                const keywords = form.handoffKeywords
                        .split(/[,\u060c]/)
                        .map((s) => s.trim())
                        .filter(Boolean)
                const hasStructured = hasMeaningfulPromptConfig(promptConfig)
                const res = await fetch(`/api/agents/${agent.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                                ...form,
                                handoffKeywords: keywords,
                                description: form.description || undefined,
                                model: form.model || null,
                                welcomeMessage: form.welcomeMessage || undefined,
                                fallbackMessage: form.fallbackMessage || undefined,
                                handoffMessage: form.handoffMessage || undefined,
                                // ─ F1: layered prompt (only send if user filled something in)
                                promptConfig: hasStructured ? promptConfig : null,
                                roleTemplate: activeRole?.key ?? null,
                                // ─ F3: customer identification
                                requireCustomerInfo,
                                customerInfoPrompt: customerInfoPrompt || undefined,
                        }),
                })
                if (res.ok) {
                        setStatus('saved')
                        router.refresh()
                        setTimeout(() => setStatus('idle'), 2000)
                } else {
                        setStatus('idle')
                }
        }

        const [deleteOpen, setDeleteOpen] = useState(false)
        const [deleting, setDeleting] = useState(false)
        const [deleteError, setDeleteError] = useState<string | null>(null)
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

        const tabs: { key: LayerTab; label: string; icon: typeof Sparkles }[] = [
                { key: 'personality', label: tf('layerPersonality'), icon: Sparkles },
                { key: 'tone', label: tf('layerTone'), icon: MessageSquare },
                { key: 'scope', label: tf('layerScope'), icon: ShieldAlert },
                { key: 'fallback', label: tf('layerFallback'), icon: HelpCircle },
                { key: 'format', label: tf('layerFormat'), icon: Type },
                { key: 'qa', label: tf('layerQA'), icon: ListChecks },
        ]

        return (
                <div className="space-y-6">
                        {/* ─ Basic identity + model ───────────────────────────────────── */}
                        <div className="spatial-surface space-y-5 rounded-[1.75rem] p-5 sm:p-6">
                                <Field label={tw('name')}>
                                        <input
                                                value={form.name}
                                                onChange={(e) => set('name', e.target.value)}
                                                className="input"
                                        />
                                </Field>
                                <Field label={tw('description')}>
                                        <input
                                                value={form.description}
                                                onChange={(e) => set('description', e.target.value)}
                                                className="input"
                                        />
                                </Field>

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
                                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                        <Field label={tw('language')}>
                                                <MaterialSelect
                                                        value={form.language}
                                                        onValueChange={(value) => set('language', value as 'fa' | 'en')}
                                                        ariaLabel={tw('language')}
                                                        options={[{ value: 'fa', label: 'فارسی' }, { value: 'en', label: 'English' }]}
                                                />
                                        </Field>
                                        <Field label={`${tw('temperature')}: ${form.temperature.toFixed(1)}`}>
                                                <div className="w-full">
                                                        {/* Force LTR so the slider fills left→right (increasing = more fill
                  = "more intensity"), matching the numeric label. Without this,
                  the RTL parent reverses the native fill direction, making the
                  bar feel "backwards". */}
                                                        <div dir="ltr" className="w-full">
                                                                <input
                                                                        type="range"
                                                                        min={0}
                                                                        max={2}
                                                                        step={0.1}
                                                                        value={form.temperature}
                                                                        onChange={(e) => set('temperature', Number(e.target.value))}
                                                                        className="h-2 w-full cursor-pointer appearance-none rounded-full outline-none [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-md [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md"
                                                                        style={{
                                                                                background: `linear-gradient(to right, #a855f7 0%, #ec4899 ${(form.temperature / 2) * 100}%, rgba(255,255,255,0.12) ${(form.temperature / 2) * 100}%, rgba(255,255,255,0.12) 100%)`,
                                                                        }}
                                                                />
                                                        </div>
                                                        <div className="mt-1.5 flex justify-between text-[10px] text-[var(--text-muted)]">
                                                                <span>{locale === 'fa' ? 'دقیق' : 'Precise'}</span>
                                                                <span>{locale === 'fa' ? 'خلاقانه' : 'Creative'}</span>
                                                        </div>
                                                </div>
                                        </Field>
                                        <Field label={tw('maxTokens')}>
                                                <input
                                                        type="number"
                                                        min={1}
                                                        max={8000}
                                                        value={form.maxTokens}
                                                        onChange={(e) => set('maxTokens', Number(e.target.value))}
                                                        className="input"
                                                />
                                        </Field>
                                </div>
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

                        {/* ─ 6-LAYER PROMPT ENGINE ──────────────────────────────────── */}
                        <div className="spatial-surface space-y-5 rounded-[1.75rem] p-5 sm:p-6">
                                <div className="flex items-start justify-between gap-3">
                                        <div>
                                                <h3 className="text-base font-medium text-[var(--text-primary)]">
                                                        {tf('promptEngineTitle')}
                                                </h3>
                                                <p className="mt-1 text-xs text-[var(--text-muted)]">
                                                        {tf('promptEngineDesc')}
                                                </p>
                                        </div>
                                        <button
                                                type="button"
                                                onClick={() => setShowPreview((v) => !v)}
                                                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
                                        >
                                                <Eye className="h-3.5 w-3.5" />
                                                {tf('previewPrompt')}
                                        </button>
                                </div>

                                {/* Role template picker */}
                                <div>
                                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                                <p className="text-xs text-[var(--text-muted)]">{tf('roleTemplateLabel')}</p>
                                                <span className="rounded-full bg-black/[0.045] px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)]">
                                                        {locale === 'fa' ? `ساخته‌شده برای ${businessLabel}` : `Built for ${businessLabel}`}
                                                </span>
                                        </div>
                                        <div className="grid gap-2 sm:grid-cols-2">
                                                {roleTemplates.map((role) => {
                                                        const selected = activeRole?.key === role.key
                                                        const custom = role.key === 'custom'
                                                        return (
                                                                <button
                                                                        key={role.key}
                                                                        type="button"
                                                                        onClick={() => applyRoleTemplate(role)}
                                                                        className={`min-h-[7rem] rounded-2xl border p-3.5 text-start transition-[border-color,background-color,box-shadow] duration-200 ${
                                                                                selected
                                                                                        ? 'border-black bg-black/[0.035] shadow-[var(--shadow-xs)]'
                                                                                        : 'border-[var(--border-default)] bg-white hover:border-black/25 hover:bg-black/[0.015]'
                                                                        }`}
                                                                >
                                                                        <div className="flex items-start justify-between gap-3">
                                                                                <p className="text-sm font-semibold text-[var(--text-primary)]">
                                                                                        {locale === 'fa' ? role.nameFa : role.nameEn}
                                                                                </p>
                                                                                <span className={`grid h-6 min-w-6 place-items-center rounded-full text-[9px] font-bold tabular-nums ${selected ? 'bg-black text-white' : 'bg-black/[0.05] text-[var(--text-muted)]'}`}>
                                                                                        <Sparkles className="h-3 w-3" />
                                                                                </span>
                                                                        </div>
                                                                        <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
                                                                                {locale === 'fa' ? role.descFa : role.descEn}
                                                                        </p>
                                                                        <p className="mt-2 text-[9px] font-medium text-[var(--text-hint)]">
                                                                                {custom
                                                                                        ? (locale === 'fa' ? 'ساخت از صفر با کنترل کامل' : 'Start from scratch with full control')
                                                                                        : (locale === 'fa' ? 'ترکیب کامل همه نقش‌ها · قابل ویرایش' : 'All roles combined · fully editable')}
                                                                        </p>
                                                                </button>
                                                        )
                                                })}
                                        </div>
                                </div>

                                {/* Layer tabs */}
                                <div className="flex flex-wrap gap-1.5 border-b border-[var(--border-subtle)] pb-2">
                                        {tabs.map(({ key, label, icon: Icon }) => (
                                                <button
                                                        key={key}
                                                        type="button"
                                                        onClick={() => setActiveTab(key)}
                                                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
                                                                activeTab === key
                                                                        ? 'bg-[var(--bg-muted)] text-[var(--text-primary)]'
                                                                        : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                                                        }`}
                                                >
                                                        <Icon className="h-3.5 w-3.5" />
                                                        {label}
                                                </button>
                                        ))}
                                </div>

                                {/* Layer editors */}
                                <LayerEditor
                                        tab={activeTab}
                                        config={promptConfig}
                                        onChange={setPromptConfig}
                                        isFa={form.language !== 'en'}
                                        t={tf}
                                />

                                {/* Live preview */}
                                {showPreview && (
                                        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-muted)] p-3">
                                                <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">
                                                        {tf('assembledPrompt')}
                                                </p>
                                                <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[var(--text-secondary)]">
                                                        {previewPrompt || tf('emptyPrompt')}
                                                </pre>
                                        </div>
                                )}
                        </div>

                        {/* ─ CUSTOMER IDENTIFICATION (F3) ──────────────────────────── */}
                        <div className="spatial-surface space-y-4 rounded-[1.75rem] p-5 sm:p-6">
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
                        <div className="spatial-surface space-y-4 rounded-[1.75rem] p-5 sm:p-6">
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
                                <Toggle
                                        label={t('active')}
                                        checked={form.active}
                                        onChange={(v) => set('active', v)}
                                />

                                <div className="flex items-center gap-3 pt-2">
                                        <button
                                                onClick={save}
                                                disabled={status === 'saving'}
                                                className="inline-flex items-center gap-2 rounded-xl bg-[var(--white)] px-5 py-2 text-sm font-medium text-[var(--bg-base)] transition-transform hover:scale-[1.02] disabled:opacity-50"
                                        >
                                                {status === 'saving' && <Loader2 className="h-4 w-4 animate-spin" />}
                                                {status === 'saved' ? tc('saved') : tc('save')}
                                        </button>
                                        {status === 'saved' && (
                                                <span className="inline-flex items-center gap-1 text-sm text-success">
                                                        <Check className="h-4 w-4" />
                                                        {tf('saved')}
                                                </span>
                                        )}
                                </div>
                        </div>

                        {/* Danger zone — delete agent */}
                        <div className="spatial-surface rounded-[1.5rem] p-5 sm:p-6">
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
                                                onClick={() => setDeleteOpen(true)}
                                                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-danger/30 bg-danger/5 px-4 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
                                        >
                                                <Trash2 className="h-4 w-4" />
                                                {tf('delete')}
                                        </button>
                                </div>
                        </div>

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
                                                                className="w-full max-w-[27rem] overflow-hidden rounded-[1.5rem] border border-black/10 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
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
                                                                        {deleteError && (
                                                                                <p role="alert" className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-start text-sm text-red-700">
                                                                                        {deleteError}
                                                                                </p>
                                                                        )}
                                                                </div>

                                                                <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-base)]/60 p-4 sm:flex-row sm:justify-end">
                                                                        <button
                                                                                ref={cancelDeleteRef}
                                                                                type="button"
                                                                                onClick={() => setDeleteOpen(false)}
                                                                                disabled={deleting}
                                                                                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border-default)] bg-white px-4 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)] disabled:opacity-50"
                                                                        >
                                                                                {tf('cancel')}
                                                                        </button>
                                                                        <button
                                                                                type="button"
                                                                                onClick={remove}
                                                                                disabled={deleting}
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
                                        rows={5}
                                        placeholder={
                                                isFa
                                                        ? 'مثلاً: تو یک مشاور فروش صبور و حرفه‌ای هستی...'
                                                        : 'e.g. You are a patient, professional sales consultant...'
                                        }
                                        className="input resize-none text-sm"
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
                                                rows={5}
                                                placeholder={
                                                        isFa
                                                                ? 'مثلاً: لحن گرم و صمیمی، از کلمات محترمانه «شما»...'
                                                                : 'e.g. Warm and friendly tone, use polite "you"...'
                                                }
                                                className="input resize-none text-sm"
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
                                />
                                <ListEditor
                                        label={t('dontSayLabel')}
                                        hint={t('dontSayHint')}
                                        items={config.dontSay}
                                        onChange={(items) => onChange({ ...config, dontSay: items })}
                                        placeholder={isFa ? 'مثلاً: قیمت را حدس نزن' : "e.g. Don't guess prices"}
                                        positive={false}
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
                                        rows={5}
                                        placeholder={
                                                isFa
                                                        ? 'مثلاً: اگر محصولی در کاتالوگ نبود، صادقانه بگو و راه تماس بده...'
                                                        : 'e.g. If a product is not in the catalog, honestly say so and offer contact...'
                                        }
                                        className="input resize-none text-sm"
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
}: {
        label: string
        hint: string
        items: string[]
        onChange: (items: string[]) => void
        placeholder: string
        positive: boolean
}) {
        const [draft, setDraft] = useState('')
        function add() {
                const v = draft.trim()
                if (!v) return
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
                                        className="input text-sm"
                                />
                                <button
                                        type="button"
                                        onClick={add}
                                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
                                        aria-label="add"
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
                                                                aria-label="remove"
                                                        >
                                                                <X className="h-3 w-3" />
                                                        </button>
                                                </li>
                                        ))}
                                </ul>
                        )}
                        <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p>
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

function QAEditor({
        items,
        onChange,
        t,
}: {
        items: PromptQAPair[]
        onChange: (items: PromptQAPair[]) => void
        t: (k: string) => string
}) {
        function add() {
                onChange([...items, { question: '', answer: '' }])
        }
        function update(i: number, patch: Partial<PromptQAPair>) {
                onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
        }
        function remove(i: number) {
                onChange(items.filter((_, idx) => idx !== i))
        }
        return (
                <div className="space-y-3">
                        {items.length === 0 && (
                                <p className="rounded-xl border border-dashed border-[var(--border-default)] p-4 text-center text-xs text-[var(--text-muted)]">
                                        {t('qaEmpty')}
                                </p>
                        )}
                        {items.map((item, i) => (
                                <div
                                        key={i}
                                        className="space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-muted)] p-3"
                                >
                                        <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-medium text-[var(--text-muted)]">
                                                        {t('qaPair')} {i + 1}
                                                </span>
                                                <button
                                                        type="button"
                                                        onClick={() => remove(i)}
                                                        className="text-[var(--text-muted)] transition-colors hover:text-danger"
                                                        aria-label="remove"
                                                >
                                                        <X className="h-3.5 w-3.5" />
                                                </button>
                                        </div>
                                        <input
                                                value={item.question}
                                                onChange={(e) => update(i, { question: e.target.value })}
                                                placeholder={t('qaQuestionPlaceholder')}
                                                className="input text-sm"
                                        />
                                        <textarea
                                                value={item.answer}
                                                onChange={(e) => update(i, { answer: e.target.value })}
                                                rows={2}
                                                placeholder={t('qaAnswerPlaceholder')}
                                                className="input resize-none text-sm"
                                        />
                                </div>
                        ))}
                        <button
                                type="button"
                                onClick={add}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
                        >
                                <Plus className="h-3.5 w-3.5" />
                                {t('qaAdd')}
                        </button>
                </div>
        )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
        return (
                <label className="block">
                        <span className="mb-2 block text-sm text-[var(--text-secondary)]">{label}</span>
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
                <button
                        type="button"
                        onClick={() => onChange(!checked)}
                        className="flex w-full items-center justify-between"
                >
                        <span
                                className={`text-sm ${checked ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}
                        >
                                {label}
                        </span>
                        <span
                                className={`relative h-6 w-11 rounded-full border transition-colors ${
                                        checked
                                                ? 'border-[var(--white)] bg-[var(--white)]'
                                                : 'border-[var(--border-hover)] bg-[var(--bg-muted)]'
                                }`}
                        >
                                <span
                                        className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full shadow-sm transition-all ${
                                                checked
                                                        ? 'start-6 bg-[var(--bg-base)]'
                                                        : 'start-1 border border-[var(--border-hover)] bg-[var(--bg-base)]'
                                        }`}
                                />
                        </span>
                </button>
        )
}
