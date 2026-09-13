'use client'

import { useEffect } from 'react'

/**
 * Unsaved-changes protection — "never make them start over".
 *
 * Arms a `beforeunload` guard while `dirty` is true, so closing or
 * reloading the tab with unsaved form input asks the user for
 * confirmation instead of silently discarding their work.
 *
 * Usage:
 *
 *   const [form, setForm] = useState(initial)
 *   const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial])
 *   useUnsavedChangesGuard(dirty)
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => {
      // Modern browsers ignore custom text, but preventDefault + returnValue
      // are both required to trigger the native confirmation prompt.
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])
}
