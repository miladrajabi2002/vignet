import { z } from 'zod'

/**
 * Normalize an Iranian mobile number to E.164: +989XXXXXXXXX.
 * Accepts: 09XXXXXXXXX, 9XXXXXXXXX, +989XXXXXXXXX, 00989XXXXXXXXX, 989XXXXXXXXX.
 * Persian/Arabic digits are converted to ASCII.
 */
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

export function toEnglishDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (d) => {
    const p = PERSIAN_DIGITS.indexOf(d)
    if (p > -1) return String(p)
    const a = ARABIC_DIGITS.indexOf(d)
    if (a > -1) return String(a)
    return d
  })
}

export function normalizePhone(input: string): string | null {
  if (!input) return null
  let s = toEnglishDigits(input).replace(/[\s\-()]/g, '')

  if (s.startsWith('+98')) s = s.slice(3)
  else if (s.startsWith('0098')) s = s.slice(4)
  else if (s.startsWith('98') && s.length === 12) s = s.slice(2)
  else if (s.startsWith('0')) s = s.slice(1)

  // At this point we expect 9XXXXXXXXX (10 digits, leading 9)
  if (!/^9\d{9}$/.test(s)) return null
  return `+98${s}`
}

/**
 * Canonical phone value used by CRM identity matching.
 *
 * Iranian mobile numbers are always stored as E.164 (`+989XXXXXXXXX`) so
 * `0912...`, `98912...`, and `+98912...` resolve to the same customer. For
 * other international numbers we keep a conservative E.164 representation
 * when a country code is explicitly present.
 */
export function normalizeContactPhone(input: string | null | undefined): string | null {
  if (!input?.trim()) return null
  const iranian = normalizePhone(input)
  if (iranian) return iranian

  let value = toEnglishDigits(input).trim().replace(/[\s\-().]/g, '')
  if (value.startsWith('00')) value = `+${value.slice(2)}`
  if (/^\+[1-9]\d{7,14}$/.test(value)) return value
  return null
}

/**
 * Legacy spellings that may still exist on older Contact rows. New writes use
 * only the first (canonical) form; the rest make lookup and cleanup backwards
 * compatible without treating formatting differences as separate people.
 */
export function contactPhoneLookupVariants(
  input: string | null | undefined,
): string[] {
  const canonical = normalizeContactPhone(input)
  if (!canonical) return []

  if (canonical.startsWith('+98') && canonical.length === 13) {
    const national = canonical.slice(3)
    return [...new Set([
      canonical,
      canonical.slice(1),
      `0${national}`,
      national,
      `0098${national}`,
    ])]
  }

  return [canonical, canonical.slice(1)]
}

/** Zod schema that validates and normalizes to E.164 (+989XXXXXXXXX). */
export const phoneSchema = z
  .string()
  .min(1, 'INVALID_PHONE')
  .transform((v) => normalizePhone(v))
  .refine((v): v is string => v !== null, { message: 'INVALID_PHONE' })
