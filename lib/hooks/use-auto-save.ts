'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AUTO_SAVE_DELAY_MS, createAutoSaver, type AutoSaver, type AutoSaveStatus } from '@/lib/auto-save'
import { useUnsavedChangesGuard } from '@/lib/hooks/use-unsaved-changes-guard'

/**
 * Saves a form by itself — no save button.
 *
 * Pass the value the server should hold (anything JSON-serializable) and how
 * to send it. A change is saved after a short pause in editing; call `flush`
 * from `onBlur` so leaving a field saves at once. Show `status` with
 * <AutoSaveStatus />.
 *
 *   const auto = useAutoSave({
 *     value: { name, notes },
 *     valid: name.trim().length > 0,
 *     save: async (value) => {
 *       const res = await fetch(url, { method: 'PATCH', body: JSON.stringify(value) })
 *       if (!res.ok) throw new Error('SAVE_FAILED')
 *     },
 *   })
 *   <div onBlur={auto.flush}>…</div>
 *   <AutoSaveStatus status={auto.status} onRetry={auto.flush} />
 *
 * The value at mount is taken as what is already stored. Closing the tab
 * while a change is still on its way asks for confirmation; leaving the
 * screen inside the app sends it.
 */
export function useAutoSave<T>({
  value,
  save,
  valid = true,
  delay = AUTO_SAVE_DELAY_MS,
}: {
  value: T
  save: (value: T) => Promise<void>
  /** False while the value must not be sent (failed validation). */
  valid?: boolean
  delay?: number
}) {
  const [status, setStatus] = useState<AutoSaveStatus>('idle')
  const saveRef = useRef(save)
  saveRef.current = save
  const valueRef = useRef(value)
  valueRef.current = value
  const storedRef = useRef(value)
  const saverRef = useRef<AutoSaver<T> | null>(null)

  useEffect(() => {
    const saver = createAutoSaver<T>(storedRef.current, {
      save: (next) => saveRef.current(next),
      delay,
      onStatus: setStatus,
    })
    saverRef.current = saver
    return () => {
      // What goes out on the way out counts as stored if this effect runs again.
      if (saver.dispose()) storedRef.current = valueRef.current
      saverRef.current = null
    }
  }, [delay])

  const key = JSON.stringify(value)
  useEffect(() => {
    saverRef.current?.update(valueRef.current, valid)
  }, [key, valid])

  const flush = useCallback(() => saverRef.current?.flush(), [])

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') saverRef.current?.flush()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [])

  useUnsavedChangesGuard(status === 'pending' || status === 'saving' || status === 'error')

  return { status, flush, busy: status === 'pending' || status === 'saving' }
}
