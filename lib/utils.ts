import { twMerge, type ClassNameValue } from 'tailwind-merge'

/** Merge Tailwind classes with conflict resolution. */
export function cn(...inputs: ClassNameValue[]) {
  return twMerge(...inputs)
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
