import type { ReactNode } from 'react'
import { getLocale } from 'next-intl/server'
import { cookies } from 'next/headers'
import { Navbar } from '@/components/marketing/navbar'
import { Footer } from '@/components/marketing/footer'
import { BackToTop } from '@/components/marketing/back-to-top'
import { ScopedIntlProvider } from '@/components/i18n/scoped-intl-provider'
import { MARKETING_CLIENT_MESSAGE_PATHS } from '@/lib/i18n/client-messages'

const SESSION_COOKIE_NAMES = ['authjs.session-token', '__Secure-authjs.session-token'] as const

export default async function MarketingLayout({ children }: { children: ReactNode }) {
	const [requestLocale, cookieStore] = await Promise.all([getLocale(), cookies()])
	const locale = requestLocale === 'en' ? 'en' : 'fa'
	// This only selects the CTA label. Protected routes still verify the signed
	// session in middleware and the dashboard server layout.
	const authenticated = cookieStore.getAll().some(({ name }) =>
		SESSION_COOKIE_NAMES.some((base) => name === base || name.startsWith(`${base}.`)),
	)
	// Single light theme site-wide (see globals.css :root). Marketing uses the
	// same monochrome tokens (--bg-base white, --text-primary/--white-* ink) as
	// the dashboard and admin.
	return (
		<ScopedIntlProvider messagePaths={MARKETING_CLIENT_MESSAGE_PATHS}>
		<div className="min-h-screen overflow-x-clip bg-[var(--bg-base)] pb-[calc(5.75rem+env(safe-area-inset-bottom))] text-[var(--text-primary)] lg:pb-0">
			{/* Entrance animations SSR with opacity:0 and only reveal after JS runs.
			    Without JS (or if hydration fails) that text would stay invisible on
			    the white page — force it visible. */}
			<noscript>
				<style>{`[style*="opacity:0"]{opacity:1!important;transform:none!important}`}</style>
			</noscript>
			<a href="#marketing-main" className="fixed start-4 top-3 z-[100] -translate-y-20 rounded-xl bg-black px-4 py-2 text-sm text-white transition-transform focus:translate-y-0">
				{locale === 'fa' ? 'رفتن به محتوای اصلی' : 'Skip to main content'}
			</a>
			<Navbar authenticated={authenticated} />
			<main id="marketing-main" tabIndex={-1}>{children}</main>
			<Footer />
			<BackToTop />
		</div>
		</ScopedIntlProvider>
	)
}
