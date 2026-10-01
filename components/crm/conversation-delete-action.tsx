'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { queueUndo } from '@/lib/undo-queue'

export function ConversationDeleteAction({
  conversationId,
}: {
  conversationId: string
}) {
  const t = useTranslations('conversations')
  const locale = useLocale()
  const router = useRouter()
  const [showDialog, setShowDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function remove() {
    if (deleting) return
    setDeleting(true)
    setError(null)
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setShowDialog(false)
        // Queue the global «بازگردانی» toast BEFORE navigating back to the
        // inbox — the toast lives in the dashboard layout and survives it.
        queueUndo('conversation', [conversationId], locale === 'en' ? 'conversation' : 'گفتگو')
        router.replace('/conversations')
        router.refresh()
        return
      }
      setError(t('deleteFailed'))
    } catch {
      setError(t('deleteFailed'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null)
          setShowDialog(true)
        }}
        disabled={deleting}
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-white/60 px-4 text-sm font-medium text-[var(--text-muted)] transition-colors hover:border-danger hover:bg-red-50 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50 disabled:opacity-50"
      >
        {deleting ? (
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
        ) : (
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        )}
        {t('delete')}
      </button>

      <ConfirmDialog
        open={showDialog}
        title={t('deleteTitle')}
        description={t('deleteDescription')}
        undoNote={t('deleteUndoNote')}
        confirmLabel={deleting ? t('deleting') : t('deleteConfirm')}
        cancelLabel={t('deleteCancel')}
        tone="danger"
        busy={deleting}
        error={error}
        onConfirm={() => void remove()}
        onClose={() => {
          if (!deleting) setShowDialog(false)
        }}
      />
    </>
  )
}
