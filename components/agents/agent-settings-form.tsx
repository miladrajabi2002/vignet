'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2, Check, Trash2 } from 'lucide-react'

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
    active: agent.active,
  })
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  async function save() {
    setStatus('saving')
    const res = await fetch(`/api/agents/${agent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
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
          <textarea
            value={form.systemPrompt}
            onChange={(e) => set('systemPrompt', e.target.value)}
            rows={5}
            className="input resize-none font-mono text-sm"
          />
        </Field>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label={tw('model')}>
            <input dir="ltr" value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="deepseek/deepseek-chat" className="input font-mono text-sm" />
          </Field>
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
        <Toggle label={t('active')} checked={form.active} onChange={(v) => set('active', v)} />

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={save}
            disabled={status === 'saving'}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2 text-sm font-medium text-black transition-transform hover:scale-[1.02] disabled:opacity-50"
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
      <span className={`relative h-6 w-11 rounded-full border transition-colors ${checked ? 'border-white/30 bg-white/20' : 'border-[var(--border-default)] bg-[var(--bg-muted)]'}`}>
        <span className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white transition-all ${checked ? 'start-6' : 'start-1'}`} />
      </span>
    </button>
  )
}
