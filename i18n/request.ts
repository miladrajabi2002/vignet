import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'
import { DEFAULT_LOCALE, isLocale } from '@/lib/locale'

export default getRequestConfig(async () => {
  const cookieStore = cookies()
  const cookieLocale = cookieStore.get('locale')?.value
  const locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
