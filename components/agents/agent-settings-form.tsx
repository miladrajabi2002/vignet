'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  ChevronDown,
  ChevronUp,
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
import {
  ROLE_TEMPLATES,
  buildLayeredPrompt,
  type PromptConfig,
  type PromptFormatConfig,
  type PromptQAPair,
  type RoleTemplate,
} from '@/lib/ai/prompt-builder'

// ── Legacy free-form templates (kept for the "quick start" chips) ─────────
const LEGACY_PROMPT_TEMPLATES = {
  shop: `تو دستیار فروش {{business}} هستی. شخصیتت: صمیمی، کوتاه‌گو، حرفه‌ای — مثل یک فروشنده خوب، نه ربات.

قوانین پاسخ‌دهی:
• پاسخ‌ها زیر ۴۰ کلمه باشن مگر توضیح بیشتری لازم باشه
• قبل از گفتن هر قیمتی، اول کاتالوگ محصولات رو چک کن
• اگه محصولی در لیست ما نبود، بگو: "این محصول الان در لیست ما نیست"
• موجودی رو صادقانه اعلام کن
• ساعت کاری: {{hours}}
• اگه نتونستی کمک کنی، بگو: "برای کمک بیشتر با ما تماس بگیرید: {{phone}}"`,
  support: `تو متخصص پشتیبانی {{business}} هستی. شخصیتت: صبور، همدل، راه‌حل‌محور.

قوانین پاسخ‌دهی:
• اول مشکل مشتری رو کامل بفهم، بعد جواب بده
• راه‌حل‌های عملی و ساده بده، گام‌به‌گام
• اگه مشکل پیچیده بود، بگو: "این موضوع نیاز به بررسی تیم ما داره — تماس: {{phone}}"
• هرگز اطلاعات شخصی مشتری رو نخواه مگر ضروری باشه
• صادق باش — اگه جواب نداری بگو، حدس نزن`,
  restaurant: `تو دستیار {{business}} هستی. شخصیتت: گرم، دوستانه، مهمان‌نواز.

قوانین پاسخ‌دهی:
• قیمت و منو رو دقیقاً از کاتالوگ بگو، حدس نزن
• غذاهای پرطرفدار رو با اشتیاق معرفی کن
• ساعت کاری: {{hours}} | تماس: {{phone}}
• برای رزرو یا سفارش، اطلاعات تماس یا لینک بده
• اگه سوالی داشتی که جوابش رو نمی‌دونی، بگو: "برای اطلاعات بیشتر تماس بگیرید"`,
  general: `تو دستیار هوشمند {{business}} هستی. شخصیتت: مودب، مختصر، مفید.

قوانین پاسخ‌دهی:
• پاسخ‌ها کوتاه و دقیق باشن
• اگه اطلاعاتی نداری، صادقانه بگو به‌جای حدس زدن
• مشتری رو به بخش مناسب هدایت کن
• راه تماس: {{phone}} | ساعت کاری: {{hours}}`,
} as const

type LegacyKey = keyof typeof LEGACY_PROMPT_TEMPLATES

interface BizVars {
  name: string
  phone: string
  hours: string
}

function applyBizVars(text: string, vars: BizVars): string {
  return text
    .replace(/\{\{business\}\}/g, vars.name || '{{business}}')
    .replace(/\{\{phone\}\}/g, vars.phone || '{{phone}}')
    .replace(/\{\{hours\}\}/g, vars.hours || '{{hours}}')
}

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

export function AgentSettingsForm({ agent }: { agent: AgentSettingsData }) {
  const t = useTranslations('agents')
  const tw = useTranslations('agents.wizard')
  const tf = useTranslations('agents.settingsForm')
  const tc = useTranslations('common')
  const router = useRouter()

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

  const [promptConfig, setPromptConfig] = useState<PromptConfig>(
    agent.promptConfig ?? EMPTY_CONFIG,
  )
  const [activeRole, setActiveRole] = useState<RoleTemplate | null>(() => {
    if (agent.roleTemplate) {
      return ROLE_TEMPLATES.find((r) => r.key === agent.roleTemplate) ?? null
    }
    return null
  })
  const [activeTab, setActiveTab] = useState<LayerTab>('personality')
  const [showPreview, setShowPreview] = useState(false)
  const [showLegacy, setShowLegacy] = useState(false)

  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [bizVars, setBizVars] = useState<BizVars>({ name: '', phone: '', hours: '' })

  // ─ F3: customer identification
  const [requireCustomerInfo, setRequireCustomerInfo] = useState(
    agent.requireCustomerInfo ?? false,
  )
  const [customerInfoPrompt, setCustomerInfoPrompt] = useState(
    agent.customerInfoPrompt ?? '',
  )

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const setBiz = (k: keyof BizVars, v: string) =>
    setBizVars((b) => ({ ...b, [k]: v }))

  function applyRoleTemplate(role: RoleTemplate) {
    setActiveRole(role)
    setPromptConfig({ ...role.config })
  }

  function selectLegacyTemplate(key: LegacyKey) {
    set('systemPrompt', applyBizVars(LEGACY_PROMPT_TEMPLATES[key], bizVars))
    setActiveRole(null)
    setPromptConfig(EMPTY_CONFIG)
  }

  const previewPrompt = useMemo(() => {
    const isFa = form.language !== 'en'
    return buildLayeredPrompt(promptConfig, form.systemPrompt, isFa)
  }, [promptConfig, form.systemPrompt, form.language])

  async function save() {
    setStatus('saving')
    const keywords = form.handoffKeywords
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const hasStructured =
      promptConfig.personality || promptConfig.tone || promptConfig.doSay.length
    const res = await fetch(`/api/agents/${agent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        handoffKeywords: keywords,
        description: form.description || undefined,
        model: form.model || undefined,
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

  async function remove() {
    if (!confirm(tf('deleteConfirm'))) return
    const res = await fetch(`/api/agents/${agent.id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/agents')
      router.refresh()
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
      <div className="space-y-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
        <Field label={tw('name')}>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} className="input" />
        </Field>
        <Field label={tw('description')}>
          <input
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            className="input"
          />
        </Field>

        <Field label={tw('model')}>
          <ModelSelect value={form.model} onChange={(v) => set('model', v)} />
        </Field>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label={tw('language')}>
            <select
              value={form.language}
              onChange={(e) => set('language', e.target.value as 'fa' | 'en')}
              className="input"
            >
              <option value="fa">فارسی</option>
              <option value="en">English</option>
            </select>
          </Field>
          <Field label={`${tw('temperature')}: ${form.temperature.toFixed(1)}`}>
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
      <div className="space-y-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
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
          <p className="mb-2 text-xs text-[var(--text-muted)]">{tf('roleTemplateLabel')}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ROLE_TEMPLATES.map((role) => {
              const selected = activeRole?.key === role.key
              return (
                <button
                  key={role.key}
                  type="button"
                  onClick={() => applyRoleTemplate(role)}
                  className={`rounded-xl border p-3 text-start transition-colors ${
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
              )
            })}
          </div>
          {activeRole && (
            <button
              type="button"
              onClick={() => {
                setActiveRole(null)
                setPromptConfig(EMPTY_CONFIG)
              }}
              className="mt-2 text-xs text-[var(--text-muted)] transition-colors hover:text-danger"
            >
              {tf('clearRole')}
            </button>
          )}
        </div>

        {/* Legacy free-form templates (collapsible) */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-muted)] p-3">
          <button
            type="button"
            onClick={() => setShowLegacy((v) => !v)}
            className="flex w-full items-center justify-between text-xs text-[var(--text-secondary)]"
          >
            <span>{tf('legacyTemplatesHint')}</span>
            {showLegacy ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          {showLegacy && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <input
                  value={bizVars.name}
                  onChange={(e) => setBiz('name', e.target.value)}
                  placeholder={tf('bizName')}
                  className="input text-xs"
                />
                <input
                  value={bizVars.phone}
                  onChange={(e) => setBiz('phone', e.target.value)}
                  placeholder={tf('bizPhone')}
                  className="input text-xs"
                />
                <input
                  value={bizVars.hours}
                  onChange={(e) => setBiz('hours', e.target.value)}
                  placeholder={tf('bizHours')}
                  className="input text-xs"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {(['shop', 'support', 'restaurant', 'general'] as LegacyKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectLegacyTemplate(key)}
                    className="rounded-md border border-[var(--border-default)] px-2 py-0.5 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
                  >
                    {tw(
                      `template${
                        key.charAt(0).toUpperCase() + key.slice(1)
                      }` as Parameters<typeof tw>[0],
                    )}
                  </button>
                ))}
              </div>
              <Field label={tw('systemPrompt')}>
                <textarea
                  value={form.systemPrompt}
                  onChange={(e) => set('systemPrompt', e.target.value)}
                  rows={5}
                  className="input resize-none font-mono text-sm"
                />
              </Field>
              <p className="text-[11px] text-[var(--text-muted)]">
                {tf('legacyTemplatesNote')}
              </p>
            </div>
          )}
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
      <div className="space-y-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
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
      <div className="space-y-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
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
          </>
        )}
        <Toggle label={t('active')} checked={form.active} onChange={(v) => set('active', v)} />

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

      <div className="rounded-2xl border border-danger/30 bg-[var(--bg-surface)] p-6">
        <button
          onClick={remove}
          className="inline-flex items-center gap-2 text-sm text-danger transition-opacity hover:opacity-80"
        >
          <Trash2 className="h-4 w-4" />
          {tf('delete')}
        </button>
      </div>
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
  config: PromptConfig
  onChange: (c: PromptConfig) => void
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
          placeholder={isFa ? 'مثلاً: تو یک مشاور فروش صبور و حرفه‌ای هستی...' : 'e.g. You are a patient, professional sales consultant...'}
          className="input resize-none text-sm"
        />
        <p className="mt-1 text-xs text-[var(--text-muted)]">{t('personalityHint')}</p>
      </Field>
    )
  }

  if (tab === 'tone') {
    return (
      <Field label={t('toneLabel')}>
        <textarea
          value={config.tone}
          onChange={(e) => onChange({ ...config, tone: e.target.value })}
          rows={5}
          placeholder={isFa ? 'مثلاً: لحن گرم و صمیمی، از کلمات محترمانه «شما»...' : 'e.g. Warm and friendly tone, use polite "you"...'}
          className="input resize-none text-sm"
        />
        <p className="mt-1 text-xs text-[var(--text-muted)]">{t('toneHint')}</p>
      </Field>
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
          placeholder={isFa ? 'مثلاً: اول نیاز مشتری را بپرس' : 'e.g. Ask the customer need first'}
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
              <span className={positive ? 'text-success' : 'text-danger'}>{positive ? '✓' : '✕'}</span>
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
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      <span
        className={`relative h-6 w-11 rounded-full border transition-colors ${
          checked
            ? 'border-[rgba(var(--ink-rgb),0.3)] bg-[rgba(var(--ink-rgb),0.2)]'
            : 'border-[var(--border-default)] bg-[var(--bg-muted)]'
        }`}
      >
        <span
          className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-[var(--white)] transition-all ${
            checked ? 'start-6' : 'start-1'
          }`}
        />
      </span>
    </button>
  )
}
