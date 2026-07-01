import type { ReactNode } from 'react'
import { Navbar } from '@/components/marketing/navbar'
import { Footer } from '@/components/marketing/footer'
import { BackToTop } from '@/components/marketing/back-to-top'

export default function MarketingLayout({ children }: { children: ReactNode }) {
	// Marketing site follows the light/dark toggle (same as the dashboard).
	return (
		<div className="bg-[var(--bg-base)] text-[var(--text-primary)]">
			<Navbar />
			<main>{children}</main>
			<Footer />
			<BackToTop />
		</div>
	)
}
