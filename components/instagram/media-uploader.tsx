'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ImagePlus,
  Film,
  X,
  UploadCloud,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * MediaUploader — multi-image/video uploader for Instagram automation replies.
 *
 * MVP behavior:
 *   - Tabs: عکس / ویدیو (image / video)
 *   - Drag-and-drop zone + file picker
 *   - Multiple images (up to `maxImages`, default 5) — single video
 *   - Preview grid with delete buttons
 *   - Caption text field (currently only meaningful for image sequences)
 *   - Files are kept as File objects; the preview uses URL.createObjectURL
 *
 * IMPORTANT (limitation noted in the task spec):
 *   For the MVP preview, we use `blob:` URLs. The Instagram Messaging API
 *   requires publicly-reachable HTTPS URLs for media attachments — `blob:`
 *   URLs only work in the local browser. When the parent form submits, it
 *   should re-host these (e.g. base64-encode for dev preview, or upload to
 *   S3/Supabase Storage and pass the resulting URL to the backend). The
 *   parent owns that conversion via the `onChange` callback.
 *
 * The parent receives `MediaItem[]` (which include the File + a temporary
 * blob: URL) and is responsible for storage.
 */

export type MediaKind = 'IMAGE' | 'VIDEO'

export interface MediaItem {
  id: string
  kind: MediaKind
  file: File
  url: string // blob: URL for preview
  caption?: string
}

export function MediaUploader({
  onChange,
  maxImages = 5,
  initial,
}: {
  onChange: (items: MediaItem[]) => void
  maxImages?: number
  initial?: MediaItem[]
}) {
  const [tab, setTab] = useState<MediaKind>('IMAGE')
  const [items, setItems] = useState<MediaItem[]>(initial ?? [])
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const urlsRef = useRef<Set<string>>(new Set())

  // Propagate changes up.
  useEffect(() => {
    onChange(items)
  }, [items, onChange])

  // Revoke blob URLs on unmount.
  useEffect(() => {
    const urls = urlsRef.current
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u))
      urls.clear()
    }
  }, [])

  function rememberUrl(url: string) {
    urlsRef.current.add(url)
    return url
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setError(null)
    const next: MediaItem[] = []
    const limit = tab === 'IMAGE' ? maxImages : 1
    for (const f of Array.from(fileList)) {
      if (tab === 'IMAGE' && !f.type.startsWith('image/')) continue
      if (tab === 'VIDEO' && !f.type.startsWith('video/')) continue
      if (items.length + next.length >= limit) {
        setError(
          tab === 'IMAGE'
            ? `حداکثر ${maxImages} عکس قابل افزودن است.`
            : 'فقط یک ویدیو قابل افزودن است.',
        )
        break
      }
      next.push({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        kind: tab,
        file: f,
        url: rememberUrl(URL.createObjectURL(f)),
      })
    }
    if (next.length === 0) {
      if (!error) {
        setError(
          tab === 'IMAGE'
            ? 'فقط فایل تصویری قابل آپلود است.'
            : 'فقط فایل ویدیویی قابل آپلود است.',
        )
      }
      return
    }
    if (tab === 'VIDEO') {
      // Replace any existing video (single).
      setItems(next)
    } else {
      setItems((arr) => [...arr, ...next])
    }
  }

  function remove(id: string) {
    setItems((arr) => {
      const target = arr.find((x) => x.id === id)
      if (target) {
        URL.revokeObjectURL(target.url)
        urlsRef.current.delete(target.url)
      }
      return arr.filter((x) => x.id !== id)
    })
  }

  function setCaption(id: string, caption: string) {
    setItems((arr) => arr.map((x) => (x.id === id ? { ...x, caption } : x)))
  }

  const imageCount = items.filter((i) => i.kind === 'IMAGE').length
  const videoItem = items.find((i) => i.kind === 'VIDEO')

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="inline-flex rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-1">
        <TabButton
          active={tab === 'IMAGE'}
          onClick={() => setTab('IMAGE')}
          icon={ImagePlus}
          label="عکس"
          count={imageCount}
        />
        <TabButton
          active={tab === 'VIDEO'}
          onClick={() => setTab('VIDEO')}
          icon={Film}
          label="ویدیو"
          count={videoItem ? 1 : 0}
        />
      </div>

      {/* Dropzone */}
      {(tab === 'IMAGE' ? imageCount : videoItem ? 1 : 0) === 0 && (
        <label
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            addFiles(e.dataTransfer.files)
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-7 text-center transition-colors',
            dragging
              ? 'border-[var(--border-strong)] bg-[var(--bg-hover)]'
              : 'border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-base)]',
          )}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-secondary)]">
            <UploadCloud className="h-5 w-5" />
          </div>
          <p className="text-xs font-medium text-[var(--text-primary)]">
            {tab === 'IMAGE' ? 'عکس‌ها را اینجا بکشید یا کلیک کنید' : 'ویدیو را اینجا بکشید یا کلیک کنید'}
          </p>
          <p className="text-[11px] text-[var(--text-muted)]">
            {tab === 'IMAGE'
              ? `حداکثر ${maxImages} عکس · JPG، PNG، WEBP`
              : 'یک ویدیو · MP4، MOV (زیر ۲۵MB توصیه می‌شود)'}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={tab === 'IMAGE' ? 'image/*' : 'video/*'}
            multiple={tab === 'IMAGE'}
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-[var(--danger)]/10 px-3 py-2 text-[11px] text-[var(--danger)]">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      {/* Preview grid */}
      {items.length > 0 && (
        <div className="space-y-2.5">
          <div
            className={cn(
              'grid gap-2',
              tab === 'IMAGE' && imageCount > 1
                ? 'grid-cols-2'
                : 'grid-cols-1',
            )}
          >
            {items.map((item) => (
              <div
                key={item.id}
                className="group relative overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)]"
              >
                {item.kind === 'IMAGE' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.url}
                    alt={item.caption || 'preview'}
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <video
                    src={item.url}
                    className="aspect-video w-full bg-black object-contain"
                    controls
                  />
                )}
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="absolute end-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
                  aria-label="حذف"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Caption (single field; applies to first image or to the video) */}
          {tab === 'IMAGE' && (
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--text-secondary)]">
                کپشن (اختیاری)
              </label>
              <input
                value={items[0]?.caption ?? ''}
                onChange={(e) => setCaption(items[0].id, e.target.value)}
                placeholder="مثلاً تخفیف ویژه تا پایان هفته"
                maxLength={500}
                className="input"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  icon: LucideIcon
  label: string
  count: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'bg-[var(--white)] text-[var(--bg-base)]'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      {count > 0 && (
        <span
          className={cn(
            'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px]',
            active ? 'bg-white/20 text-white' : 'bg-[var(--bg-muted)] text-[var(--text-secondary)]',
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}
