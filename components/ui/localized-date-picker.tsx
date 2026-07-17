'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, Check, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  calendarMonthLength,
  calendarMonthOffset,
  calendarPartsFromDateKey,
  dateKeyFromCalendarParts,
  formatDateKey,
  shiftCalendarMonth,
  todayDateKey,
  type CalendarMonth,
  type DateLocale,
} from '@/lib/localized-date'

type PickerPosition = { left: number; top?: number; bottom?: number; width: number }

const WEEKDAYS = {
  fa: [
    { short: 'ش', full: 'شنبه' }, { short: 'ی', full: 'یکشنبه' }, { short: 'د', full: 'دوشنبه' },
    { short: 'س', full: 'سه‌شنبه' }, { short: 'چ', full: 'چهارشنبه' }, { short: 'پ', full: 'پنجشنبه' }, { short: 'ج', full: 'جمعه' },
  ],
  en: [
    { short: 'Su', full: 'Sunday' }, { short: 'Mo', full: 'Monday' }, { short: 'Tu', full: 'Tuesday' },
    { short: 'We', full: 'Wednesday' }, { short: 'Th', full: 'Thursday' }, { short: 'Fr', full: 'Friday' }, { short: 'Sa', full: 'Saturday' },
  ],
} as const

export function LocalizedDatePicker({
  value,
  onValueChange,
  locale,
  min,
  max,
  ariaLabel,
  placeholder,
  disabled = false,
  name,
  className,
  buttonClassName,
  timeZone = 'Asia/Tehran',
}: {
  value: string
  onValueChange: (value: string) => void
  locale: DateLocale
  min?: string
  max?: string
  ariaLabel: string
  placeholder?: string
  disabled?: boolean
  name?: string
  className?: string
  buttonClassName?: string
  timeZone?: string
}) {
  const id = useId()
  const fa = locale === 'fa'
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<PickerPosition | null>(null)
  const today = useMemo(() => todayDateKey(timeZone), [timeZone])
  const initialKey = value || min || today
  const initialParts = calendarPartsFromDateKey(initialKey, locale)
  const [visibleMonth, setVisibleMonth] = useState<CalendarMonth>({ year: initialParts.year, month: initialParts.month })

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (!open) return
    const parts = calendarPartsFromDateKey(value || min || today, locale)
    setVisibleMonth({ year: parts.year, month: parts.month })
  }, [locale, min, open, today, value])

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const width = Math.min(336, window.innerWidth - 16)
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8)
    const below = window.innerHeight - rect.bottom
    const placeAbove = below < 430 && rect.top > below
    setPosition(placeAbove
      ? { left, bottom: window.innerHeight - rect.top + 8, width }
      : { left, top: Math.min(rect.bottom + 8, window.innerHeight - 96), width })
  }, [])

  useEffect(() => {
    if (!open) return
    updatePosition()
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    function onViewportChange() { setOpen(false) }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onViewportChange, { passive: true })
    window.addEventListener('scroll', onViewportChange, { passive: true, capture: true })
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onViewportChange, true)
    }
  }, [open, updatePosition])

  const monthLength = calendarMonthLength(visibleMonth, locale)
  const offset = calendarMonthOffset(visibleMonth, locale)
  const monthTitleKey = dateKeyFromCalendarParts(visibleMonth.year, visibleMonth.month, 1, locale)
  const monthTitle = formatDateKey(monthTitleKey, locale, { year: 'numeric', month: 'long' })
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = index - offset + 1
    return day >= 1 && day <= monthLength ? day : null
  })
  const displayValue = value
    ? formatDateKey(value, locale, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })
    : placeholder ?? (fa ? 'انتخاب تاریخ' : 'Choose a date')
  const PrevIcon = fa ? ChevronRight : ChevronLeft
  const NextIcon = fa ? ChevronLeft : ChevronRight

  function selectDate(dateKey: string) {
    onValueChange(dateKey)
    setOpen(false)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  return (
    <div className={cn('relative min-w-0', className)}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={`${id}-calendar`}
        onClick={() => {
          if (!open) updatePosition()
          setOpen((current) => !current)
        }}
        onKeyDown={(event) => {
          if ((event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') && !open) {
            event.preventDefault()
            updatePosition()
            setOpen(true)
          }
        }}
        className={cn(
          'spatial-press flex min-h-11 w-full items-center gap-2 rounded-xl border border-black/[0.08] bg-white px-3 text-start shadow-[0_6px_18px_rgba(0,0,0,0.055)] transition-[border-color,box-shadow,background-color] duration-150 hover:border-black/[0.14] focus-visible:border-black/20 focus-visible:shadow-[0_10px_28px_rgba(0,0,0,0.09)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45',
          open && 'border-black/20 shadow-[0_10px_28px_rgba(0,0,0,0.09)]',
          buttonClassName,
        )}
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-black/[0.045] text-black/55"><CalendarDays className="h-3.5 w-3.5" /></span>
        <span className={cn('min-w-0 flex-1 truncate text-xs font-medium', value ? 'text-black/75' : 'text-black/35')}>{displayValue}</span>
      </button>

      {mounted && open && position && createPortal(
        <div
          ref={panelRef}
          id={`${id}-calendar`}
          role="dialog"
          aria-modal="false"
          aria-label={ariaLabel}
          dir={fa ? 'rtl' : 'ltr'}
          className="material-select-menu fixed z-[130] max-h-[min(31rem,calc(100dvh-1rem))] overflow-y-auto rounded-[1.35rem] border border-black/10 bg-white/97 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl"
          style={position}
        >
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => setVisibleMonth((current) => shiftCalendarMonth(current, -1))} aria-label={fa ? 'ماه قبل' : 'Previous month'} className="grid h-11 w-11 place-items-center rounded-xl border border-black/[0.07] text-black/55 transition-colors hover:bg-black/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"><PrevIcon className="h-4 w-4" /></button>
            <div className="min-w-0 text-center">
              <p className="truncate text-sm font-bold text-black/80">{monthTitle}</p>
              <p className="mt-0.5 text-[10px] text-black/35">{fa ? 'تقویم شمسی' : 'Gregorian calendar'}</p>
            </div>
            <button type="button" onClick={() => setVisibleMonth((current) => shiftCalendarMonth(current, 1))} aria-label={fa ? 'ماه بعد' : 'Next month'} className="grid h-11 w-11 place-items-center rounded-xl border border-black/[0.07] text-black/55 transition-colors hover:bg-black/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"><NextIcon className="h-4 w-4" /></button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1" role="row">
            {WEEKDAYS[locale].map((weekday) => <span key={weekday.full} title={weekday.full} className="grid h-8 place-items-center text-[10px] font-bold text-black/35">{weekday.short}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1" role="grid" aria-label={monthTitle}>
            {days.map((day, index) => {
              if (day === null) return <span key={`empty-${index}`} className="h-10" aria-hidden />
              const dateKey = dateKeyFromCalendarParts(visibleMonth.year, visibleMonth.month, day, locale)
              const selected = dateKey === value
              const isToday = dateKey === today
              const unavailable = Boolean((min && dateKey < min) || (max && dateKey > max))
              return (
                <button
                  key={dateKey}
                  type="button"
                  role="gridcell"
                  aria-selected={selected}
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={formatDateKey(dateKey, locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  disabled={unavailable}
                  onClick={() => selectDate(dateKey)}
                  className={cn(
                    'relative grid h-10 place-items-center rounded-xl text-xs font-semibold tabular-nums transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25 disabled:cursor-not-allowed disabled:text-black/18',
                    selected ? 'bg-black text-white shadow-sm' : 'text-black/65 hover:bg-black/[0.05]',
                    isToday && !selected && 'ring-1 ring-emerald-500/45 text-emerald-700',
                  )}
                >
                  {day.toLocaleString(fa ? 'fa-IR' : 'en-US', { useGrouping: false })}
                  {selected && <Check className="absolute bottom-0.5 end-0.5 h-2.5 w-2.5" />}
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-black/[0.07] pt-3">
            <p className="text-[10px] text-black/35">{fa ? 'انتخاب تاریخ بر اساس ساعت تهران' : 'Dates use Tehran time'}</p>
            <button type="button" disabled={Boolean((min && today < min) || (max && today > max))} onClick={() => selectDate(today)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-[11px] font-bold text-black/60 transition-colors hover:bg-black/[0.045] disabled:opacity-30"><RotateCcw className="h-3.5 w-3.5" />{fa ? 'امروز' : 'Today'}</button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
