'use client'

import {
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
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

const desktopDialogVariants = {
  hidden: { opacity: 0, scale: 0.97, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const },
  },
  exit: {
    opacity: 0,
    scale: 0.985,
    y: 6,
    transition: { duration: 0.14, ease: [0.4, 0, 1, 1] as const },
  },
}

/**
 * Drag to dismiss (phone sheet only). Pulling the handle or header down — or
 * the content once it is scrolled to the top, like iOS sheets — moves the
 * sheet with the finger; letting go past a quarter of its height (at most
 * DISMISS_DISTANCE) or with a downward flick closes it, anything less springs
 * back. Upward pulls meet rubber-band resistance.
 */
const DISMISS_DISTANCE = 140
const DISMISS_VELOCITY = 600 // px/s
const DRAG_SLOP = 6
const SNAP_BACK = { type: 'spring' as const, stiffness: 520, damping: 42, mass: 0.8 }

function rubberBand(offset: number) {
  return offset >= 0 ? offset : -Math.min(24, Math.sqrt(-offset) * 2)
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
  const [isDesktopViewport, setIsDesktopViewport] = useState(false)
  const reduceMotion = useReducedMotion()
  const contentRef = useRef<HTMLDivElement>(null)
  const dragY = useMotionValue(0)
  const overlayOpacity = useTransform(dragY, (value) => {
    const height = panelRef.current?.offsetHeight || 600
    return value <= 0 ? 1 : Math.max(0, 1 - value / height)
  })
  const dragRef = useRef<{ startY: number; startX: number; lastY: number; lastT: number; velocity: number; active: boolean; crossed: boolean } | null>(null)
  const dragEnabledRef = useRef(false)

  onCloseRef.current = onClose

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (mobileOnly) return
    const media = window.matchMedia('(min-width: 768px)')
    const update = () => setIsDesktopViewport(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [mobileOnly])

  useEffect(() => {
    if (open) dragY.set(0)
  }, [open, dragY])

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

  const usesDesktopDialogMotion = !mobileOnly && isDesktopViewport
  dragEnabledRef.current = !usesDesktopDialogMotion

  function dismissDistance() {
    return Math.min(DISMISS_DISTANCE, (panelRef.current?.offsetHeight ?? 560) * 0.25)
  }

  function beginDrag(x: number, y: number) {
    dragRef.current = { startY: y, startX: x, lastY: y, lastT: performance.now(), velocity: 0, active: false, crossed: false }
  }

  /** Returns true once the gesture is a sheet drag (the caller then owns the event). */
  function moveDrag(x: number, y: number, fromContent: boolean): boolean {
    const drag = dragRef.current
    if (!drag) return false
    const dy = y - drag.startY
    if (!drag.active) {
      if (Math.abs(dy) < DRAG_SLOP || Math.abs(dy) < Math.abs(x - drag.startX)) return false
      // Content only hands over a downward pull that starts at the very top.
      if (fromContent && (dy < 0 || (contentRef.current?.scrollTop ?? 0) > 0)) {
        dragRef.current = null
        return false
      }
      drag.active = true
      drag.startY = y
    }
    const now = performance.now()
    const dt = Math.max(1, now - drag.lastT)
    drag.velocity = ((y - drag.lastY) / dt) * 1000
    drag.lastY = y
    drag.lastT = now
    const offset = rubberBand(y - drag.startY)
    dragY.set(offset)
    const crossed = offset > dismissDistance()
    if (crossed !== drag.crossed) {
      drag.crossed = crossed
      // A light tick as the release point is crossed (Android; iOS has no web haptics).
      if (crossed) navigator.vibrate?.(8)
    }
    return true
  }

  function endDrag() {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag?.active) return
    const offset = dragY.get()
    if (offset > dismissDistance() || (drag.velocity > DISMISS_VELOCITY && offset > 0)) {
      onCloseRef.current()
      return
    }
    animate(dragY, 0, reduceMotion ? { duration: 0 } : SNAP_BACK)
  }

  function onHeaderPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragEnabledRef.current || event.button !== 0) return
    if ((event.target as HTMLElement).closest('a, button, input, select, textarea, [contenteditable="true"]')) return
    event.currentTarget.setPointerCapture(event.pointerId)
    beginDrag(event.clientX, event.clientY)
  }

  function onHeaderPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (moveDrag(event.clientX, event.clientY, false)) event.preventDefault()
  }

  // Touch on the scrolling content: a non-passive listener so a pull-down at
  // scrollTop 0 can stop the native overscroll and move the sheet instead.
  useEffect(() => {
    const content = contentRef.current
    if (!open || !content) return
    const onTouchStart = (event: TouchEvent) => {
      if (!dragEnabledRef.current || event.touches.length !== 1) return
      const touch = event.touches[0]
      beginDrag(touch.clientX, touch.clientY)
    }
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (touch && moveDrag(touch.clientX, touch.clientY, true) && event.cancelable) event.preventDefault()
    }
    const onTouchEnd = () => endDrag()
    content.addEventListener('touchstart', onTouchStart, { passive: true })
    content.addEventListener('touchmove', onTouchMove, { passive: false })
    content.addEventListener('touchend', onTouchEnd)
    content.addEventListener('touchcancel', onTouchEnd)
    return () => {
      content.removeEventListener('touchstart', onTouchStart)
      content.removeEventListener('touchmove', onTouchMove)
      content.removeEventListener('touchend', onTouchEnd)
      content.removeEventListener('touchcancel', onTouchEnd)
    }
    // The handlers only read refs and the motion value, so binding once per open is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mounted])

  if (!mounted) return null

  const usesDetailMotion = motionPreset === 'detail'
  const activeDetailVariants = reduceMotion
    ? reducedDetailSheetVariants
    : usesDesktopDialogMotion
      ? desktopDialogVariants
      : detailSheetVariants

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
            className="absolute inset-0 cursor-default"
          >
            <motion.span
              aria-hidden="true"
              style={{ opacity: overlayOpacity }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
          </motion.button>

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            style={{ y: dragY }}
            variants={usesDetailMotion ? activeDetailVariants : undefined}
            initial={
              usesDetailMotion
                ? undefined
                : reduceMotion
                  ? false
                  : usesDesktopDialogMotion
                    ? { opacity: 0, scale: 0.97, y: 10 }
                    : { y: '100%' }
            }
            animate={usesDetailMotion ? undefined : usesDesktopDialogMotion ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
            exit={usesDetailMotion ? undefined : usesDesktopDialogMotion ? { opacity: 0, scale: 0.985, y: 6 } : { y: '100%' }}
            transition={
              usesDetailMotion
                ? undefined
                : reduceMotion
                  ? { duration: 0 }
                  : usesDesktopDialogMotion
                    ? { duration: 0.2, ease: [0.16, 1, 0.3, 1] }
                  : {
                      type: 'spring',
                      stiffness: 420,
                      damping: 38,
                      mass: 0.85,
                    }
            }
            className={cn(
              'absolute inset-x-0 bottom-0 flex w-full flex-col overflow-hidden rounded-t-sheet border border-b-0 border-black/10 bg-white shadow-[var(--elev-2)] outline-none will-change-transform',
              size === 'large'
                ? 'h-[min(92dvh,52rem)]'
                : 'max-h-[min(86dvh,42rem)]',
              !mobileOnly &&
                'md:relative md:inset-auto md:h-auto md:max-h-[min(90dvh,48rem)] md:max-w-xl md:rounded-sheet md:border-b md:shadow-[var(--elev-2)]',
              panelClassName,
            )}
          >
            <div
              onPointerDown={onHeaderPointerDown}
              onPointerMove={onHeaderPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              className={cn(
                'shrink-0 touch-none select-none border-b border-[var(--border-subtle)] bg-white/95 px-4 pb-3 pt-2 backdrop-blur-xl',
                !mobileOnly && 'md:touch-auto md:select-auto',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'mx-auto mb-2 block h-1.5 w-11 cursor-grab rounded-full bg-black/15 active:cursor-grabbing',
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
                  className="spatial-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border-default)] bg-white text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div
              ref={contentRef}
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
