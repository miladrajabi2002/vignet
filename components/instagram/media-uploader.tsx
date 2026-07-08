'use client'

import { useEffect, useRef, useState } from 'react'
import {
        ImagePlus,
        Film,
        X,
        UploadCloud,
        AlertCircle,
        Loader2,
        RotateCcw,
        type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * MediaUploader — multi-image / single-video / single-audio uploader that
 * uploads to S3 via `POST /api/uploads/instagram` and returns real HTTPS URLs.
 *
 * Behavior:
 *   - Tabs: عکس / ویدیو / وویس (image / video / audio)
 *   - Drag-and-drop zone + file picker
 *   - Multiple images (up to `maxImages`, default 5) — single video / single audio
 *   - Per-file upload progress (spinner + percent)
 *   - On success: stores the HTTPS URL returned by S3 in `MediaItem.remoteUrl`
 *     (the preview `url` stays as the blob URL so it keeps working in the
 *     operator's browser even when S3 is served from `http://127.0.0.1:9000/...`).
 *     The parent form reads `item.remoteUrl ?? item.url` for the saved mediaUrl.
 *   - On error: shows a retry button on the failed item.
 *   - Preview grid (image) / video player / audio player.
 *
 * The S3-UPLOAD subagent is building `/api/uploads/instagram` in parallel.
 * Contract: multipart form `files` → `{ files: [{ url, key, size, contentType, originalName }] }`.
 *
 * If the endpoint isn't deployed yet (or S3 isn't configured), the uploader
 * surfaces a clear message instead of silently failing.
 */

export type MediaKind = 'IMAGE' | 'VIDEO' | 'AUDIO'

export interface MediaItem {
        /** Client-side stable id (NOT persisted). */
        id: string
        kind: MediaKind
        /** The local File. Null for `initial` items reconstructed from an existing S3 URL. */
        file: File | null
        /**
         * Preview URL used by the <img>/<video>/<audio> elements. While uploading
         * (and after upload) this stays a `blob:` URL so the preview keeps working
         * in the operator's browser even when S3 is served from
         * `http://127.0.0.1:9000/...` (which the operator can't reach). For
         * `initial` items this is the existing S3 URL (there is no local File).
         */
        url: string
        /**
         * The real S3 HTTPS URL returned by the upload API. Null until the upload
         * succeeds. This is what gets saved to the automation action and sent to
         * Instagram. The parent form should read `item.remoteUrl ?? item.url`.
         */
        remoteUrl: string | null
        /** True once the S3 upload returned a real HTTPS URL. */
        uploaded: boolean
        /** Upload progress 0..100. */
        progress: number
        /** Error message if the upload failed; null otherwise. */
        error: string | null
        caption?: string
}

interface UploadResponse {
        files: Array<{
                url: string
                key?: string
                size?: number
                contentType?: string
                originalName?: string
        }>
        error?: string
}

const UPLOAD_ENDPOINT = '/api/uploads/instagram'

export function MediaUploader({
        onChange,
        maxImages = 5,
        initial,
        kind,
}: {
        onChange: (items: MediaItem[]) => void
        maxImages?: number
        initial?: MediaItem[]
        /** Lock the uploader to a single kind (used by the message builder). */
        kind?: MediaKind
}) {
        const [tab, setTab] = useState<MediaKind>(kind ?? 'IMAGE')
        const [items, setItems] = useState<MediaItem[]>(initial ?? [])
        const [dragging, setDragging] = useState(false)
        const [error, setError] = useState<string | null>(null)
        const [s3Unavailable, setS3Unavailable] = useState(false)
        const inputRef = useRef<HTMLInputElement>(null)
        const urlsRef = useRef<Set<string>>(new Set())
        const inFlightRef = useRef<Map<string, (file: MediaItem) => void>>(new Map())

        // Lock tab when `kind` prop is provided.
        useEffect(() => {
                if (kind) setTab(kind)
        }, [kind])

        // Propagate changes up.
        useEffect(() => {
                onChange(items)
                // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [items])

        // Revoke blob URLs on unmount.
        useEffect(() => {
                const urls = urlsRef.current
                return () => {
                        urls.forEach((u) => {
                                if (u.startsWith('blob:')) URL.revokeObjectURL(u)
                        })
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
                        if (tab === 'AUDIO' && !f.type.startsWith('audio/')) continue
                        if (items.length + next.length >= limit) {
                                setError(
                                        tab === 'IMAGE'
                                                ? `حداکثر ${maxImages.toLocaleString('fa-IR')} عکس قابل افزودن است.`
                                                : 'فقط یک فایل قابل افزودن است.',
                                )
                                break
                        }
                        const item: MediaItem = {
                                id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                                kind: tab,
                                file: f,
                                url: rememberUrl(URL.createObjectURL(f)),
                                remoteUrl: null,
                                uploaded: false,
                                progress: 0,
                                error: null,
                        }
                        next.push(item)
                }
                if (next.length === 0) {
                        if (!error) {
                                setError(
                                        tab === 'IMAGE'
                                                ? 'فقط فایل تصویری قابل آپلود است.'
                                                : tab === 'VIDEO'
                                                        ? 'فقط فایل ویدیویی قابل آپلود است.'
                                                        : 'فقط فایل صوتی قابل آپلود است.',
                                )
                        }
                        return
                }
                if (tab === 'VIDEO' || tab === 'AUDIO') {
                        // Replace any existing single-file item.
                        setItems((arr) => {
                                arr.forEach((i) => {
                                        if (i.url.startsWith('blob:')) URL.revokeObjectURL(i.url)
                                        urlsRef.current.delete(i.url)
                                })
                                return next
                        })
                } else {
                        setItems((arr) => [...arr, ...next])
                }
                // Kick off uploads for the new items.
                next.forEach((item) => uploadItem(item))
        }

        /** Upload a single file to S3 via the /api/uploads/instagram endpoint. */
        async function uploadItem(item: MediaItem) {
                // `initial` items (existing S3 URL, no local File) are already uploaded.
                if (!item.file) return
                const file = item.file
                // Mark as uploading.
                setItems((arr) =>
                        arr.map((x) => (x.id === item.id ? { ...x, progress: 5, error: null } : x)),
                )

                const formData = new FormData()
                formData.append('files', file, file.name)

                // Use XMLHttpRequest for upload progress events.
                const xhr = new XMLHttpRequest()
                const promise = new Promise<MediaItem>((resolve, reject) => {
                        xhr.upload.addEventListener('progress', (e) => {
                                if (e.lengthComputable) {
                                        const pct = Math.min(95, Math.round((e.loaded / e.total) * 95))
                                        setItems((arr) =>
                                                arr.map((x) => (x.id === item.id ? { ...x, progress: pct } : x)),
                                        )
                                }
                        })
                        xhr.addEventListener('load', () => {
                                if (xhr.status >= 200 && xhr.status < 300) {
                                        try {
                                                const data = JSON.parse(xhr.responseText) as UploadResponse
                                                const uploaded = data.files?.[0]
                                                if (!uploaded?.url) {
                                                        reject(new Error('پاسخ سرور فاقد URL است.'))
                                                        return
                                                }
                                                // Store the S3 URL in `remoteUrl` but KEEP `url` as the blob URL so
                                                // the preview keeps working in the operator's browser (the S3 URL
                                                // may be `http://127.0.0.1:9000/...` which the operator can't
                                                // load). Do NOT revoke the blob URL here — it's revoked on
                                                // unmount or when the item is removed.
                                                setItems((arr) =>
                                                        arr.map((x) =>
                                                                x.id === item.id
                                                                        ? {
                                                                                ...x,
                                                                                remoteUrl: uploaded.url,
                                                                                uploaded: true,
                                                                                progress: 100,
                                                                                error: null,
                                                                        }
                                                                        : x,
                                                        ),
                                                )
                                                resolve({ ...item, remoteUrl: uploaded.url, uploaded: true })
                                        } catch {
                                                reject(new Error('پاسخ سرور نامعتبر بود.'))
                                        }
                                } else if (xhr.status === 503 || xhr.status === 501) {
                                        setS3Unavailable(true)
                                        reject(new Error('سرویس آپلود در دسترس نیست (احتمالاً S3 پیکربندی نشده).'))
                                } else {
                                        let msg = 'آپلود ناموفق بود.'
                                        try {
                                                const data = JSON.parse(xhr.responseText) as UploadResponse
                                                if (data?.error) msg = data.error
                                        } catch {
                                                /* ignore */
                                        }
                                        reject(new Error(msg))
                                }
                        })
                        xhr.addEventListener('error', () => {
                                reject(new Error('خطای شبکه هنگام آپلود.'))
                        })
                        xhr.addEventListener('abort', () => {
                                reject(new Error('آپلود لغو شد.'))
                        })
                        xhr.open('POST', UPLOAD_ENDPOINT)
                        xhr.send(formData)
                })

                // Store the reject handler so the retry button can re-trigger.
                inFlightRef.current.set(item.id, (_item) => {
                        uploadItem(_item)
                })

                try {
                        await promise
                } catch (e) {
                        const msg = e instanceof Error ? e.message : 'آپلود ناموفق بود.'
                        setItems((arr) =>
                                arr.map((x) =>
                                        x.id === item.id ? { ...x, progress: 0, error: msg, uploaded: false } : x,
                                ),
                        )
                } finally {
                        inFlightRef.current.delete(item.id)
                }
        }

        function retry(item: MediaItem) {
                uploadItem({ ...item, error: null, progress: 0 })
        }

        function remove(id: string) {
                setItems((arr) => {
                        const target = arr.find((x) => x.id === id)
                        if (target) {
                                // Best-effort DELETE of the S3 object so we don't leak orphaned uploads
                                // when the operator picks a file then removes it before saving the
                                // scenario. Failures are swallowed (don't block the UI).
                                if (target.uploaded && target.remoteUrl) {
                                        const key = deriveS3Key(target.remoteUrl)
                                        if (key) {
                                                const encoded = key
                                                        .split('/')
                                                        .map(encodeURIComponent)
                                                        .join('/')
                                                fetch(`/api/uploads/instagram/${encoded}`, {
                                                        method: 'DELETE',
                                                }).catch(() => {})
                                        }
                                }
                                // Revoke the local blob preview URL.
                                if (target.url.startsWith('blob:')) {
                                        URL.revokeObjectURL(target.url)
                                        urlsRef.current.delete(target.url)
                                }
                        }
                        return arr.filter((x) => x.id !== id)
                })
        }

        function setCaption(id: string, caption: string) {
                setItems((arr) => arr.map((x) => (x.id === id ? { ...x, caption } : x)))
        }

        const imageCount = items.filter((i) => i.kind === 'IMAGE').length
        const videoItem = items.find((i) => i.kind === 'VIDEO')
        const audioItem = items.find((i) => i.kind === 'AUDIO')
        const activeCount =
                tab === 'IMAGE' ? imageCount : tab === 'VIDEO' ? (videoItem ? 1 : 0) : audioItem ? 1 : 0

        return (
                <div className="space-y-3">
                        {/* S3 unavailable banner */}
                        {s3Unavailable && (
                                <div className="flex items-start gap-2 rounded-lg bg-[var(--amber)]/10 px-3 py-2 text-[11px] text-[var(--amber)]">
                                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                        <span className="leading-relaxed">
                                                سرویس آپلود به S3 در دسترس نیست. احتمالاً هنوز پیکربندی نشده. فایل‌ها فقط برای پیش‌نمایش محلی نگه داشته می‌شوند — قبل از ذخیره سناریو این مشکل را برطرف کنید.
                                        </span>
                                </div>
                        )}

                        {/* Tabs — hidden when `kind` prop locks to one type */}
                        {!kind && (
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
                                        <TabButton
                                                active={tab === 'AUDIO'}
                                                onClick={() => setTab('AUDIO')}
                                                icon={UploadCloud}
                                                label="وویس"
                                                count={audioItem ? 1 : 0}
                                        />
                                </div>
                        )}

                        {/* Dropzone */}
                        {activeCount === 0 && (
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
                                                {tab === 'IMAGE'
                                                        ? 'عکس‌ها را اینجا بکشید یا کلیک کنید'
                                                        : tab === 'VIDEO'
                                                                ? 'ویدیو را اینجا بکشید یا کلیک کنید'
                                                                : 'فایل صوتی را اینجا بکشید یا کلیک کنید'}
                                        </p>
                                        <p className="text-[11px] text-[var(--text-muted)]">
                                                {tab === 'IMAGE'
                                                        ? `حداکثر ${maxImages.toLocaleString('fa-IR')} عکس · JPG، PNG، WEBP`
                                                        : tab === 'VIDEO'
                                                                ? 'یک ویدیو · MP4، MOV (زیر ۲۵MB توصیه می‌شود)'
                                                                : 'یک فایل صوتی · MP3، M4A، WAV'}
                                        </p>
                                        <input
                                                ref={inputRef}
                                                type="file"
                                                accept={
                                                        tab === 'IMAGE' ? 'image/*' : tab === 'VIDEO' ? 'video/*' : 'audio/*'
                                                }
                                                multiple={tab === 'IMAGE'}
                                                className="hidden"
                                                onChange={(e) => {
                                                        addFiles(e.target.files)
                                                        e.target.value = ''
                                                }}
                                        />
                                </label>
                        )}

                        {/* Inline error */}
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
                                                                {/* Image */}
                                                                {item.kind === 'IMAGE' && (
                                                                        // eslint-disable-next-line @next/next/no-img-element
                                                                        <img
                                                                                src={item.url}
                                                                                alt={item.caption || 'preview'}
                                                                                className="aspect-square w-full object-cover"
                                                                        />
                                                                )}
                                                                {/* Video */}
                                                                {item.kind === 'VIDEO' && (
                                                                        <video
                                                                                src={item.url}
                                                                                className="aspect-video w-full bg-black object-contain"
                                                                                controls
                                                                        />
                                                                )}
                                                                {/* Audio — custom waveform player */}
                                                                {item.kind === 'AUDIO' && (
                                                                        <div className="flex items-center gap-3 px-3 py-4">
                                                                                <div
                                                                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                                                                                        style={{
                                                                                                background:
                                                                                                        'linear-gradient(45deg, #f58529, #dd2a7b, #8134af)',
                                                                                        }}
                                                                                >
                                                                                        <svg width="10" height="11" viewBox="0 0 10 11" fill="currentColor" aria-hidden>
                                                                                                <path d="M0 0 L10 5.5 L0 11 Z" />
                                                                                        </svg>
                                                                                </div>
                                                                                <div className="flex-1">
                                                                                        <div className="flex h-6 items-center gap-[2px]">
                                                                                                {[7, 12, 5, 11, 8, 14, 6, 10, 9, 13, 5, 11, 7, 9, 12, 6, 10, 8].map((h, i) => (
                                                                                                        <span
                                                                                                                key={i}
                                                                                                                className="w-[2px] rounded-full bg-[var(--text-secondary)]"
                                                                                                                style={{ height: h }}
                                                                                                        />
                                                                                                ))}
                                                                                        </div>
                                                                                        <p className="mt-1 truncate text-[10px] text-[var(--text-muted)]" dir="ltr">
                                                                                                {item.file?.name ?? 'voice memo'}
                                                                                        </p>
                                                                                </div>
                                                                                <audio src={item.url} controls className="hidden" />
                                                                        </div>
                                                                )}

                                                                {/* Upload progress overlay */}
                                                                {!item.uploaded && !item.error && (
                                                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/55 text-white backdrop-blur-sm">
                                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                                <span className="text-[10px] font-medium">
                                                                                        {item.progress > 0
                                                                                                ? `${item.progress.toLocaleString('fa-IR')}٪`
                                                                                                : 'در حال آپلود…'}
                                                                                </span>
                                                                        </div>
                                                                )}

                                                                {/* Error overlay with retry */}
                                                                {item.error && (
                                                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/70 p-2 text-center text-white">
                                                                                <AlertCircle className="h-4 w-4 text-red-300" />
                                                                                <span className="text-[10px] leading-tight">{item.error}</span>
                                                                                <button
                                                                                        type="button"
                                                                                        onClick={() => retry(item)}
                                                                                        className="mt-1 inline-flex items-center gap-1 rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-medium hover:bg-white/30"
                                                                                >
                                                                                        <RotateCcw className="h-3 w-3" />
                                                                                        تلاش دوباره
                                                                                </button>
                                                                        </div>
                                                                )}

                                                                {/* Success check */}
                                                                {item.uploaded && (
                                                                        <div className="absolute start-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-success text-white shadow">
                                                                                <svg width="10" height="8" viewBox="0 0 10 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                                        <polyline points="0.5 4 3.5 7 9.5 0.5" />
                                                                                </svg>
                                                                        </div>
                                                                )}

                                                                {/* Delete */}
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
                                        {tab === 'IMAGE' && items[0] && (
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
                                        {count.toLocaleString('fa-IR')}
                                </span>
                        )}
                </button>
        )
}


/**
 * Extract the S3 object key (`instagram/...`) from a public S3 URL.
 *
 * The upload API stores files under the `instagram/` folder, so the key
 * always starts with `instagram/`. We locate that prefix in the URL and take
 * everything from there. Query/hash suffixes are stripped and the result is
 * percent-decoded. Returns null if the URL doesn't contain `instagram/`
 * (in which case the DELETE call is skipped — best-effort).
 */
function deriveS3Key(remoteUrl: string): string | null {
        // Extract the path after `/api/uploads/instagram/` so the DELETE call goes
        // to `/api/uploads/instagram/2026/07/file.png` (matching the GET route).
        const marker = '/api/uploads/instagram/'
        const idx = remoteUrl.indexOf(marker)
        if (idx === -1) return null
        const raw = remoteUrl.slice(idx + marker.length).split(/[?#]/)[0]
        try {
                return decodeURIComponent(raw)
        } catch {
                return raw
        }
}
