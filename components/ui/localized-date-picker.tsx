'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { CalendarDays, RotateCcw, Trash2 } from 'lucide-react'
import { DayPicker as GregorianDayPicker, type Matcher } from 'react-day-picker'
import { DayPicker as PersianDayPicker, faIR } from 'react-day-picker/persian'
import { enUS } from 'react-day-picker/locale'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'
import { cn } from '@/lib/utils'
import {
  dateKeyInTimeZone,
  formatDateKey,
  parseDateKey,
  todayDateKey,
  type DateLocale,
} from '@/lib/localized-date'

export type LocalizedDatePickerProps = {
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
}

function dateFromKey(value?: string): Date | undefined {
  if (!value) return undefined
  try {
    const { year, month, day } = parseDateKey(value)
    // Noon survives display-zone conversion without crossing the date boundary.
    return new Date(Date.UTC(year, month - 1, day, 12))
  } catch {
    return undefined
  }
}

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
}: LocalizedDatePickerProps) {
  const id = useId()
  const fa = locale === 'fa'
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const todayKey = useMemo(() => todayDateKey(timeZone), [timeZone])
  const selectedDate = useMemo(() => dateFromKey(value), [value])
  const minDate = useMemo(() => dateFromKey(min), [min])
  const maxDate = useMemo(() => dateFromKey(max), [max])
  const today = useMemo(() => dateFromKey(todayKey) ?? new Date(), [todayKey])
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => selectedDate ?? today)

  useEffect(() => {
    if (open) setVisibleMonth(selectedDate ?? today)
  }, [open, selectedDate, today])

  function selectDate(date: Date) {
    onValueChange(dateKeyInTimeZone(date, timeZone))
    setOpen(false)
  }

  const displayValue = value
    ? formatDateKey(value, locale, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })
    : placeholder ?? (fa ? 'انتخاب تاریخ' : 'Choose a date')
  const unavailable: Matcher[] = [
    ...(minDate ? [{ before: minDate } as const] : []),
    ...(maxDate ? [{ after: maxDate } as const] : []),
  ]
  const calendarProps = {
    id: `${id}-calendar`,
    mode: 'single' as const,
    selected: selectedDate,
    month: visibleMonth,
    onMonthChange: setVisibleMonth,
    onSelect: (date: Date | undefined) => { if (date) selectDate(date) },
    disabled: unavailable,
    startMonth: minDate,
    endMonth: maxDate,
    today,
    timeZone,
    noonSafe: true,
    fixedWeeks: true,
    showOutsideDays: false,
    navLayout: 'around' as const,
    autoFocus: true,
    className: 'vigent-date-calendar',
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
        onClick={() => setOpen(true)}
        className={cn(
          'spatial-press flex min-h-11 w-full items-center gap-2 rounded-xl border border-black/[0.08] bg-white px-3 text-start shadow-[0_6px_18px_rgba(0,0,0,0.055)] transition-[border-color,box-shadow,background-color] duration-150 hover:border-black/[0.14] focus-visible:border-black/20 focus-visible:shadow-[0_10px_28px_rgba(0,0,0,0.09)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45',
          open && 'border-black/20 shadow-[0_10px_28px_rgba(0,0,0,0.09)]',
          buttonClassName,
        )}
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-black/[0.045] text-black/55"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /></span>
        <span className={cn('min-w-0 flex-1 truncate text-xs font-medium', value ? 'text-black/75' : 'text-black/35')}>{displayValue}</span>
      </button>

      <MobileBottomSheet
        open={open}
        title={fa ? 'انتخاب تاریخ' : 'Choose a date'}
        description={fa ? 'تقویم شمسی' : 'Gregorian calendar'}
        closeLabel={fa ? 'بستن تقویم' : 'Close calendar'}
        triggerRef={triggerRef}
        mobileOnly={false}
        motionPreset="detail"
        panelClassName="md:max-w-md"
        contentClassName="pb-2"
        onClose={() => setOpen(false)}
        footer={
          <div className="flex min-h-12 items-center justify-between gap-2">
            <button
              type="button"
              disabled={!value}
              onClick={() => { onValueChange(''); setOpen(false) }}
              className="spatial-press inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-bold text-[var(--text-secondary)] transition-colors hover:bg-black/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25 disabled:invisible"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              {fa ? 'پاک کردن' : 'Clear'}
            </button>
            <button
              type="button"
              disabled={Boolean((min && todayKey < min) || (max && todayKey > max))}
              onClick={() => selectDate(today)}
              className="spatial-press inline-flex min-h-11 items-center gap-2 rounded-xl bg-black px-4 text-xs font-bold text-white shadow-[var(--shadow-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              {fa ? 'امروز' : 'Today'}
            </button>
          </div>
        }
      >
        {fa
          ? <PersianDayPicker {...calendarProps} locale={faIR} dir="rtl" numerals="arabext" />
          : <GregorianDayPicker {...calendarProps} locale={enUS} dir="ltr" numerals="latn" />}
        <p className="mt-2 text-center text-[11px] leading-5 text-[var(--text-muted)]">{fa ? 'تاریخ‌ها بر اساس ساعت تهران هستند' : 'Dates use Tehran time'}</p>
      </MobileBottomSheet>
    </div>
  )
}
