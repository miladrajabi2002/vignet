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

/** Zod schema that validates and normalizes to E.164 (+989XXXXXXXXX). */
export const phoneSchema = z
  .string()
  .min(1, 'INVALID_PHONE')
  .transform((v) => normalizePhone(v))
  .refine((v): v is string => v !== null, { message: 'INVALID_PHONE' })

export const otpCodeSchema = z
  .string()
  .transform(toEnglishDigits)
  .pipe(z.string().regex(/^\d{6}$/, 'INVALID_CODE'))
