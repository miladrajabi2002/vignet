'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronUp, Loader2, Check, Trash2 } from 'lucide-react'
import { ModelSelect } from '@/components/agent-builder/model-select'

const PROMPT_TEMPLATES = {
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

type TemplateKey = keyof typeof PROMPT_TEMPLATES

interface BizVars { name: string; phone: string; hours: string }

function applyBizVars(text: string, vars: BizVars): string {
  return text
    .replace(/\{\{business\}\}/g, vars.name || '{{business}}')
    .replace(/\{\{phone\}\}/g, vars.phone || '{{phone}}')
    .replace(/\{\{hours\}\}/g, vars.hours || '{{hours}}')
}

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
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [previewKey, setPreviewKey] = useState<TemplateKey | null>(null)
  const [bizVars, setBizVars] = useState<BizVars>({ name: '', phone: '', hours: '' })

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const setBiz = (k: keyof BizVars, v: string) =>
    setBizVars((b) => ({ ...b, [k]: v }))

  function selectTemplate(key: TemplateKey) {
    set('systemPrompt', applyBizVars(PROMPT_TEMPLATES[key], bizVars))
    setPreviewKey(null)
  }

  async function save() {
    setStatus('saving')
    const keywords = form.handoffKeywords
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
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

  return (
    <div className="space-y-6">
      <div className="space-y-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
        <Field label={tw('name')}>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} className="input" />
        </Field>
        <Field label={tw('description')}>
          <input value={form.description} onChange={(e) => set('description', e.target.value)} className="input" />
        </Field>

        <Field label={tw('systemPrompt')}>
          {/* Business vars */}
          <div className="mb-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-muted)] p-3">
            <p className="mb-2 text-xs text-[var(--text-muted)]">{tw('bizVarsLabel')}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input value={bizVars.name} onChange={(e) => setBiz('name', e.target.value)} placeholder={tw('bizName')} className="input text-xs" />
              <input value={bizVars.phone} onChange={(e) => setBiz('phone', e.target.value)} placeholder={tw('bizPhone')} className="input text-xs" />
              <input value={bizVars.hours} onChange={(e) => setBiz('hours', e.target.value)} placeholder={tw('bizHours')} className="input text-xs" />
            </div>
          </div>
          {/* Template picker */}
          <div className="mb-2">
            <p className="mb-2 text-xs text-[var(--text-muted)]">{tw('templateLabel')}</p>
            <div className="flex flex-wrap gap-2">
              {(['shop', 'support', 'restaurant', 'general'] as TemplateKey[]).map((key) => (
                <div key={key} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => selectTemplate(key)}
                    className="rounded-md border border-[var(--border-default)] px-2 py-0.5 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
                  >
                    {tw(`template${key.charAt(0).toUpperCase() + key.slice(1)}` as Parameters<typeof tw>[0])}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewKey(previewKey === key ? null : key)}
                    className="rounded p-0.5 text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
                  >
                    {previewKey === key ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                </div>
              ))}
            </div>
            {previewKey && (
              <div className="mt-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-muted)] p-3">
                <pre className="whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                  {applyBizVars(PROMPT_TEMPLATES[previewKey], bizVars)}
                </pre>
              </div>
            )}
          </div>
          <textarea
            value={form.systemPrompt}
            onChange={(e) => set('systemPrompt', e.target.value)}
            rows={7}
            className="input resize-none font-mono text-sm"
          />
        </Field>

        <Field label={tw('model')}>
          <ModelSelect value={form.model} onChange={(v) => set('model', v)} />
        </Field>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label={tw('language')}>
            <select value={form.language} onChange={(e) => set('language', e.target.value as 'fa' | 'en')} className="input">
              <option value="fa">فارسی</option>
              <option value="en">English</option>
            </select>
          </Field>
          <Field label={`${tw('temperature')}: ${form.temperature.toFixed(1)}`}>
            <input type="range" min={0} max={2} step={0.1} value={form.temperature} onChange={(e) => set('temperature', Number(e.target.value))} className="w-full accent-white" />
          </Field>
          <Field label={tw('maxTokens')}>
            <input type="number" min={1} max={8000} value={form.maxTokens} onChange={(e) => set('maxTokens', Number(e.target.value))} className="input" />
          </Field>
        </div>
        <Field label={tw('welcomeMessage')}>
          <input value={form.welcomeMessage} onChange={(e) => set('welcomeMessage', e.target.value)} className="input" />
        </Field>
        <Field label={tw('fallbackMessage')}>
          <input value={form.fallbackMessage} onChange={(e) => set('fallbackMessage', e.target.value)} className="input" />
        </Field>

        <Toggle label={tf('handoffEnabled')} checked={form.handoffEnabled} onChange={(v) => set('handoffEnabled', v)} />
        {form.handoffEnabled && (
          <Field label={tf('handoffKeywords')}>
            <input
              value={form.handoffKeywords}
              onChange={(e) => set('handoffKeywords', e.target.value)}
              placeholder={tf('handoffKeywordsPlaceholder')}
              className="input text-sm"
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">{tf('handoffKeywordsHint')}</p>
          </Field>
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
        <button onClick={remove} className="inline-flex items-center gap-2 text-sm text-danger transition-opacity hover:opacity-80">
          <Trash2 className="h-4 w-4" />
          {tf('delete')}
        </button>
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

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between">
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      <span className={`relative h-6 w-11 rounded-full border transition-colors ${checked ? 'border-[rgba(var(--ink-rgb),0.3)] bg-[rgba(var(--ink-rgb),0.2)]' : 'border-[var(--border-default)] bg-[var(--bg-muted)]'}`}>
        <span className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-[var(--white)] transition-all ${checked ? 'start-6' : 'start-1'}`} />
      </span>
    </button>
  )
}
