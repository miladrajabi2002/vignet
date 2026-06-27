'use client'

import { useRef, useState } from 'react'
import { Volume2, Loader2, Pause } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Speaks a piece of text via /api/voice/tts (BYOK) and plays the returned audio.
 * Caches the generated blob URL so repeated plays don't re-synthesize.
 */
export function SpeakButton({
  text,
  disabled,
  label,
}: {
  text: string
  disabled?: boolean
  label?: string
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)

  async function toggle() {
    if (state === 'playing') {
      audioRef.current?.pause()
      setState('idle')
      return
    }
    if (!text.trim()) return

    try {
      if (!urlRef.current) {
        setState('loading')
        const res = await fetch('/api/voice/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })
        if (!res.ok) {
          setState('idle')
          return
        }
        const blob = await res.blob()
        urlRef.current = URL.createObjectURL(blob)
      }
      const audio = audioRef.current ?? new Audio()
      audioRef.current = audio
      audio.src = urlRef.current
      audio.onended = () => setState('idle')
      await audio.play()
      setState('playing')
    } catch {
      setState('idle')
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-40',
      )}
    >
      {state === 'loading' ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : state === 'playing' ? (
        <Pause className="h-3.5 w-3.5" />
      ) : (
        <Volume2 className="h-3.5 w-3.5" />
      )}
    </button>
  )
}
