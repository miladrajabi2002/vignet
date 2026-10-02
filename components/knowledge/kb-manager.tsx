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
  AlertCircle,
  Clock,
  Database,
  Pencil,
  Plus,
  MessageSquareText,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/format'
import { knowledgeRequestErrorMessageKey } from '@/lib/knowledge/request-error'
import { UploadDropzone, uploadFileWithProgress } from '@/components/ui/upload-dropzone'

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
  /** Fast-moving sources: minutes cadence; wins over the hourly column when > 0. */
  refreshIntervalMinutes?: number
  /** Editable fields — populated when the user opens the edit panel. */
  sourceUrl?: string | null
  content?: string | null
}

type Mode = 'text' | 'url' | 'file'

// Re-crawl cadence choices in minutes (0 = manual). Sub-hour options exist
// because price/availability pages change within minutes, not hours; the
// scheduler ticks every 5 minutes and the staleness check gates real work.
const CADENCE_MINUTES = [0, 15, 30, 60, 360, 720, 1440, 4320, 10080]

function cadencePayload(minutes: number): { refreshIntervalHours: number; refreshIntervalMinutes: number } {
  if (minutes > 0 && minutes < 60) return { refreshIntervalHours: 0, refreshIntervalMinutes: minutes }
  return { refreshIntervalHours: Math.round(minutes / 60), refreshIntervalMinutes: 0 }
}

function cadenceMinutesOf(item: { refreshIntervalMinutes?: number; refreshIntervalHours?: number }): number {
  return item.refreshIntervalMinutes && item.refreshIntervalMinutes > 0
    ? item.refreshIntervalMinutes
    : (item.refreshIntervalHours ?? 0) * 60
}

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
  const [refreshCadenceMinutes, setRefreshCadenceMinutes] = useState<number>(1440)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editRefreshCadenceMinutes, setEditRefreshCadenceMinutes] = useState<number>(1440)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const sessionRedirectingRef = useRef(false)
  // With sources already listed the form stays closed until asked for.
  const [formOpen, setFormOpen] = useState(items.length === 0)
  const formRef = useRef<HTMLElement>(null)
  const totalChunks = items.reduce((sum, item) => sum + (item.status === 'READY' ? item.chunkCount : 0), 0)

  function openForm(next: Mode) {
    setMode(next)
    setFormOpen(true)
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function redirectAfterUnauthorized() {
    if (sessionRedirectingRef.current) return
    sessionRedirectingRef.current = true

    // Keep text/url drafts across the forced sign-in round trip. File objects
    // cannot be serialized, so browsers will still require re-selecting a file.
    if (mode !== 'file') {
      try {
        sessionStorage.setItem(
          `knowledge-draft:${agentId}`,
          JSON.stringify({ mode, name, content, url, refreshCadenceMinutes }),
        )
      } catch {
        // Storage can be unavailable in strict private-browsing contexts.
      }
    }
    const next = `${window.location.pathname}${window.location.search}`
    window.location.replace(
      `/api/auth/force-logout?next=${encodeURIComponent(next)}`,
    )
  }

  async function readRequestError(response: Response) {
    const data = (await response.json().catch(() => ({}))) as { error?: string }
    return t(knowledgeRequestErrorMessageKey(response.status, data.error))
  }

  useEffect(() => {
    const key = `knowledge-draft:${agentId}`
    let raw: string | null = null
    try {
      raw = sessionStorage.getItem(key)
      if (raw) sessionStorage.removeItem(key)
    } catch {
      return
    }
    if (!raw) return
    try {
      const draft = JSON.parse(raw) as {
        mode?: Mode
        name?: string
        content?: string
        url?: string
        refreshCadenceMinutes?: number
        refreshHours?: number
      }
      if (draft.mode === 'text' || draft.mode === 'url') setMode(draft.mode)
      if (typeof draft.name === 'string') setName(draft.name)
      if (typeof draft.content === 'string') setContent(draft.content)
      if (typeof draft.url === 'string') setUrl(draft.url)
      if (typeof draft.refreshCadenceMinutes === 'number') setRefreshCadenceMinutes(draft.refreshCadenceMinutes)
      else if (typeof draft.refreshHours === 'number') setRefreshCadenceMinutes(draft.refreshHours * 60)
    } catch {
      // Ignore malformed or obsolete drafts.
    }
  }, [agentId])

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
        // Handled by the UploadDropzone queue above; kept as a no-op guard.
        return
      } else {
        res = await fetch(`/api/agents/${agentId}/knowledge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            mode === 'url'
              ? { name: name || url, mode: 'url', url, ...cadencePayload(refreshCadenceMinutes) }
              : { name: name || 'دانش', mode: 'text', content },
          ),
        })
      }
      if (!res.ok) {
        if (res.status === 401) redirectAfterUnauthorized()
        setError(await readRequestError(res))
        return
      }
      try {
        sessionStorage.removeItem(`knowledge-draft:${agentId}`)
      } catch {
        // The successful request matters even when browser storage is blocked.
      }
      setName('')
      setContent('')
      setUrl('')
      setFormOpen(false)
      router.refresh()
    } catch {
      setError(t('requestFailed'))
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
    setEditRefreshCadenceMinutes(cadenceMinutesOf(item))
    // Fetch full KB row to get sourceUrl/content
    try {
      const res = await fetch(`/api/agents/${agentId}/knowledge/${item.id}`)
      if (!res.ok) {
        if (res.status === 401) redirectAfterUnauthorized()
        setEditError(await readRequestError(res))
        return
      }
      const data = (await res.json()) as { kb: KbItem & { sourceUrl?: string | null } }
      setEditUrl(data.kb.sourceUrl ?? '')
      setEditContent(data.kb.content ?? '')
    } catch {
      setEditError(t('requestFailed'))
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
        if (editRefreshCadenceMinutes !== cadenceMinutesOf(item)) {
          Object.assign(body, cadencePayload(editRefreshCadenceMinutes))
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
        if (res.status === 401) redirectAfterUnauthorized()
        setEditError(await readRequestError(res))
        return
      }
      cancelEdit()
      router.refresh()
    } catch {
      setEditError(t('requestFailed'))
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

  // File mode uploads directly through the dropzone queue (per-file progress
  // + retry), so the explicit Add button only applies to text/url modes.
  const canSubmit =
    !submitting &&
    (mode === 'text' ? content.trim() : mode === 'url' ? url.trim() : false)

  return (
    <div className="space-y-6">
      {/* What the agent knows comes first; adding a source is one tap away. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="ui-h3">{locale === 'fa' ? 'دانش ایجنت' : 'Agent knowledge'}</h2>
          <p className="mt-0.5 text-[12px] leading-5 text-[var(--text-muted)]">
            {items.length === 0
              ? (locale === 'fa' ? 'هنوز منبعی اضافه نشده؛ ایجنت فقط از همین منابع جواب می‌دهد.' : 'No sources yet. The agent answers only from these sources.')
              : (locale === 'fa'
                ? `${items.length.toLocaleString('fa-IR')} منبع · ${totalChunks.toLocaleString('fa-IR')} قطعه · ایجنت فقط از همین‌ها جواب می‌دهد`
                : `${items.length} sources · ${totalChunks} chunks · the agent answers only from these`)}
          </p>
        </div>
        {items.length > 0 && !formOpen && (
          <button type="button" onClick={() => openForm('text')} className="spatial-press inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-black px-4 text-xs font-semibold text-white shadow-[var(--shadow-control)]">
            <Plus className="h-4 w-4" />
            {t('addSourceTitle')}
          </button>
        )}
      </div>

      {/* ── Added items list ──────────────────────────────────────────── */}
      {items.length > 0 && (
        <div className="spatial-surface divide-y divide-[var(--border-subtle)] overflow-hidden rounded-card">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-4"
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
                    <label className="mb-1 block text-[12px] font-medium text-[var(--text-secondary)]">
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
                        <label className="mb-1 block text-[12px] font-medium text-[var(--text-secondary)]">
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
                        <label className="mb-2 block text-[12px] font-medium text-[var(--text-secondary)]">
                          {t('refreshIntervalLabel')}
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {CADENCE_MINUTES.map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setEditRefreshCadenceMinutes(m)}
                              className={cn(
                                'min-h-9 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium',
                                editRefreshCadenceMinutes === m
                                  ? 'border-black bg-black text-white'
                                  : 'border-[var(--border-default)] bg-white/70 text-[var(--text-secondary)]',
                              )}
                            >
                              {m === 0
                                ? t('refreshManual')
                                : m < 60
                                  ? t('refreshMinutes', { m })
                                  : m < 1440
                                    ? t('refreshHours', { h: m / 60 })
                                    : t('refreshDays', { d: m / 1440 })}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                  {item.type === 'TEXT' && (
                    <div>
                      <label className="mb-1 block text-[12px] font-medium text-[var(--text-secondary)]">
                        {t('content')}
                      </label>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={5}
                        placeholder={t('contentEditPlaceholder')}
                        className="input resize-none"
                      />
                      <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                        {t('contentEditHint')}
                      </p>
                    </div>
                  )}
                  {item.type !== 'TEXT' && item.type !== 'URL' && (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
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
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {editLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {editLoading ? t('saving') : t('save')}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Display row ── */
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)]">
                    <TypeIcon type={item.type} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-[var(--text-primary)]">
                      {item.name}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--text-muted)]">
                      <span>{typeLabel(item.type, locale)}</span>
                      {item.status === 'READY' && (
                        <span>· {t('chunks', { count: item.chunkCount })}</span>
                      )}
                      {item.status === 'ERROR' && item.errorMsg && (
                        <span className="text-danger">· {item.errorMsg}</span>
                      )}
                    </div>
                    {item.type === 'URL' && item.lastIngestedAt && (
                      <div className="mt-1 flex items-center gap-1 text-[12px] text-[var(--text-muted)]">
                        <Clock className="h-3 w-3" />
                        {t('lastRefreshed', {
                          when: formatDateTime(new Date(item.lastIngestedAt), locale),
                        })}
                        {(() => {
                          const minutes = cadenceMinutesOf(item)
                          if (minutes <= 0) return ''
                          return ` · ${minutes < 60
                            ? t('refreshEveryMinutes', { m: minutes })
                            : t('refreshEvery', { h: minutes / 60 })}`
                        })()}
                      </div>
                    )}
                    {item.type === 'URL' &&
                      cadenceMinutesOf(item) > 0 &&
                      !item.lastIngestedAt && (
                        <div className="mt-1 text-[12px] text-[var(--amber)]">
                          {t('refreshScheduled')}
                        </div>
                      )}
                  </div>
                  <StatusChip status={item.status} label={t(`status.${item.status}`)} />
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--text-muted)] transition-[background-color,color,transform] duration-150 hover:bg-black/[0.04] hover:text-[var(--text-primary)] active:scale-[0.94] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
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

      {items.length > 0 && !formOpen && (
        <div className="grid gap-2 sm:grid-cols-3">
          {tabs.map(({ key, label, description, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => openForm(key)}
              className="spatial-press rounded-2xl border border-dashed border-black/20 px-3.5 py-3 text-start transition-colors hover:border-black/40 hover:bg-white"
            >
              <span className="flex items-center gap-1.5 text-[13px] font-bold text-[var(--text-primary)]"><Icon className="h-4 w-4" />{label}</span>
              <span className="mt-0.5 block text-[12px] leading-5 text-[var(--text-muted)]">{description}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Add form ──────────────────────────────────────────────────── */}
      {formOpen && (
      <section
        ref={formRef}
        className="spatial-surface scroll-mt-28 overflow-hidden rounded-card"
        aria-labelledby="knowledge-add-title"
      >
        <div className="border-b border-black/[0.05] bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(248,248,250,0.78))] px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-control border border-black/[0.06] bg-white text-[var(--text-primary)] shadow-[var(--shadow-control)]">
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
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                aria-label={t('cancel')}
                className="ms-auto grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--text-muted)] hover:bg-black/[0.04] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
          <div
            className="ui-seg grid-cols-1 sm:grid-cols-3"
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
                  className="ui-seg-tab group min-h-[4.5rem] justify-start gap-3 px-3.5 py-3 text-start"
                  >
                  <span className="ui-seg-icon h-9 w-9">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{label}</span>
                    <span
                      className="mt-0.5 block text-[13px] font-normal leading-5 text-[var(--text-muted)]"
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
                    {CADENCE_MINUTES.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setRefreshCadenceMinutes(m)}
                        className={cn(
                          'min-h-11 rounded-xl border px-3 py-2 text-xs font-medium transition-[border-color,background-color,color,transform] duration-150 active:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
                          refreshCadenceMinutes === m
                            ? 'border-black bg-black text-white'
                            : 'border-[var(--border-default)] bg-white/70 text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]',
                        )}
                      >
                        {m === 0
                          ? t('refreshManual')
                          : m < 60
                            ? t('refreshMinutes', { m })
                            : m < 1440
                              ? t('refreshHours', { h: m / 60 })
                              : t('refreshDays', { d: m / 1440 })}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-muted)]">
                    {t('refreshIntervalHint')}
                  </p>
                </div>
              </div>
            )}
            {mode === 'file' && (
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-[var(--text-primary)]">
                  {t('tabFile')}
                </span>
                {/* Drag-and-drop queue with real per-file progress, retry and
                    independent uploads — replacing the single plain file input. */}
                <UploadDropzone
                  accept=".pdf,.csv"
                  multiple
                  locale={locale}
                  upload={async (file, onProgress) => {
                    const fd = new FormData()
                    fd.append('file', file)
                    fd.append('name', file.name)
                    try {
                      const { response, status } = await uploadFileWithProgress(
                        `/api/agents/${agentId}/knowledge`,
                        fd,
                        onProgress,
                      )
                      if (status === 401) redirectAfterUnauthorized()
                      return response
                    } catch (error) {
                      // Surface a localized, per-file reason — never a raw code.
                      const code = error instanceof Error ? error.message : 'UNKNOWN'
                      throw new Error(t(knowledgeRequestErrorMessageKey(0, code)))
                    }
                  }}
                  onFileUploaded={() => router.refresh()}
                  labels={{
                    dropHint: locale === 'fa' ? 'فایل را اینجا رها کنید' : 'Drop files here',
                    formatsHint: t('fileHint'),
                    browse: locale === 'fa' ? 'انتخاب فایل' : 'Browse files',
                    retry: t('retry'),
                    remove: locale === 'fa' ? 'حذف' : 'Remove',
                    failed: t('requestFailed'),
                    region: t('tabFile'),
                  }}
                />
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
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-black px-5 py-2.5 text-sm font-semibold text-white transition-[opacity,transform,box-shadow] duration-150 hover:shadow-[var(--shadow-control)] active:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? t('adding') : t('add')}
            </button>
          </div>
        </div>
      </section>
      )}

    </div>
  )
}

function typeLabel(type: string, locale: 'fa' | 'en') {
  const fa = locale === 'fa'
  if (type === 'URL') return fa ? 'لینک صفحه' : 'Web page'
  if (type === 'FAQ') return fa ? 'پرسش و پاسخ' : 'Q&A'
  if (type === 'PDF' || type === 'CSV') return fa ? `فایل ${type}` : `${type} file`
  return fa ? 'متن' : 'Text'
}

function TypeIcon({ type }: { type: string }) {
  const Icon = type === 'URL' ? Link2 : type === 'FAQ' ? MessageSquareText : type === 'PDF' || type === 'CSV' ? FileText : Pencil
  return <Icon className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.8} />
}

function StatusChip({ status, label }: { status: KbStatus; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium',
        status === 'READY' && 'bg-emerald-50 text-emerald-700',
        status === 'ERROR' && 'bg-red-50 text-red-700',
        (status === 'PENDING' || status === 'PROCESSING') && 'bg-black/[0.05] text-[var(--text-secondary)]',
      )}
    >
      {status === 'PROCESSING' && <Loader2 className="h-3 w-3 animate-spin" />}
      {label}
    </span>
  )
}
