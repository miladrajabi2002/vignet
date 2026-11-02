'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { queueUndo } from '@/lib/undo-queue'

/**
 * Trashes one closed chat pre-order from «درخواست‌ها», after the shared
 * confirm dialog; «بازگردانی» brings it back for a few minutes.
 */
export function RequestDeleteButton({ draftId, label, fa }: { draftId: string; label: string; fa: boolean }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function remove() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/commerce/order-drafts/${draftId}`, { method: 'DELETE' })
      if (response.status === 409) throw new Error(fa ? 'سفارش باز را اول لغو کنید، بعد حذفش کنید.' : 'Cancel the open pre-order first, then delete it.')
      if (!response.ok && response.status !== 404) throw new Error(fa ? 'حذف نشد؛ دوباره تلاش کنید.' : 'It was not deleted; try again.')
      setConfirming(false)
      if (response.ok) queueUndo('request', [draftId], fa ? 'پیش‌سفارش' : 'pre-order')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        title={fa ? 'حذف پیش‌سفارش' : 'Delete pre-order'}
        onClick={() => { setError(null); setConfirming(true) }}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-default)] bg-white text-[var(--text-muted)] transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] dark:bg-neutral-900 dark:hover:border-red-900 dark:hover:bg-red-950/40 dark:hover:text-red-300"
      >
        <Trash2 className="size-4" aria-hidden />
        <span className="sr-only">{fa ? 'حذف پیش‌سفارش' : 'Delete pre-order'}</span>
      </button>
      <ConfirmDialog
        open={confirming}
        title={fa ? 'این پیش‌سفارش حذف شود؟' : 'Delete this pre-order?'}
        description={fa ? `${label}. از فهرست درخواست‌ها برداشته می‌شود؛ گفتگو و مشتری دست نمی‌خورند.` : `${label}. It leaves the requests list; the conversation and the customer are not touched.`}
        confirmLabel={fa ? 'حذف' : 'Delete'}
        cancelLabel={fa ? 'انصراف' : 'Cancel'}
        busy={busy}
        error={error}
        undoNote={fa ? 'تا چند ثانیه بعد از حذف، «بازگردانی» پایین صفحه برش می‌گرداند.' : 'For a few seconds after deleting, Undo at the bottom of the screen brings it back.'}
        onConfirm={remove}
        onClose={() => { if (!busy) setConfirming(false) }}
      />
    </>
  )
}
