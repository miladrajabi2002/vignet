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

export const metadata: Metadata = {
  title: 'Vigent — AI Agent Platform',
  description:
    'Build smart AI agents that answer from your own data and talk to customers across every channel.',
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
