'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { AnimatePresence, motion } from 'framer-motion'
import {
        ArrowLeft,
        ArrowRight,
        CheckCircle2,
        ChevronDown,
        ChevronUp,
        Loader2,
        Package,
        BookOpen,
        Zap,
        Sparkles,
        ShieldCheck,
        Radio,
        FlaskConical,
        DatabaseZap,
        CircleDashed,
        Eye,
} from 'lucide-react'
import { ModelSelect } from './model-select'
import type { ModelAlias } from '@/lib/ai/models'
import {
        ROLE_TEMPLATES,
        type PromptConfig,
        type RoleTemplate,
} from '@/lib/ai/prompt-builder'
import type { VigentoDraft } from '@/lib/ai/vigento-draft'
import { VigentoComposer } from './vigento-composer'
import { MaterialSelect } from '@/components/ui/material-select'

const TOTAL = 5

interface FormState {
        name: string
        description: string
        welcomeMessage: string
        fallbackMessage: string
        model: string
        language: 'fa' | 'en'
        temperature: number
        maxTokens: number
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
        return {
                personality: role.config.personality,
                tone: role.config.tone,
                doSay: role.config.doSay.join('\n'),
                dontSay: role.config.dontSay.join('\n'),
                fallbackBehavior: role.config.fallbackBehavior,
                fmtBold: role.config.format.bold,
                fmtEmoji: role.config.format.emoji,
                fmtLinks: role.config.format.links,
                fmtBullets: role.config.format.bullets,
                fmtLength: role.config.format.length,
                qaPairsText: role.config.qaPairs.map((qa) => `${qa.question}|${qa.answer}`).join('\n'),
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
                fa: { name: 'دستیار فروش اینستاگرام', description: 'پاسخ به دایرکت و کامنت، معرفی محصول و پیگیری مشتری', welcome: 'سلام! برای دیدن قیمت، موجودی یا انتخاب محصول پیام بدهید؛ همین‌جا راهنمایی‌تان می‌کنم.' },
                en: { name: 'Instagram sales assistant', description: 'Answer DMs and comments, recommend products and follow up', welcome: 'Hi! Ask about price, stock or choosing a product and I will help right here.' },
        },
        store: {
                role: 'sales_consultant',
                fa: { name: 'دستیار فروش', description: 'مشاوره محصول، پاسخ به سوالات خرید و پیگیری سفارش', welcome: 'سلام! برای انتخاب محصول یا پیگیری سفارش در کنارتان هستم.' },
                en: { name: 'Sales assistant', description: 'Product advice, purchase questions and order follow-up', welcome: 'Hi! I can help you choose a product or track an order.' },
        },
        commerce: {
                role: 'sales_consultant',
                fa: { name: 'مشاور هوشمند فروش', description: 'مشاوره خرید، مقایسه محصول، پیگیری سفارش و تحویل موارد حساس به تیم', welcome: 'سلام! برای انتخاب محصول، بررسی موجودی یا پیگیری سفارش در کنارتان هستم.' },
                en: { name: 'Commerce copilot', description: 'Buying advice, product comparison, order tracking and safe handoff', welcome: 'Hi! I can help you choose a product, check availability or track an order.' },
        },
        food: {
                role: 'sales_consultant',
                fa: { name: 'دستیار سفارش و رزرو', description: 'معرفی منو، پیشنهاد آیتم، ثبت سفارش و هماهنگی رزرو میز', welcome: 'سلام! برای دیدن منو، انتخاب غذا، ثبت سفارش یا رزرو میز بفرمایید.' },
                en: { name: 'Food ordering assistant', description: 'Menu guidance, recommendations, order capture and table booking', welcome: 'Hi! I can help with the menu, an order, or a table booking.' },
        },
        appointments: {
                role: 'lead_capture',
                fa: { name: 'دستیار نوبت‌دهی', description: 'شناخت نیاز، نمایش زمان آزاد، ثبت و جابه‌جایی نوبت بدون تداخل', welcome: 'سلام! نوع خدمت و زمان مدنظرتان را بفرمایید تا نزدیک‌ترین وقت آزاد را پیدا کنم.' },
                en: { name: 'Appointment assistant', description: 'Qualify needs, show availability, book and reschedule without conflicts', welcome: 'Hi! Tell me the service and preferred time and I will find the closest available slot.' },
        },
        services: {
                role: 'lead_capture',
                fa: { name: 'دستیار رزرو', description: 'پاسخ به سوالات، ثبت درخواست و هماهنگی رزرو', welcome: 'سلام! برای دریافت راهنمایی یا ثبت درخواست بفرمایید چه کمکی می‌توانم بکنم؟' },
                en: { name: 'Booking assistant', description: 'Answer questions, capture requests and coordinate bookings', welcome: 'Hi! How can I help with information or a booking today?' },
        },
        education: {
                role: 'full_service',
                fa: { name: 'راهنمای دوره‌ها', description: 'معرفی دوره، پاسخ به سوالات ثبت‌نام و پیگیری علاقه‌مندان', welcome: 'سلام! برای انتخاب دوره و پاسخ به سوالات ثبت‌نام در کنارتان هستم.' },
                en: { name: 'Course guide', description: 'Course discovery, enrollment questions and lead follow-up', welcome: 'Hi! I can help you choose a course and answer enrollment questions.' },
        },
        support: {
                role: 'general_support',
                fa: { name: 'همکار پشتیبانی', description: 'تشخیص موضوع، پاسخ دانش‌محور، اولویت‌بندی و تحویل امن به اپراتور', welcome: 'سلام! موضوع یا مشکل را بفرستید؛ پاسخ می‌دهم یا با خلاصه کامل به همکار مربوط تحویل می‌دهم.' },
                en: { name: 'Support copilot', description: 'Issue triage, knowledge-grounded answers, priority and safe handoff', welcome: 'Hi! Send the issue and I will resolve it or hand it to the right teammate with context.' },
        },
        custom: {
                role: 'full_service',
                fa: { name: 'دستیار هوشمند کسب‌وکار', description: 'پاسخ‌گویی، جمع‌آوری اطلاعات و اجرای جریان متناسب با کسب‌وکار', welcome: 'سلام! بفرمایید چه کمکی از دستم برمی‌آید؟' },
                en: { name: 'Business copilot', description: 'Answers, information capture and a workflow tailored to the business', welcome: 'Hi! How can I help today?' },
        },
        messaging: {
                role: 'general_support',
                fa: { name: 'دستیار پشتیبانی پیام‌رسان', description: 'پاسخ‌گویی در تلگرام، بله و روبیکا و تحویل موارد مهم به اپراتور', welcome: 'سلام! سوال یا درخواستتان را بفرستید؛ اگر نیاز به بررسی همکار باشد، گفتگو را برای پیگیری تحویل می‌دهم.' },
                en: { name: 'Messaging support assistant', description: 'Support customers on Telegram, Bale and Rubika with human handoff', welcome: 'Hi! Send your question or request. If a teammate needs to review it, I will hand it over with context.' },
        },
} as const

export function AgentWizard({
        initialBusiness,
        modelPolicy,
        workspaceProductCount = 0,
        showVigento = true,
        onboardingMode = false,
}: {
        initialBusiness?: string
        workspaceProductCount?: number
        showVigento?: boolean
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
        const defaultRole = ROLE_TEMPLATES.find((r) => r.key === (preset?.role ?? 'full_service')) ?? ROLE_TEMPLATES[0]
        const presetCopy = preset?.[locale]

        const [step, setStep] = useState(0)
        const [loading, setLoading] = useState(false)
        const [error, setError] = useState(false)
        const [created, setCreated] = useState<CreatedAgent | null>(null)
        const [selectedRole, setSelectedRole] = useState<RoleTemplate>(defaultRole)
        const [draft, setDraft] = useState<ConfigDraft>(draftFromRole(defaultRole))
        const [showEditor, setShowEditor] = useState(true)
        const [vigentoDraft, setVigentoDraft] = useState<VigentoDraft | null>(null)
        const [form, setForm] = useState<FormState>({
                name: presetCopy?.name ?? '',
                description: presetCopy?.description ?? '',
                welcomeMessage: presetCopy?.welcome ?? '',
                fallbackMessage: '',
                model: '',
                language: 'fa',
                temperature: 0.7,
                maxTokens: 1000,
                handoffEnabled: true,
                handoffMessage: '',
                handoffKeywords: locale === 'fa' ? 'اپراتور، انسان، شکایت' : 'operator, human, complaint',
                requireCustomerInfo: preset?.role === 'lead_capture',
                customerInfoPrompt: '',
        })

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

        function applyVigentoDraft(next: VigentoDraft) {
                const role = ROLE_TEMPLATES.find((item) => item.key === next.roleTemplate) ?? ROLE_TEMPLATES[0]
                setSelectedRole(role)
                setDraft({
                        personality: next.promptConfig.personality,
                        tone: next.promptConfig.tone,
                        doSay: next.promptConfig.doSay.join('\n'),
                        dontSay: next.promptConfig.dontSay.join('\n'),
                        fallbackBehavior: next.promptConfig.fallbackBehavior,
                        fmtBold: role.config.format.bold,
                        fmtEmoji: role.config.format.emoji,
                        fmtLinks: role.config.format.links,
                        fmtBullets: role.config.format.bullets,
                        fmtLength: role.config.format.length,
                        qaPairsText: role.config.qaPairs.map((qa) => `${qa.question}|${qa.answer}`).join('\n'),
                })
                setForm((current) => ({
                        ...current,
                        name: next.name,
                        description: next.description,
                        welcomeMessage: next.welcomeMessage,
                        fallbackMessage: next.fallbackMessage,
                        handoffEnabled: next.handoffEnabled,
                        handoffMessage: next.handoffMessage,
                        handoffKeywords: next.handoffKeywords.join('، '),
                        requireCustomerInfo: next.requireCustomerInfo,
                        customerInfoPrompt: next.customerInfoPrompt,
                }))
                setVigentoDraft(next)
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
                                        description: form.description || undefined,
                                        // Send the role template key + the (possibly edited) prompt config so
                                        // the agent starts with the full 6-layer engine ready to go.
                                        roleTemplate: selectedRole.key,
                                        promptConfig: configFromDraft(selectedRole, draft),
                                        welcomeMessage: form.welcomeMessage || undefined,
                                        fallbackMessage: form.fallbackMessage || undefined,
                                        model: form.model || undefined,
                                        language: form.language,
                                        temperature: form.temperature,
                                        maxTokens: form.maxTokens,
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
                ? ['هدف', 'شخصیت و قوانین', 'دانش و تحویل', 'مدل و ارزیابی', 'بازبینی و انتشار']
                : ['Goal', 'Persona & guardrails', 'Knowledge & handoff', 'Model & evaluation', 'Review & publish']

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
                        {showVigento && (
                                <VigentoComposer
                                        locale={locale}
                                        currentName={form.name}
                                        onApply={applyVigentoDraft}
                                />
                        )}
                        <div className="mb-2 text-sm text-[var(--text-secondary)]">
                                {t('step', { n: step + 1, total: TOTAL })} — {stepTitles[step]}
                        </div>
                        <div className="mb-8 h-1 overflow-hidden rounded-full bg-[var(--white-05)]">
                                <div
                                        className="h-full bg-[var(--white)] transition-all duration-500"
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
                                                                <Field label={t('description')}>
                                                                        <textarea
                                                                                value={form.description}
                                                                                onChange={(e) => set('description', e.target.value)}
                                                                                placeholder={t('descriptionPlaceholder')}
                                                                                rows={3}
                                                                                className="input resize-none"
                                                                        />
                                                                </Field>
                                                        </>
                                                )}

                                                {step === 1 && (
                                                        <>
                                                                {/* Role template picker (6-layer engine) */}
                                                                <div>
                                                                        <p className="mb-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                                                                                <Sparkles className="h-3.5 w-3.5" />
                                                                                {t('roleTemplateLabel')}
                                                                        </p>
                                                                        <div className="grid gap-2 sm:grid-cols-2">
                                                                                {ROLE_TEMPLATES.map((role) => {
                                                                                        const selected = selectedRole.key === role.key
                                                                                        return (
                                                                                                <button
                                                                                                        key={role.key}
                                                                                                        type="button"
                                                                                                        onClick={() => selectRole(role)}
                                                                                                        className={`w-full rounded-xl border p-3 text-start transition-colors ${
                                                                                                                selected
                                                                                                                        ? 'border-[var(--border-strong)] bg-[var(--bg-muted)]'
                                                                                                                        : 'border-[var(--border-default)] hover:border-[var(--border-hover)]'
                                                                                                        }`}
                                                                                                >
                                                                                        <p className="text-sm font-medium text-[var(--text-primary)]">
                                                                                                {locale === 'fa' ? role.nameFa : role.nameEn}
                                                                                        </p>
                                                                                        <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-muted)]">
                                                                                                {locale === 'fa' ? role.descFa : role.descEn}
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
                                                                                                        <textarea
                                                                                                                value={draft.tone}
                                                                                                                onChange={(e) => setD('tone', e.target.value)}
                                                                                                                rows={2}
                                                                                                                placeholder={t('layerTonePh')}
                                                                                                                className="input resize-none text-sm"
                                                                                                        />
                                                                                                </LayerField>
                                                                                                <LayerField n={3} label={t('layerDoSay')}>
                                                                                                        <textarea
                                                                                                                value={draft.doSay}
                                                                                                                onChange={(e) => setD('doSay', e.target.value)}
                                                                                                                rows={4}
                                                                                                                placeholder={t('layerListPh')}
                                                                                                                className="input resize-none text-sm"
                                                                                                        />
                                                                                                </LayerField>
                                                                                                <LayerField n={4} label={t('layerDontSay')}>
                                                                                                        <textarea
                                                                                                                value={draft.dontSay}
                                                                                                                onChange={(e) => setD('dontSay', e.target.value)}
                                                                                                                rows={4}
                                                                                                                placeholder={t('layerListPh')}
                                                                                                                className="input resize-none text-sm"
                                                                                                        />
                                                                                                </LayerField>
                                                                                                <LayerField n={5} label={t('layerFallback')}>
                                                                                                        <textarea
                                                                                                                value={draft.fallbackBehavior}
                                                                                                                onChange={(e) => setD('fallbackBehavior', e.target.value)}
                                                                                                                rows={2}
                                                                                                                placeholder={t('layerFallbackPh')}
                                                                                                                className="input resize-none text-sm"
                                                                                                        />
                                                                                                </LayerField>
                                                                                                {/* Layer 5 — Response format */}
                                                                                                <LayerField n={5} label={t('layerFormat')}>
                                                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                                                                <label className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white px-2.5 py-1.5 text-xs cursor-pointer hover:border-[var(--border-strong)]">
                                                                                                                        <input type="checkbox" checked={draft.fmtBold} onChange={(e) => setD('fmtBold', e.target.checked)} className="h-3.5 w-3.5 accent-[var(--accent)]" />
                                                                                                                        {tA('settingsForm.fmt_bold')}
                                                                                                                </label>
                                                                                                                <label className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white px-2.5 py-1.5 text-xs cursor-pointer hover:border-[var(--border-strong)]">
                                                                                                                        <input type="checkbox" checked={draft.fmtEmoji} onChange={(e) => setD('fmtEmoji', e.target.checked)} className="h-3.5 w-3.5 accent-[var(--accent)]" />
                                                                                                                        {tA('settingsForm.fmt_emoji')}
                                                                                                                </label>
                                                                                                                <label className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white px-2.5 py-1.5 text-xs cursor-pointer hover:border-[var(--border-strong)]">
                                                                                                                        <input type="checkbox" checked={draft.fmtLinks} onChange={(e) => setD('fmtLinks', e.target.checked)} className="h-3.5 w-3.5 accent-[var(--accent)]" />
                                                                                                                        {tA('settingsForm.fmt_links')}
                                                                                                                </label>
                                                                                                                <label className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white px-2.5 py-1.5 text-xs cursor-pointer hover:border-[var(--border-strong)]">
                                                                                                                        <input type="checkbox" checked={draft.fmtBullets} onChange={(e) => setD('fmtBullets', e.target.checked)} className="h-3.5 w-3.5 accent-[var(--accent)]" />
                                                                                                                        {tA('settingsForm.fmt_bullets')}
                                                                                                                </label>
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
                                                                                                <LayerField n={6} label={t('layerQA')}>
                                                                                                        <textarea
                                                                                                                value={draft.qaPairsText}
                                                                                                                onChange={(e) => setD('qaPairsText', e.target.value)}
                                                                                                                rows={4}
                                                                                                                placeholder={locale === 'fa' ? 'سؤال نمونه مشتری|پاسخ ایده‌آل ایجنت\nهر خط یک نمونه' : 'Customer question|Ideal agent answer\nOne pair per line'}
                                                                                                                className="input resize-none text-sm"
                                                                                                        />
                                                                                                        <p className="mt-1.5 text-[10px] text-[var(--text-muted)]">
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

                                        {step === 2 && (
                                                <>
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
                                                                                <span>{locale === 'fa' ? 'تحویل به اپراتور فعال باشد' : 'Enable human handoff'}</span>
                                                                                <input type="checkbox" checked={form.handoffEnabled} onChange={(e) => set('handoffEnabled', e.target.checked)} className="h-4 w-4 accent-violet-500" />
                                                                        </label>
                                                                        {form.handoffEnabled && (
                                                                                <div className="mt-3 space-y-3">
                                                                                        <Field label={locale === 'fa' ? 'پیام تحویل' : 'Handoff message'}><input value={form.handoffMessage} onChange={(e) => set('handoffMessage', e.target.value)} className="input" /></Field>
                                                                                        <Field label={locale === 'fa' ? 'کلمات تحویل' : 'Handoff keywords'}><input value={form.handoffKeywords} onChange={(e) => set('handoffKeywords', e.target.value)} className="input" /><p className="mt-1 text-[10px] text-[var(--text-muted)]">{locale === 'fa' ? 'با ویرگول جدا کنید؛ مثل اپراتور، شکایت، پرداخت ناموفق' : 'Comma-separated; e.g. operator, complaint, payment failed'}</p></Field>
                                                                                </div>
                                                                        )}
                                                                        <label className="mt-3 flex min-h-11 items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                                                                                <span>{locale === 'fa' ? 'برای پیگیری، اطلاعات مشتری گرفته شود' : 'Collect customer details for follow-up'}</span>
                                                                                <input type="checkbox" checked={form.requireCustomerInfo} onChange={(e) => set('requireCustomerInfo', e.target.checked)} className="h-4 w-4 accent-violet-500" />
                                                                        </label>
                                                                        {form.requireCustomerInfo && <div className="mt-3"><Field label={locale === 'fa' ? 'نحوه درخواست اطلاعات' : 'Information request policy'}><textarea value={form.customerInfoPrompt} onChange={(e) => set('customerInfoPrompt', e.target.value)} rows={3} className="input resize-none" /></Field></div>}
                                                                </section>

                                                                <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-4">
                                                                        <div className="mb-4 flex items-start gap-2">
                                                                                <DatabaseZap className="mt-0.5 h-4 w-4 text-sky-500" />
                                                                                <div>
                                                                                        <h3 className="text-sm font-medium text-[var(--text-primary)]">{locale === 'fa' ? 'آمادگی RAG و دانش' : 'RAG & knowledge readiness'}</h3>
                                                                                        <p className="mt-1 text-[11px] leading-5 text-[var(--text-muted)]">{locale === 'fa' ? 'وضعیت واقعی زیرساخت، بدون ادعای قابلیت متصل‌نشده.' : 'Actual infrastructure status, without claiming unconnected sources.'}</p>
                                                                                </div>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                                <ReadinessRow label={locale === 'fa' ? 'بخش‌بندی زمینه‌ای منابع' : 'Contextual source chunking'} state="ready" locale={locale} />
                                                                                <ReadinessRow label={locale === 'fa' ? 'جست‌وجوی برداری + بازرتبه‌بندی تازگی' : 'Vector search + freshness reranking'} state="ready" locale={locale} />
                                                                                <ReadinessRow label={locale === 'fa' ? `کاتالوگ فعال (${workspaceProductCount.toLocaleString('fa-IR')} محصول)` : `Active catalog (${workspaceProductCount} products)`} state={workspaceProductCount > 0 ? 'ready' : 'needs-source'} locale={locale} />
                                                                                <ReadinessRow label={locale === 'fa' ? 'جست‌وجوی hybrid واژه + بردار' : 'Hybrid keyword + vector retrieval'} state="ready" locale={locale} />
                                                                        </div>
                                                                        {vigentoDraft?.knowledgePlan?.length ? (
                                                                                <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
                                                                                        <p className="text-[10px] font-medium text-[var(--text-muted)]">{locale === 'fa' ? 'منابع پیشنهادی ویجنتو' : 'Vigento suggested sources'}</p>
                                                                                        <ul className="mt-2 space-y-1.5">{vigentoDraft.knowledgePlan.map((item) => <li key={`${item.type}-${item.label}`} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]"><CircleDashed className="h-3.5 w-3.5 text-violet-400" />{item.label}</li>)}</ul>
                                                                                </div>
                                                                        ) : null}
                                                                </section>
                                                        </div>
                                                        {vigentoDraft?.channelPolicy && (
                                                                <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-4">
                                                                        <h3 className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]"><Radio className="h-4 w-4 text-violet-400" />{locale === 'fa' ? 'سیاست پیشنهادی کانال‌ها' : 'Recommended channel policy'}</h3>
                                                                        <div className="mt-3 flex flex-wrap gap-2">{vigentoDraft.channelPolicy.recommended.map((channel) => <span key={channel} className="rounded-full border border-[var(--border-default)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)]">{channel}</span>)}</div>
                                                                </section>
                                                        )}
                                                </>
                                        )}

                                        {step === 3 && (
                                                <>
                                                                <Field label={t('model')}>
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
                                                                <Field label={t('language')}>
                                                                        <MaterialSelect
                                                                                value={form.language}
                                                                                onValueChange={(value) => set('language', value as 'fa' | 'en')}
                                                                                ariaLabel={t('language')}
                                                                                options={[{ value: 'fa', label: 'فارسی' }, { value: 'en', label: 'English' }]}
                                                                        />
                                                                </Field>
                                                                <Field label={`${t('temperature')}: ${form.temperature.toFixed(1)}`}>
                                                                        <div className="w-full">
                                                                                {/* Force LTR so the slider fills left→right (increasing = more
                        fill = "more intensity"), matching the numeric label. */}
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
                                                                                        <span>دقیق</span>
                                                                                        <span>خلاقانه</span>
                                                                                </div>
                                                                        </div>
                                                                </Field>
                                                                <Field label={t('maxTokens')}>
                                                                        <input
                                                                                type="number"
                                                                                min={1}
                                                                                max={1200}
                                                                                value={form.maxTokens}
                                                                                onChange={(e) => set('maxTokens', Number(e.target.value))}
                                                                                className="input"
                                                                        />
                                                        </Field>
                                                        <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-4">
                                                                <h3 className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]"><FlaskConical className="h-4 w-4 text-violet-400" />{locale === 'fa' ? 'سناریوهای ارزیابی قبل از انتشار' : 'Pre-publish evaluation scenarios'}</h3>
                                                                {vigentoDraft?.evalCases?.length ? (
                                                                        <div className="mt-3 grid gap-2 sm:grid-cols-2">{vigentoDraft.evalCases.map((item) => <div key={item.input} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3"><div className="flex items-center justify-between gap-2"><span className="line-clamp-1 text-xs text-[var(--text-primary)]">{item.input}</span><span className="rounded-full bg-[var(--bg-hover)] px-2 py-0.5 text-[9px] text-[var(--text-muted)]">{item.risk}</span></div><p className="mt-1 line-clamp-2 text-[10px] leading-5 text-[var(--text-muted)]">{item.expectedBehavior}</p></div>)}</div>
                                                                ) : <p className="mt-2 text-xs leading-6 text-[var(--text-muted)]">{locale === 'fa' ? 'پس از ساخت، در Playground حداقل یک سؤال عادی، یک سؤال خارج از دانش و یک درخواست اپراتور را تست کنید.' : 'After creation, test one normal question, one out-of-knowledge request, and one operator request in the Playground.'}</p>}
                                                        </section>
                                                </>
                                        )}

                                        {step === 4 && (
                                                <ReviewCard
                                                        locale={locale}
                                                        form={form}
                                                        role={selectedRole}
                                                        knowledgeCount={workspaceProductCount}
                                                        evalCount={vigentoDraft?.evalCases.length ?? 0}
                                                />
                                        )}
                                        </motion.div>
                                </AnimatePresence>

                                {error && <p className="mt-4 text-sm text-danger">{tA('emptyDesc')}</p>}

                                <div className="mt-8 flex items-center justify-between">
                                        <button
                                                type="button"
                                                onClick={() => setStep((s) => Math.max(0, s - 1))}
                                                disabled={step === 0}
                                                className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-0"
                                        >
                                                <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                                                {tc('back')}
                                        </button>

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
                                                        {loading ? tA('creating') : tA('create')}
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
                                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-[var(--accent-soft)] text-[10px] font-semibold text-[var(--accent-strong)]">{faNum}</span>
                                {label}
                        </span>
                        {children}
                </label>
        )
}

function ReadinessRow({
        label,
        state,
        locale,
}: {
        label: string
        state: 'ready' | 'needs-source' | 'roadmap'
        locale: 'fa' | 'en'
}) {
        const copy = state === 'ready'
                ? (locale === 'fa' ? 'آماده' : 'Ready')
                : state === 'needs-source'
                        ? (locale === 'fa' ? 'نیازمند منبع' : 'Needs a source')
                        : (locale === 'fa' ? 'در برنامه' : 'Roadmap')
        return (
                <div className="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2">
                        <span className="text-[11px] text-[var(--text-secondary)]">{label}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] ${state === 'ready' ? 'bg-emerald-500/10 text-emerald-500' : state === 'roadmap' ? 'bg-[var(--bg-hover)] text-[var(--text-muted)]' : 'bg-amber-500/10 text-amber-500'}`}>{copy}</span>
                </div>
        )
}

function ReviewCard({
        locale,
        form,
        role,
        knowledgeCount,
        evalCount,
}: {
        locale: 'fa' | 'en'
        form: FormState
        role: RoleTemplate
        knowledgeCount: number
        evalCount: number
}) {
        const isFa = locale === 'fa'
        const checklist = [
                { ok: form.name.trim().length > 0, text: isFa ? 'هدف و نام ایجنت مشخص است' : 'Agent goal and name are defined' },
                { ok: form.handoffEnabled && form.handoffKeywords.trim().length > 0, text: isFa ? 'مسیر تحویل انسانی تنظیم شده' : 'Human handoff path is configured' },
                { ok: knowledgeCount > 0, text: isFa ? 'حداقل یک منبع کاتالوگ در دسترس است' : 'At least one catalog source is available' },
                { ok: evalCount >= 3, text: isFa ? 'سناریوهای تست عادی، مرزی و تحویل آماده‌اند' : 'Normal, boundary, and handoff evals are ready' },
        ]
        return (
                <div className="space-y-4">
                        <div className="flex items-start gap-3 rounded-xl border border-violet-500/20 bg-violet-500/[0.06] p-4">
                                <Eye className="mt-0.5 h-5 w-5 shrink-0 text-violet-400" />
                                <div><h3 className="text-sm font-semibold text-[var(--text-primary)]">{isFa ? 'آخرین بازبینی پیش از انتشار' : 'Final review before publish'}</h3><p className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">{isFa ? 'ساخت ایجنت تنها با دکمه نهایی انجام می‌شود. منابع و کانال‌ها بعد از ساخت قابل اتصال‌اند.' : 'The agent is created only by the final button. Sources and channels can be connected afterward.'}</p></div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-4">
                                        <p className="text-[10px] text-[var(--text-muted)]">{isFa ? 'ایجنت' : 'Agent'}</p>
                                        <p className="mt-1 text-base font-medium text-[var(--text-primary)]">{form.name || '—'}</p>
                                        <p className="mt-2 text-xs leading-6 text-[var(--text-secondary)]">{form.description || (isFa ? 'بدون توضیح' : 'No description')}</p>
                                </div>
                                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-4">
                                        <p className="text-[10px] text-[var(--text-muted)]">{isFa ? 'پیکربندی' : 'Configuration'}</p>
                                        <dl className="mt-2 space-y-2 text-xs"><div className="flex justify-between gap-3"><dt className="text-[var(--text-muted)]">{isFa ? 'نقش' : 'Role'}</dt><dd className="text-[var(--text-primary)]">{isFa ? role.nameFa : role.nameEn}</dd></div><div className="flex justify-between gap-3"><dt className="text-[var(--text-muted)]">{isFa ? 'مدل' : 'Model'}</dt><dd className="text-[var(--text-primary)]">{form.model || (isFa ? 'پیش‌فرض امن' : 'Safe default')}</dd></div><div className="flex justify-between gap-3"><dt className="text-[var(--text-muted)]">{isFa ? 'تحویل اپراتور' : 'Handoff'}</dt><dd className="text-[var(--text-primary)]">{form.handoffEnabled ? (isFa ? 'فعال' : 'Enabled') : (isFa ? 'خاموش' : 'Off')}</dd></div></dl>
                                </div>
                        </div>
                        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-4">
                                <p className="text-xs font-medium text-[var(--text-primary)]">{isFa ? 'چک‌لیست آمادگی' : 'Readiness checklist'}</p>
                                <div className="mt-3 grid gap-2 sm:grid-cols-2">{checklist.map((item) => <div key={item.text} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">{item.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <CircleDashed className="h-4 w-4 shrink-0 text-amber-500" />}{item.text}</div>)}</div>
                        </div>
                </div>
        )
}
