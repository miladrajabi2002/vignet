import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { Providers } from '@/components/providers'
import { dirForLocale, type Locale } from '@/lib/locale'
import './globals.css'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-display',
  weight: '100 900',
})

const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-mono',
  weight: '100 900',
})

// Estedad — a refined variable Persian typeface (OFL). Replaces Vazirmatn as
// the Persian/RTL family: cleaner, more characterful, and self-hosted so it
// loads instantly with no external request. Weight contrast (300 → 600) does
// the work of a separate display face for the minimal-luxury look.
const estedad = localFont({
  src: './fonts/EstedadVF.woff2',
  variable: '--font-fa',
  weight: '100 900',
  display: 'swap',
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vigent.ir'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Vigent — پلتفرم ایجنت هوش مصنوعی',
    template: '%s — Vigent',
  },
  description:
    'ایجنت‌های هوشمندی بسازید که از داده‌های شما پاسخ می‌دهند و در تمام کانال‌ها با مشتریان گفتگو می‌کنند.',
  applicationName: 'Vigent',
  openGraph: {
    type: 'website',
    siteName: 'Vigent',
    title: 'Vigent — پلتفرم ایجنت هوش مصنوعی',
    description:
      'ایجنت‌های هوشمندی بسازید که از داده‌های شما پاسخ می‌دهند و در تمام کانال‌ها با مشتریان گفتگو می‌کنند.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vigent — پلتفرم ایجنت هوش مصنوعی',
    description:
      'ایجنت‌های هوشمندی بسازید که از داده‌های شما پاسخ می‌دهند و در تمام کانال‌ها با مشتریان گفتگو می‌کنند.',
  },
  robots: { index: true, follow: true },
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = (await getLocale()) as Locale
  const messages = await getMessages()
  const dir = dirForLocale(locale)

  return (
    <html
      lang={locale}
      dir={dir}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${estedad.variable}`}
    >
      <body className="antialiased">
        <Providers>
          <NextIntlClientProvider locale={locale} messages={messages}>
            {children}
          </NextIntlClientProvider>
        </Providers>
      </body>
    </html>
  )
}
