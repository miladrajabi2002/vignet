'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

/** Persian/Arabic digits → Latin, then keep only digits (and one dot when allowed). */
export function normalizeNumberInput(raw: string, decimals = false): string {
  const latin = raw.replace(/[۰-۹٠-٩]/g, (digit) => {
    const persian = PERSIAN_DIGITS.indexOf(digit)
    return String(persian >= 0 ? persian : ARABIC_DIGITS.indexOf(digit))
  })
  if (!decimals) return latin.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  const cleaned = latin.replace(/[٫,]/g, (char) => (char === '٫' ? '.' : '')).replace(/[^\d.]/g, '')
  const dot = cleaned.indexOf('.')
  const single = dot < 0 ? cleaned : `${cleaned.slice(0, dot + 1)}${cleaned.slice(dot + 1).replace(/\./g, '')}`
  return single.replace(/^0+(?=\d)/, '')
}

/** 2490000 → "2,490,000"; keeps a trailing "." or decimals the user is typing. */
export function groupDigits(value: string): string {
  if (!value) return ''
  const [whole, fraction] = value.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction === undefined ? grouped : `${grouped}.${fraction}`
}

/**
 * The console's number field: thousands separators while typing, Persian
 * digits accepted, no browser spinners, and the unit as its own cell at the
 * field's end (it used to be an overlay that sat on top of the value).
 * `onChange` receives the bare number string ('' when cleared).
 */
export function NumberField({
  value,
  onChange,
  unit,
  decimals = false,
  disabled,
  placeholder,
  id,
  ariaLabel,
  className,
}: {
  value: number | string | null | undefined
  onChange: (raw: string) => void
  unit?: string
  decimals?: boolean
  disabled?: boolean
  placeholder?: string
  id?: string
  ariaLabel?: string
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  // Digits left of the caret after the last edit; separators are re-inserted
  // on every render, so the caret is restored by digit count, not index.
  const caretDigitsRef = useRef<number | null>(null)
  // While typing, the field shows exactly what was typed: a form that stores
  // an emptied field as 0 must not put a "0" back under the caret.
  const [draft, setDraft] = useState<string | null>(null)
  const display = groupDigits(draft ?? (value === null || value === undefined ? '' : normalizeNumberInput(String(value), decimals)))

  useLayoutEffect(() => {
    const input = inputRef.current
    const digits = caretDigitsRef.current
    if (!input || digits === null || document.activeElement !== input) return
    caretDigitsRef.current = null
    let seen = 0
    let position = 0
    while (position < display.length && seen < digits) {
      if (/[\d.]/.test(display[position])) seen += 1
      position += 1
    }
    input.setSelectionRange(position, position)
  }, [display])

  return (
    <div className={cn('ui-num', className)} data-disabled={disabled ? 'true' : undefined}>
      <input
        ref={inputRef}
        id={id}
        dir="ltr"
        type="text"
        inputMode={decimals ? 'decimal' : 'numeric'}
        autoComplete="off"
        aria-label={ariaLabel}
        disabled={disabled}
        placeholder={placeholder}
        value={display}
        onChange={(event) => {
          const { value: next, selectionStart } = event.target
          const beforeCaret = next.slice(0, selectionStart ?? next.length)
          caretDigitsRef.current = normalizeNumberInput(beforeCaret, decimals).length
          const normalized = normalizeNumberInput(next, decimals)
          setDraft(normalized)
          onChange(normalized)
        }}
        onBlur={() => setDraft(null)}
      />
      {unit && <span className="ui-num-unit">{unit}</span>}
    </div>
  )
}
