'use client'

/**
 * Bulk-delete button — used on the products / orders / conversations /
 * contacts pages to remove all records in the current workspace, or a caller-
 * supplied selection.
 *
 * Shows a confirm dialog with the actual count of records that will be
 * deleted (fetched from a count endpoint), then sends DELETE to the
 * matching API route. The route soft-deletes the rows and returns their ids,
 * which feed the «بازگردانی» (undo) snackbar for a few seconds afterwards
 * (requires `restoreEndpoint`). Trashed rows are purged by the worker after
 * 7 days.
 *
 * After a successful deletion, calls router.refresh() to reload the
 * current page's server component data. If the caller needs custom
 * post-delete behavior (e.g. navigate to a different URL), pass an
 * `onDeleted` callback.
 *
 * ⚠️ Security: the API route is workspace-scoped, so even if a user
 * tampers with the request, they can only delete records in their own
 * workspace. The session cookie + workspaceId check on the server side
 * is the real security gate; this button is just UX.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Trash2, AlertTriangle } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { UndoSnackbar, type UndoPhase } from '@/components/ui/undo-snackbar'

interface BulkDeleteButtonProps {
  /** Endpoint that returns { count: number } — used to show the actual
   *  number of records that will be deleted. */
  countEndpoint: string
  /** DELETE endpoint that wipes all records in the workspace. */
  deleteEndpoint: string
  /** POST endpoint that restores the soft-deleted ids (undo). */
  restoreEndpoint?: string
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
  /** Optional: title for the confirm dialog (defaults to «حذف همه ${entityLabel}»).
   *  Set this when the button label is not "حذف همه" — e.g. the
   *  "delete cancelled orders" button should have dialogTitle="حذف سفارش‌های
   *  لغو شده" instead of "حذف همه سفارش‌های لغو شده". */
  dialogTitle?: string
  /** Optional: extra warning text shown under the count. */
  extraWarning?: string
  /** Called after a successful deletion — usually to navigate or
   *  clear local state. router.refresh() is always called automatically. */
  onDeleted?: () => void
  /** Called after a successful undo — usually to clear local selection. */
  onRestored?: () => void
  /** Use an icon-only trigger on narrow screens to keep action rails on one row. */
  compactOnMobile?: boolean
}

const UNDO_DURATION_MS = 9_000

export function BulkDeleteButton({
  countEndpoint,
  deleteEndpoint,
  restoreEndpoint,
  entityLabel,
  entitySingularLabel,
  buttonLabel = 'حذف همه',
  countOverride,
  deleteBody,
  dialogTitle,
  extraWarning,
  onDeleted,
  onRestored,
  compactOnMobile = false,
}: BulkDeleteButtonProps) {
  const router = useRouter()
  const locale = useLocale()
  const fa = locale !== 'en'
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [count, setCount] = useState<number | null>(null)
  const [countLoading, setCountLoading] = useState(false)

  // ── Undo snackbar state ──
  const [undoPhase, setUndoPhase] = useState<UndoPhase | null>(null)
  const [undoIds, setUndoIds] = useState<string[]>([])
  const undoSnapshotRef = useRef<{ count: number }>({ count: 0 })

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

  function dismissUndo() {
    setUndoPhase(null)
    setUndoIds([])
  }

  async function performUndo() {
    if (!restoreEndpoint || undoIds.length === 0) {
      dismissUndo()
      return
    }
    setUndoPhase('restoring')
    try {
      const res = await fetch(restoreEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: undoIds }),
      })
      if (!res.ok) throw new Error('RESTORE_FAILED')
      setUndoPhase('restored')
      router.refresh()
      onRestored?.()
    } catch {
      setUndoPhase('error')
    }
  }

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
      // Offer undo when the route reported which ids it trashed.
      if (restoreEndpoint && Array.isArray(body.ids) && body.ids.length > 0) {
        undoSnapshotRef.current = { count: body.ids.length }
        setUndoIds(body.ids as string[])
        setUndoPhase('undo')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطای ناشناخته')
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

  const description = [
    countText,
    fa
      ? 'بلافاصله بعد از حذف، چند ثانیه فرصت «بازگردانی» خواهید داشت.'
      : 'Right after the delete you get a few seconds to undo.',
    extraWarning,
  ].filter(Boolean).join(' ')

  const dialogTitleText = dialogTitle
    ?? (fa ? `حذف همه ${entityLabel}` : `Delete all ${entityLabel}`)
  const confirmLabel = busy
    ? (fa ? 'در حال حذف…' : 'Deleting…')
    : (fa ? 'بله، حذف کن' : 'Yes, delete')

  return (
    <>
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

      <ConfirmDialog
        open={open}
        title={dialogTitleText}
        description={description}
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

      {restoreEndpoint && (
        <UndoSnackbar
          phase={undoPhase}
          count={undoSnapshotRef.current.count}
          entityLabel={entitySingularLabel ?? entityLabel}
          locale={fa ? 'fa' : 'en'}
          durationMs={UNDO_DURATION_MS}
          onUndo={performUndo}
          onDismiss={dismissUndo}
        />
      )}
    </>
  )
}
