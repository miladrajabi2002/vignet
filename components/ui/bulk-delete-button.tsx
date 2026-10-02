'use client'

/**
 * Bulk-delete button — used on the products / orders / conversations /
 * contacts pages to remove all records in the current workspace, or a caller-
 * supplied selection.
 *
 * Shows a confirm dialog with the actual count of records that will be
 * deleted (fetched from a count endpoint), then sends DELETE to the matching
 * API route. The route soft-deletes the rows and returns their ids, which
 * are queued for the global «بازگردانی» (undo) snackbar (requires
 * `restoreEndpoint` + `undoKind`). Trashed rows are purged by the worker
 * after 7 days.
 *
 * After a successful deletion, calls router.refresh() to reload the current
 * page's server component data. If the caller needs custom post-delete
 * behavior (e.g. navigate to a different URL), pass an `onDeleted` callback.
 *
 * ⚠️ Security: the API route is workspace-scoped, so even if a user
 * tampers with the request, they can only delete records in their own
 * workspace. The session cookie + workspaceId check on the server side
 * is the real security gate; this button is just UX.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Trash2, AlertTriangle, Ellipsis } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'
import { queueUndo, type UndoKind } from '@/lib/undo-queue'

interface BulkDeleteButtonProps {
  /** Endpoint that returns { count: number } — used to show the actual
   *  number of records that will be deleted. */
  countEndpoint: string
  /** DELETE endpoint that wipes all records in the workspace. */
  deleteEndpoint: string
  /** POST endpoint that restores the soft-deleted ids (undo). */
  restoreEndpoint?: string
  /** Which soft-deleted entity this button trashes — feeds the undo queue. */
  undoKind?: UndoKind
  /** Human label for what's being deleted, e.g. "محصولات". */
  entityLabel: string
  /** Singular human label used in the undo snackbar, e.g. "محصول". */
  entitySingularLabel?: string
  /** Optional: label for the button itself (defaults to «حذف همه»). */
  buttonLabel?: string
  /** Optional fixed count. When provided, the count endpoint is not queried. */
  countOverride?: number
  /** Optional JSON body sent with the DELETE request. */
  deleteBody?: unknown
  /** Optional: title for the confirm dialog (defaults to «حذف همه ${entityLabel}»). */
  dialogTitle?: string
  /** Optional: extra warning text shown under the count. */
  extraWarning?: string
  /** Called after a successful deletion — usually to navigate or
   *  clear local state. router.refresh() is always called automatically. */
  onDeleted?: () => void
  /** Use an icon-only trigger on narrow screens to keep action rails on one row. */
  compactOnMobile?: boolean
  /**
   * `menu` tucks the delete action inside a quiet «⋯» overflow menu, so a
   * once-a-year destructive action does not sit beside the page's daily
   * primary button. `button` keeps the standalone red trigger.
   */
  variant?: 'button' | 'menu'
  /** Extra rows shown above the delete action inside the «⋯» menu. */
  menuItems?: React.ReactNode
}

/** Restyles caller-supplied links (e.g. export) as full-width menu rows. */
const MENU_LINK_CLASS =
  '[&_a]:flex [&_a]:min-h-11 [&_a]:w-full [&_a]:items-center [&_a]:justify-start [&_a]:gap-2 [&_a]:rounded-xl [&_a]:border-0 [&_a]:bg-transparent [&_a]:px-3 [&_a]:text-xs [&_a]:font-medium [&_a]:text-[var(--text-primary)] [&_a]:shadow-none [&_a:hover]:bg-[var(--bg-hover)]'

export function BulkDeleteButton({
  countEndpoint,
  deleteEndpoint,
  restoreEndpoint,
  undoKind,
  entityLabel,
  entitySingularLabel,
  buttonLabel = 'حذف همه',
  countOverride,
  deleteBody,
  dialogTitle,
  extraWarning,
  onDeleted,
  compactOnMobile = false,
  variant = 'button',
  menuItems,
}: BulkDeleteButtonProps) {
  const router = useRouter()
  const locale = useLocale()
  const fa = locale !== 'en'
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [count, setCount] = useState<number | null>(null)
  const [countLoading, setCountLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Element
      // On phones the menu is a bottom sheet portalled to <body>; it closes itself.
      if (target.closest?.('[role="dialog"]')) return
      if (!menuRef.current?.contains(target)) setMenuOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  // When the dialog opens, fetch the actual record count so the user
  // sees «۱۲۳ محصول حذف می‌شود» instead of a generic warning. This
  // makes the confirmation feel real and reduces accidental clicks.
  useEffect(() => {
    if (!open) return
    setCount(null)
    setError(null)
    if (countOverride !== undefined) {
      setCount(countOverride)
      setCountLoading(false)
      return
    }
    setCountLoading(true)
    fetch(countEndpoint, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('COUNT_FAILED'))))
      .then((data) => setCount(typeof data.count === 'number' ? data.count : 0))
      .catch(() => setCount(0))
      .finally(() => setCountLoading(false))
  }, [open, countEndpoint, countOverride])

  async function handleConfirm() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(deleteEndpoint, {
        method: 'DELETE',
        ...(deleteBody === undefined
          ? {}
          : {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(deleteBody),
            }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const body = await res.json().catch(() => ({}))
      setOpen(false)
      // Always refresh the server component's data so the deleted
      // records disappear from the list without a manual F5.
      router.refresh()
      onDeleted?.()
      // Offer undo when the route reported which ids it trashed — the
      // GLOBAL toast (dashboard layout) renders the snackbar, so it
      // survives navigation and reloads.
      if (restoreEndpoint && undoKind && Array.isArray(body.ids) && body.ids.length > 0) {
        queueUndo(undoKind, body.ids as string[], entitySingularLabel ?? entityLabel)
      }
    } catch {
      setError(fa ? 'حذف انجام نشد؛ اتصال را بررسی کنید و دوباره تلاش کنید.' : 'Delete failed. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const countText =
    countLoading
      ? fa ? 'در حال شمارش…' : 'Counting…'
      : count !== null
        ? fa
          ? `${count.toLocaleString('fa-IR')} ${entityLabel} حذف می‌شود`
          : `${count} ${entityLabel} will be deleted`
        : ''

  const description = [countText, extraWarning].filter(Boolean).join('. ')
  // Only promise an undo when this entity really is restorable.
  const undoNote = restoreEndpoint && undoKind
    ? (fa
        ? 'تا چند ثانیه بعد از حذف، دکمهٔ «بازگردانی» پایین صفحه همه را برمی‌گرداند.'
        : 'For a few seconds after deleting, the Undo button at the bottom of the screen brings them all back.')
    : undefined

  const dialogTitleText = dialogTitle
    ?? (fa ? `حذف همه ${entityLabel}` : `Delete all ${entityLabel}`)
  const confirmLabel = busy
    ? (fa ? 'در حال حذف…' : 'Deleting…')
    : (fa ? 'بله، حذف کن' : 'Yes, delete')

  return (
    <>
      {variant === 'menu' ? (
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={fa ? 'کارهای بیشتر' : 'More actions'}
            title={fa ? 'کارهای بیشتر' : 'More actions'}
            className="inline-flex size-11 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <Ellipsis className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div
              role="menu"
              onClick={() => setMenuOpen(false)}
              className={`absolute end-0 top-full z-40 mt-2 hidden min-w-52 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-1.5 shadow-[var(--elev-2)] md:block ${MENU_LINK_CLASS}`}
            >
              {menuItems}
              {/* The destructive action is fenced off from the routine ones above it. */}
              {menuItems ? <div aria-hidden className="mx-2 my-1.5 h-px bg-[var(--border-default)]" /> : null}
              <button
                type="button"
                role="menuitem"
                onClick={() => setOpen(true)}
                className="flex min-h-11 w-full items-center gap-2 rounded-xl bg-red-50/70 px-3 text-start text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {buttonLabel}
              </button>
            </div>
          )}
          {/* Phones get the same actions as a bottom sheet, like every other mobile menu. */}
          <MobileBottomSheet
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            title={fa ? 'کارهای بیشتر' : 'More actions'}
            closeLabel={fa ? 'بستن' : 'Close'}
          >
            <div
              onClick={() => setMenuOpen(false)}
              className={`space-y-2 [&_a]:!min-h-12 [&_a]:!bg-[var(--bg-base)] [&_a]:!text-sm ${MENU_LINK_CLASS}`}
            >
              {menuItems}
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex min-h-12 w-full items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 text-start text-sm font-medium text-red-700"
              >
                <Trash2 className="h-4 w-4" />
                {buttonLabel}
              </button>
            </div>
          </MobileBottomSheet>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={buttonLabel}
          title={buttonLabel}
          className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50 ${compactOnMobile ? 'w-11 px-0 sm:w-auto sm:px-3' : 'px-3'}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className={compactOnMobile ? 'hidden sm:inline' : undefined}>
            {buttonLabel}
          </span>
        </button>
      )}

      <ConfirmDialog
        open={open}
        title={dialogTitleText}
        description={description}
        undoNote={undoNote}
        cancelLabel={fa ? 'انصراف' : 'Cancel'}
        confirmLabel={confirmLabel}
        tone="danger"
        busy={busy}
        error={error}
        icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
        onConfirm={handleConfirm}
        onClose={() => {
          if (!busy) setOpen(false)
        }}
      />
    </>
  )
}
