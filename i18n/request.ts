import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'
import { DEFAULT_LOCALE, isLocale } from '@/lib/locale'

export default getRequestConfig(async () => {
  // Locale resolution order:
  //   1. `x-vigent-locale` request header — set by middleware for /en/* URLs.
  //      A shared English link must render English even when the visitor's
  //      cookie (or no cookie at all, e.g. crawlers) says otherwise.
  //   2. `locale` cookie — the dashboard language toggle.
  //   3. Default (fa).
  const headerStore = await headers()
  const headerLocale = headerStore.get('x-vigent-locale')

  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get('locale')?.value

  const locale = isLocale(headerLocale)
    ? headerLocale
    : isLocale(cookieLocale)
      ? cookieLocale
      : DEFAULT_LOCALE

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
