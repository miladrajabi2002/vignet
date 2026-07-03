import type { ReactNode } from 'react'
import { Navbar } from '@/components/marketing/navbar'
import { Footer } from '@/components/marketing/footer'
import { BackToTop } from '@/components/marketing/back-to-top'

export default function MarketingLayout({ children }: { children: ReactNode }) {
	// Single light theme site-wide (see globals.css :root). Marketing uses the
	// same monochrome tokens (--bg-base white, --text-primary/--white-* ink) as
	// the dashboard and admin.
	return (
		<div className="bg-[var(--bg-base)] text-[var(--text-primary)]">
			<Navbar />
			<main>{children}</main>
			<Footer />
			<BackToTop />
		</div>
	)
}
