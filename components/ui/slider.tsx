'use client'

import { useId, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Shared slider primitive — the slider-UX checklist in one component.
 *
 *  - Filled track: everything from the min side to the current value is
 *    painted with the ink accent, so the selected amount is readable at a
 *    glance (a lone thumb doesn't communicate the value).
 *  - Floating value bubble appears only while dragging / focusing, so the
 *    resting UI stays calm.
 *  - The whole row is the hit area (44px tall), not just the thin track —
 *    grabbing anywhere works, especially on touch.
 *  - Native `<input type="range">` underneath: free keyboard support
 *    (arrows, Home, End), step snapping, RTL mirroring and touch-pan.
 *  - Ticks row renders snap-point shortcuts when `ticks` is provided.
 *
 * RTL notes: the fill anchors to the inline start, the bubble wrapper is a
 * zero-width element positioned by `inset-inline-start`, and the bubble
 * centers on it with a physical translate — so both directions align the
 * fill/bubble with the native thumb automatically.
 *
 * Usage:
 *
 *   <Slider
 *     label="تعداد گفتگوها"
 *     min={10} max={500} step={5}
 *     value={count}
 *     onChange={setCount}
 *     formatValue={(v) => v.toLocaleString('fa-IR')}
 *     ticks={[10, 100, 250, 500]}
 *   />
 */
export function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled = false,
  formatValue,
  ticks,
  id,
  className,
  'aria-label': ariaLabel,
}: {
  /** Visible label above the track (sr-only if you pass ariaLabel instead). */
  label?: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  disabled?: boolean
  /** Format the floating bubble + any ticks, e.g. Persian digits. */
  formatValue?: (value: number) => string
  /** Snap-point shortcuts rendered under the track. */
  ticks?: number[]
  className?: string
  id?: string
  'aria-label'?: string
}) {
  const autoId = useId()
  const inputId = id ?? autoId
  const [active, setActive] = useState(false)

  const percent = Math.max(0, Math.min(100, ((value - min) / Math.max(1e-9, max - min)) * 100))
  const display = formatValue ? formatValue(value) : String(value)

  // Thumb travel: the thumb center moves between (0% + 0.875rem) and
  // (100% − 0.875rem) on a 1.75rem thumb — interpolate the fill width.
  const fillWidth = `calc(${percent}% + ${(0.875 - (percent / 100) * 1.75).toFixed(3)}rem)`

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label htmlFor={inputId} className="mb-2 block text-sm font-semibold text-[var(--text-primary)]">
          {label}
        </label>
      )}
      <div className="relative flex h-11 items-center">
        {/* Track + fill — pointer events pass through to the input */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-[var(--bg-muted)]"
        />
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-[var(--text-primary)] transition-[width] duration-75',
            disabled && 'opacity-40',
          )}
          style={{ width: fillWidth }}
        />
        <input
          id={inputId}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-label={ariaLabel ?? label}
          aria-valuetext={display}
          onChange={(event) => onChange(Number(event.target.value))}
          onPointerDown={() => setActive(true)}
          onPointerUp={() => setActive(false)}
          onPointerCancel={() => setActive(false)}
          onBlur={() => setActive(false)}
          onFocus={() => setActive(true)}
          onKeyDown={() => setActive(true)}
          className={cn(
            'relative h-11 w-full cursor-pointer touch-pan-x appearance-none bg-transparent',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2',
            // Visible native thumb, aligned with the fill end.
            '[&::-webkit-slider-thumb]:h-[1.75rem] [&::-webkit-slider-thumb]:w-[1.75rem] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[var(--text-primary)] [&::-webkit-slider-thumb]:shadow-[0_1px_4px_rgba(0,0,0,0.3)]',
            '[&::-moz-range-thumb]:h-[1.75rem] [&::-moz-range-thumb]:w-[1.75rem] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[var(--text-primary)] [&::-moz-range-thumb]:shadow-[0_1px_4px_rgba(0,0,0,0.3)]',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        />
        {/* Floating value — a zero-width anchor at the thumb position; the
            bubble centers on it with a physical translate so RTL works. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0 z-10 h-0 w-0"
          style={{ insetInlineStart: fillWidth }}
        >
          <span
            className={cn(
              'absolute start-0 top-[-1.9rem] -translate-x-1/2 whitespace-nowrap rounded-lg bg-[var(--text-primary)] px-2 py-1 text-[11px] font-bold text-white shadow-sm transition-opacity duration-100',
              active ? 'opacity-100' : 'opacity-0',
            )}
          >
            {display}
          </span>
        </span>
      </div>
      {ticks && ticks.length > 0 && (
        <div className="mt-0.5 flex justify-between text-[10px] font-semibold text-[var(--text-muted)]" aria-hidden="true">
          {ticks.map((tick) => (
            <button
              key={tick}
              type="button"
              tabIndex={-1}
              disabled={disabled}
              onClick={() => onChange(tick)}
              className="rounded-md px-1 py-0.5 tabular-nums transition-colors hover:text-[var(--text-primary)] disabled:opacity-50"
            >
              {formatValue ? formatValue(tick) : tick}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
