'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Loader2, RotateCcw, Save, Trash2 } from 'lucide-react'

interface VersionItem {
  id: string
  label: string
  note: string | null
  promptConfig: unknown | null
  roleTemplate: string | null
  model: string | null
  createdAt: string
}

export function AgentVersions({ agentId }: { agentId: string }) {
  const t = useTranslations('versions')
  const [versions, setVersions] = useState<VersionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [restoredId, setRestoredId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/agents/${agentId}/versions`, { cache: 'no-store' })
      if (response.ok) setVersions((await response.json()).items ?? [])
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    void load()
  }, [load])

  async function saveVersion() {
    setSaving(true)
    try {
      const response = await fetch(`/api/agents/${agentId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (response.ok) await load()
    } finally {
      setSaving(false)
    }
  }

  async function restore(id: string) {
    setRestoringId(id)
    setRestoredId(null)
    try {
      const response = await fetch(`/api/agents/${agentId}/versions/${id}`, { method: 'POST' })
      if (response.ok) {
        setRestoredId(id)
        window.location.reload()
      }
    } finally {
      setRestoringId(null)
    }
  }

  async function remove(id: string) {
    const response = await fetch(`/api/agents/${agentId}/versions/${id}`, { method: 'DELETE' })
    if (response.ok) setVersions((current) => current.filter((version) => version.id !== id))
  }

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-[var(--text-primary)]">{t('title')}</h2>
        <button
          type="button"
          onClick={saveVersion}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t('save')}
        </button>
      </div>
      <p className="text-xs text-[var(--text-secondary)]">{t('hint')}</p>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" />
        </div>
      ) : versions.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--text-muted)]">{t('empty')}</p>
      ) : (
        <ul className="divide-y divide-[var(--border-subtle)]">
          {versions.map((version) => (
            <li key={version.id} className="flex items-center gap-2 py-2.5">
              <span className="text-sm text-[var(--text-primary)]">{version.label}</span>
              {version.note && <span className="text-xs text-[var(--text-muted)]">· {version.note}</span>}
              <div className="ms-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => restore(version.id)}
                  disabled={restoringId === version.id}
                  title={t('restore')}
                  className="rounded-lg p-1.5 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-50"
                >
                  {restoringId === version.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : restoredId === version.id ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => remove(version.id)}
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
  )
}
