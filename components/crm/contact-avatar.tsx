'use client'

import { useEffect, useState } from 'react'
import { User } from 'lucide-react'
import { cn } from '@/lib/utils'

const SIZES = {
  xs: { pixels: 24, frame: 'h-6 w-6', icon: 'h-3 w-3' },
  sm: { pixels: 36, frame: 'h-9 w-9', icon: 'h-4 w-4' },
  md: { pixels: 40, frame: 'h-10 w-10', icon: 'h-5 w-5' },
  lg: { pixels: 56, frame: 'h-14 w-14', icon: 'h-7 w-7' },
} as const

export function ContactAvatar({
  src,
  fallbackSrc,
  alt,
  size = 'sm',
  loading = 'lazy',
  className,
}: {
  src?: string | null
  fallbackSrc?: string | null
  alt: string
  size?: keyof typeof SIZES
  loading?: 'eager' | 'lazy'
  className?: string
}) {
  const [broken, setBroken] = useState(false)
  const [usingFallback, setUsingFallback] = useState(false)
  const dimensions = SIZES[size]

  useEffect(() => {
    setBroken(false)
    setUsingFallback(false)
  }, [fallbackSrc, src])

  const activeSrc = usingFallback || !src ? fallbackSrc ?? src : src

  if (activeSrc && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={activeSrc}
        alt={alt}
        width={dimensions.pixels}
        height={dimensions.pixels}
        loading={loading}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => {
          if (!usingFallback && fallbackSrc && fallbackSrc !== activeSrc) {
            setUsingFallback(true)
            return
          }
          setBroken(true)
        }}
        className={cn(
          dimensions.frame,
          'shrink-0 rounded-full border border-[var(--border-default)] object-cover',
          className,
        )}
      />
    )
  }

  return (
    <span
      role="img"
      aria-label={alt}
      className={cn(
        dimensions.frame,
        'inline-flex shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] text-[var(--text-secondary)]',
        className,
      )}
    >
      <User className={dimensions.icon} aria-hidden="true" />
    </span>
  )
}
