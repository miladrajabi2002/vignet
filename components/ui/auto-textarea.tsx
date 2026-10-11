'use client'

import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'

/**
 * A textarea that is as tall as its text: it grows line by line up to
 * `maxRows`, and only then scrolls. A fixed four-line box inside a page that
 * already scrolls hid the last line and made long prompts hard to review,
 * most of all on a phone.
 */
export function AutoTextarea({
  maxRows = 12,
  value,
  ...rest
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value'> & { value: string; maxRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const cs = window.getComputedStyle(el)
    const line = Number.parseFloat(cs.lineHeight) || 24
    const border = Number.parseFloat(cs.borderTopWidth) + Number.parseFloat(cs.borderBottomWidth)
    const padding = Number.parseFloat(cs.paddingTop) + Number.parseFloat(cs.paddingBottom)
    const max = line * maxRows + padding + border
    const wanted = el.scrollHeight + border
    el.style.height = `${Math.min(wanted, max)}px`
    el.style.overflowY = wanted > max ? 'auto' : 'hidden'
  }, [value, maxRows])

  return <textarea ref={ref} value={value} {...rest} />
}
