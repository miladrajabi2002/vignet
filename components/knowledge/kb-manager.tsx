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
              ? { name: name || url, mode: 'url', url }
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
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
        <div className="mb-4 flex gap-2">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors',
                mode === key
                  ? 'border-[var(--border-strong)] text-[var(--text-primary)]'
                  : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('namePlaceholder')}
          className="input mb-3"
        />

        {mode === 'text' && (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('contentPlaceholder')}
            rows={5}
            className="input resize-none"
          />
        )}
        {mode === 'url' && (
          <input
            dir="ltr"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t('urlPlaceholder')}
            className="input font-mono text-sm"
          />
        )}
        {mode === 'file' && (
          <div>
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

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <button
          onClick={submit}
          disabled={!canSubmit}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2 text-sm font-medium text-black transition-transform hover:scale-[1.02] disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? t('adding') : t('add')}
        </button>
      </div>

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--text-muted)]">
          {t('empty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4"
            >
              <StatusIcon status={item.status} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-[var(--text-primary)]">
                  {item.name}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {item.type} · {t(`status.${item.status}`)}
                  {item.status === 'READY' &&
                    ` · ${t('chunks', { count: item.chunkCount })}`}
                  {item.status === 'ERROR' && item.errorMsg
                    ? ` · ${item.errorMsg}`
                    : ''}
                </div>
              </div>
              <button
                onClick={() => remove(item.id)}
                className="text-[var(--text-muted)] transition-colors hover:text-danger"
                aria-label={t('delete')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
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
