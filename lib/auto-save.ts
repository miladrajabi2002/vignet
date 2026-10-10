/**
 * Saving without a save button.
 *
 * A form reports its current value on every change; the saver waits for a
 * short pause, sends the latest value once, and reports how that went so the
 * form can show "saving… / saved / not saved" in place of a button.
 *
 *   - edits made while a request is in flight are sent after it, never lost
 *   - an invalid value (half-typed email, empty required name) is held back
 *   - a failed save stays "error" until the next edit or a retry
 *   - leaving the form sends what is still waiting
 *
 * Framework-free on purpose: lib/hooks/use-auto-save.ts is the React face.
 */

export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

/** Pause after the last change before a save goes out. */
export const AUTO_SAVE_DELAY_MS = 800

export interface AutoSaverOptions<T> {
  /** Sends the value; rejects when it was not stored. */
  save: (value: T) => Promise<void>
  delay?: number
  /** How long "saved" shows before the status settles back to idle. */
  savedHoldMs?: number
  onStatus?: (status: AutoSaveStatus) => void
}

export interface AutoSaver<T> {
  /** The form's current value. `valid: false` holds it back until it is fixed. */
  update(value: T, valid?: boolean): void
  /** Save now instead of waiting out the pause — blur, Enter, retry. */
  flush(): void
  /** Stop for good. A valid change still waiting is sent; returns whether one was. */
  dispose(): boolean
  readonly status: AutoSaveStatus
}

export function createAutoSaver<T>(initial: T, options: AutoSaverOptions<T>): AutoSaver<T> {
  const delay = options.delay ?? AUTO_SAVE_DELAY_MS
  const savedHoldMs = options.savedHoldMs ?? 1800

  let storedKey = JSON.stringify(initial)
  let value = initial
  let key = storedKey
  let valid = true
  let status: AutoSaveStatus = 'idle'
  let timer: ReturnType<typeof setTimeout> | undefined
  let holdTimer: ReturnType<typeof setTimeout> | undefined
  let saving = false
  let disposed = false

  const waiting = () => key !== storedKey && valid

  function setStatus(next: AutoSaveStatus) {
    if (status === next) return
    status = next
    if (!disposed) options.onStatus?.(next)
  }

  function clearTimer() {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }

  function showSaved() {
    setStatus('saved')
    holdTimer = setTimeout(() => setStatus('idle'), savedHoldMs)
  }

  async function run() {
    clearTimer()
    if (saving) return
    if (!waiting()) {
      // The request that just landed already carried this value.
      if (status === 'saving') {
        if (key === storedKey) showSaved()
        else setStatus('idle')
      }
      return
    }
    saving = true
    if (holdTimer !== undefined) clearTimeout(holdTimer)
    setStatus('saving')
    const sentKey = key
    let ok = true
    try {
      await options.save(value)
    } catch {
      ok = false
    }
    saving = false
    if (ok) storedKey = sentKey

    if (disposed) {
      // The form is gone, but it changed again while this request was out.
      if (ok && waiting()) void options.save(value).catch(() => {})
      return
    }
    // Edited while the request was out: that edit's own pause decides when it goes.
    if (timer !== undefined) return
    if (ok && waiting()) {
      void run()
      return
    }
    if (!ok) {
      setStatus('error')
      return
    }
    if (key !== storedKey) {
      setStatus('idle')
      return
    }
    showSaved()
  }

  return {
    update(next, isValid = true) {
      if (disposed) return
      value = next
      key = JSON.stringify(next)
      valid = isValid
      clearTimer()
      if (!waiting()) {
        if (!saving && (status === 'pending' || status === 'error')) setStatus('idle')
        return
      }
      if (holdTimer !== undefined) clearTimeout(holdTimer)
      if (!saving) setStatus('pending')
      timer = setTimeout(() => void run(), delay)
    },
    flush() {
      if (!disposed && waiting()) void run()
    },
    dispose() {
      if (disposed) return false
      disposed = true
      clearTimer()
      if (holdTimer !== undefined) clearTimeout(holdTimer)
      if (saving || !waiting()) return false
      void options.save(value).catch(() => {})
      return true
    },
    get status() {
      return status
    },
  }
}
