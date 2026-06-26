import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { Vazirmatn } from 'next/font/google'
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

const vazirmatn = Vazirmatn({
  subsets: ['arabic'],
  variable: '--font-fa',
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
      className={`${geistSans.variable} ${geistMono.variable} ${vazirmatn.variable}`}
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
