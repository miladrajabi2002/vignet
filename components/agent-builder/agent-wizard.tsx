'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Loader2, Package, BookOpen, Zap, Sparkles } from 'lucide-react'
import { ModelSelect } from './model-select'
import { ROLE_TEMPLATES, type RoleTemplate } from '@/lib/ai/prompt-builder'

const TOTAL = 3
const VARIABLES = ['{{name}}', '{{business}}', '{{phone}}', '{{product}}']

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
  const [selectedRole, setSelectedRole] = useState<RoleTemplate | null>(
    ROLE_TEMPLATES.find((r) => r.key === 'general_support') ?? null,
  )
  const [previewRole, setPreviewRole] = useState<RoleTemplate | null>(null)
  const [form, setForm] = useState<FormState>({
    name: '',
    description: '',
    systemPrompt: '',
    welcomeMessage: '',
    fallbackMessage: '',
    model: '',
    language: 'fa',
    temperature: 0.7,
    maxTokens: 1000,
  })

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  function selectRole(role: RoleTemplate) {
    setSelectedRole(role)
    setPreviewRole(null)
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
          roleTemplate: selectedRole?.key,
          promptConfig: selectedRole?.config,
          // Keep the legacy systemPrompt empty — the engine falls back to it
          // only when promptConfig + roleTemplate are both absent.
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
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--white)] px-5 py-2 text-sm font-medium text-[var(--bg-base)] transition-transform hover:scale-[1.02]"
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
          className="h-full bg-[var(--white)] transition-all duration-500"
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
                  {/* Role template picker (6-layer engine) */}
                  <div className="mb-2">
                    <p className="mb-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                      <Sparkles className="h-3.5 w-3.5" />
                      {t('roleTemplateLabel')}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {ROLE_TEMPLATES.map((role) => {
                        const selected = selectedRole?.key === role.key
                        return (
                          <div key={role.key} className="space-y-1">
                            <button
                              type="button"
                              onClick={() => selectRole(role)}
                              className={`w-full rounded-xl border p-3 text-start transition-colors ${
                                selected
                                  ? 'border-[var(--border-strong)] bg-[var(--bg-muted)]'
                                  : 'border-[var(--border-default)] hover:border-[var(--border-hover)]'
                              }`}
                            >
                              <p className="text-sm font-medium text-[var(--text-primary)]">
                                {role.nameFa}
                              </p>
                              <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-muted)]">
                                {role.descFa}
                              </p>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewRole(previewRole?.key === role.key ? null : role)
                              }
                              className="flex items-center gap-1 px-1 text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
                            >
                              {previewRole?.key === role.key ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                              {t('previewTemplate')}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                    {previewRole && (
                      <div className="mt-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-muted)] p-3">
                        <p className="mb-1 text-[11px] font-medium text-[var(--text-secondary)]">
                          {previewRole.nameFa} — پیش‌نمایش پرامپت
                        </p>
                        <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[var(--text-secondary)]">
                          {[
                            `### شخصیت\n${previewRole.config.personality}`,
                            `### لحن\n${previewRole.config.tone}`,
                            previewRole.config.doSay.length
                              ? `### بایدها\n${previewRole.config.doSay.map((s) => `• ${s}`).join('\n')}`
                              : '',
                            previewRole.config.dontSay.length
                              ? `### نبایدها\n${previewRole.config.dontSay.map((s) => `• ${s}`).join('\n')}`
                              : '',
                            `### عدم آگاهی\n${previewRole.config.fallbackBehavior}`,
                          ]
                            .filter(Boolean)
                            .join('\n\n')}
                        </pre>
                      </div>
                    )}
                  </div>
                  <p className="mb-1 text-[11px] text-[var(--text-muted)]">
                    {t('systemPromptHint')}
                  </p>
                  <textarea
                    value={form.systemPrompt}
                    onChange={(e) => set('systemPrompt', e.target.value)}
                    rows={4}
                    placeholder={t('systemPromptPlaceholderLegacy')}
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
      <span className="mb-2 block text-sm text-[var(--text-secondary)]">
        {label}
      </span>
      {children}
    </label>
  )
}
