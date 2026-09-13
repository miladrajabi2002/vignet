'use client'

/**
 * Client-side queue for the «بازگردانی» (undo) toast.
 *
 * Every delete — single or bulk — calls queueUndo() right after the DELETE
 * succeeds. The GlobalUndoToast mounted once in the dashboard layout picks
 * the request up and shows the redesigned undo snackbar. Because the payload
 * lives in sessionStorage (plus a custom event for instant pickup), the offer
 * survives route changes AND a page reload — deleting a contact from its
 * detail page navigates back to the list, and the undo bar is already there.
 */

export type UndoKind = 'contact' | 'conversation' | 'product' | 'order'

export interface UndoRequest {
  kind: UndoKind
  ids: string[]
  /** Singular human label for the snackbar message, e.g. "محصول". */
  entityLabel: string
  queuedAt: number
}

const STORAGE_KEY = 'vigent:undo-request'
export const UNDO_QUEUE_EVENT = 'vigent:undo-queued'
export const UNDO_RESTORED_EVENT = 'vigent:undo-restored'

/** How long a queued request may still be picked up after a reload. */
export const UNDO_PICKUP_TTL_MS = 9_000

export function queueUndo(kind: UndoKind, ids: string[], entityLabel: string): void {
  if (typeof window === 'undefined' || ids.length === 0) return
  const request: UndoRequest = { kind, ids, entityLabel, queuedAt: Date.now() }
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(request))
  } catch {
    // Private mode / storage full — the event still fires for the live page.
  }
  window.dispatchEvent(new CustomEvent<UndoRequest>(UNDO_QUEUE_EVENT, { detail: request }))
}

export function readQueuedUndo(): UndoRequest | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as UndoRequest
    if (
      !parsed ||
      typeof parsed.kind !== 'string' ||
      !Array.isArray(parsed.ids) ||
      parsed.ids.length === 0
    ) {
      window.sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    if (Date.now() - parsed.queuedAt > UNDO_PICKUP_TTL_MS) {
      window.sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearQueuedUndo(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/** Restore endpoint for each soft-deleted entity kind. */
export const UNDO_RESTORE_ENDPOINTS: Record<UndoKind, string> = {
  contact: '/api/contacts/bulk/restore',
  conversation: '/api/conversations/bulk/restore',
  product: '/api/products/bulk/restore',
  order: '/api/products/orders/bulk/restore',
}
