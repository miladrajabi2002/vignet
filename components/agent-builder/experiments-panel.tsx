'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Save, RotateCcw, Trash2, FlaskConical } from 'lucide-react'

interface VariantStat {
  variant: string
  total: number
  rated: number
  avgRating: number | null
  handoff: number
}

interface VersionItem {
  id: string
  label: string
  note: string | null
  model: string | null
  createdAt: string
}

export function ExperimentsPanel({ agentId }: { agentId: string }) {
  const t = useTranslations('experiments')

  const [variantPrompt, setVariantPrompt] = useState('')
  const [split, setSplit] = useState(50)
  const [active, setActive] = useState(false)
  const [stats, setStats] = useState<VariantStat[]>([])
  const [versions, setVersions] = useState<VersionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [savingExp, setSavingExp] = useState(false)
  const [savedExp, setSavedExp] = useState(false)
  const [savingVer, setSavingVer] = useState(false)

  const load = useCallback(async () => {
    try {
      const [expRes, verRes] = await Promise.all([
        fetch(`/api/agents/${agentId}/experiment`, { cache: 'no-store' }),
        fetch(`/api/agents/${agentId}/versions`, { cache: 'no-store' }),
      ])
      if (expRes.ok) {
        const data = await expRes.json()
        setVariantPrompt(data.config.variantPrompt ?? '')
        setSplit(data.config.split ?? 50)
        setActive(data.config.active ?? false)
        setStats(data.stats ?? [])
      }
      if (verRes.ok) setVersions((await verRes.json()).items ?? [])
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    load()
  }, [load])

  async function saveExperiment() {
    setSavingExp(true)
    setSavedExp(false)
    try {
      const res = await fetch(`/api/agents/${agentId}/experiment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantPrompt, split, active }),
      })
      if (res.ok) {
        setSavedExp(true)
        setTimeout(() => setSavedExp(false), 2000)
      }
    } finally {
      setSavingExp(false)
    }
  }

  async function saveVersion() {
    setSavingVer(true)
    try {
      const res = await fetch(`/api/agents/${agentId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) await load()
    } finally {
      setSavingVer(false)
    }
  }

  async function restore(id: string) {
    await fetch(`/api/agents/${agentId}/versions/${id}`, { method: 'POST' }).catch(() => {})
  }

  async function remove(id: string) {
    await fetch(`/api/agents/${agentId}/versions/${id}`, { method: 'DELETE' }).catch(() => {})
    setVersions((prev) => prev.filter((v) => v.id !== id))
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* A/B experiment */}
      <section className="space-y-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-[var(--text-secondary)]" />
          <h2 className="text-sm font-medium text-[var(--text-primary)]">{t('abTitle')}</h2>
        </div>
        <p className="text-xs text-[var(--text-secondary)]">{t('abHint')}</p>

        <label className="block text-xs text-[var(--text-secondary)]">{t('variantPrompt')}</label>
        <textarea
          value={variantPrompt}
          onChange={(e) => setVariantPrompt(e.target.value)}
          rows={5}
          placeholder={t('variantPlaceholder')}
          className="w-full resize-y rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-strong)] focus:outline-none"
        />

        <div className="flex items-center gap-3">
          <label className="text-xs text-[var(--text-secondary)]">{t('split')}</label>
          <input
            type="range"
            min={1}
            max={99}
            value={split}
            onChange={(e) => setSplit(Number(e.target.value))}
            className="flex-1"
          />
          <span className="w-10 text-end text-sm text-[var(--text-primary)]">٪{split}</span>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            {t('enable')}
          </label>
          <button
            onClick={saveExperiment}
            disabled={savingExp}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--white)] px-4 py-1.5 text-sm font-medium text-[var(--bg-base)] disabled:opacity-50"
          >
            {savingExp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {savedExp ? t('saved') : t('save')}
          </button>
        </div>
      </section>

      {/* Comparison */}
      <section className="space-y-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
        <h2 className="text-sm font-medium text-[var(--text-primary)]">{t('comparison')}</h2>
        <div className="grid grid-cols-2 gap-3">
          {(['A', 'B'] as const).map((v) => {
            const s = stats.find((x) => x.variant === v)
            return (
              <div key={v} className="rounded-xl border border-[var(--border-default)] p-3">
                <p className="text-xs font-medium text-[var(--text-secondary)]">
                  {v === 'A' ? t('variantA') : t('variantB')}
                </p>
                <p className="mt-2 text-2xl font-light text-[var(--text-primary)]">
                  {(s?.total ?? 0).toLocaleString('fa-IR')}
                  <span className="ms-1 text-xs text-[var(--text-muted)]">{t('conversations')}</span>
                </p>
                <div className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
                  <div className="flex justify-between">
                    <span>{t('avgRating')}</span>
                    <span>{s?.avgRating != null ? s.avgRating.toFixed(1) : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('handoff')}</span>
                    <span>{(s?.handoff ?? 0).toLocaleString('fa-IR')}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Versions */}
      <section className="space-y-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-[var(--text-primary)]">{t('versionsTitle')}</h2>
          <button
            onClick={saveVersion}
            disabled={savingVer}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            {savingVer ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t('saveVersion')}
          </button>
        </div>
        <p className="text-xs text-[var(--text-secondary)]">{t('versionsHint')}</p>

        {versions.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--text-muted)]">{t('noVersions')}</p>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {versions.map((v) => (
              <li key={v.id} className="flex items-center gap-2 py-2.5">
                <span className="text-sm text-[var(--text-primary)]">{v.label}</span>
                {v.note && <span className="text-xs text-[var(--text-muted)]">· {v.note}</span>}
                <div className="ms-auto flex items-center gap-1">
                  <button
                    onClick={() => restore(v.id)}
                    title={t('restore')}
                    className="rounded-lg p-1.5 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => remove(v.id)}
                    title={t('delete')}
                    className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
