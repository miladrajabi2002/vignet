'use client'

import { useCallback, useId, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, FileText, Loader2, RotateCcw, UploadCloud, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { middleTruncate } from '@/lib/format'

/**
 * Upload queue UX — the "never make them start over" primitive.
 *
 * Brings the checklist from the upload-UX review to every upload surface:
 *  - reactive drop zone (border/background change while dragging over)
 *  - multi-file with an INDEPENDENT queue: one failing file never blocks
 *    or discards the others
 *  - real per-file progress percentage (XHR upload events, not a fake spinner)
 *  - per-file size + type + status row
 *  - per-file retry from the SAME File object — no re-picking
 *  - per-file error reasons, dismissable
 *
 * The caller owns the actual request via `uploadFile(file, onProgress)`,
 * so each surface keeps its own endpoint, auth and error-code mapping.
 */

export interface UploadQueueItem<T = unknown> {
  id: string
  file: File
  status: 'queued' | 'uploading' | 'done' | 'error'
  /** 0–100, real upload progress from XHR events. */
  progress: number
  error?: string
  result?: T
}

export interface UploadDropzoneLabels {
  /** Primary hint inside the drop area. */
  dropHint: string
  /** Formats hint, e.g. "PDF یا CSV — حداکثر ۲۰ مگابایت". */
  formatsHint?: string
  /** Browse button label. */
  browse: string
  /** Per-file retry button label (icon button, aria only). */
  retry: string
  /** Remove item label (icon button, aria only). */
  remove: string
  /** Generic failure used when the upload fn throws without a message. */
  failed: string
  /** Aria label for the whole region. */
  region?: string
}

/**
 * Upload a single file with real progress events. XHR is used instead of
 * fetch because fetch cannot report upload progress without streams hacks.
 * Rejects with an Error whose message is the server's `error` code/text
 * when possible, so callers can localize the reason per surface.
 */
export function uploadFileWithProgress(
  url: string,
  formData: FormData,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
): Promise<{ response: unknown; status: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.responseType = 'json'

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)))
      }
    })
    xhr.addEventListener('load', () => {
      let body: unknown = null
      try {
        body = xhr.response
      } catch {
        body = null
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100)
        resolve({ response: body, status: xhr.status })
      } else {
        const code =
          (body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string'
            ? (body as { error: string }).error
            : null) ?? `HTTP_${xhr.status}`
        reject(new Error(code))
      }
    })
    xhr.addEventListener('error', () => reject(new Error('NETWORK')))
    xhr.addEventListener('abort', () => reject(new Error('ABORTED')))

    if (signal) {
      signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }

    xhr.send(formData)
  })
}

function formatSize(bytes: number, locale: string): string {
  const units = locale === 'fa' ? ['بایت', 'کیلوبایت', 'مگابایت'] : ['B', 'KB', 'MB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const num = value >= 10 || unit === 0 ? Math.round(value) : Math.round(value * 10) / 10
  return `${num.toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')} ${units[unit]}`
}

function fileKindIcon() {
  return FileText
}

export function UploadDropzone<T = unknown>({
  accept,
  multiple = true,
  maxFiles,
  upload,
  onFileUploaded,
  onFileRemoved,
  disabled = false,
  labels,
  locale = 'fa',
  className,
}: {
  accept?: string
  multiple?: boolean
  maxFiles?: number
  /** Perform the actual request for one file; report progress 0–100. */
  upload: (file: File, onProgress: (percent: number) => void) => Promise<T>
  /** Called when one file finishes successfully. */
  onFileUploaded?: (item: UploadQueueItem<T>, result: T) => void
  /** Called when a row is dismissed by the user. */
  onFileRemoved?: (item: UploadQueueItem<T>) => void
  disabled?: boolean
  labels: UploadDropzoneLabels
  locale?: 'fa' | 'en'
  className?: string
}) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [items, setItems] = useState<UploadQueueItem<T>[]>([])
  const dragDepth = useRef(0)
  // Mirror of `items` for capacity math outside render — keeps side effects
  // (starting uploads) out of the state updater function.
  const itemsRef = useRef<UploadQueueItem<T>[]>([])
  itemsRef.current = items

  const activeCount = items.filter((i) => i.status === 'queued' || i.status === 'uploading').length
  const atCapacity = typeof maxFiles === 'number' && items.length >= maxFiles

  const patchItem = useCallback((id: string, patch: Partial<UploadQueueItem<T>>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }, [])

  const runUpload = useCallback(
    async (item: UploadQueueItem<T>) => {
      patchItem(item.id, { status: 'uploading', progress: 0, error: undefined })
      try {
        const result = await upload(item.file, (percent) => patchItem(item.id, { progress: percent }))
        patchItem(item.id, { status: 'done', progress: 100, result })
        onFileUploaded?.({ ...item, status: 'done', progress: 100, result }, result)
      } catch (error) {
        // The caller's `upload` is expected to reject with a localized,
        // user-readable message (map server codes there). Anything else
        // falls back to the generic failure label.
        const message = error instanceof Error && error.message && !/^[A-Z_]+$/.test(error.message) ? error.message : labels.failed
        patchItem(item.id, { status: 'error', error: message })
      }
    },
    [labels.failed, onFileUploaded, patchItem, upload],
  )

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      if (disabled) return
      const incoming = Array.from(files)
      const capacity =
        typeof maxFiles === 'number' ? Math.max(0, maxFiles - itemsRef.current.length) : incoming.length
      const accepted = (capacity > 0 ? incoming.slice(0, capacity) : []).map<UploadQueueItem<T>>((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        status: 'queued' as const,
        progress: 0,
      }))
      if (accepted.length === 0) return
      setItems((prev) => [...prev, ...accepted])
      // Fire each upload independently — one failure never cancels others.
      accepted.forEach((item) => void runUpload(item))
    },
    [disabled, maxFiles, runUpload],
  )

  return (
    <div className={className}>
      {/* Drop zone — reacts the instant a file hovers over it */}
      <div
        role="button"
        tabIndex={0}
        aria-disabled={disabled || atCapacity}
        aria-label={labels.region ?? labels.dropHint}
        onClick={() => !disabled && !atCapacity && inputRef.current?.click()}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && !disabled && !atCapacity) {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault()
          dragDepth.current += 1
          if (!disabled && !atCapacity) setDragOver(true)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault()
          dragDepth.current = Math.max(0, dragDepth.current - 1)
          if (dragDepth.current === 0) setDragOver(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          dragDepth.current = 0
          setDragOver(false)
          if (disabled || atCapacity) return
          if (event.dataTransfer?.files?.length) addFiles(event.dataTransfer.files)
        }}
        className={cn(
          'flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-5 text-center transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/50 focus-visible:ring-offset-2',
          dragOver
            ? 'border-[var(--text-primary)] bg-[var(--text-primary)]/[0.045]'
            : 'border-[var(--border-hover)] bg-[var(--bg-muted)]/40 hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]/60',
          (disabled || atCapacity) && 'cursor-not-allowed opacity-55',
        )}
      >
        <UploadCloud
          className={cn(
            'h-7 w-7 transition-transform duration-150',
            dragOver ? 'scale-110 text-[var(--text-primary)]' : 'text-[var(--text-hint)]',
          )}
          aria-hidden="true"
        />
        <p className="text-sm font-medium text-[var(--text-secondary)]">{labels.dropHint}</p>
        {labels.formatsHint && <p className="text-xs text-[var(--text-hint)]">{labels.formatsHint}</p>}
        <label
          htmlFor={inputId}
          onClick={(event) => event.stopPropagation()}
          className="mt-1 inline-flex min-h-9 cursor-pointer items-center rounded-xl border border-[var(--border-default)] bg-white px-3 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          {labels.browse}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled || atCapacity}
          className="sr-only"
          onChange={(event) => {
            if (event.target.files?.length) addFiles(event.target.files)
            event.target.value = ''
          }}
        />
      </div>

      {/* Independent per-file queue */}
      {items.length > 0 && (
        <ul className="mt-3 space-y-2" aria-live="polite">
          {items.map((item) => {
            const Icon = fileKindIcon()
            const uploading = item.status === 'uploading'
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-white px-3 py-2.5"
              >
                <span
                  className={cn(
                    'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                    item.status === 'error'
                      ? 'bg-danger/10 text-danger'
                      : item.status === 'done'
                        ? 'bg-success/10 text-success'
                        : 'bg-[var(--bg-muted)] text-[var(--text-secondary)]',
                  )}
                >
                  {item.status === 'done' ? (
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  ) : item.status === 'error' ? (
                    <AlertCircle className="h-5 w-5" aria-hidden="true" />
                  ) : uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p dir="ltr" className="min-w-0 truncate text-start text-xs font-semibold text-[var(--text-primary)]" title={item.file.name}>
                      {middleTruncate(item.file.name, 36)}
                    </p>
                    <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-muted)]">
                      {formatSize(item.file.size, locale)}
                    </span>
                  </div>
                  {/* Real progress bar + percent — no fake indeterminate spinners */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <div
                      className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]"
                      role="progressbar"
                      aria-valuenow={item.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={item.file.name}
                    >
                      <div
                        className={cn(
                          'h-full rounded-full transition-[width] duration-200',
                          item.status === 'error' ? 'bg-danger' : item.status === 'done' ? 'bg-success' : 'bg-[var(--text-primary)]',
                        )}
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                    <span className="w-9 shrink-0 text-end text-[10px] font-semibold tabular-nums text-[var(--text-muted)]">
                      {item.status === 'done' ? '✓' : `${item.progress}%`}
                    </span>
                  </div>
                  {item.status === 'error' && (
                    <p className="mt-1 text-[11px] text-danger">{item.error ?? labels.failed}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {/* Retry keeps the same File — the user never re-picks */}
                  {item.status === 'error' && (
                    <button
                      type="button"
                      onClick={() => void runUpload(item)}
                      aria-label={`${labels.retry}: ${item.file.name}`}
                      className="grid h-9 w-9 place-items-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/50"
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setItems((prev) => prev.filter((row) => row.id !== item.id))
                      onFileRemoved?.(item)
                    }}
                    aria-label={`${labels.remove}: ${item.file.name}`}
                    className="grid h-9 w-9 place-items-center rounded-xl text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/50"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {activeCount > 0 && (
        <p className="mt-2 text-[11px] text-[var(--text-muted)]" role="status">
          {locale === 'fa' ? `${activeCount.toLocaleString('fa-IR')} فایل در حال آپلود…` : `${activeCount} file(s) uploading…`}
        </p>
      )}
    </div>
  )
}
