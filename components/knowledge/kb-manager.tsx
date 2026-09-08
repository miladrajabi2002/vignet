'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import {
  FileText,
  Link2,
  Upload,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Database,
  Pencil,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/format'

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
  /** Editable fields — populated when the user opens the edit panel. */
  sourceUrl?: string | null
  content?: string | null
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
  const locale = useLocale() === 'en' ? 'en' : 'fa'
  const router = useRouter()

  const [mode, setMode] = useState<Mode>('text')
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [url, setUrl] = useState('')
  const [refreshHours, setRefreshHours] = useState<number>(24)
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editRefreshHours, setEditRefreshHours] = useState<number>(24)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
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

  async function startEdit(item: KbItem) {
    setEditingId(item.id)
    setEditName(item.name)
    setEditError(null)
    setEditLoading(true)
    // Fetch full KB row to get sourceUrl/content
    try {
      const res = await fetch(`/api/agents/${agentId}/knowledge/${item.id}`)
      if (!res.ok) throw new Error('failed')
      const data = (await res.json()) as { kb: KbItem & { sourceUrl?: string | null } }
      setEditUrl(data.kb.sourceUrl ?? '')
      setEditRefreshHours(item.refreshIntervalHours ?? 0)
      // TEXT content is NOT stored on the KB row — it's chunked. For editing,
      // we let the user replace the content entirely (not append). Show empty
      // textarea with a hint that this will REPLACE the current content.
      setEditContent('')
    } catch {
      setEditError(t('add'))
    } finally {
      setEditLoading(false)
    }
  }

  function cancelEdit() {
    setEditingId(null)
    setEditName('')
    setEditUrl('')
    setEditContent('')
    setEditError(null)
  }

  async function saveEdit(item: KbItem) {
    setEditError(null)
    setEditLoading(true)
    try {
      const body: Record<string, unknown> = {}
      if (editName.trim() && editName !== item.name) body.name = editName.trim()
      if (item.type === 'URL') {
        if (editUrl.trim() && editUrl !== (item.sourceUrl ?? '')) body.url = editUrl.trim()
        if (editRefreshHours !== (item.refreshIntervalHours ?? 0)) {
          body.refreshIntervalHours = editRefreshHours
        }
      }
      if (item.type === 'TEXT' && editContent.trim()) {
        body.content = editContent
      }
      if (Object.keys(body).length === 0) {
        cancelEdit()
        return
      }
      const res = await fetch(`/api/agents/${agentId}/knowledge/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setEditError(data.error === 'INVALID_URL' ? t('invalidUrl') : t('add'))
        return
      }
      cancelEdit()
      router.refresh()
    } catch {
      setEditError(t('add'))
    } finally {
      setEditLoading(false)
    }
  }

  const tabs: {
    key: Mode
    label: string
    description: string
    icon: typeof FileText
  }[] = [
    {
      key: 'text',
      label: t('tabText'),
      description: t('tabTextDesc'),
      icon: FileText,
    },
    {
      key: 'url',
      label: t('tabUrl'),
      description: t('tabUrlDesc'),
      icon: Link2,
    },
    {
      key: 'file',
      label: t('tabFile'),
      description: t('tabFileDesc'),
      icon: Upload,
    },
  ]

  const canSubmit =
    !submitting &&
    (mode === 'text' ? content.trim() : mode === 'url' ? url.trim() : !!file)

  return (
    <div className="space-y-6">
      {/* ── Add form ──────────────────────────────────────────────────── */}
      <section
        className="spatial-surface overflow-hidden rounded-[1.5rem]"
        aria-labelledby="knowledge-add-title"
      >
        <div className="border-b border-black/[0.05] bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(248,248,250,0.78))] px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[0.9rem] border border-black/[0.06] bg-white text-[var(--text-primary)] shadow-[0_8px_24px_-18px_rgba(0,0,0,0.7)]">
              <Database className="h-[1.1rem] w-[1.1rem]" />
            </span>
            <div>
              <h2
                id="knowledge-add-title"
                className="text-base font-bold tracking-[-0.02em] text-[var(--text-primary)]"
              >
                {t('addSourceTitle')}
              </h2>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                {t('addSourceSubtitle')}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
          <div
            className="grid grid-cols-1 gap-1.5 rounded-[1.35rem] border border-black/[0.06] bg-black/[0.035] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:grid-cols-3"
            role="tablist"
            aria-label={t('tabsAria')}
          >
            {tabs.map(({ key, label, description, icon: Icon }) => {
              const active = mode === key
              return (
                <button
                  key={key}
                  id={`knowledge-tab-${key}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls="knowledge-source-panel"
                  onClick={() => setMode(key)}
                  className={cn(
                    'group flex min-h-[4.5rem] items-center gap-3 rounded-[1.05rem] px-3.5 py-3 text-start transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.985] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70',
                    active
                      ? 'bg-black text-white shadow-[0_12px_28px_-18px_rgba(0,0,0,0.9)]'
                      : 'text-[var(--text-secondary)] hover:bg-white/70 hover:text-[var(--text-primary)]',
                  )}
                >
                  <span
                    className={cn(
                      'grid h-9 w-9 shrink-0 place-items-center rounded-xl border',
                      active
                        ? 'border-white/15 bg-white/10 text-white'
                        : 'border-black/[0.06] bg-white/75 text-[var(--text-secondary)]',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{label}</span>
                    <span
                      className={cn(
                        'mt-0.5 block text-[11px] leading-5',
                        active ? 'text-white/60' : 'text-[var(--text-muted)]',
                      )}
                    >
                      {description}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          <div
            id="knowledge-source-panel"
            role="tabpanel"
            aria-labelledby={`knowledge-tab-${mode}`}
            className="space-y-4"
          >

            {/* Name field — always shown */}
            <div>
              <label
                htmlFor="knowledge-source-name"
                className="mb-1.5 block text-xs font-semibold text-[var(--text-primary)]"
              >
                {t('name')}
              </label>
              <input
                id="knowledge-source-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('namePlaceholder')}
                className="input min-h-11"
              />
            </div>

            {mode === 'text' && (
              <div>
                <label
                  htmlFor="knowledge-text-content"
                  className="mb-1.5 block text-xs font-semibold text-[var(--text-primary)]"
                >
                  {t('content')}
                </label>
                <textarea
                  id="knowledge-text-content"
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
                  <label
                    htmlFor="knowledge-page-url"
                    className="mb-1.5 block text-xs font-semibold text-[var(--text-primary)]"
                  >
                    {t('url')}
                  </label>
                  <input
                    id="knowledge-page-url"
                    dir="ltr"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={t('urlPlaceholder')}
                    className="input min-h-11 font-mono text-sm"
                  />
                </div>
            {/* Refresh interval — inset card */}
                <div className="spatial-inset rounded-2xl p-4">
                  <label className="mb-2 block text-xs font-semibold text-[var(--text-primary)]">
                    {t('refreshIntervalLabel')}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[0, 6, 12, 24, 72, 168].map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setRefreshHours(h)}
                        className={cn(
                          'min-h-11 rounded-xl border px-3 py-2 text-xs font-medium transition-[border-color,background-color,color,transform] duration-150 active:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60',
                          refreshHours === h
                            ? 'border-black bg-black text-white'
                            : 'border-[var(--border-default)] bg-white/70 text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]',
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
                <label
                  htmlFor="knowledge-file"
                  className="mb-1.5 block text-xs font-semibold text-[var(--text-primary)]"
                >
                  {t('tabFile')}
                </label>
                <div className="rounded-2xl border border-dashed border-black/[0.12] bg-black/[0.018] p-4 transition-colors focus-within:border-black/30 focus-within:bg-white">
                  <input
                    id="knowledge-file"
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.csv"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="block min-h-11 w-full text-sm text-[var(--text-secondary)] file:me-3 file:min-h-11 file:cursor-pointer file:rounded-xl file:border-0 file:bg-black file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                  />
                  <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                    {t('fileHint')}
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div
                className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm text-danger"
                role="alert"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-black px-5 py-2.5 text-sm font-semibold text-white transition-[opacity,transform,box-shadow] duration-150 hover:shadow-[0_12px_26px_-18px_rgba(0,0,0,0.9)] active:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? t('adding') : t('add')}
            </button>
          </div>
        </div>
      </section>

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
              className="spatial-inset rounded-2xl p-4 transition-colors hover:border-[var(--border-hover)]"
            >
              {editingId === item.id ? (
                /* ── Edit form (inline) ── */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                      {t('editTitle')}
                    </span>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="grid h-8 w-8 place-items-center rounded-lg text-[var(--text-muted)] hover:bg-black/[0.04] hover:text-[var(--text-primary)]"
                      aria-label={t('cancel')}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">
                      {t('name')}
                    </label>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="input min-h-11"
                    />
                  </div>
                  {item.type === 'URL' && (
                    <>
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">
                          {t('url')}
                        </label>
                        <input
                          dir="ltr"
                          value={editUrl}
                          onChange={(e) => setEditUrl(e.target.value)}
                          className="input min-h-11 font-mono text-sm"
                        />
                      </div>
                      <div className="spatial-inset rounded-2xl p-3">
                        <label className="mb-2 block text-[11px] font-medium text-[var(--text-secondary)]">
                          {t('refreshIntervalLabel')}
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {[0, 6, 12, 24, 72, 168].map((h) => (
                            <button
                              key={h}
                              type="button"
                              onClick={() => setEditRefreshHours(h)}
                              className={cn(
                                'min-h-9 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium',
                                editRefreshHours === h
                                  ? 'border-black bg-black text-white'
                                  : 'border-[var(--border-default)] bg-white/70 text-[var(--text-secondary)]',
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
                      </div>
                    </>
                  )}
                  {item.type === 'TEXT' && (
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">
                        {t('content')}
                      </label>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={5}
                        placeholder={t('contentEditPlaceholder')}
                        className="input resize-none"
                      />
                      <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                        {t('contentEditHint')}
                      </p>
                    </div>
                  )}
                  {item.type !== 'TEXT' && item.type !== 'URL' && (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                      {t('editFileHint')}
                    </p>
                  )}
                  {editError && (
                    <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {editError}
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={editLoading}
                      className="min-h-10 rounded-xl border border-[var(--border-default)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-black/[0.04]"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={() => saveEdit(item)}
                      disabled={editLoading}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {editLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {editLoading ? t('saving') : t('save')}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Display row ── */
                <div className="flex items-center gap-3">
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
                          when: formatDateTime(new Date(item.lastIngestedAt), locale),
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
                    type="button"
                    onClick={() => startEdit(item)}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--text-muted)] transition-[background-color,color,transform] duration-150 hover:bg-black/[0.04] hover:text-[var(--text-primary)] active:scale-[0.94] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60"
                    aria-label={t('edit')}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--text-muted)] transition-[background-color,color,transform] duration-150 hover:bg-danger/10 hover:text-danger active:scale-[0.94] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/60"
                    aria-label={t('delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
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
