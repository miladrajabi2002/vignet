'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Clock3, Moon, Sun, Sunrise, Sunset, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * 24-hour time picker (no AM/PM, no native `<input type="time">`, whose look
 * and 12h/24h format depend on the OS locale).
 *
 * Desktop: a popover anchored to the field. Phone: a bottom sheet with large
 * touch targets. Values are minutes after midnight; `allowEndOfDay` adds 24:00
 * for "until midnight" range ends.
 */

const MINUTE_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
const HOUR_ROWS: Array<{ fa: string; en: string; Icon: typeof Sun; hours: number[] }> = [
  { fa: 'بامداد', en: 'Night', Icon: Moon, hours: [0, 1, 2, 3, 4, 5] },
  { fa: 'صبح', en: 'Morning', Icon: Sunrise, hours: [6, 7, 8, 9, 10, 11] },
  { fa: 'ظهر و عصر', en: 'Afternoon', Icon: Sun, hours: [12, 13, 14, 15, 16, 17] },
  { fa: 'شب', en: 'Evening', Icon: Sunset, hours: [18, 19, 20, 21, 22, 23] },
]

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

export function localDigits(value: string, fa: boolean): string {
  return fa ? value.replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]) : value
}

export function formatClock(minute: number, fa = false): string {
  const value = minute >= 1440
    ? '24:00'
    : `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
  return localDigits(value, fa)
}

function useIsPhone() {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)')
    const sync = () => setPhone(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
  return phone
}

export function TimePicker({
  value,
  onChange,
  fa,
  label,
  min,
  allowEndOfDay = false,
  className,
  size = 'md',
}: {
  /** Minutes after midnight (1440 = 24:00). */
  value: number
  onChange: (minute: number) => void
  fa: boolean
  label: string
  /** Times at or before this minute are disabled (for range ends). */
  min?: number
  allowEndOfDay?: boolean
  className?: string
  size?: 'md' | 'lg'
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${formatClock(value, fa)}`}
        className={cn(
          'group inline-flex items-center justify-center gap-1.5 rounded-xl border bg-white font-bold tabular-nums text-[var(--text-primary)] transition-[border-color,box-shadow] hover:border-[var(--border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
          open ? 'border-[var(--text-primary)] shadow-[0_0_0_3px_rgba(17,17,17,0.08)]' : 'border-[var(--border-default)]',
          size === 'lg' ? 'min-h-12 px-4 text-base' : 'min-h-11 px-3 text-[15px]',
          className,
        )}
      >
        <Clock3 className="h-3.5 w-3.5 text-[var(--text-hint)] transition-colors group-hover:text-[var(--text-secondary)]" aria-hidden />
        <span dir="ltr">{formatClock(value, fa)}</span>
      </button>
      {open && (
        <TimePickerPanel
          anchor={triggerRef}
          value={value}
          fa={fa}
          label={label}
          min={min}
          allowEndOfDay={allowEndOfDay}
          onClose={() => {
            setOpen(false)
            triggerRef.current?.focus({ preventScroll: true })
          }}
          onChange={onChange}
        />
      )}
    </>
  )
}

function TimePickerPanel({
  anchor,
  value,
  fa,
  label,
  min,
  allowEndOfDay,
  onClose,
  onChange,
}: {
  anchor: React.RefObject<HTMLButtonElement | null>
  value: number
  fa: boolean
  label: string
  min?: number
  allowEndOfDay: boolean
  onClose: () => void
  onChange: (minute: number) => void
}) {
  const phone = useIsPhone()
  const reduceMotion = useReducedMotion()
  const panelRef = useRef<HTMLDivElement>(null)
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [draft, setDraft] = useState(value)
  const [position, setPosition] = useState<{ top: number; left: number; above: boolean } | null>(null)
  const draftHour = draft >= 1440 ? 24 : Math.floor(draft / 60)
  const draftMinute = draft >= 1440 ? 0 : draft % 60

  useEffect(() => { setHost(document.body) }, [])

  const place = useCallback(() => {
    const trigger = anchor.current
    if (!trigger || phone) return
    const rect = trigger.getBoundingClientRect()
    const width = 320
    const height = panelRef.current?.offsetHeight ?? 420
    const above = rect.bottom + 8 + height > window.innerHeight && rect.top - 8 - height > 0
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8)
    setPosition({ top: above ? rect.top - 8 - height : rect.bottom + 8, left, above })
  }, [anchor, phone])

  useLayoutEffect(() => {
    if (!host) return
    place()
  }, [host, place])

  useEffect(() => {
    if (!host) return
    const reposition = () => place()
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    // Capture phase so an enclosing sheet/dialog never sees this Escape.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    const onPointer = (event: MouseEvent) => {
      if (phone) return
      const target = event.target as Node
      if (panelRef.current?.contains(target) || anchor.current?.contains(target)) return
      onClose()
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('mousedown', onPointer)
    const selected = panelRef.current?.querySelector<HTMLElement>('[data-selected-hour="true"]')
      ?? panelRef.current?.querySelector<HTMLElement>('button:not([disabled])')
    selected?.focus({ preventScroll: true })
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('mousedown', onPointer)
    }
  }, [host, place, phone, onClose, anchor])

  const disabled = (minute: number) => min !== undefined && minute <= min

  function pickHour(hour: number) {
    if (hour === 24) {
      setDraft(1440)
      onChange(1440)
      onClose()
      return
    }
    // Keep the chosen minutes; if that lands on a disabled time, snap to the
    // first allowed minute of the hour.
    let next = hour * 60 + draftMinute
    if (disabled(next)) next = hour * 60 + (MINUTE_STEPS.find((step) => !disabled(hour * 60 + step)) ?? 0)
    setDraft(next)
    if (!phone) onChange(next)
  }

  function pickMinute(minute: number) {
    const next = Math.min(draftHour, 23) * 60 + minute
    setDraft(next)
    onChange(next)
    onClose()
  }

  if (!host) return null

  const body = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-bold text-[var(--text-muted)]">{label}</p>
          <p className="text-[28px] font-bold leading-9 tabular-nums tracking-tight text-[var(--text-primary)]" dir="ltr">
            <span>{localDigits(String(Math.min(draftHour, 24)).padStart(2, '0'), fa)}</span>
            <span className="mx-0.5 text-[var(--text-muted)]">:</span>
            <span>{localDigits(String(draftMinute).padStart(2, '0'), fa)}</span>
          </p>
        </div>
        {phone ? (
          <button type="button" onClick={onClose} aria-label={fa ? 'بستن' : 'Close'} className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)]">
            <X className="h-4 w-4" />
          </button>
        ) : (
          <span className="rounded-lg bg-black/[0.05] px-2 py-1 text-[12px] font-bold text-[var(--text-muted)]">{fa ? '۲۴ ساعته' : '24-hour'}</span>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-[13px] font-bold text-[var(--text-secondary)]">{fa ? 'ساعت' : 'Hour'}</p>
        <div className="space-y-1">
          {HOUR_ROWS.map((row) => (
            <div key={row.fa} className="flex items-center gap-1.5">
              <span className="flex w-5 shrink-0 justify-center text-[var(--text-muted)]" title={fa ? row.fa : row.en}>
                <row.Icon className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only">{fa ? row.fa : row.en}</span>
              </span>
              <div className="grid flex-1 grid-cols-6 gap-1" dir="ltr">
                {row.hours.map((hour) => {
                  const off = MINUTE_STEPS.every((step) => disabled(hour * 60 + step))
                  const active = hour === draftHour
                  return (
                    <button
                      key={hour}
                      type="button"
                      disabled={off}
                      data-selected-hour={active ? 'true' : undefined}
                      aria-pressed={active}
                      onClick={() => pickHour(hour)}
                      className={cn(
                        'rounded-lg font-bold tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-25',
                        phone ? 'min-h-11 text-[15px]' : 'min-h-9 text-[13px]',
                        active
                          ? 'bg-[var(--text-primary)] text-white'
                          : 'bg-black/[0.035] text-[var(--text-primary)] hover:bg-black/[0.08]',
                      )}
                    >
                      {localDigits(String(hour).padStart(2, '0'), fa)}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[13px] font-bold text-[var(--text-secondary)]">{fa ? 'دقیقه' : 'Minute'}</p>
        <div className={cn('grid gap-1 ps-[1.625rem]', phone ? 'grid-cols-4' : 'grid-cols-6')} dir="ltr">
          {MINUTE_STEPS.map((minute) => {
            const hour = Math.min(draftHour, 23)
            const off = draftHour === 24 || disabled(hour * 60 + minute)
            const active = draftHour !== 24 && minute === draftMinute
            return (
              <button
                key={minute}
                type="button"
                disabled={off}
                aria-pressed={active}
                onClick={() => pickMinute(minute)}
                className={cn(
                  'rounded-lg font-bold tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-25',
                  phone ? 'min-h-11 text-[15px]' : 'min-h-9 text-[13px]',
                  active
                    ? 'bg-[var(--text-primary)] text-white'
                    : minute % 15 === 0
                      ? 'bg-black/[0.05] text-[var(--text-primary)] hover:bg-black/[0.09]'
                      : 'bg-transparent text-[var(--text-secondary)] ring-1 ring-inset ring-black/[0.06] hover:bg-black/[0.05]',
                )}
              >
                :{localDigits(String(minute).padStart(2, '0'), fa)}
              </button>
            )
          })}
        </div>
      </div>

      {allowEndOfDay && (
        <button
          type="button"
          onClick={() => pickHour(24)}
          aria-pressed={draft >= 1440}
          className={cn(
            'flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border text-[13px] font-bold transition-colors',
            draft >= 1440 ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white' : 'border-dashed border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]',
          )}
        >
          <Moon className="h-3.5 w-3.5" />{fa ? 'تا پایان شب (۲۴:۰۰)' : 'Until midnight (24:00)'}
        </button>
      )}

      {phone && (
        <button
          type="button"
          onClick={() => { onChange(draft); onClose() }}
          className="spatial-press min-h-12 w-full rounded-2xl bg-[var(--text-primary)] text-sm font-bold text-white"
        >
          {fa ? `تأیید ${formatClock(draft, true)}` : `Set ${formatClock(draft)}`}
        </button>
      )}
    </div>
  )

  if (phone) {
    return createPortal(
      <motion.div
        className="fixed inset-0 z-[90] bg-black/40"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
      >
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          className="fixed inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-sheet bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl"
          initial={reduceMotion ? false : { y: '100%' }}
          animate={{ y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <span aria-hidden className="absolute start-1/2 top-2 h-1.5 w-11 -translate-x-1/2 rounded-full bg-black/15 rtl:translate-x-1/2" />
          {body}
        </motion.div>
      </motion.div>,
      host,
    )
  }

  return createPortal(
    <motion.div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      className="fixed z-[90] w-80 rounded-card border border-[var(--border-default)] bg-white p-3.5 shadow-[var(--elev-2)]"
      style={{ top: position?.top ?? -9999, left: position?.left ?? -9999 }}
      initial={reduceMotion ? false : { opacity: 0, y: position?.above ? 6 : -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.16, ease: [0.16, 1, 0.3, 1] }}
    >
      {body}
    </motion.div>,
    host,
  )
}

/**
 * A working-hours range as one control: «از ۰۹:۰۰ ← → تا ۱۷:۰۰ · ۸ ساعت».
 * Stays one tidy row on phones (the two native inputs used to wrap badly).
 */
export function TimeRangeField({
  start,
  end,
  onChange,
  fa,
  onRemove,
  invalid = false,
  className,
}: {
  start: number
  end: number
  onChange: (next: { start: number; end: number }) => void
  fa: boolean
  onRemove?: () => void
  invalid?: boolean
  className?: string
}) {
  const span = end - start
  const hours = Math.floor(span / 60)
  const minutes = span % 60
  const spanLabel = span <= 0
    ? (fa ? 'نامعتبر' : 'Invalid')
    : fa
      ? `${hours ? `${localDigits(String(hours), true)} ساعت` : ''}${hours && minutes ? ' و ' : ''}${minutes ? `${localDigits(String(minutes), true)} دقیقه` : ''}`
      : `${hours ? `${hours}h` : ''}${minutes ? ` ${minutes}m` : ''}`.trim()

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'flex min-w-0 flex-1 items-center gap-1 rounded-2xl border bg-[var(--bg-base)] p-1',
          invalid ? 'border-red-400/60 bg-red-50/60' : 'border-[var(--border-subtle)]',
        )}
      >
        <TimePicker
          value={start}
          fa={fa}
          label={fa ? 'شروع' : 'Start'}
          onChange={(value) => onChange({ start: value, end: end <= value ? Math.min(value + 60, 1440) : end })}
          className="min-w-0 flex-1 border-transparent bg-white shadow-[var(--shadow-xs)]"
        />
        <span className="shrink-0 px-0.5 text-[12px] font-bold text-[var(--text-muted)]">{fa ? 'تا' : 'to'}</span>
        <TimePicker
          value={end}
          fa={fa}
          label={fa ? 'پایان' : 'End'}
          min={start}
          allowEndOfDay
          onChange={(value) => onChange({ start, end: value })}
          className="min-w-0 flex-1 border-transparent bg-white shadow-[var(--shadow-xs)]"
        />
        <span className={cn('hidden shrink-0 px-2 text-[13px] font-medium sm:inline', invalid ? 'text-red-600' : 'text-[var(--text-muted)]')}>{spanLabel}</span>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={fa ? 'حذف بازه' : 'Remove range'}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--text-hint)] transition-colors hover:bg-red-500/10 hover:text-red-600"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
