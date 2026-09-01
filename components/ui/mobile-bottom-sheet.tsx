'use client'

import {
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const frameVariants = {
  hidden: {},
  visible: {
    transition: { when: 'beforeChildren' as const },
  },
  exit: {
    transition: { when: 'afterChildren' as const },
  },
}

const overlayVariants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: { duration: 0.16, ease: 'easeOut' as const },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.12, ease: 'easeIn' as const },
  },
}

const detailSheetVariants = {
  hidden: {
    y: '100%',
  },
  visible: {
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 430,
      damping: 38,
      mass: 0.82,
    },
  },
  exit: {
    y: '100%',
    transition: {
      duration: 0.22,
      ease: [0.4, 0, 1, 1] as const,
    },
  },
}

const reducedDetailSheetVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.14, ease: 'easeOut' as const },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.1, ease: 'easeIn' as const },
  },
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function MobileBottomSheet({
  open,
  title,
  description,
  closeLabel,
  children,
  footer,
  size = 'auto',
  motionPreset = 'default',
  mobileOnly = true,
  panelClassName,
  contentClassName,
  triggerRef,
  onClose,
}: {
  open: boolean
  title: string
  description?: string
  closeLabel: string
  children: ReactNode
  footer?: ReactNode
  size?: 'auto' | 'large'
  /** Use the stronger bottom-up transition only for drill-down detail views. */
  motionPreset?: 'default' | 'detail'
  /** Keep the sheet mobile-only, or turn it into a centered dialog on desktop. */
  mobileOnly?: boolean
  panelClassName?: string
  contentClassName?: string
  triggerRef?: { current: HTMLElement | null }
  onClose: () => void
}) {
  const reactId = useId()
  const titleId = `${reactId}-title`
  const descriptionId = `${reactId}-description`
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  const [mounted, setMounted] = useState(false)
  const reduceMotion = useReducedMotion()

  onCloseRef.current = onClose

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return

    const returnFocus =
      triggerRef?.current ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus())

    function isTopmostModal() {
      const modals = Array.from(
        document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'),
      )
      return modals.at(-1) === panelRef.current
    }

    function onKeyDown(event: KeyboardEvent) {
      if (!isTopmostModal()) return

      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
      ).filter((element) => element.getAttribute('aria-hidden') !== 'true')

      if (focusable.length === 0) {
        event.preventDefault()
        panelRef.current?.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !panelRef.current?.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      returnFocus?.focus({ preventScroll: true })
    }
  }, [open, triggerRef])

  if (!mounted) return null

  const usesDetailMotion = motionPreset === 'detail'

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={cn(
            'fixed inset-0 z-[100]',
            mobileOnly ? 'md:hidden' : 'md:grid md:place-items-center md:p-6',
          )}
          variants={usesDetailMotion ? frameVariants : undefined}
          initial={
            usesDetailMotion ? 'hidden' : reduceMotion ? false : { opacity: 0 }
          }
          animate={usesDetailMotion ? 'visible' : { opacity: 1 }}
          exit={usesDetailMotion ? 'exit' : { opacity: 0 }}
          transition={
            usesDetailMotion
              ? undefined
              : { duration: reduceMotion ? 0 : 0.16, ease: 'easeOut' }
          }
        >
          <motion.button
            type="button"
            tabIndex={-1}
            aria-label={closeLabel}
            onClick={onClose}
            variants={usesDetailMotion ? overlayVariants : undefined}
            className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-sm"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            variants={
              usesDetailMotion
                ? reduceMotion
                  ? reducedDetailSheetVariants
                  : detailSheetVariants
                : undefined
            }
            initial={
              usesDetailMotion
                ? undefined
                : reduceMotion
                  ? false
                  : { y: '100%' }
            }
            animate={usesDetailMotion ? undefined : { y: 0 }}
            exit={usesDetailMotion ? undefined : { y: '100%' }}
            transition={
              usesDetailMotion
                ? undefined
                : reduceMotion
                  ? { duration: 0 }
                  : {
                      type: 'spring',
                      stiffness: 420,
                      damping: 38,
                      mass: 0.85,
                    }
            }
            className={cn(
              'absolute inset-x-0 bottom-0 flex w-full flex-col overflow-hidden rounded-t-[1.75rem] border border-b-0 border-black/10 bg-white shadow-[0_-22px_70px_rgba(0,0,0,0.24)] outline-none will-change-transform',
              size === 'large'
                ? 'h-[min(92dvh,52rem)]'
                : 'max-h-[min(86dvh,42rem)]',
              !mobileOnly &&
                'md:relative md:inset-auto md:h-auto md:max-h-[min(90dvh,48rem)] md:max-w-xl md:rounded-[1.75rem] md:border-b md:shadow-[0_24px_80px_rgba(0,0,0,0.24)]',
              panelClassName,
            )}
          >
            <div className="shrink-0 border-b border-[var(--border-subtle)] bg-white/95 px-4 pb-3 pt-2 backdrop-blur-xl">
              <span
                aria-hidden="true"
                className={cn(
                  'mx-auto mb-2 block h-1.5 w-11 rounded-full bg-black/15',
                  !mobileOnly && 'md:hidden',
                )}
              />
              <div className="flex min-h-11 items-center gap-3">
                <div className="min-w-0 flex-1">
                  <h2
                    id={titleId}
                    className="truncate text-base font-bold text-[var(--text-primary)]"
                  >
                    {title}
                  </h2>
                  {description && (
                    <p
                      id={descriptionId}
                      className="mt-0.5 truncate text-xs text-[var(--text-muted)]"
                    >
                      {description}
                    </p>
                  )}
                </div>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={onClose}
                  aria-label={closeLabel}
                  className="spatial-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border-default)] bg-white text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div
              className={cn(
                'min-h-0 flex-1 overscroll-contain overflow-y-auto px-4 py-4',
                !footer && '[padding-bottom:max(1rem,env(safe-area-inset-bottom))]',
                contentClassName,
              )}
            >
              {children}
            </div>

            {footer && (
              <div className="shrink-0 border-t border-[var(--border-subtle)] bg-white/95 px-4 pt-3 backdrop-blur-xl [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
