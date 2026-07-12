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

// IRANSansWeb — the standard Persian web font, loaded via @font-face in
// globals.css from /public/fonts/. The user places the .ttf files there.
// The --font-fa variable is set in globals.css :root.
const estedad = localFont({
        src: './fonts/EstedadVF.woff2',
        variable: '--font-fa-fallback',
        weight: '100 900',
        display: 'swap',
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vigent.ir'

export const metadata: Metadata = {
        metadataBase: new URL(siteUrl),
        title: {
                default: 'ویجنت — ایجنت هوشمند فروش و پشتیبانی فارسی',
                template: '%s — Vigent',
        },
        description:
                'با ویجنت فروش و پشتیبانی مشتری را در اینستاگرام، تلگرام، واتساپ، بله، روبیکا و سایت از یک داشبورد هوشمند مدیریت کنید.',
        applicationName: 'Vigent',
        openGraph: {
                type: 'website',
                siteName: 'Vigent',
                title: 'ویجنت — ایجنت هوشمند فروش و پشتیبانی فارسی',
                description:
                        'فروش و پشتیبانی مشتری در اینستاگرام، تلگرام، واتساپ، بله، روبیکا و سایت؛ همه از یک داشبورد هوشمند.',
        },
        twitter: {
                card: 'summary_large_image',
                title: 'ویجنت — ایجنت هوشمند فروش و پشتیبانی فارسی',
                description:
                        'فروش و پشتیبانی مشتری در اینستاگرام، تلگرام، واتساپ، بله، روبیکا و سایت؛ همه از یک داشبورد هوشمند.',
        },
        robots: { index: true, follow: true },
        manifest: '/site.webmanifest',
        // Keep every URL deploy-safe: icon.png is the shipped PNG fallback
        // until dedicated 16/32/180/192px brand files are supplied.
        // Brand icons. Drop a 512×512 square PNG (or SVG) at public/icon.png
        // for the favicon / app icon / apple-touch-icon. The legacy
        // app/favicon.ico is kept as the .ico fallback for old browsers.
        icons: {
                icon: [
                        { url: '/favicon.ico', sizes: 'any' },
                        { url: '/icon.png', type: 'image/png', sizes: '512x512' },
                ],
                apple: [{ url: '/icon.png', type: 'image/png', sizes: '512x512' }],
        },
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
