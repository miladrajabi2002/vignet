'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Package, BookOpen, Zap } from 'lucide-react'
import { ModelSelect } from './model-select'

const TOTAL = 3
const VARIABLES = ['{{name}}', '{{business}}', '{{phone}}', '{{product}}']

const PROMPT_TEMPLATES = {
  shop: `تو دستیار فروش این کسب‌وکار هستی. شخصیتت: صمیمی، کوتاه‌گو، حرفه‌ای — مثل یک فروشنده خوب، نه ربات.

قوانین پاسخ‌دهی:
• پاسخ‌ها زیر ۴۰ کلمه باشن مگر توضیح بیشتری لازم باشه
• قبل از گفتن هر قیمتی، اول کاتالوگ محصولات رو چک کن
• اگه محصولی در لیست ما نبود، بگو: "این محصول الان در لیست ما نیست"
• موجودی رو صادقانه اعلام کن
• اگه نتونستی کمک کنی، بگو: "برای کمک بیشتر با تیم ما تماس بگیرید"`,
  support: `تو متخصص پشتیبانی این کسب‌وکار هستی. شخصیتت: صبور، همدل، راه‌حل‌محور.

قوانین پاسخ‌دهی:
• اول مشکل مشتری رو کامل بفهم، بعد جواب بده
• راه‌حل‌های عملی و ساده بده، گام‌به‌گام
• اگه مشکل پیچیده بود، بگو: "این موضوع نیاز به بررسی تیم ما داره"
• هرگز اطلاعات شخصی مشتری رو نخواه مگر ضروری باشه
• صادق باش — اگه جواب نداری بگو، حدس نزن`,
  restaurant: `تو دستیار این رستوران هستی. شخصیتت: گرم، دوستانه، مهمان‌نواز.

قوانین پاسخ‌دهی:
• قیمت و منو رو دقیقاً از کاتالوگ بگو، حدس نزن
• غذاهای پرطرفدار رو با اشتیاق معرفی کن
• برای رزرو یا سفارش، اطلاعات تماس یا لینک بده
• اگه سوالی داشتی که جوابش رو نمی‌دونی، بگو: "برای اطلاعات بیشتر تماس بگیرید"`,
  general: `تو دستیار هوشمند این کسب‌وکار هستی. شخصیتت: مودب، مختصر، مفید.

قوانین پاسخ‌دهی:
• پاسخ‌ها کوتاه و دقیق باشن
• اگه اطلاعاتی نداری، صادقانه بگو به‌جای حدس زدن
• مشتری رو به بخش مناسب هدایت کن`,
} as const

type TemplateKey = keyof typeof PROMPT_TEMPLATES

interface FormState {
  name: string
  description: string
  systemPrompt: string
  welcomeMessage: string
  fallbackMessage: string
  model: string
  language: 'fa' | 'en'
  temperature: number
  maxTokens: number
}

interface CreatedAgent {
  id: string
  name: string
  catalogCount: number
}

export function AgentWizard() {
  const t = useTranslations('agents.wizard')
  const tA = useTranslations('agents')
  const tc = useTranslations('common')
  const router = useRouter()

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [created, setCreated] = useState<CreatedAgent | null>(null)
  const [form, setForm] = useState<FormState>({
    name: '',
    description: '',
    systemPrompt: PROMPT_TEMPLATES.general,
    welcomeMessage: '',
    fallbackMessage: '',
    model: '',
    language: 'fa',
    temperature: 0.7,
    maxTokens: 1000,
  })

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

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
          systemPrompt: form.systemPrompt || undefined,
          welcomeMessage: form.welcomeMessage || undefined,
          fallbackMessage: form.fallbackMessage || undefined,
          model: form.model || undefined,
          language: form.language,
          temperature: form.temperature,
          maxTokens: form.maxTokens,
        }),
      })
      if (!res.ok) {
        setError(true)
        setLoading(false)
        return
      }
      const data = await res.json()
      setCreated({ id: data.agent.id, name: data.agent.name, catalogCount: data.catalogCount ?? 0 })
    } catch {
      setError(true)
      setLoading(false)
    }
  }

  const stepTitles = [t('basics'), t('persona'), t('config')]

  if (created) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-success" />
            <div>
              <h2 className="text-xl font-medium text-[var(--text-primary)]">{t('successTitle')}</h2>
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
                <p className="text-sm text-[var(--text-secondary)]">{t('successKnowledge')}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => router.push(`/agents/${created.id}`)}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2 text-sm font-medium text-black transition-transform hover:scale-[1.02]"
              >
                <Zap className="h-4 w-4" />
                {t('goToAgent')}
              </button>
              <button
                onClick={() => router.push('/products')}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] px-5 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
              >
                <Package className="h-4 w-4" />
                {t('addProducts')}
              </button>
              <button
                onClick={() => router.push(`/agents/${created.id}/knowledge`)}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] px-5 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
              >
                <BookOpen className="h-4 w-4" />
                {t('addKnowledge')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-2 text-sm text-[var(--text-secondary)]">
        {t('step', { n: step + 1, total: TOTAL })} — {stepTitles[step]}
      </div>
      <div className="mb-8 h-1 overflow-hidden rounded-full bg-[var(--white-05)]">
        <div
          className="h-full bg-white transition-all duration-500"
          style={{ width: `${((step + 1) / TOTAL) * 100}%` }}
        />
      </div>

      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
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
                <Field label={t('systemPrompt')}>
                  {/* Template quick-start */}
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-[var(--text-muted)]">{t('templateLabel')}</span>
                    {(['shop', 'support', 'restaurant', 'general'] as TemplateKey[]).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => set('systemPrompt', PROMPT_TEMPLATES[key])}
                        className="rounded-md border border-[var(--border-default)] px-2 py-0.5 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
                      >
                        {t(`template${key.charAt(0).toUpperCase() + key.slice(1)}` as Parameters<typeof t>[0])}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={form.systemPrompt}
                    onChange={(e) => set('systemPrompt', e.target.value)}
                    rows={7}
                    className="input resize-none font-mono text-sm"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-[var(--text-muted)]">
                      {t('systemPromptHint')}
                    </span>
                    {VARIABLES.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => set('systemPrompt', form.systemPrompt + ' ' + v)}
                        className="rounded-md border border-[var(--border-default)] px-2 py-0.5 font-mono text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label={t('welcomeMessage')}>
                  <input
                    value={form.welcomeMessage}
                    onChange={(e) => set('welcomeMessage', e.target.value)}
                    placeholder={t('welcomePlaceholder')}
                    className="input"
                  />
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{t('welcomeHint')}</p>
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
                <Field label={t('model')}>
                  <ModelSelect value={form.model} onChange={(v) => set('model', v)} />
                </Field>
                <Field label={t('language')}>
                  <select
                    value={form.language}
                    onChange={(e) => set('language', e.target.value as 'fa' | 'en')}
                    className="input"
                  >
                    <option value="fa">فارسی</option>
                    <option value="en">English</option>
                  </select>
                </Field>
                <Field label={`${t('temperature')}: ${form.temperature.toFixed(1)}`}>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={form.temperature}
                    onChange={(e) => set('temperature', Number(e.target.value))}
                    className="w-full accent-white"
                  />
                </Field>
                <Field label={t('maxTokens')}>
                  <input
                    type="number"
                    min={1}
                    max={8000}
                    value={form.maxTokens}
                    onChange={(e) => set('maxTokens', Number(e.target.value))}
                    className="input"
                  />
                </Field>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {error && (
          <p className="mt-4 text-sm text-danger">{tA('emptyDesc')}</p>
        )}

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
              className="inline-flex items-center gap-1 rounded-xl bg-white px-5 py-2 text-sm font-medium text-black transition-transform hover:scale-[1.02] disabled:opacity-50"
            >
              {tc('next')}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2 text-sm font-medium text-black transition-transform hover:scale-[1.02] disabled:opacity-50"
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
      <span className="mb-2 block text-sm text-[var(--text-secondary)]">
        {label}
      </span>
      {children}
    </label>
  )
}
