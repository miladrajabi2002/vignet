'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Loader2, Trash2 } from 'lucide-react'

export function ConversationDeleteAction({
  conversationId,
}: {
  conversationId: string
}) {
  const t = useTranslations('conversations')
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const [showDialog, setShowDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const deletingRef = useRef(false)

  deletingRef.current = deleting

  useEffect(() => {
    if (!showDialog) return

    const trigger = triggerRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cancelRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !deletingRef.current) {
        setShowDialog(false)
        return
      }
      if (event.key !== 'Tab') return

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      )
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !dialogRef.current?.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      trigger?.focus()
    }
  }, [showDialog])

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
        router.replace('/conversations')
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
        ref={triggerRef}
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

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {showDialog && (
              <motion.div
                className="fixed inset-0 z-[1000] grid place-items-center bg-black/55 p-4 backdrop-blur-md"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.16, ease: 'easeOut' }}
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget && !deleting) {
                    setShowDialog(false)
                  }
                }}
              >
                <motion.div
                  ref={dialogRef}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="delete-conversation-title"
                  aria-describedby="delete-conversation-description"
                  className="w-full max-w-[27rem] overflow-hidden rounded-[1.5rem] border border-black/10 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
                  initial={
                    reduceMotion ? false : { opacity: 0, scale: 0.96, y: 12 }
                  }
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: 6 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.2,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <div className="p-6 pb-5 text-center sm:text-start">
                    <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100 sm:mx-0">
                      <Trash2 className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h2
                      id="delete-conversation-title"
                      className="mt-4 text-lg font-bold tracking-tight text-[var(--text-primary)]"
                    >
                      {t('deleteTitle')}
                    </h2>
                    <p
                      id="delete-conversation-description"
                      className="mt-2 text-sm leading-6 text-[var(--text-secondary)]"
                    >
                      {t('deleteDescription')}
                    </p>
                    {error && (
                      <p
                        role="alert"
                        className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-start text-sm text-red-700"
                      >
                        {error}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-base)]/60 p-4 sm:flex-row sm:justify-end">
                    <button
                      ref={cancelRef}
                      type="button"
                      onClick={() => setShowDialog(false)}
                      disabled={deleting}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border-default)] bg-white px-4 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)] disabled:opacity-50"
                    >
                      {t('deleteCancel')}
                    </button>
                    <button
                      type="button"
                      onClick={remove}
                      disabled={deleting}
                      className="inline-flex min-h-11 min-w-32 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deleting && (
                        <Loader2
                          className="h-4 w-4 animate-spin motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                      )}
                      {deleting ? t('deleting') : t('deleteConfirm')}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  )
}
