'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2, Check, Trash2, KeyRound } from 'lucide-react'

export function AiKeyForm({ currentHint }: { currentHint: string | null }) {
  const t = useTranslations('settings.aiKeys')
  const router = useRouter()

  const [hint, setHint] = useState(currentHint)
  const [key, setKey] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>(
    'idle',
  )

  async function save() {
    if (!key.trim()) return
    setStatus('loading')
    try {
      const res = await fetch('/api/openrouter/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus('error')
        return
      }
      setHint(data.hint)
      setKey('')
      setStatus('ok')
      router.refresh()
    } catch {
      setStatus('error')
    }
  }

  async function remove() {
    setStatus('loading')
    try {
      await fetch('/api/openrouter/validate', { method: 'DELETE' })
      setHint(null)
      setStatus('idle')
      router.refresh()
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
      <div className="mb-4 flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-[var(--text-secondary)]" />
        <h2 className="text-lg font-medium text-[var(--text-primary)]">
          {t('title')}
        </h2>
      </div>
      <p className="mb-6 text-sm text-[var(--text-secondary)]">
        {t('subtitle')}
      </p>

      {hint && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[var(--text-secondary)]">
              {t('currentKey')}:
            </span>
            <span className="font-mono text-[var(--text-primary)]">{hint}</span>
          </div>
          <button
            onClick={remove}
            disabled={status === 'loading'}
            className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] transition-colors hover:text-danger"
          >
            <Trash2 className="h-4 w-4" />
            {t('remove')}
          </button>
        </div>
      )}

      <label className="mb-2 block text-sm text-[var(--text-secondary)]">
        {t('keyLabel')}
      </label>
      <div className="flex gap-2">
        <input
          dir="ltr"
          type="password"
          value={key}
          onChange={(e) => {
            setKey(e.target.value)
            setStatus('idle')
          }}
          placeholder={t('keyPlaceholder')}
          className="flex-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-2.5 font-mono text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-hint)] focus:border-[var(--border-strong)]"
        />
        <button
          onClick={save}
          disabled={status === 'loading' || !key.trim()}
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-[var(--white)] px-4 py-2.5 text-sm font-medium text-[var(--bg-base)] transition-transform hover:scale-[1.01] disabled:opacity-50"
        >
          {status === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
          {status === 'loading' ? t('validating') : t('validate')}
        </button>
      </div>

      {status === 'ok' && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-success">
          <Check className="h-4 w-4" />
          {t('valid')}
        </p>
      )}
      {status === 'error' && (
        <p className="mt-3 text-sm text-danger">{t('invalid')}</p>
      )}

      <p className="mt-6 border-t border-[var(--border-subtle)] pt-4 text-xs text-[var(--text-muted)]">
        {t('byokNote')}
      </p>
    </div>
  )
}
