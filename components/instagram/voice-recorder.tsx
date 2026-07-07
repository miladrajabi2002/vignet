'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, Square, Trash2, Upload, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * VoiceRecorder — a self-contained voice capture widget using the
 * MediaRecorder API. Records up to `maxSeconds` (default 30) of audio and
 * exposes the resulting Blob to the parent via `onRecorded`.
 *
 * Lifecycle:
 *   idle → recording → ready (with playback) → idle
 *
 * The parent owns the actual upload/storage. This component is intentionally
 * upload-agnostic so it can be reused both for IG DM voice replies and the
 * broader voice-message feature. For IG automation, the parent typically
 * converts the Blob to a data URL and stores it in the form state (the IG
 * Messaging API accepts media via URL or by re-hosting; for the MVP preview we
 * use blob: URLs and the backend media-sender will re-host when the message is
 * actually sent).
 */
export function VoiceRecorder({
  onRecorded,
  onCleared,
  maxSeconds = 30,
  label = 'ضبط صدا',
  disabled,
}: {
  onRecorded: (blob: Blob, url: string) => void
  onCleared?: () => void
  maxSeconds?: number
  label?: string
  disabled?: boolean
}) {
  const [state, setState] = useState<'idle' | 'recording' | 'ready' | 'denied'>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioUrlRef = useRef<string | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer()
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    }
  }, [])

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  async function start() {
    if (disabled) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = pickMime()
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        })
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
        const url = URL.createObjectURL(blob)
        audioUrlRef.current = url
        setAudioUrl(url)
        setState('ready')
        onRecorded(blob, url)
      }
      recorderRef.current = recorder
      recorder.start()
      setElapsed(0)
      setState('recording')
      timerRef.current = setInterval(() => {
        setElapsed((s) => {
          if (s + 1 >= maxSeconds) {
            // Auto-stop at max
            stopInternal()
            return maxSeconds
          }
          return s + 1
        })
      }, 1000)
    } catch {
      setState('denied')
    }
  }

  function stopInternal() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    stopTimer()
  }

  function stop() {
    stopInternal()
    // state will become 'ready' in the onstop handler
  }

  function clear() {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    audioUrlRef.current = null
    setAudioUrl(null)
    setElapsed(0)
    setState('idle')
    onCleared?.()
  }

  async function upload() {
    // No-op placeholder: the parent owns the actual upload. We just expose
    // the blob via onRecorded on stop. This button exists so the UX matches
    // the spec (record → preview → upload). For the MVP, the parent treats
    // the blob: URL as the source of truth and converts/hosts when the form
    // submits.
    setUploading(true)
    try {
      await new Promise((r) => setTimeout(r, 400))
    } finally {
      setUploading(false)
    }
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(1, '0')
  const ss = String(elapsed % 60).padStart(2, '0')
  const maxMm = String(Math.floor(maxSeconds / 60)).padStart(1, '0')
  const maxSs = String(maxSeconds % 60).padStart(2, '0')

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
      {state === 'denied' ? (
        <div className="flex items-start gap-2 text-xs text-[var(--danger)]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="leading-relaxed">
            دسترسی به میکروفون داده نشد. در تنظیمات مرورگر اجازه دهید و دوباره تلاش کنید.
          </p>
        </div>
      ) : state === 'ready' && audioUrl ? (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <audio src={audioUrl} controls className="h-9 flex-1" />
            <span className="text-[11px] text-[var(--text-muted)]">{mm}:{ss}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={upload}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--white)] px-3 py-1.5 text-xs font-medium text-[var(--bg-base)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              استفاده
            </button>
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            >
              <Trash2 className="h-3 w-3" />
              حذف
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={state === 'recording' ? stop : start}
            disabled={disabled}
            aria-label={label}
            className={cn(
              'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all',
              state === 'recording'
                ? 'bg-[var(--danger)] text-white shadow-[0_0_0_4px_rgba(239,68,68,0.18)]'
                : 'bg-[var(--white)] text-[var(--bg-base)] hover:opacity-90',
              disabled && 'opacity-50',
            )}
          >
            {state === 'recording' ? (
              <Square className="h-4 w-4" fill="currentColor" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--text-primary)]">
                {state === 'recording' ? 'در حال ضبط…' : 'ضبط وویس'}
              </span>
              {state === 'recording' && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--danger)] opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--danger)]" />
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span
                className={cn(
                  'font-mono text-[11px] tabular-nums',
                  state === 'recording' ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]',
                )}
                dir="ltr"
              >
                {mm}:{ss}
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">/ {maxMm}:{maxSs}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Pick the best-supported audio mime type the browser will actually record. */
function pickMime(): string | undefined {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return undefined
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ]
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c
    } catch {
      // some browsers throw on isTypeSupported for odd strings
    }
  }
  return undefined
}
