'use client'

import { useRef, useState } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// Minimal structural type for the MicVAD instance we use (lib is browser-only,
// imported dynamically so it never runs during SSR/build).
interface MicVADInstance {
  start: () => void
  pause: () => void
  destroy: () => void
}

/**
 * Records microphone audio and transcribes it via /api/voice/stt (Whisper, BYOK).
 *
 * Two capture modes:
 *  - default: manual MediaRecorder (click to start, click to stop).
 *  - vad: hands-free. Silero VAD (@ricky0123/vad-web) detects the utterance and
 *    auto-stops on silence, then transcribes the captured speech.
 */
export function VoiceRecorder({
  onTranscript,
  onError,
  disabled,
  label,
  vad = false,
}: {
  onTranscript: (text: string) => void
  onError?: (code: string) => void
  disabled?: boolean
  label?: string
  vad?: boolean
}) {
  const [state, setState] = useState<'idle' | 'recording' | 'busy'>('idle')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const vadRef = useRef<MicVADInstance | null>(null)

  async function start() {
    if (vad) return startVad()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        void transcribe(blob, 'recording.webm')
      }
      recorderRef.current = recorder
      recorder.start()
      setState('recording')
    } catch {
      onError?.('MIC_DENIED')
    }
  }

  async function startVad() {
    try {
      const { MicVAD, utils } = await import('@ricky0123/vad-web')
      const instance = await MicVAD.new({
        onSpeechEnd: (audio: Float32Array) => {
          // 16kHz mono float PCM → WAV for Whisper.
          const wav = utils.encodeWAV(audio)
          vadRef.current?.pause()
          void transcribe(new Blob([wav], { type: 'audio/wav' }), 'speech.wav')
        },
        onVADMisfire: () => {
          // Too short to be speech — keep listening silently.
        },
      })
      vadRef.current = instance as unknown as MicVADInstance
      instance.start()
      setState('recording')
    } catch (e) {
      console.error('[vad] init failed:', e)
      onError?.('MIC_DENIED')
    }
  }

  function stop() {
    if (vad) {
      vadRef.current?.destroy()
      vadRef.current = null
      setState('idle')
      return
    }
    recorderRef.current?.stop()
    setState('busy')
  }

  async function transcribe(blob: Blob, filename: string) {
    if (blob.size === 0) {
      setState('idle')
      return
    }
    setState('busy')
    try {
      const form = new FormData()
      form.append('audio', blob, filename)
      const res = await fetch('/api/voice/stt', { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        onError?.(data.error ?? 'STT_FAILED')
      } else if (data.text) {
        onTranscript(data.text)
      }
    } catch {
      onError?.('STT_FAILED')
    } finally {
      vadRef.current?.destroy()
      vadRef.current = null
      setState('idle')
    }
  }

  const recording = state === 'recording'
  const busy = state === 'busy'

  return (
    <button
      type="button"
      onClick={recording ? stop : start}
      disabled={disabled || busy}
      aria-label={label}
      className={cn(
        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors disabled:opacity-50',
        recording
          ? 'border-danger/40 bg-danger/10 text-danger'
          : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
      )}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : recording ? (
        <Square className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </button>
  )
}
