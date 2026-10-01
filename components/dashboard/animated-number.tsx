'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Counts from the previous value to the new one when the number changes
 * (credit dropping after a reply, a top-up landing), so the change is seen
 * instead of silently swapped. First paint and reduced motion show the value
 * as is.
 */
export function AnimatedNumber({ value, locale, duration = 600 }: { value: number; locale: string; duration?: number }) {
  const [shown, setShown] = useState(value)
  const previous = useRef(value)

  useEffect(() => {
    const from = previous.current
    previous.current = value
    if (from === value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(value)
      return
    }
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setShown(Math.round(from + (value - from) * eased))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return <>{shown.toLocaleString(locale)}</>
}
