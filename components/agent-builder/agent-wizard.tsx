'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { AnimatePresence, motion } from 'framer-motion'
import {
        ArrowLeft,
        ArrowRight,
        Check,
        CheckCircle2,
        ChevronDown,
        ChevronUp,
        Loader2,
        Package,
        BookOpen,
        Zap,
	Sparkles,
	ShieldCheck,
	CircleDashed,
	Eye,
} from 'lucide-react'
import { findModel, type ModelAlias } from '@/lib/ai/models'
import {
        getRoleTemplatesForBusiness,
        getSuggestedRoleTemplate,
        normalizePromptConfig,
        type PromptConfig,
        type RoleTemplate,
} from '@/lib/ai/prompt-builder'
import { fromLegacyBusinessKey, getVerticalPack, type BusinessTypeValue } from '@/lib/verticals/registry'
import { MaterialSelect } from '@/components/ui/material-select'
import { NaturalConversationControls } from './natural-conversation-controls'

const TOTAL = 3

interface FormState {
	name: string
	welcomeMessage: string
        fallbackMessage: string
        model: string
        language: 'fa' | 'en'
        handoffEnabled: boolean
        handoffMessage: string
        handoffKeywords: string
        requireCustomerInfo: boolean
        customerInfoPrompt: string
}

/** Editable snapshot of the template's 6-layer config (lists as one-per-line text). */
interface ConfigDraft {
        personality: string
        tone: string
        conversationFormality: 'formal' | 'balanced' | 'casual'
        conversationInitiative: 'answer_only' | 'guided' | 'proactive'
        conversationEmpathy: 'neutral' | 'balanced' | 'warm'
        conversationFollowUp: 'rare' | 'when_needed' | 'often'
        mirrorCustomerTone: boolean
        useCustomerName: boolean
        avoidRepeatedGreetings: boolean
        doSay: string
        dontSay: string
        fallbackBehavior: string
        // Layer 5 — format toggles
        fmtBold: boolean
        fmtEmoji: boolean
        fmtLinks: boolean
        fmtBullets: boolean
        fmtLength: 'short' | 'medium' | 'long'
        // Layer 6 — Q&A pairs (text, one pair per "Q|A" line)
        qaPairsText: string
}

function draftFromRole(role: RoleTemplate): ConfigDraft {
        const config = normalizePromptConfig(role.config)
        return {
                personality: config.personality,
                tone: config.tone,
                conversationFormality: config.conversation.formality,
                conversationInitiative: config.conversation.initiative,
                conversationEmpathy: config.conversation.empathy,
                conversationFollowUp: config.conversation.followUp,
                mirrorCustomerTone: config.conversation.mirrorCustomerTone,
                useCustomerName: config.conversation.useCustomerName,
                avoidRepeatedGreetings: config.conversation.avoidRepeatedGreetings,
                doSay: config.doSay.join('\n'),
                dontSay: config.dontSay.join('\n'),
                fallbackBehavior: config.fallbackBehavior,
                fmtBold: config.format.bold,
                fmtEmoji: config.format.emoji,
                fmtLinks: config.format.links,
                fmtBullets: config.format.bullets,
                fmtLength: config.format.length,
                qaPairsText: config.qaPairs.map((qa) => `${qa.question}|${qa.answer}`).join('\n'),
        }
}

function configFromDraft(role: RoleTemplate, draft: ConfigDraft): PromptConfig {
        const lines = (s: string) =>
                s
                        .split('\n')
                        .map((l) => l.trim())
                        .filter(Boolean)
        // Parse Q&A pairs: each line "question|answer"
        const qaPairs = draft.qaPairsText
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean)
                .map((line) => {
                        const [question, ...rest] = line.split('|')
                        return { question: (question ?? '').trim(), answer: rest.join('|').trim() }
                })
                .filter((qa) => qa.question && qa.answer)
                .slice(0, 20)
        return {
                ...role.config,
                personality: draft.personality.trim(),
                tone: draft.tone.trim(),
                conversation: {
                        formality: draft.conversationFormality,
                        initiative: draft.conversationInitiative,
                        empathy: draft.conversationEmpathy,
                        followUp: draft.conversationFollowUp,
                        mirrorCustomerTone: draft.mirrorCustomerTone,
                        useCustomerName: draft.useCustomerName,
                        avoidRepeatedGreetings: draft.avoidRepeatedGreetings,
                },
                doSay: lines(draft.doSay),
                dontSay: lines(draft.dontSay),
                fallbackBehavior: draft.fallbackBehavior.trim(),
                format: {
                        bold: draft.fmtBold,
                        emoji: draft.fmtEmoji,
                        links: draft.fmtLinks,
                        bullets: draft.fmtBullets,
                        length: draft.fmtLength,
                },
                qaPairs,
        }
}

interface CreatedAgent {
        id: string
        name: string
        catalogCount: number
}

const BUSINESS_PRESETS = {
        instagram: {
                role: 'sales_consultant',
                fa: { name: 'دستیار فروش اینستاگرام', welcome: 'سلام! برای دیدن قیمت، موجودی یا انتخاب محصول پیام بدهید؛ همین‌جا راهنمایی‌تان می‌کنم.' },
                en: { name: 'Instagram sales assistant', welcome: 'Hi! Ask about price, stock or choosing a product and I will help right here.' },
        },
        store: {
                role: 'sales_consultant',
                fa: { name: 'دستیار فروش', welcome: 'سلام! برای انتخاب محصول یا پیگیری سفارش در کنارتان هستم.' },
                en: { name: 'Sales assistant', welcome: 'Hi! I can help you choose a product or track an order.' },
        },
        commerce: {
                role: 'sales_consultant',
                fa: { name: 'مشاور هوشمند فروش', welcome: 'سلام! برای انتخاب محصول، بررسی موجودی یا پیگیری سفارش در کنارتان هستم.' },
                en: { name: 'Commerce copilot', welcome: 'Hi! I can help you choose a product, check availability or track an order.' },
        },
        food: {
                role: 'sales_consultant',
                fa: { name: 'دستیار سفارش و رزرو', welcome: 'سلام! برای دیدن منو، انتخاب غذا، ثبت سفارش یا رزرو میز بفرمایید.' },
                en: { name: 'Food ordering assistant', welcome: 'Hi! I can help with the menu, an order, or a table booking.' },
        },
        appointments: {
                role: 'lead_capture',
                fa: { name: 'دستیار نوبت‌دهی', welcome: 'سلام! نوع خدمت و زمان مدنظرتان را بفرمایید تا نزدیک‌ترین وقت آزاد را پیدا کنم.' },
                en: { name: 'Appointment assistant', welcome: 'Hi! Tell me the service and preferred time and I will find the closest available slot.' },
        },
        services: {
                role: 'lead_capture',
                fa: { name: 'دستیار رزرو', welcome: 'سلام! برای دریافت راهنمایی یا ثبت درخواست بفرمایید چه کمکی می‌توانم بکنم؟' },
                en: { name: 'Booking assistant', welcome: 'Hi! How can I help with information or a booking today?' },
        },
        education: {
                role: 'full_service',
                fa: { name: 'راهنمای دوره‌ها', welcome: 'سلام! برای انتخاب دوره و پاسخ به سوالات ثبت‌نام در کنارتان هستم.' },
                en: { name: 'Course guide', welcome: 'Hi! I can help you choose a course and answer enrollment questions.' },
        },
        support: {
                role: 'general_support',
                fa: { name: 'همکار پشتیبانی', welcome: 'سلام! موضوع یا مشکل را بفرستید؛ پاسخ می‌دهم یا با خلاصه کامل به همکار مربوط تحویل می‌دهم.' },
                en: { name: 'Support copilot', welcome: 'Hi! Send the issue and I will resolve it or hand it to the right teammate with context.' },
        },
        custom: {
                role: 'full_service',
                fa: { name: 'دستیار هوشمند کسب‌وکار', welcome: 'سلام! بفرمایید چه کمکی از دستم برمی‌آید؟' },
                en: { name: 'Business copilot', welcome: 'Hi! How can I help today?' },
        },
        messaging: {
                role: 'general_support',
                fa: { name: 'دستیار پشتیبانی پیام‌رسان', welcome: 'سلام! سوال یا درخواستتان را بفرستید؛ اگر نیاز به بررسی همکار باشد، گفتگو را برای پیگیری تحویل می‌دهم.' },
                en: { name: 'Messaging support assistant', welcome: 'Hi! Send your question or request. If a teammate needs to review it, I will hand it over with context.' },
        },
} as const

export function AgentWizard({
        initialBusiness,
        businessType,
        modelPolicy,
	workspaceProductCount = 0,
	onboardingMode = false,
}: {
        initialBusiness?: string
	businessType?: BusinessTypeValue | null
	workspaceProductCount?: number
	onboardingMode?: boolean
        modelPolicy: {
                plan: 'TRIAL' | 'STARTER' | 'PRO' | 'BUSINESS'
                enabledModels: ModelAlias[]
                trialModel: ModelAlias
                creditBalanceIRR: number
                replyPricesIRR: Record<ModelAlias, number>
        }
}) {
        const t = useTranslations('agents.wizard')
        const tA = useTranslations('agents')
        const tc = useTranslations('common')
        const locale = useLocale() === 'en' ? 'en' : 'fa'
        const router = useRouter()

        const preset = initialBusiness && initialBusiness in BUSINESS_PRESETS
                ? BUSINESS_PRESETS[initialBusiness as keyof typeof BUSINESS_PRESETS]
                : null
        const resolvedBusinessType = businessType ?? fromLegacyBusinessKey(initialBusiness)
        const roleTemplates = getRoleTemplatesForBusiness(resolvedBusinessType)
        const defaultRole = getSuggestedRoleTemplate(resolvedBusinessType, preset?.role ?? 'full_service')
        const businessLabel = locale === 'fa'
                ? getVerticalPack(resolvedBusinessType).titleFa
                : getVerticalPack(resolvedBusinessType).titleEn
	const presetCopy = preset?.[locale]
	const trialModelLabel = locale === 'fa' ? findModel(modelPolicy.trialModel).name : modelPolicy.trialModel
	const activeModelLabel = modelPolicy.plan === 'TRIAL'
		? trialModelLabel
		: (locale === 'fa' ? 'مدل پیش‌فرض ویجنت' : 'Vigent default model')

        const [step, setStep] = useState(0)
        const [loading, setLoading] = useState(false)
        const [error, setError] = useState(false)
        const [created, setCreated] = useState<CreatedAgent | null>(null)
	const [selectedRole, setSelectedRole] = useState<RoleTemplate>(defaultRole)
	const [draft, setDraft] = useState<ConfigDraft>(draftFromRole(defaultRole))
	const [showEditor, setShowEditor] = useState(false)
	const [form, setForm] = useState<FormState>({
		name: presetCopy?.name ?? '',
		welcomeMessage: presetCopy?.welcome ?? '',
		fallbackMessage: '',
		model: modelPolicy.plan === 'TRIAL' ? modelPolicy.trialModel : '',
                language: 'fa',
                handoffEnabled: true,
                handoffMessage: '',
                handoffKeywords: locale === 'fa' ? 'اپراتور، انسان، شکایت' : 'operator, human, complaint',
                requireCustomerInfo: preset?.role === 'lead_capture',
		customerInfoPrompt: '',
	})

	useEffect(() => {
		window.scrollTo({ top: 0, behavior: 'auto' })
	}, [step])

        const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
                setForm((f) => ({ ...f, [key]: value }))

        const setD = <K extends keyof ConfigDraft>(key: K, value: ConfigDraft[K]) =>
                setDraft((d) => ({ ...d, [key]: value }))

        function selectRole(role: RoleTemplate) {
                setSelectedRole(role)
                setDraft(draftFromRole(role))
                // The custom template is an empty canvas — open the editor right away.
                setShowEditor(role.key === 'custom')
        }

        const canNext = step === 0 ? form.name.trim().length > 0 : true

        async function submit() {
                setLoading(true)
                setError(false)
                try {
                        const res = await fetch('/api/agents', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                        name: form.name,
				// Send the role template key + the (possibly edited) prompt config so
                                        // the agent starts with the full 6-layer engine ready to go.
                                        roleTemplate: selectedRole.key,
                                        promptConfig: configFromDraft(selectedRole, draft),
                                        welcomeMessage: form.welcomeMessage || undefined,
                                        fallbackMessage: form.fallbackMessage || undefined,
                                        model: form.model || undefined,
                                        language: form.language,
                                        handoffEnabled: form.handoffEnabled,
                                        handoffMessage: form.handoffMessage || undefined,
                                        handoffKeywords: form.handoffKeywords
                                                .split(/[,\u060c]/)
                                                .map((item) => item.trim())
                                                .filter(Boolean),
                                        requireCustomerInfo: form.requireCustomerInfo,
                                        customerInfoPrompt: form.customerInfoPrompt || undefined,
                                }),
                        })
                        if (!res.ok) {
                                setError(true)
                                setLoading(false)
                                return
                        }
                        const data = await res.json()
                        if (onboardingMode) {
                                router.push('/onboarding')
                                router.refresh()
                                return
                        }
                        setCreated({
                                id: data.agent.id,
                                name: data.agent.name,
                                catalogCount: data.catalogCount ?? 0,
                        })
                } catch {
                        setError(true)
                        setLoading(false)
                }
        }

	const stepTitles = locale === 'fa'
		? ['نام، شخصیت و قوانین', 'تحویل و تنظیمات پاسخ', 'بازبینی و ساخت']
		: ['Name, persona & guardrails', 'Handoff & response settings', 'Review & create']

        if (created) {
                return (
                        <div className="mx-auto max-w-2xl">
                                <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-8">
                                        <div className="flex flex-col items-center gap-4 text-center">
                                                <CheckCircle2 className="h-12 w-12 text-success" />
                                                <div>
                                                        <h2 className="text-xl font-medium text-[var(--text-primary)]">
                                                                {t('successTitle')}
                                                        </h2>
                                                        <p className="mt-1 text-sm text-[var(--text-secondary)]">{created.name}</p>
                                                </div>
                                                <div className="mt-2 flex w-full flex-col gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-muted)] p-4 text-start">
                                                        <div className="flex items-center gap-3">
                                                                <Package className="h-5 w-5 shrink-0 text-[var(--text-muted)]" />
                                                                <p className="text-sm text-[var(--text-secondary)]">
                                                                        {created.catalogCount > 0
                                                                                ? t('successProducts', { count: created.catalogCount })
                                                                                : t('successNoProducts')}
                                                                </p>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                                <BookOpen className="h-5 w-5 shrink-0 text-[var(--text-muted)]" />
                                                                <p className="text-sm text-[var(--text-secondary)]">
                                                                        {t('successKnowledge')}
                                                                </p>
                                                        </div>
                                                </div>
                                                <p className="mt-3 text-sm text-[var(--text-secondary)]">
                                                        {t('successNextSteps')}
                                                </p>
                                                <div className="mt-1 flex flex-wrap justify-center gap-3">
                                                        <button
                                                                onClick={() => router.push(`/agents/${created.id}`)}
                                                                className="inline-flex items-center gap-2 rounded-xl bg-[var(--white)] px-5 py-2 text-sm font-medium text-[var(--bg-base)] transition-transform hover:scale-[1.02]"
                                                        >
                                                                <Zap className="h-4 w-4" />
                                                                {t('startSetup')}
                                                        </button>
                                                </div>
                                        </div>
                                </div>
                        </div>
                )
        }

	return (
		<div className="mx-auto max-w-4xl">
			<div className="mb-2 text-sm text-[var(--text-secondary)]">
                                {t('step', { n: step + 1, total: TOTAL })} — {stepTitles[step]}
                        </div>
                        <div className="mb-8 h-1 overflow-hidden rounded-full bg-[var(--white-05)]">
                                <div
                                        className="h-full bg-[var(--white)] transition-[width] duration-300"
                                        style={{ width: `${((step + 1) / TOTAL) * 100}%` }}
                                />
                        </div>

                        <div className="spatial-surface rounded-[1.75rem] p-5 sm:p-7">
                                <AnimatePresence mode="wait" initial={false}>
                                        <motion.div
                                                key={step}
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                transition={{ duration: 0.25 }}
                                                className="space-y-5"
                                        >
						{step === 0 && (
							<>
								<Field label={t('name')}>
									<input
										autoFocus
										value={form.name}
										onChange={(e) => set('name', e.target.value)}
										placeholder={t('namePlaceholder')}
										className="input"
									/>
								</Field>
								{/* Role template picker (6-layer engine) */}
                                                                <div>
                                                                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                                                                <p className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                                                                                        <Sparkles className="h-3.5 w-3.5" />
                                                                                        {t('roleTemplateLabel')}
                                                                                </p>
                                                                                <span className="rounded-full bg-black/[0.045] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
                                                                                        {locale === 'fa' ? `ساخته‌شده برای ${businessLabel}` : `Built for ${businessLabel}`}
                                                                                </span>
                                                                        </div>
                                                                        <div className="grid gap-2 sm:grid-cols-2">
                                                                                {roleTemplates.map((role) => {
                                                                                        const selected = selectedRole.key === role.key
                                                                                        const custom = role.key === 'custom'
                                                                                        return (
                                                                                                <button
                                                                                                        key={role.key}
                                                                                                        type="button"
                                                                                                        onClick={() => selectRole(role)}
                                                                                                        className={`w-full min-h-[7.25rem] rounded-2xl border p-3.5 text-start transition-[border-color,background-color,box-shadow] duration-200 ${
                                                                                                                selected
                                                                                                                        ? 'border-black bg-black/[0.035] shadow-[var(--shadow-xs)]'
                                                                                                                        : 'border-[var(--border-default)] bg-white hover:border-black/25 hover:bg-black/[0.015]'
                                                                                                        }`}
                                                                                                >
                                                                                        <div className="flex items-start justify-between gap-3">
                                                                                                <p className="text-sm font-semibold text-[var(--text-primary)]">
                                                                                                        {locale === 'fa' ? role.nameFa : role.nameEn}
                                                                                                </p>
                                                                                                <span className={`grid h-6 min-w-6 place-items-center rounded-full text-[11px] font-bold tabular-nums ${selected ? 'bg-black text-white' : 'bg-black/[0.05] text-[var(--text-muted)]'}`}>
                                                                                                        {custom ? <Zap className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                                                                                                </span>
                                                                                        </div>
                                                                                        <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
                                                                                                {locale === 'fa' ? role.descFa : role.descEn}
                                                                                                        </p>
                                                                                        <p className="mt-2 text-[11px] font-medium text-[var(--text-hint)]">
                                                                                                {custom
                                                                                                        ? (locale === 'fa' ? 'ساخت از صفر با کنترل کامل' : 'Start from scratch with full control')
                                                                                                        : (locale === 'fa' ? 'ترکیب کامل همه نقش‌ها · قابل ویرایش' : 'All roles combined · fully editable')}
                                                                                        </p>
                                                                                                </button>
                                                                                        )
                                                                                })}
                                                                        </div>

                                                                        {/* 6-layer prompt engine — always visible, prominently labelled */}
                                                                        <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--accent-border)] bg-[linear-gradient(180deg,var(--accent-soft),transparent_45%)]">
                                                                                <button
                                                                                        type="button"
                                                                                        onClick={() => setShowEditor((v) => !v)}
                                                                                        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-start"
                                                                                >
                                                                                        <span className="flex items-center gap-2">
                                                                                                <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--accent)] text-white">
                                                                                                        <Sparkles className="h-4 w-4" />
                                                                                                </span>
                                                                                                <span>
                                                                                                        <span className="block text-sm font-semibold text-[var(--text-primary)]">
                                                                                                                {locale === 'fa' ? 'موتور پرامپت ۶ لایه‌ای' : 'Six-layer prompt engine'}
                                                                                                        </span>
                                                                                                        <span className="block text-[11px] text-[var(--text-muted)]">
                                                                                                                {locale === 'fa' ? 'شخصیت، لحن، قلمرو، fallback، قالب، پرسش‌وپاسخ' : 'Personality · tone · scope · fallback · format · Q&A'}
                                                                                                        </span>
                                                                                                </span>
                                                                                        </span>
                                                                                        {showEditor ? <ChevronUp className="h-4 w-4 text-[var(--text-muted)]" /> : <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />}
                                                                                </button>
                                                                                {showEditor && (
                                                                                        <div className="space-y-4 border-t border-[var(--border-subtle)] bg-white/60 p-4">
                                                                                                <LayerField n={1} label={t('layerPersonality')}>
                                                                                                        <textarea
                                                                                                                value={draft.personality}
                                                                                                                onChange={(e) => setD('personality', e.target.value)}
                                                                                                                rows={3}
                                                                                                                placeholder={t('layerPersonalityPh')}
                                                                                                                className="input resize-none text-sm"
                                                                                                        />
                                                                                                </LayerField>
                                                                                                <LayerField n={2} label={t('layerTone')}>
                                                                                                        <div className="space-y-3">
                                                                                                                <textarea
                                                                                                                        value={draft.tone}
                                                                                                                        onChange={(e) => setD('tone', e.target.value)}
                                                                                                                        rows={2}
                                                                                                                        placeholder={t('layerTonePh')}
                                                                                                                        className="input resize-none text-sm"
                                                                                                                />
                                                                                                                <NaturalConversationControls
                                                                                                                        value={{
                                                                                                                                formality: draft.conversationFormality,
                                                                                                                                initiative: draft.conversationInitiative,
                                                                                                                                empathy: draft.conversationEmpathy,
                                                                                                                                followUp: draft.conversationFollowUp,
                                                                                                                                mirrorCustomerTone: draft.mirrorCustomerTone,
                                                                                                                                useCustomerName: draft.useCustomerName,
                                                                                                                                avoidRepeatedGreetings: draft.avoidRepeatedGreetings,
                                                                                                                        }}
                                                                                                                        onChange={(conversation) => setDraft((current) => ({
                                                                                                                                ...current,
                                                                                                                                conversationFormality: conversation.formality,
                                                                                                                                conversationInitiative: conversation.initiative,
                                                                                                                                conversationEmpathy: conversation.empathy,
                                                                                                                                conversationFollowUp: conversation.followUp,
                                                                                                                                mirrorCustomerTone: conversation.mirrorCustomerTone,
                                                                                                                                useCustomerName: conversation.useCustomerName,
                                                                                                                                avoidRepeatedGreetings: conversation.avoidRepeatedGreetings,
                                                                                                                        }))}
                                                                                                                />
                                                                                                        </div>
                                                                                                </LayerField>
                                                                                                <LayerField n={3} label={locale === 'fa' ? 'قلمرو پاسخ و خط قرمزها' : 'Response scope & guardrails'}>
                                                                                                        <div className="grid gap-3 sm:grid-cols-2">
                                                                                                                <label className="block"><span className="mb-1.5 block text-[11px] font-medium text-emerald-700">{t('layerDoSay')}</span><textarea value={draft.doSay} onChange={(e) => setD('doSay', e.target.value)} rows={4} placeholder={t('layerListPh')} className="input resize-none text-sm" /></label>
                                                                                                                <label className="block"><span className="mb-1.5 block text-[11px] font-medium text-rose-700">{t('layerDontSay')}</span><textarea value={draft.dontSay} onChange={(e) => setD('dontSay', e.target.value)} rows={4} placeholder={t('layerListPh')} className="input resize-none text-sm" /></label>
                                                                                                        </div>
                                                                                                </LayerField>
                                                                                                <LayerField n={4} label={t('layerFallback')}>
                                                                                                        <textarea
                                                                                                                value={draft.fallbackBehavior}
                                                                                                                onChange={(e) => setD('fallbackBehavior', e.target.value)}
                                                                                                                rows={2}
                                                                                                                placeholder={t('layerFallbackPh')}
                                                                                                                className="input resize-none text-sm"
                                                                                                        />
                                                                                                </LayerField>
                                                                                                <LayerField n={5} label={tA('settingsForm.layerFormat')}>
                                                                                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                                                                                                {([
                                                                                                                        ['fmtBold', draft.fmtBold, tA('settingsForm.fmt_bold')],
                                                                                                                        ['fmtEmoji', draft.fmtEmoji, tA('settingsForm.fmt_emoji')],
                                                                                                                        ['fmtLinks', draft.fmtLinks, tA('settingsForm.fmt_links')],
                                                                                                                        ['fmtBullets', draft.fmtBullets, tA('settingsForm.fmt_bullets')],
                                                                                                                ] as const).map(([key, active, label]) => (
                                                                                                                        <button key={key} type="button" aria-pressed={active} onClick={() => setD(key, !active)} className={`spatial-press flex min-h-11 items-center justify-between gap-2 rounded-xl border px-3 text-xs font-medium ${active ? 'border-black bg-black text-white shadow-[var(--shadow-control)]' : 'border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:border-black/30'}`}>
                                                                                                                                <span>{label}</span><span className={`grid h-5 w-5 place-items-center rounded-md ${active ? 'bg-white text-black' : 'bg-black/[0.05] text-transparent'}`}><Check className="h-3 w-3" /></span>
                                                                                                                        </button>
                                                                                                                ))}
                                                                                                        </div>
                                                                                                        <p className="mt-2 text-[11px] font-medium text-[var(--text-secondary)]">{tA('settingsForm.formatLength')}</p>
                                                                                                        <div className="mt-1.5 flex gap-1.5">
                                                                                                                {(['short', 'medium', 'long'] as const).map((len) => (
                                                                                                                        <button
                                                                                                                                key={len}
                                                                                                                                type="button"
                                                                                                                                onClick={() => setD('fmtLength', len)}
                                                                                                                                className={`rounded-lg border px-3 py-1 text-xs transition-colors ${draft.fmtLength === len ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-foreground)]' : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'}`}
                                                                                                                        >
                                                                                                                                {tA(`settingsForm.length_${len}`)}
                                                                                                                        </button>
                                                                                                                ))}
                                                                                                        </div>
                                                                                                </LayerField>
                                                                                                {/* Layer 6 — Q&A pairs */}
                                                                                                <LayerField n={6} label={tA('settingsForm.layerQA')}>
                                                                                                        <textarea
                                                                                                                value={draft.qaPairsText}
                                                                                                                onChange={(e) => setD('qaPairsText', e.target.value)}
                                                                                                                rows={4}
                                                                                                                placeholder={locale === 'fa' ? 'سؤال نمونه مشتری|پاسخ ایده‌آل ایجنت\nهر خط یک نمونه' : 'Customer question|Ideal agent answer\nOne pair per line'}
                                                                                                                className="input resize-none text-sm"
                                                                                                        />
                                                                                                        <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
                                                                                                                {locale === 'fa' ? 'هر خط یک نمونه: سؤال|پاسخ. حداکثر ۲۰ نمونه.' : 'One pair per line: question|answer. Max 20 pairs.'}
                                                                                                        </p>
                                                                                                </LayerField>
                                                                                        </div>
                                                                                )}
                                                                        </div>
                                                                </div>
                                                                <Field label={t('welcomeMessage')}>
                                                                        <input
                                                                                value={form.welcomeMessage}
                                                                                onChange={(e) => set('welcomeMessage', e.target.value)}
                                                                                placeholder={t('welcomePlaceholder')}
                                                                                className="input"
                                                                        />
                                                                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                                                                                {t('welcomeHint')}
                                                                        </p>
                                                                </Field>
                                                                <Field label={t('fallbackMessage')}>
                                                                        <input
                                                                                value={form.fallbackMessage}
                                                                                onChange={(e) => set('fallbackMessage', e.target.value)}
                                                                                className="input"
                                                                        />
                                                                </Field>
                                                        </>
                                                )}

					{step === 1 && (
						<div className="grid gap-4 lg:grid-cols-2">
								<section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-4">
                                                                        <div className="mb-4 flex items-start gap-2">
                                                                                <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-500" />
                                                                                <div>
                                                                                        <h3 className="text-sm font-medium text-[var(--text-primary)]">{locale === 'fa' ? 'مرز پاسخ و تحویل امن' : 'Safe boundaries & handoff'}</h3>
                                                                                        <p className="mt-1 text-[11px] leading-5 text-[var(--text-muted)]">{locale === 'fa' ? 'موارد مبهم یا حساس با خلاصه به اپراتور منتقل می‌شوند.' : 'Ambiguous or sensitive cases are handed off with context.'}</p>
                                                                                </div>
                                                                        </div>
                                                                        <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                                                                                <span>
                                                                                        <span className="block">{locale === 'fa' ? 'انتقال خودکار در موقعیت‌های پیشنهادی' : 'Proactive human handoff'}</span>
                                                                                        <span className="mt-0.5 block text-[10px] leading-4 text-[var(--text-muted)]">{locale === 'fa' ? 'برای اصطکاک، مذاکره یا طولانی‌شدن گفتگو؛ درخواست مستقیم و موارد پرخطر همیشه منتقل می‌شوند' : 'For friction, negotiation, or long chats; direct requests and high-risk cases always transfer'}</span>
                                                                                </span>
                                                                                <input type="checkbox" checked={form.handoffEnabled} onChange={(e) => set('handoffEnabled', e.target.checked)} className="h-4 w-4 accent-violet-500" />
                                                                        </label>
                                                                        {form.handoffEnabled && (
                                                                                <div className="mt-3 space-y-3">
                                                                                        <Field label={locale === 'fa' ? 'پیام تحویل' : 'Handoff message'}><input value={form.handoffMessage} onChange={(e) => set('handoffMessage', e.target.value)} className="input" /></Field>
                                                                                        <Field label={locale === 'fa' ? 'کلمات تحویل' : 'Handoff keywords'}><input value={form.handoffKeywords} onChange={(e) => set('handoffKeywords', e.target.value)} className="input" /><p className="mt-1 text-[11px] text-[var(--text-muted)]">{locale === 'fa' ? 'با ویرگول جدا کنید؛ مثل اپراتور، شکایت، پرداخت ناموفق' : 'Comma-separated; e.g. operator, complaint, payment failed'}</p></Field>
                                                                                </div>
                                                                        )}
                                                                        <label className="mt-3 flex min-h-11 items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                                                                                <span>
                                                                                        <span className="block">{locale === 'fa' ? 'نام و شماره موبایل قبل از چت اجباری باشد' : 'Require name and mobile before chat'}</span>
                                                                                        <span className="mt-0.5 block text-[10px] leading-4 text-[var(--text-muted)]">{locale === 'fa' ? 'در ویجت وب و چت‌لینک یک فرم یکپارچه نمایش داده می‌شود' : 'Shows one consistent form in the web widget and chat link'}</span>
                                                                                </span>
                                                                                <input type="checkbox" checked={form.requireCustomerInfo} onChange={(e) => set('requireCustomerInfo', e.target.checked)} className="h-4 w-4 accent-violet-500" />
                                                                        </label>
                                                                        {form.requireCustomerInfo && <div className="mt-3"><Field label={locale === 'fa' ? 'متن معرفی فرم (اختیاری)' : 'Pre-chat form message (optional)'}><textarea value={form.customerInfoPrompt} onChange={(e) => set('customerInfoPrompt', e.target.value)} rows={3} placeholder={locale === 'fa' ? 'برای اینکه بهتر راهنمایی‌تان کنیم، لطفاً نام و شماره موبایل خود را وارد کنید.' : 'To help you better, please enter your name and mobile number.'} className="input resize-none" /></Field></div>}
                                                                </section>

								<section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-4">
									<div className="flex items-start gap-2 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-3.5">
										<Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-strong)]" />
										<div>
											<h3 className="text-sm font-medium text-[var(--text-primary)]">
												{locale === 'fa' ? 'مدل پاسخ‌گویی فعلاً خودکار انتخاب می‌شود' : 'The response model is selected automatically for now'}
											</h3>
											<p className="mt-1 text-[11px] leading-5 text-[var(--text-muted)]">
											{modelPolicy.plan === 'TRIAL'
												? (locale === 'fa'
													? `در دوره آزمایشی مدل «${trialModelLabel}» فعال است. بعداً از تنظیمات ایجنت می‌توانید مدل را تغییر دهید.`
													: `The ${trialModelLabel} model is active during the trial. You can change it later in agent settings.`)
												: (locale === 'fa'
													? 'مدل پیش‌فرض ویجنت فعال است و بعداً از تنظیمات ایجنت قابل تغییر است.'
													: 'The Vigent default model is active and can be changed later in agent settings.')}
											</p>
										</div>
									</div>
									<div className="mt-4">
										<Field label={t('language')}>
											<MaterialSelect
												value={form.language}
												onValueChange={(value) => set('language', value as 'fa' | 'en')}
												ariaLabel={t('language')}
												options={[{ value: 'fa', label: 'فارسی' }, { value: 'en', label: 'English' }]}
											/>
										</Field>
										<p className="mt-1.5 text-[11px] leading-5 text-[var(--text-muted)]">
											{locale === 'fa' ? 'زبان پیش‌فرض پاسخ‌های ایجنت را مشخص کنید.' : 'Choose the default language for agent replies.'}
										</p>
									</div>
								</section>
							</div>
					)}

					{step === 2 && (
						<ReviewCard
							locale={locale}
							form={form}
							role={selectedRole}
							knowledgeCount={workspaceProductCount}
							modelLabel={form.model || activeModelLabel}
							isTrial={modelPolicy.plan === 'TRIAL'}
						/>
                                        )}
                                        </motion.div>
                                </AnimatePresence>

                                {error && <p className="mt-4 text-sm text-danger">{tA('emptyDesc')}</p>}

                                <div className="mt-8 flex items-center justify-between">
                                        {step === 0 && onboardingMode ? (
                                                <button
                                                        type="button"
                                                        onClick={() => router.push('/onboarding')}
                                                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/15 px-3 text-sm text-[var(--text-secondary)] transition-[color,background-color,border-color] hover:border-white/25 hover:bg-white/5 hover:text-[var(--text-primary)]"
                                                >
                                                        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                                                        {locale === 'fa' ? 'بازگشت به انتخاب روش ساخت' : 'Back to setup options'}
                                                </button>
                                        ) : step > 0 ? (
                                                <button
                                                        type="button"
                                                        onClick={() => setStep((s) => Math.max(0, s - 1))}
                                                        className="inline-flex min-h-11 items-center gap-1 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                                                >
                                                        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                                                        {tc('back')}
                                                </button>
                                        ) : (
                                                <span aria-hidden="true" className="min-h-11" />
                                        )}

                                        {step < TOTAL - 1 ? (
                                                <button
                                                        type="button"
                                                        onClick={() => canNext && setStep((s) => s + 1)}
                                                        disabled={!canNext}
                                                        className="inline-flex items-center gap-1 rounded-xl bg-[var(--white)] px-5 py-2 text-sm font-medium text-[var(--bg-base)] transition-transform hover:scale-[1.02] disabled:opacity-50"
                                                >
                                                        {tc('next')}
                                                        <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                                                </button>
                                        ) : (
                                                <button
                                                        type="button"
                                                        onClick={submit}
                                                        disabled={loading}
                                                        className="inline-flex items-center gap-2 rounded-xl bg-[var(--white)] px-5 py-2 text-sm font-medium text-[var(--bg-base)] transition-transform hover:scale-[1.02] disabled:opacity-50"
                                                >
                                                        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
						{loading ? tA('creating') : (locale === 'fa' ? 'ساخت و ادامه' : 'Create and continue')}
                                                </button>
                                        )}
                                </div>
                        </div>
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

function LayerField({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
        const faNum = ['۱', '۲', '۳', '۴', '۵', '۶'][n - 1] ?? String(n)
        return (
                <label className="block">
                        <span className="mb-2 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-[var(--accent-soft)] text-[11px] font-semibold text-[var(--accent-strong)]">{faNum}</span>
                                {label}
                        </span>
                        {children}
                </label>
        )
}

function ReviewCard({
	locale,
	form,
	role,
	knowledgeCount,
	modelLabel,
	isTrial,
}: {
	locale: 'fa' | 'en'
	form: FormState
	role: RoleTemplate
	knowledgeCount: number
	modelLabel: string
	isTrial: boolean
}) {
	const isFa = locale === 'fa'
	const checklist = [
		{
			ok: form.name.trim().length > 0,
			label: isFa ? 'نام ایجنت' : 'Agent name',
			value: form.name || '—',
		},
		{
			ok: true,
			label: isFa ? 'نقش و رفتار' : 'Role and behavior',
			value: isFa ? role.nameFa : role.nameEn,
		},
		{
			ok: true,
			label: isFa ? 'زبان پاسخ‌گویی' : 'Response language',
			value: form.language === 'fa' ? 'فارسی' : 'English',
		},
		{
			ok: true,
			label: isFa ? 'مدل فعلی' : 'Current model',
			value: isTrial
				? (isFa ? `${modelLabel} · آزمایشی و قابل تغییر` : `${modelLabel} · trial, changeable later`)
				: (isFa ? `${modelLabel} · قابل تغییر` : `${modelLabel} · changeable later`),
		},
		{
			ok: true,
			label: isFa ? 'تحویل گفتگو به اپراتور' : 'Human handoff',
			value: form.handoffEnabled ? (isFa ? 'فعال' : 'Enabled') : (isFa ? 'فعلاً غیرفعال' : 'Disabled for now'),
		},
		{
			ok: knowledgeCount > 0,
			label: isFa ? 'محصولات و دانش' : 'Products and knowledge',
			value: knowledgeCount > 0
				? (isFa ? `${knowledgeCount.toLocaleString('fa-IR')} محصول آماده اتصال است` : `${knowledgeCount} products are ready to connect`)
				: (isFa ? 'پس از ساخت می‌توانید از منو اضافه کنید' : 'You can add them from the menu after creation'),
		},
	]
	return (
		<div className="space-y-4">
			<div className="flex items-start gap-3 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4">
				<Eye className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-strong)]" />
				<div>
					<h3 className="text-sm font-semibold text-[var(--text-primary)]">{isFa ? 'چک‌لیست آمادگی ایجنت' : 'Agent readiness checklist'}</h3>
					<p className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">
						{isFa ? 'جزئیات را یک‌بار بررسی کنید؛ محصولات، دانش و برنامه‌های ارتباطی بعداً هم قابل افزودن‌اند.' : 'Review the details once. Products, knowledge and connected apps can also be added later.'}
					</p>
				</div>
			</div>
			<div className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)]">
				<ul className="divide-y divide-[var(--border-subtle)]">
					{checklist.map((item) => (
						<li key={item.label} className="flex items-start gap-3 px-4 py-3.5">
							{item.ok
								? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
								: <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}
							<div className="min-w-0 flex-1 sm:flex sm:items-start sm:justify-between sm:gap-4">
								<span className="block text-xs font-medium text-[var(--text-primary)]">{item.label}</span>
								<span className="mt-1 block text-xs leading-5 text-[var(--text-muted)] sm:mt-0 sm:max-w-[60%] sm:text-end">{item.value}</span>
							</div>
						</li>
					))}
				</ul>
			</div>
		</div>
        )
}
