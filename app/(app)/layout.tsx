import type { Metadata, Viewport } from 'next'
import { getLocale } from 'next-intl/server'
import type { Locale } from '@/lib/locale'
import { RootDocument, rootMetadata, rootViewport } from '../root-document'
import '../app.css'

// Root for every per-request page: dashboard, admin, login, public chat/menu/pay
// pages. The public marketing site has its own root (app/(marketing)).
export const viewport: Viewport = rootViewport

export async function generateMetadata(): Promise<Metadata> {
        return rootMetadata(await getLocale())
}

export default async function AppRootLayout({
        children,
}: Readonly<{ children: React.ReactNode }>) {
        const locale = (await getLocale()) as Locale
        return <RootDocument locale={locale}>{children}</RootDocument>
}
