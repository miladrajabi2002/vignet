import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale } from 'next-intl/server'
import { Providers } from '@/components/providers'
import { dirForLocale, type Locale } from '@/lib/locale'
import './globals.css'

const geistSans = localFont({
        src: './fonts/GeistVF.woff',
        variable: '--font-display',
        weight: '100 900',
		preload: false,
})

const geistMono = localFont({
        src: './fonts/GeistMonoVF.woff',
        variable: '--font-mono',
        weight: '100 900',
		preload: false,
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vigent.ir'

const ROOT_METADATA_COPY = {
	fa: {
		title: 'ویجنت — ایجنت هوشمند فروش و پشتیبانی فارسی',
		description: 'با ویجنت فروش و پشتیبانی مشتری را در اینستاگرام، تلگرام، بله، روبیکا و سایت از یک داشبورد هوشمند مدیریت کنید.',
		openGraphDescription: 'فروش و پشتیبانی مشتری در اینستاگرام، تلگرام، بله، روبیکا و سایت؛ همه از یک داشبورد هوشمند.',
	},
	en: {
		title: 'Vigent — AI Sales and Customer Support Agent',
		description: 'Manage sales and customer support across Instagram, Telegram, Bale, Rubika and your website from one intelligent dashboard.',
		openGraphDescription: 'Bring customer sales and support across every channel into one intelligent business dashboard.',
	},
} as const

export async function generateMetadata(): Promise<Metadata> {
	const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
	const copy = ROOT_METADATA_COPY[locale]

	return {
        metadataBase: new URL(siteUrl),
        title: {
			default: copy.title,
                template: '%s — Vigent',
        },
		description: copy.description,
        applicationName: 'Vigent',
        openGraph: {
                type: 'website',
                siteName: 'Vigent',
			title: copy.title,
			description: copy.openGraphDescription,
        },
        twitter: {
                card: 'summary_large_image',
			title: copy.title,
			description: copy.openGraphDescription,
        },
        robots: { index: true, follow: true },
        manifest: '/site.webmanifest',
        icons: {
                icon: [
                        { url: '/favicon.ico', sizes: 'any' },
                        { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
                        { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
                ],
                apple: [{ url: '/apple-touch-icon.png', type: 'image/png', sizes: '180x180' }],
        },
	}
}

export default async function RootLayout({
        children,
}: Readonly<{ children: React.ReactNode }>) {
        const locale = (await getLocale()) as Locale
        const dir = dirForLocale(locale)

        return (
                <html
                        lang={locale}
                        dir={dir}
                        suppressHydrationWarning
						className={`${geistSans.variable} ${geistMono.variable}`}
                >
                        <body className="antialiased">
                                <Providers>
                                        {/* Route layouts provide only the messages their Client Components use. */}
                                        <NextIntlClientProvider locale={locale} messages={{}}>
                                                {children}
                                        </NextIntlClientProvider>
                                </Providers>
                        </body>
                </html>
        )
}
