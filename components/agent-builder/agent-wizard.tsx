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
	CircleDashed,
} from 'lucide-react'
import { findModel, type ModelAlias } from '@/lib/ai/models'
import {
        getBusinessGoals,
        getRecommendedRoleForGoals,
        getRoleTemplatesForBusiness,
        getSuggestedRoleTemplate,
        normalizePromptConfig,
        type PromptConfig,
        type RoleTemplate,
} from '@/lib/ai/prompt-builder'
import { fromLegacyBusinessKey, type BusinessTypeValue } from '@/lib/verticals/registry'
import { NaturalConversationControls } from './natural-conversation-controls'
import { GoalPicker } from '@/components/agents/goal-picker'
import { PROMPT_SCOPE_RULE_LIMIT } from '@/lib/agents/prompt-config-limits'
import { StepProgress } from '@/components/ui/step-progress'
import { Switch } from '@/components/ui/switch'
import { TagInput } from '@/components/ui/tag-input'

const TOTAL = 2

interface FormState {
	name: string
	welcomeMessage: string
        fallbackMessage: string
        model: string
        language: 'fa' | 'en'
        handoffEnabled: boolean
        handoffMessage: string
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
                doSay: lines(draft.doSay).slice(0, PROMPT_SCOPE_RULE_LIMIT),
                dontSay: lines(draft.dontSay).slice(0, PROMPT_SCOPE_RULE_LIMIT),
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
	const presetCopy = preset?.[locale]
	const trialModelLabel = locale === 'fa' ? findModel(modelPolicy.trialModel).name : findModel(modelPolicy.trialModel).nameEn
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
	const goalOptions = getBusinessGoals(resolvedBusinessType)
	const [goals, setGoals] = useState<string[]>(() => goalOptions.map((goal) => goal.key))
	const [form, setForm] = useState<FormState>({
		name: presetCopy?.name ?? '',
		welcomeMessage: presetCopy?.welcome ?? '',
		fallbackMessage: '',
		model: modelPolicy.plan === 'TRIAL' ? modelPolicy.trialModel : '',
                language: locale,
                handoffEnabled: true,
                handoffMessage: '',
                requireCustomerInfo: preset?.role === 'lead_capture',
		customerInfoPrompt: '',
	})

	const [handoffWords, setHandoffWords] = useState<string[]>(locale === 'fa' ? ['اپراتور', 'انسان', 'شکایت'] : ['operator', 'human', 'complaint'])

	useEffect(() => {
		window.scrollTo({ top: 0, behavior: 'auto' })
	}, [step])

        const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
                setForm((f) => ({ ...f, [key]: value }))

        const setD = <K extends keyof ConfigDraft>(key: K, value: ConfigDraft[K]) =>
                setDraft((d) => ({ ...d, [key]: value }))

        function selectRole(picked: RoleTemplate) {
                const role = picked.key === 'custom' ? picked : getRecommendedRoleForGoals(resolvedBusinessType, goals)
                setSelectedRole(role)
                setDraft(draftFromRole(role))
                // The custom template is an empty canvas — open the editor right away.
                setShowEditor(role.key === 'custom')
        }

        // Goals rebuild the recommended behavior, keeping the tone already picked.
        function selectGoals(keys: string[]) {
                const role = getRecommendedRoleForGoals(resolvedBusinessType, keys)
                setGoals(keys)
                setSelectedRole(role)
                setDraft((d) => ({ ...draftFromRole(role), conversationFormality: d.conversationFormality }))
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
                                        handoffKeywords: handoffWords,
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
		? ['ایجنت شما', 'مرز پاسخ و ساخت']
		: ['Your agent', 'Boundaries & create']
	const isFa = locale === 'fa'
	const toneSample = TONE_SAMPLES[draft.conversationFormality][locale]
	const reviewRows = [
		{ ok: form.name.trim().length > 0, label: isFa ? 'نام' : 'Name', value: form.name || '—' },
		{
			ok: true,
			label: isFa ? 'نقش و لحن' : 'Role and tone',
			value: `${isFa ? selectedRole.nameFa : selectedRole.nameEn} · ${TONE_LABELS[draft.conversationFormality][locale]}`,
		},
		{ ok: true, label: isFa ? 'مدل' : 'Model', value: form.model || activeModelLabel },
		{
			ok: true,
			label: isFa ? 'تحویل به اپراتور' : 'Operator handoff',
			value: form.handoffEnabled ? (isFa ? 'فعال' : 'On') : (isFa ? 'خاموش' : 'Off'),
		},
		{
			ok: workspaceProductCount > 0,
			label: isFa ? 'محصولات و دانش' : 'Products and knowledge',
			value: workspaceProductCount > 0
				? (isFa ? `${workspaceProductCount.toLocaleString('fa-IR')} محصول` : `${workspaceProductCount} products`)
				: (isFa ? 'بعد از ساخت' : 'After creation'),
		},
	]

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
                                                                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--text-primary)] px-5 text-sm font-medium text-white shadow-[var(--shadow-control)]"
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

	const backButton = step === 0 && onboardingMode ? (
		<button
			type="button"
			onClick={() => router.push('/onboarding')}
			className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
		>
			<ArrowLeft className="h-4 w-4 rtl:rotate-180" />
			{isFa ? 'بازگشت به راه‌اندازی' : 'Back to setup'}
		</button>
	) : step > 0 ? (
		<button
			type="button"
			onClick={() => setStep((s) => Math.max(0, s - 1))}
			className="inline-flex min-h-11 items-center gap-1 px-2 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
		>
			<ArrowLeft className="h-4 w-4 rtl:rotate-180" />
			{tc('back')}
		</button>
	) : (
		<span aria-hidden="true" className="min-h-11" />
	)

	return (
		<div className="mx-auto max-w-4xl">
			<p className="sr-only" aria-live="polite">{t('step', { n: step + 1, total: TOTAL })} — {stepTitles[step]}</p>
			<StepProgress steps={[...stepTitles]} current={step} locale={locale === 'fa' ? 'fa' : 'en'} className="mb-5 sm:mb-6" />

			<AnimatePresence mode="wait" initial={false}>
				<motion.div
					key={step}
					initial={{ opacity: 0, x: 20 }}
					animate={{ opacity: 1, x: 0 }}
					exit={{ opacity: 0, x: -20 }}
					transition={{ duration: 0.25 }}
				>
					{step === 0 && (
						<div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
							<div className="spatial-surface space-y-4 rounded-sheet p-5 sm:p-6">
								<Field label={t('name')}>
									<input
										autoFocus
										value={form.name}
										onChange={(e) => set('name', e.target.value)}
										placeholder={t('namePlaceholder')}
										className="input"
									/>
								</Field>

								<div>
									<span id="wizard-role" className="ui-field-label">{isFa ? 'نقش' : 'Role'}</span>
									<div role="radiogroup" aria-labelledby="wizard-role" className="space-y-2">
										{roleTemplates.map((role) => {
											const selected = selectedRole.key === role.key
											return (
												<button
													key={role.key}
													type="button"
													role="radio"
													aria-checked={selected}
													onClick={() => selectRole(role)}
													className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-start transition-[border-color,box-shadow] duration-150 ${
														selected
															? 'border-[var(--text-primary)] shadow-[0_0_0_1px_var(--text-primary)]'
															: 'border-[var(--border-default)] bg-white hover:border-black/25'
													}`}
												>
													<span className={`h-5 w-5 shrink-0 rounded-full border bg-white ${selected ? 'border-[6px] border-[var(--text-primary)]' : 'border-black/30'}`} />
													<span className="min-w-0">
														<span className="block text-[13px] font-bold text-[var(--text-primary)]">{isFa ? role.nameFa : role.nameEn}</span>
														<span className="block text-[12px] leading-5 text-[var(--text-muted)]">{isFa ? role.descFa : role.descEn}</span>
													</span>
												</button>
											)
										})}
									</div>
									{selectedRole.key !== 'custom' && (
										<GoalPicker id="wizard-goals" className="mt-4" goals={goalOptions} selected={goals} onChange={selectGoals} fa={isFa} />
									)}
									<button
										type="button"
										onClick={() => setShowEditor((v) => !v)}
										aria-expanded={showEditor}
										aria-controls="wizard-behavior-editor"
										className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
									>
										{showEditor ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
										{isFa ? 'ویرایش شش لایهٔ رفتار (اختیاری؛ بعداً هم از «بهبود ایجنت» می‌شود)' : 'Edit the six behavior layers (optional; also available later in Improve agent)'}
									</button>
									{showEditor && (
										<div id="wizard-behavior-editor" className="space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4">
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
                                                                                                                <label className="block"><span className="mb-1.5 block text-[12px] font-medium text-emerald-700">{t('layerDoSay')}</span><textarea value={draft.doSay} onChange={(e) => setD('doSay', e.target.value)} rows={4} placeholder={t('layerListPh')} className="input resize-none text-sm" /><span className="mt-1 block text-[12px] text-[var(--text-muted)]">{locale === 'fa' ? `حداکثر ${PROMPT_SCOPE_RULE_LIMIT.toLocaleString('fa-IR')} مورد` : `Up to ${PROMPT_SCOPE_RULE_LIMIT} items`}</span></label>
                                                                                                                <label className="block"><span className="mb-1.5 block text-[12px] font-medium text-red-700">{t('layerDontSay')}</span><textarea value={draft.dontSay} onChange={(e) => setD('dontSay', e.target.value)} rows={4} placeholder={t('layerListPh')} className="input resize-none text-sm" /><span className="mt-1 block text-[12px] text-[var(--text-muted)]">{locale === 'fa' ? `حداکثر ${PROMPT_SCOPE_RULE_LIMIT.toLocaleString('fa-IR')} مورد` : `Up to ${PROMPT_SCOPE_RULE_LIMIT} items`}</span></label>
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
                                                                                                        <p className="mt-2 text-[12px] font-medium text-[var(--text-secondary)]">{tA('settingsForm.formatLength')}</p>
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
                                                                                                        <p className="mt-1.5 text-[12px] text-[var(--text-muted)]">
                                                                                                                {locale === 'fa' ? 'هر خط یک نمونه: سؤال|پاسخ. حداکثر ۲۰ نمونه.' : 'One pair per line: question|answer. Max 20 pairs.'}
                                                                                                        </p>
                                                                                                </LayerField>
										</div>
									)}
								</div>

								<div>
									<span id="wizard-tone" className="ui-field-label">{isFa ? 'لحن' : 'Tone'}</span>
									<div role="radiogroup" aria-labelledby="wizard-tone" className="ui-seg w-full grid-cols-3 sm:w-80">
										{(['casual', 'balanced', 'formal'] as const).map((value) => (
											<button
												key={value}
												type="button"
												role="radio"
												aria-checked={draft.conversationFormality === value}
												data-active={draft.conversationFormality === value}
												onClick={() => setD('conversationFormality', value)}
												className="ui-seg-tab flex-1 px-5"
											>
												{TONE_LABELS[value][locale]}
											</button>
										))}
									</div>
								</div>

								<Field label={t('welcomeMessage')}>
									<input
										value={form.welcomeMessage}
										onChange={(e) => set('welcomeMessage', e.target.value)}
										placeholder={t('welcomePlaceholder')}
										className="input"
									/>
									<p className="ui-field-hint">{t('welcomeHint')}</p>
								</Field>
							</div>

							{/* Live preview: follows the name, tone and greeting as they change. */}
							<div className="rounded-sheet border border-[var(--border-subtle)] bg-[#fbfbfa] p-5 lg:sticky lg:top-24" aria-live="polite">
								<div className="flex items-center justify-between gap-2">
									<span className="truncate text-[13px] font-bold text-[var(--text-primary)]">{form.name.trim() || t('namePlaceholder')}</span>
									<span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[12px] font-medium text-emerald-700">
										<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
										{isFa ? 'پیش‌نمایش' : 'Preview'}
									</span>
								</div>
								<div className="mt-3 flex flex-col gap-2 text-[13px] leading-6">
									<p className="ms-auto max-w-[85%] rounded-2xl rounded-se-md bg-[var(--text-primary)] px-3 py-2 text-white">
										{form.welcomeMessage.trim() || t('welcomePlaceholder')}
									</p>
									<p className="max-w-[85%] rounded-2xl rounded-ss-md bg-black/[0.06] px-3 py-2 text-[var(--text-primary)]">
										{isFa ? 'سفارشم کی می‌رسه؟' : 'When does my order arrive?'}
									</p>
									<p className="ms-auto max-w-[85%] rounded-2xl rounded-se-md bg-[var(--text-primary)] px-3 py-2 text-white">{toneSample}</p>
								</div>
								<p className="mt-3 text-[12px] leading-5 text-[var(--text-muted)]">
									{isFa ? 'با تغییر نام، لحن یا پیام، همین گفتگو عوض می‌شود. جواب دوم فقط نمونهٔ لحن است.' : 'This exchange follows the name, tone and greeting. The second reply only shows the tone.'}
								</p>
							</div>
						</div>
					)}

					{step === 1 && (
						<div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
							<div className="spatial-surface divide-y divide-[var(--border-subtle)] overflow-hidden rounded-sheet">
								<div className="p-4 sm:p-5">
									<div className="flex items-center justify-between gap-4">
										<div>
											<p className="text-[13px] font-bold text-[var(--text-primary)]">{isFa ? 'تحویل خودکار به اپراتور' : 'Automatic operator handoff'}</p>
											<p className="text-[12px] leading-5 text-[var(--text-muted)]">{isFa ? 'برای شکایت، مذاکره، درخواست مستقیم و موارد پرخطر' : 'For complaints, negotiation, direct requests and high-risk cases'}</p>
										</div>
										<Switch checked={form.handoffEnabled} onChange={(v) => set('handoffEnabled', v)} aria-label={isFa ? 'تحویل خودکار به اپراتور' : 'Automatic operator handoff'} />
									</div>
									{form.handoffEnabled && (
										<div className="mt-3 space-y-3">
											<div>
												<label htmlFor="wizard-handoff-words" className="ui-field-label">{isFa ? 'کلمه‌هایی که همیشه تحویل می‌دهند' : 'Words that always hand off'}</label>
												<TagInput
													id="wizard-handoff-words"
													value={handoffWords}
													onChange={setHandoffWords}
													locale={locale}
													placeholder={isFa ? 'کلمه را بنویسید و Enter بزنید' : 'Type a word and press Enter'}
												/>
											</div>
											<Field label={isFa ? 'پیامی که مشتری موقع تحویل می‌بیند' : 'Message the customer sees on handoff'}>
												<input
													value={form.handoffMessage}
													onChange={(e) => set('handoffMessage', e.target.value)}
													placeholder={isFa ? 'همکارم تا چند دقیقهٔ دیگر جواب می‌دهد.' : 'A teammate will reply in a few minutes.'}
													className="input"
												/>
											</Field>
										</div>
									)}
								</div>

								<div className="p-4 sm:p-5">
									<Field label={isFa ? 'وقتی جواب را نمی‌داند' : 'When it does not know the answer'}>
										<input
											value={form.fallbackMessage}
											onChange={(e) => set('fallbackMessage', e.target.value)}
											placeholder={isFa ? 'مطمئن نیستم؛ از همکارم می‌پرسم و خبر می‌دهم.' : 'I am not sure; I will check with a teammate and get back to you.'}
											className="input"
										/>
										<p className="ui-field-hint">{isFa ? 'خالی بماند، ایجنت طبق الگوی نقش رفتار می‌کند.' : 'Left empty, the agent follows its role template.'}</p>
									</Field>
								</div>

								<div className="p-4 sm:p-5">
									<div className="flex items-center justify-between gap-4">
										<div>
											<p className="text-[13px] font-bold text-[var(--text-primary)]">{isFa ? 'گرفتن نام و شماره پیش از گفتگو' : 'Ask for name and number before chatting'}</p>
											<p className="text-[12px] leading-5 text-[var(--text-muted)]">{isFa ? 'فقط در ویجت سایت و لینک چت' : 'Website widget and chat link only'}</p>
										</div>
										<Switch checked={form.requireCustomerInfo} onChange={(v) => set('requireCustomerInfo', v)} aria-label={isFa ? 'گرفتن نام و شماره پیش از گفتگو' : 'Ask for name and number before chatting'} />
									</div>
									{form.requireCustomerInfo && (
										<div className="mt-3">
											<Field label={isFa ? 'متن بالای فرم (اختیاری)' : 'Text above the form (optional)'}>
												<textarea value={form.customerInfoPrompt} onChange={(e) => set('customerInfoPrompt', e.target.value)} rows={2} placeholder={isFa ? 'برای اینکه بهتر راهنمایی‌تان کنیم، لطفاً نام و شماره موبایل خود را وارد کنید.' : 'To help you better, please enter your name and mobile number.'} className="input resize-none" />
											</Field>
										</div>
									)}
								</div>
							</div>

							<div className="spatial-surface rounded-sheet p-4 sm:p-5 lg:sticky lg:top-24">
								<h3 className="text-[13px] font-bold text-[var(--text-primary)]">{isFa ? 'بازبینی' : 'Review'}</h3>
								<ul className="mt-2 divide-y divide-[var(--border-subtle)]">
									{reviewRows.map((item) => (
										<li key={item.label} className="flex items-center gap-2 py-2.5 text-[13px]">
											{item.ok
												? <Check className="h-4 w-4 shrink-0 text-emerald-600" />
												: <CircleDashed className="h-4 w-4 shrink-0 text-amber-600" />}
											<span className="text-[var(--text-primary)]">{item.label}</span>
											<span className="ms-auto max-w-[60%] truncate text-[12px] text-[var(--text-muted)]">{item.value}</span>
										</li>
									))}
								</ul>
								{error && <p className="mt-3 text-sm text-danger" role="alert">{tA('createFailed')}</p>}
								<div className="mt-3 flex items-center justify-between gap-3">
									{backButton}
									<button
										type="button"
										onClick={submit}
										disabled={loading}
										aria-busy={loading}
										className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--text-primary)] px-5 text-sm font-medium text-white shadow-[var(--shadow-control)] disabled:cursor-wait disabled:opacity-70"
									>
										{loading && <Loader2 className="h-4 w-4 animate-spin" />}
										{loading ? tA('creating') : onboardingMode ? (isFa ? 'ساخت و ادامه' : 'Create and continue') : (isFa ? 'ساخت ایجنت' : 'Create agent')}
									</button>
								</div>
							</div>
						</div>
					)}
				</motion.div>
			</AnimatePresence>

			{step === 0 && (
				<div className="mt-4 flex items-center justify-between">
					{backButton}
					<button
						type="button"
						onClick={() => canNext && setStep(1)}
						disabled={!canNext}
						className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-[var(--text-primary)] px-5 text-sm font-medium text-white shadow-[var(--shadow-control)]"
					>
						{tc('next')}
						<ArrowRight className="h-4 w-4 rtl:rotate-180" />
					</button>
				</div>
			)}
		</div>
	)
}

const TONE_LABELS = {
	casual: { fa: 'صمیمی', en: 'Friendly' },
	balanced: { fa: 'متعادل', en: 'Balanced' },
	formal: { fa: 'رسمی', en: 'Formal' },
} as const

const TONE_SAMPLES = {
	casual: { fa: 'سلام عزیزم 🌸 فردا دستت می‌رسه، خیالت راحت!', en: 'Hi there 🌸 it arrives tomorrow, no worries!' },
	balanced: { fa: 'سلام! سفارشتون فردا به دستتون می‌رسه.', en: 'Hi! Your order arrives tomorrow.' },
	formal: { fa: 'سلام، وقت بخیر. سفارش شما فردا تحویل داده می‌شود.', en: 'Hello. Your order will be delivered tomorrow.' },
} as const

function Field({ label, children }: { label: string; children: React.ReactNode }) {
        return (
                <label className="block">
                        <span className="ui-field-label">{label}</span>
                        {children}
                </label>
        )
}

function LayerField({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
        const faNum = ['۱', '۲', '۳', '۴', '۵', '۶'][n - 1] ?? String(n)
        return (
                <label className="block">
                        <span className="mb-2 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-[var(--accent-soft)] text-[12px] font-semibold text-[var(--accent-strong)]">{faNum}</span>
                                {label}
                        </span>
                        {children}
                </label>
        )
}
