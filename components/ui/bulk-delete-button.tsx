'use client'

/**
 * Bulk-delete button — used on the products / orders / conversations /
 * contacts pages to wipe ALL records in the current workspace.
 *
 * Shows a confirm dialog with the actual count of records that will be
 * deleted (fetched from a count endpoint), then sends DELETE to the
 * matching API route. The dialog warns the user that this is permanent
 * and cannot be undone.
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

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface BulkDeleteButtonProps {
  /** Endpoint that returns { count: number } — used to show the actual
   *  number of records that will be deleted. */
  countEndpoint: string
  /** DELETE endpoint that wipes all records in the workspace. */
  deleteEndpoint: string
  /** Human label for what's being deleted, e.g. "محصولات". */
  entityLabel: string
  /** Optional: label for the button itself (defaults to «حذف همه»). */
  buttonLabel?: string
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
}

export function BulkDeleteButton({
  countEndpoint,
  deleteEndpoint,
  entityLabel,
  buttonLabel = 'حذف همه',
  dialogTitle,
  extraWarning,
  onDeleted,
}: BulkDeleteButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [count, setCount] = useState<number | null>(null)
  const [countLoading, setCountLoading] = useState(false)

  // When the dialog opens, fetch the actual record count so the user
  // sees «۱۲۳ محصول حذف می‌شود» instead of a generic warning. This
  // makes the confirmation feel real and reduces accidental clicks.
  useEffect(() => {
    if (!open) return
    setCount(null)
    setError(null)
    setCountLoading(true)
    fetch(countEndpoint, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('COUNT_FAILED'))))
      .then((data) => setCount(typeof data.count === 'number' ? data.count : 0))
      .catch(() => setCount(0))
      .finally(() => setCountLoading(false))
  }, [open, countEndpoint])

  async function handleConfirm() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(deleteEndpoint, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      setOpen(false)
      // Always refresh the server component's data so the deleted
      // records disappear from the list without a manual F5.
      router.refresh()
      onDeleted?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطای ناشناخته')
    } finally {
      setBusy(false)
    }
  }

  const countText =
    countLoading
      ? 'در حال شمارش…'
      : count !== null
        ? `${count.toLocaleString('fa-IR')} ${entityLabel} حذف می‌شود`
        : ''

  const description = [
    countText,
    'این عملیات غیرقابل بازگشت است و هیچ راهی برای بازیابی اطلاعات وجود ندارد.',
    extraWarning,
  ].filter(Boolean).join(' ')

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {buttonLabel}
      </button>

      <ConfirmDialog
        open={open}
        title={dialogTitle ?? `حذف همه ${entityLabel}`}
        description={description}
        confirmLabel={busy ? 'در حال حذف…' : 'بله، حذف کن'}
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
