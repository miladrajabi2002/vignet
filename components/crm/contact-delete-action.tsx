'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { MoreVertical, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { queueUndo } from '@/lib/undo-queue'

export function ContactDeleteAction({
  contactId,
  returnTo = '/contacts',
  compact = false,
}: {
  contactId: string
  returnTo?: string
  /** A ⋮ menu holding the delete action, for headers with a primary action. */
  compact?: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
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
        <div className="relative" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false) }}>
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={locale === 'en' ? 'More actions' : 'کارهای دیگر'}
            className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--border-default)] bg-white text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <MoreVertical className="h-4 w-4" aria-hidden="true" />
          </button>
          {menuOpen && (
            <div role="menu" className="absolute end-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-[var(--border-default)] bg-white py-1 shadow-[var(--elev-2)]">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  setError(null)
                  setShowDialog(true)
                }}
                className="flex min-h-11 w-full items-center gap-2 px-3 text-start text-[13px] text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {t('delete')}
              </button>
            </div>
          )}
        </div>
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
