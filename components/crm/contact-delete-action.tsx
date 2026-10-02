'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { queueUndo } from '@/lib/undo-queue'

export function ContactDeleteAction({
  contactId,
  returnTo = '/contacts',
  compact = false,
}: {
  contactId: string
  returnTo?: string
  /** Icon-only on phones, icon and label from `sm` up, for headers with a primary action. */
  compact?: boolean
}) {
  const t = useTranslations('contacts.detail')
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
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setShowDialog(false)
        // Queue the global «بازگردانی» toast BEFORE navigating — it lives in
        // the dashboard layout, so it is already waiting on the list page.
        queueUndo('contact', [contactId], locale === 'en' ? 'customer' : 'مشتری')
        router.replace(returnTo)
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
      {compact ? (
        <button
          type="button"
          onClick={() => {
            setError(null)
            setShowDialog(true)
          }}
          aria-label={t('delete')}
          title={t('delete')}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-white text-sm font-medium text-[var(--text-muted)] transition-colors hover:border-danger hover:bg-red-50 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50 sm:w-auto sm:px-4"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">{t('delete')}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            setError(null)
            setShowDialog(true)
          }}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] px-4 text-sm font-medium text-[var(--text-muted)] transition-colors hover:border-danger hover:bg-red-50 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {t('delete')}
        </button>
      )}

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
