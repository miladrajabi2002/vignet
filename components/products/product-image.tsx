'use client'

import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react'
import { productImageSrc } from '@/lib/products/image-src'

/**
 * Product photo that loads straight from the shop and falls back to our
 * cached copy only for viewers who cannot reach the shop.
 *
 * Most viewers reach the shop fine, so they cost our server nothing. When the
 * direct load errors — or has not finished DIRECT_TIMEOUT_MS after the image
 * scrolled into view (blocked hosts usually hang rather than fail) — the
 * image switches to `/media/products/remote` and the host is remembered for
 * the browser session, so the shop's other photos skip the wait.
 */

const DIRECT_TIMEOUT_MS = 4_000
const BLOCKED_HOSTS_KEY = 'vigent:unreachable-image-hosts'
const blockedHosts = new Set<string>()
let blockedHostsLoaded = false

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

function isBlocked(host: string): boolean {
  if (!blockedHostsLoaded) {
    blockedHostsLoaded = true
    try {
      const saved = JSON.parse(sessionStorage.getItem(BLOCKED_HOSTS_KEY) ?? '[]') as unknown
      if (Array.isArray(saved)) saved.forEach((h) => typeof h === 'string' && blockedHosts.add(h))
    } catch {
      // Storage unavailable — the in-memory set still works for this page.
    }
  }
  return blockedHosts.has(host)
}

function markBlocked(host: string): void {
  blockedHosts.add(host)
  try {
    sessionStorage.setItem(BLOCKED_HOSTS_KEY, JSON.stringify([...blockedHosts]))
  } catch {
    // Non-essential.
  }
}

type ProductImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string
}

export function ProductImage({ src, onError, onLoad, ...props }: ProductImageProps) {
  const fallbackSrc = productImageSrc(src)
  const canFallback = fallbackSrc !== src
  const host = canFallback ? hostOf(src) : null
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const useFallback = canFallback && failedSrc === src
  const ref = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (!canFallback || useFallback) return
    const fallback = () => {
      if (host) markBlocked(host)
      setFailedSrc(src)
    }
    if (host && isBlocked(host)) {
      setFailedSrc(src)
      return
    }
    const img = ref.current
    if (!img) return
    // Errored before hydration attached onError.
    if (img.complete) {
      if (img.naturalWidth === 0) fallback()
      return
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    // Lazy images only start loading near the viewport — start the clock then.
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        timer = setTimeout(() => {
          const el = ref.current
          if (el && !(el.complete && el.naturalWidth > 0)) fallback()
        }, DIRECT_TIMEOUT_MS)
      },
      { rootMargin: '200px' },
    )
    observer.observe(img)
    return () => {
      observer.disconnect()
      if (timer) clearTimeout(timer)
    }
  }, [src, host, canFallback, useFallback])

  return (
    // Shop photos come from arbitrary tenant hosts — next/image can't list them.
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img
      {...props}
      ref={ref}
      src={useFallback ? fallbackSrc : src}
      onError={(event) => {
        if (canFallback && !useFallback) {
          if (host) markBlocked(host)
          setFailedSrc(src)
        }
        onError?.(event)
      }}
      onLoad={onLoad}
    />
  )
}
