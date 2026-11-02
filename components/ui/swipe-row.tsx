'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Swipe actions for list rows on touch screens (Mail-style).
 *
 *   • Swipe toward the reading start (right→left in English, left→right in
 *     Persian) to reveal the `trailing` actions; the other way reveals
 *     `leading` ones. Positions are logical, so RTL mirrors itself.
 *   • Release past half the action rail → the rail stays open; a long swipe
 *     (past FULL_SWIPE of the row) runs the side's first action directly,
 *     with a haptic tick on Android as it arms.
 *   • A gesture is claimed only once it is clearly horizontal, so vertical
 *     scrolling never fights it, and touches starting at the screen edge are
 *     left to the browser's back gesture.
 *   • One row is open at a time; scrolling, tapping elsewhere or tapping the
 *     row closes it. Rows do nothing on mouse/trackpad devices, so every
 *     action must also exist in the row's own menu or detail sheet.
 */

export interface SwipeAction {
  key: string
  label: string
  icon: LucideIcon
  tone?: 'danger' | 'brand' | 'ok' | 'neutral'
  onAction: () => void | Promise<void>
}

const ACTION_WIDTH = 76
const LOCK_DISTANCE = 8
const EDGE_GUARD = 20
const FULL_SWIPE = 0.6
const OPEN_VELOCITY = 450 // px/s
const SNAP = { type: 'spring' as const, stiffness: 560, damping: 44, mass: 0.7 }

const TONE: Record<NonNullable<SwipeAction['tone']>, string> = {
  danger: 'bg-[#dc2626] text-white',
  brand: 'bg-[#111111] text-white',
  ok: 'bg-[#059669] text-white',
  neutral: 'bg-[#6b7280] text-white',
}

/** The row currently open, so opening another closes it. */
let openRow: { close: () => void } | null = null

function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse)')
    const update = () => setCoarse(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return coarse
}

export function SwipeRow({
  leading = [],
  trailing = [],
  disabled = false,
  className,
  children,
}: {
  leading?: SwipeAction[]
  trailing?: SwipeAction[]
  disabled?: boolean
  /** Shape of the row (rounding, border) — the rails are clipped to it. */
  className?: string
  children: ReactNode
}) {
  const coarse = useCoarsePointer()
  const reduceMotion = useReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const [rtl, setRtl] = useState(false)
  const [openSide, setOpenSide] = useState<'leading' | 'trailing' | null>(null)
  const [armed, setArmed] = useState<'leading' | 'trailing' | null>(null)
  const [busy, setBusy] = useState(false)
  const enabled = coarse && !disabled && (leading.length > 0 || trailing.length > 0)

  // Physical side of each logical rail: positive x reveals the left edge.
  const sideForX = (value: number): 'leading' | 'trailing' | null => {
    if (value === 0) return null
    const revealsLeft = value > 0
    return revealsLeft === rtl ? 'trailing' : 'leading'
  }
  const signFor = (side: 'leading' | 'trailing') => ((side === 'trailing') === rtl ? 1 : -1)
  const stateRef = useRef({ leading, trailing, rtl, openSide, busy })
  stateRef.current = { leading, trailing, rtl, openSide, busy }
  const actionsFor = (side: 'leading' | 'trailing') => (side === 'leading' ? stateRef.current.leading : stateRef.current.trailing)
  // Stable identity for the open-row registry; `close` itself changes every render.
  const handle = useRef({ close: () => {} }).current

  function settle(target: number, side: 'leading' | 'trailing' | null) {
    setOpenSide(side)
    animate(x, target, reduceMotion ? { duration: 0 } : SNAP)
    if (side) {
      if (openRow && openRow !== handle) openRow.close()
      openRow = handle
    } else if (openRow === handle) {
      openRow = null
    }
  }

  function close() {
    setArmed(null)
    settle(0, null)
  }
  handle.close = close

  async function run(action: SwipeAction, side: 'leading' | 'trailing') {
    if (stateRef.current.busy) return
    setBusy(true)
    const width = rootRef.current?.offsetWidth ?? 360
    // Full swipe: the row slides out of the way while the action runs.
    await animate(x, signFor(side) * width, reduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.4, 0, 1, 1] })
    try {
      await action.onAction()
    } finally {
      setBusy(false)
      setArmed(null)
      setOpenSide(null)
      if (openRow === handle) openRow = null
      x.set(0)
    }
  }

  useEffect(() => {
    setRtl(getComputedStyle(rootRef.current ?? document.documentElement).direction === 'rtl')
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!enabled || !root) return

    let start: { x: number; y: number; offset: number; t: number } | null = null
    let mode: 'pending' | 'horizontal' | 'vertical' = 'pending'
    let lastX = 0
    let lastT = 0
    let velocity = 0
    let suppressClick = false

    const railWidth = (side: 'leading' | 'trailing') => actionsFor(side).length * ACTION_WIDTH

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || stateRef.current.busy) return
      const touch = event.touches[0]
      if (touch.clientX < EDGE_GUARD || touch.clientX > window.innerWidth - EDGE_GUARD) return
      start = { x: touch.clientX, y: touch.clientY, offset: x.get(), t: performance.now() }
      mode = 'pending'
      lastX = touch.clientX
      lastT = start.t
      velocity = 0
    }

    const onTouchMove = (event: TouchEvent) => {
      if (!start) return
      const touch = event.touches[0]
      if (!touch) return
      const dx = touch.clientX - start.x
      const dy = touch.clientY - start.y
      if (mode === 'pending') {
        if (Math.hypot(dx, dy) < LOCK_DISTANCE) return
        mode = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'horizontal' : 'vertical'
        if (mode === 'vertical') {
          start = null
          return
        }
        if (openRow && openRow !== handle) openRow.close()
      }
      if (mode !== 'horizontal') return
      if (event.cancelable) event.preventDefault()

      const now = performance.now()
      velocity = ((touch.clientX - lastX) / Math.max(1, now - lastT)) * 1000
      lastX = touch.clientX
      lastT = now

      let next = start.offset + dx
      const side = sideForX(next)
      const width = root.offsetWidth
      if (!side || actionsFor(side).length === 0) {
        next = Math.sign(next) * Math.min(16, Math.abs(next) * 0.15)
      } else if (Math.abs(next) > width * 0.92) {
        next = Math.sign(next) * width * 0.92
      }
      x.set(next)

      const nextArmed = side && actionsFor(side).length > 0 && Math.abs(next) > width * FULL_SWIPE ? side : null
      setArmed((current) => {
        if (current !== nextArmed && nextArmed) navigator.vibrate?.(10)
        return nextArmed
      })
    }

    const onTouchEnd = () => {
      if (!start) return
      const wasHorizontal = mode === 'horizontal'
      start = null
      if (!wasHorizontal) return
      suppressClick = true
      window.setTimeout(() => { suppressClick = false }, 400)

      const offset = x.get()
      const side = sideForX(offset)
      const width = root.offsetWidth
      if (!side || actionsFor(side).length === 0) {
        handle.close()
        return
      }
      const first = actionsFor(side)[0]
      if (Math.abs(offset) > width * FULL_SWIPE && first) {
        void run(first, side)
        return
      }
      const rail = railWidth(side)
      const towardOpen = Math.sign(velocity) === Math.sign(offset)
      if (Math.abs(offset) > rail / 2 || (towardOpen && Math.abs(velocity) > OPEN_VELOCITY)) {
        setArmed(null)
        settle(signFor(side) * rail, side)
      } else {
        handle.close()
      }
    }

    // A tap on an open row closes it instead of opening the row's target.
    const onClickCapture = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest('[data-swipe-action]')) return
      if (suppressClick || stateRef.current.openSide) {
        event.preventDefault()
        event.stopPropagation()
        suppressClick = false
        if (stateRef.current.openSide) handle.close()
      }
    }

    root.addEventListener('touchstart', onTouchStart, { passive: true })
    root.addEventListener('touchmove', onTouchMove, { passive: false })
    root.addEventListener('touchend', onTouchEnd)
    root.addEventListener('touchcancel', onTouchEnd)
    root.addEventListener('click', onClickCapture, true)
    return () => {
      root.removeEventListener('touchstart', onTouchStart)
      root.removeEventListener('touchmove', onTouchMove)
      root.removeEventListener('touchend', onTouchEnd)
      root.removeEventListener('touchcancel', onTouchEnd)
      root.removeEventListener('click', onClickCapture, true)
    }
    // The handlers read the latest props through stateRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, rtl])

  // Scrolling or touching anywhere else closes the open row.
  useEffect(() => {
    if (!openSide) return
    const onScroll = () => handle.close()
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) handle.close()
    }
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true })
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSide])

  useEffect(() => () => {
    if (openRow === handle) openRow = null
  }, [handle])

  if (!enabled) return <div className={className}>{children}</div>

  return (
    <div ref={rootRef} className={cn('relative isolate overflow-hidden', className)}>
      {(['leading', 'trailing'] as const).map((side) => {
        const actions = actionsFor(side)
        if (!actions.length) return null
        // Leading sits at the inline start, trailing at the inline end.
        return (
          <Rail
            key={side}
            side={side}
            actions={actions}
            x={x}
            rtl={rtl}
            open={openSide === side}
            armed={armed === side}
            onRun={(action) => void run(action, side)}
          />
        )
      })}
      <motion.div style={{ x }} className="relative z-10 touch-pan-y bg-inherit">
        {children}
      </motion.div>
    </div>
  )
}

function Rail({
  side,
  actions,
  x,
  rtl,
  open,
  armed,
  onRun,
}: {
  side: 'leading' | 'trailing'
  actions: SwipeAction[]
  x: MotionValue<number>
  rtl: boolean
  open: boolean
  armed: boolean
  onRun: (action: SwipeAction) => void
}) {
  // Visible only while the row moves toward this rail.
  const onLeft = (side === 'trailing') === rtl
  const opacity = useTransform(x, (value) => ((onLeft ? value > 0 : value < 0) ? 1 : 0))
  const width = useTransform(x, (value) => Math.max(actions.length * ACTION_WIDTH, Math.abs(value)))
  const first = actions[0]

  return (
    <motion.div
      aria-hidden={!open}
      style={{ opacity, width }}
      className={cn('absolute inset-y-0 flex', onLeft ? 'left-0 flex-row' : 'right-0 flex-row-reverse')}
    >
      {actions.map((action, index) => {
        const Icon = action.icon
        const grow = armed && index === 0
        return (
          <button
            key={action.key}
            type="button"
            data-swipe-action=""
            tabIndex={open ? 0 : -1}
            onClick={(event) => {
              event.stopPropagation()
              onRun(action)
            }}
            className={cn(
              'flex h-full shrink-0 flex-col items-center justify-center gap-1 px-2 text-[11px] font-bold transition-[flex-grow] duration-150',
              TONE[action.tone ?? 'neutral'],
              grow ? 'grow' : 'grow-0',
              armed && index > 0 && 'hidden',
            )}
            style={{ minWidth: grow ? undefined : ACTION_WIDTH }}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span className="max-w-[4.5rem] truncate">{action.label}</span>
          </button>
        )
      })}
      {armed && first && <span className="sr-only">{first.label}</span>}
    </motion.div>
  )
}
