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
			{/* Entrance animations SSR with opacity:0 and only reveal after JS runs.
			    Without JS (or if hydration fails) that text would stay invisible on
			    the white page — force it visible. */}
			<noscript>
				<style>{`[style*="opacity:0"]{opacity:1!important;transform:none!important}`}</style>
			</noscript>
			<Navbar />
			<main>{children}</main>
			<Footer />
			<BackToTop />
		</div>
	)
}
