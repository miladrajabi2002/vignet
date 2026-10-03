'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Local state for a search box whose text is debounced into the URL (`?q=`).
 *
 * The naive pattern — `useEffect(() => setValue(urlValue), [urlValue])` —
 * eats keystrokes: the debounce sends "ab", the user keeps typing "abc",
 * then the navigation lands and resets the box to "ab". It also strips a
 * trailing space, since the URL only ever carries the trimmed query.
 *
 * Here the box only adopts the URL value when it is not an echo of a query
 * this box sent itself — i.e. back/forward, a "clear filters" link, etc.
 *
 * Usage:
 *
 *   const [value, setValue, markSent] = useUrlSearchInput(defaultQuery)
 *   // in the debounce timer, right before router.replace:
 *   markSent(value.trim())
 */
export function useUrlSearchInput(urlValue: string) {
  const [value, setValue] = useState(urlValue)
  // Queries sent but not yet seen back in the URL, oldest first.
  const pending = useRef<string[]>([])

  useEffect(() => {
    const echo = pending.current.indexOf(urlValue.trim())
    if (echo >= 0) {
      // Our own navigation landed; anything sent before it is superseded.
      pending.current = pending.current.slice(echo + 1)
      return
    }
    pending.current = []
    setValue(urlValue)
  }, [urlValue])

  const markSent = useCallback((query: string) => {
    pending.current.push(query.trim())
  }, [])

  return [value, setValue, markSent] as const
}
