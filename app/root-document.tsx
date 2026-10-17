import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import localFont from 'next/font/local'
import { NextIntlClientProvider } from 'next-intl'
import { Providers } from '@/components/providers'
import { dirForLocale, type Locale } from '@/lib/locale'
import { ChunkLoadRecovery } from '@/components/system/chunk-load-recovery'
import { ServiceWorkerRegister } from '@/components/system/service-worker-register'
import { alt as shareImageAlt, contentType as shareImageType, size as shareImageSize } from '@/lib/seo/share-image'

/*
 * The <html> document shared by the two root layouts:
 *   app/(app)/layout.tsx — dashboard, admin, login and other per-request pages
 *     (locale from the cookie);
 *   app/(marketing)/vg-site/[variant]/layout.tsx — the public site, rendered
 *     statically once per locale and signed-in state (locale from the URL).
 * Separate roots let each side ship only its own CSS; moving between them is a
 * full page load, so the two stylesheets never meet in one document.
 */

const geistSans = localFont({
        src: './fonts/GeistVF.woff2',
        variable: '--font-display',
        weight: '100 900',
                preload: false,
})

const geistMono = localFont({
        src: './fonts/GeistMonoVF.woff2',
        variable: '--font-mono',
        weight: '100 900',
                preload: false,
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vigent.ir'

export const rootViewport: Viewport = {
        width: 'device-width',
        initialScale: 1,
        viewportFit: 'cover',
        themeColor: '#ffffff',
}

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

// app/opengraph-image.tsx and app/twitter-image.tsx sit above both root
// layouts, where Next no longer attaches them by convention, so the share card
// is listed here. A page that sets its own openGraph/twitter object replaces
// it, exactly as the file convention behaved.
function shareImage(url: string) {
        return { url, alt: shareImageAlt, type: shareImageType, ...shareImageSize }
}

export function rootMetadata(requestLocale: string): Metadata {
        const locale = requestLocale === 'en' ? 'en' : 'fa'
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
                        images: [shareImage('/opengraph-image')],
        },
        twitter: {
                card: 'summary_large_image',
                        title: copy.title,
                        description: copy.openGraphDescription,
                        images: [shareImage('/twitter-image')],
        },
        robots: { index: true, follow: true },
        manifest: '/site.webmanifest',
        appleWebApp: {
                capable: true,
                statusBarStyle: 'default',
                title: 'Vigent',
        },
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

export function RootDocument({ locale, children }: { locale: Locale; children: ReactNode }) {
        return (
                <html
                        lang={locale}
                        dir={dirForLocale(locale)}
                        suppressHydrationWarning
                                                className={`${geistSans.variable} ${geistMono.variable}`}
                >
                        <body className="antialiased">
                                <ChunkLoadRecovery />
                                <ServiceWorkerRegister />
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
