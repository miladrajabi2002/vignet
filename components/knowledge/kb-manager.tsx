'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  FileText,
  Link2,
  Upload,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type KbStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'ERROR'

export interface KbItem {
  id: string
  name: string
  type: string
  status: KbStatus
  chunkCount: number
  errorMsg: string | null
  /** F4: when the KB was last re-crawled (URL type only). Prisma returns Date. */
  lastIngestedAt?: Date | string | null
  /** F4: refresh cadence in hours (0 = manual only). */
  refreshIntervalHours?: number
}

type Mode = 'text' | 'url' | 'file'

export function KbManager({
  agentId,
  items,
}: {
  agentId: string
  items: KbItem[]
}) {
  const t = useTranslations('knowledge')
  const router = useRouter()

  const [mode, setMode] = useState<Mode>('text')
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [url, setUrl] = useState('')
  const [refreshHours, setRefreshHours] = useState<number>(24)
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Auto-refresh while any item is still processing.
  const pending = items.some(
    (i) => i.status === 'PENDING' || i.status === 'PROCESSING',
  )
  useEffect(() => {
    if (!pending) return
    const id = setInterval(() => router.refresh(), 3000)
    return () => clearInterval(id)
  }, [pending, router])

  async function submit() {
    setError(null)
    setSubmitting(true)
    try {
      let res: Response
      if (mode === 'file') {
        if (!file) return
        const fd = new FormData()
        fd.append('file', file)
        fd.append('name', name || file.name)
        res = await fetch(`/api/agents/${agentId}/knowledge`, {
          method: 'POST',
          body: fd,
        })
      } else {
        res = await fetch(`/api/agents/${agentId}/knowledge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            mode === 'url'
              ? { name: name || url, mode: 'url', url, refreshIntervalHours: refreshHours }
              : { name: name || 'دانش', mode: 'text', content },
          ),
        })
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(
          data.error === 'STORAGE_NOT_CONFIGURED'
            ? t('storageNotConfigured')
            : t('add'),
        )
        return
      }
      setName('')
      setContent('')
      setUrl('')
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      router.refresh()
    } catch {
      setError(t('add'))
    } finally {
      setSubmitting(false)
    }
  }

  async function remove(id: string) {
    await fetch(`/api/agents/${agentId}/knowledge/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  const tabs: { key: Mode; label: string; icon: typeof FileText }[] = [
    { key: 'text', label: t('tabText'), icon: FileText },
    { key: 'url', label: t('tabUrl'), icon: Link2 },
    { key: 'file', label: t('tabFile'), icon: Upload },
  ]

  const canSubmit =
    !submitting &&
    (mode === 'text' ? content.trim() : mode === 'url' ? url.trim() : !!file)

  return (
    <div className="space-y-6">
      {/* ── Add form ──────────────────────────────────────────────────── */}
      <div className="spatial-surface rounded-[1.5rem] p-5 sm:p-6">
        {/* Tabs: text / url / file — pill style with active fill */}
        <div className="mb-5 flex gap-1.5 rounded-xl bg-[var(--bg-muted)] p-1">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={cn(
                'inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                mode === key
                  ? 'bg-[var(--bg-base)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Name field — always shown */}
        <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
          {t('namePlaceholder')}
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('namePlaceholder')}
          className="input mb-4"
        />

        {mode === 'text' && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
              {t('contentPlaceholder')}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('contentPlaceholder')}
              rows={5}
              className="input resize-none"
            />
          </div>
        )}
        {mode === 'url' && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                {t('urlPlaceholder')}
              </label>
              <input
                dir="ltr"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t('urlPlaceholder')}
                className="input font-mono text-sm"
              />
            </div>
            {/* Refresh interval — inset card */}
            <div className="spatial-inset rounded-xl p-4">
              <label className="mb-2 block text-xs font-medium text-[var(--text-secondary)]">
                {t('refreshIntervalLabel')}
              </label>
              <div className="flex flex-wrap gap-2">
                {[0, 6, 12, 24, 72, 168].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setRefreshHours(h)}
                    className={cn(
                      'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
                      refreshHours === h
                        ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-base)]'
                        : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]',
                    )}
                  >
                    {h === 0
                      ? t('refreshManual')
                      : h < 24
                        ? t('refreshHours', { h })
                        : t('refreshDays', { d: Math.round(h / 24) })}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
                {t('refreshIntervalHint')}
              </p>
            </div>
          </div>
        )}
        {mode === 'file' && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
              {t('tabFile')}
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-[var(--text-secondary)] file:me-3 file:rounded-lg file:border file:border-[var(--border-default)] file:bg-[var(--bg-base)] file:px-3 file:py-1.5 file:text-[var(--text-primary)]"
            />
            <p className="mt-2 text-xs text-[var(--text-muted)]">{t('fileHint')}</p>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={!canSubmit}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--text-primary)] px-5 py-2.5 text-sm font-medium text-[var(--bg-base)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? t('adding') : t('add')}
        </button>
      </div>

      {/* ── Added items list ──────────────────────────────────────────── */}
      {items.length === 0 ? (
        <div className="spatial-surface rounded-[1.5rem] p-8 text-center">
          <FileText className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
          <p className="mt-3 text-sm text-[var(--text-muted)]">{t('empty')}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <div
              key={item.id}
              className="spatial-inset flex items-center gap-3 rounded-2xl p-4 transition-colors hover:border-[var(--border-hover)]"
            >
              <StatusIcon status={item.status} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-[var(--text-primary)]">
                  {item.name}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--text-muted)]">
                  <span className="rounded-md bg-[var(--bg-base)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide">
                    {item.type}
                  </span>
                  <span>{t(`status.${item.status}`)}</span>
                  {item.status === 'READY' && (
                    <span>· {t('chunks', { count: item.chunkCount })}</span>
                  )}
                  {item.status === 'ERROR' && item.errorMsg && (
                    <span className="text-danger">· {item.errorMsg}</span>
                  )}
                </div>
                {item.type === 'URL' && item.lastIngestedAt && (
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                    <Clock className="h-3 w-3" />
                    {t('lastRefreshed', {
                      when: new Date(item.lastIngestedAt).toLocaleString('fa-IR'),
                    })}
                    {item.refreshIntervalHours && item.refreshIntervalHours > 0
                      ? ` · ${t('refreshEvery', { h: item.refreshIntervalHours })}`
                      : ''}
                  </div>
                )}
                {item.type === 'URL' &&
                  item.refreshIntervalHours &&
                  item.refreshIntervalHours > 0 &&
                  !item.lastIngestedAt && (
                    <div className="mt-1 text-[11px] text-[var(--amber)]">
                      {t('refreshScheduled')}
                    </div>
                  )}
              </div>
              <button
                onClick={() => remove(item.id)}
                className="shrink-0 rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-danger/10 hover:text-danger"
                aria-label={t('delete')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusIcon({ status }: { status: KbStatus }) {
  if (status === 'READY')
    return <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
  if (status === 'ERROR')
    return <AlertCircle className="h-5 w-5 shrink-0 text-danger" />
  if (status === 'PROCESSING')
    return <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[var(--text-secondary)]" />
  return <Clock className="h-5 w-5 shrink-0 text-[var(--text-muted)]" />
}
