import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'

/**
 * A dashboard page's browser-tab title in the viewer's language. The
 * dashboard layout wraps it as «<title> · پنل ویجنت», so open tabs and
 * history entries tell the pages apart.
 */
export function dashboardTitle(fa: string, en: string): () => Promise<Metadata> {
  return async () => ({ title: (await getLocale()) === 'en' ? en : fa })
}
