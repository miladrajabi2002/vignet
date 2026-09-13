'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { UndoSnackbar, type UndoPhase } from '@/components/ui/undo-snackbar'
import {
  UNDO_QUEUE_EVENT,
  UNDO_RESTORED_EVENT,
  UNDO_RESTORE_ENDPOINTS,
  clearQueuedUndo,
  readQueuedUndo,
  type UndoRequest,
} from '@/lib/undo-queue'

/**
 * Mounted ONCE in the dashboard layout so the undo offer survives every
 * in-app navigation (list → detail → delete → back) and page reloads.
 * Delete sites never render their own snackbar — they call queueUndo().
 */
export function GlobalUndoToast() {
  const router = useRouter()
  const locale = useLocale()
  const [request, setRequest] = useState<UndoRequest | null>(null)
  const [phase, setPhase] = useState<UndoPhase | null>(null)

  const adopt = useCallback((next: UndoRequest | null) => {
    setRequest(next)
    setPhase(next ? 'undo' : null)
  }, [])

  // Pick up queued requests: on mount (reload case) and live via the event.
  useEffect(() => {
    adopt(readQueuedUndo())
    function onQueued(event: Event) {
      const detail = (event as CustomEvent<UndoRequest>).detail
      if (detail) adopt({ ...detail, queuedAt: detail.queuedAt ?? Date.now() })
    }
    window.addEventListener(UNDO_QUEUE_EVENT, onQueued)
    return () => window.removeEventListener(UNDO_QUEUE_EVENT, onQueued)
  }, [adopt])

  const dismiss = useCallback(() => {
    setPhase(null)
    setRequest(null)
    clearQueuedUndo()
  }, [])

  const performUndo = useCallback(async () => {
    if (!request) {
      dismiss()
      return
    }
    setPhase('restoring')
    try {
      const res = await fetch(UNDO_RESTORE_ENDPOINTS[request.kind], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: request.ids }),
      })
      if (!res.ok) throw new Error('RESTORE_FAILED')
      setPhase('restored')
      clearQueuedUndo()
      router.refresh()
      // Let list pages react (e.g. clear a stale row selection).
      window.dispatchEvent(new CustomEvent(UNDO_RESTORED_EVENT, { detail: { kind: request.kind } }))
    } catch {
      setPhase('error')
    }
  }, [request, dismiss, router])

  return (
    <UndoSnackbar
      phase={phase}
      count={request?.ids.length ?? 0}
      entityLabel={request?.entityLabel ?? ''}
      locale={locale === 'en' ? 'en' : 'fa'}
      onUndo={performUndo}
      onDismiss={dismiss}
    />
  )
}
