import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge Tailwind classes with conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const ADJECTIVES = ['swift', 'bright', 'calm', 'bold', 'clever', 'keen', 'prime', 'vivid']
const NOUNS = ['fox', 'wave', 'spark', 'pulse', 'atlas', 'nova', 'orbit', 'flux']

/** Generate a unique, URL-safe workspace slug. */
export function generateSlug(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  const rand = Math.random().toString(36).slice(2, 7)
  return `${adj}-${noun}-${rand}`
}

/** Format a number as Iranian Toman with Persian digits. */
export function formatToman(value: number, locale: 'fa' | 'en' = 'fa'): string {
  return value.toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')
}
