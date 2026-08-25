'use client'

import { useEffect } from 'react'
import { recoverFromChunkLoadError } from '@/lib/observability/chunk-load-recovery'

/** Catch chunk failures that happen outside React's error-boundary lifecycle. */
export function ChunkLoadRecovery() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      recoverFromChunkLoadError(event.error ?? event.message)
    }
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (recoverFromChunkLoadError(event.reason) === 'reload-started') {
        event.preventDefault()
      }
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }, [])

  return null
}
