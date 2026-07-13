import type { ReactNode } from 'react'
import { getLocale } from 'next-intl/server'
import { Navbar } from '@/components/marketing/navbar'
import { Footer } from '@/components/marketing/footer'
import { BackToTop } from '@/components/marketing/back-to-top'

export default async function MarketingLayout({ children }: { children: ReactNode }) {
	const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
	// Single light theme site-wide (see globals.css :root). Marketing uses the
	// same monochrome tokens (--bg-base white, --text-primary/--white-* ink) as
	// the dashboard and admin.
	return (
		<div className="min-h-screen overflow-x-clip bg-[var(--bg-base)] text-[var(--text-primary)]">
			{/* Entrance animations SSR with opacity:0 and only reveal after JS runs.
			    Without JS (or if hydration fails) that text would stay invisible on
			    the white page — force it visible. */}
			<noscript>
				<style>{`[style*="opacity:0"]{opacity:1!important;transform:none!important}`}</style>
			</noscript>
			<a href="#marketing-main" className="fixed start-4 top-3 z-[100] -translate-y-20 rounded-xl bg-black px-4 py-2 text-sm text-white transition-transform focus:translate-y-0">
				{locale === 'fa' ? 'رفتن به محتوای اصلی' : 'Skip to main content'}
			</a>
			<Navbar />
			<main id="marketing-main" tabIndex={-1}>{children}</main>
			<Footer />
			<BackToTop />
		</div>
	)
}
