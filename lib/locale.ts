export const LOCALES = ['fa', 'en'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'fa'
export const LOCALE_COOKIE = 'locale'

export function isLocale(value: string | undefined | null): value is Locale {
  return value === 'fa' || value === 'en'
}

export function dirForLocale(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'fa' ? 'rtl' : 'ltr'
}
