import type { ReactNode } from 'react'
import { Navbar } from '@/components/marketing/navbar'
import { Footer } from '@/components/marketing/footer'
import { BackToTop } from '@/components/marketing/back-to-top'

export default function MarketingLayout({ children }: { children: ReactNode }) {
	// Marketing site is ALWAYS dark by design (see globals.css comment:
	// "Light theme — inverted monochrome (dashboard only; marketing stays black)").
	// The `dark` class on this wrapper forces dark CSS variables for the entire
	// marketing subtree, regardless of the next-themes setting on <html>.
	// This keeps the landing page, blog, and docs in their intended high-contrast
	// black & white look while the dashboard/admin can use the light theme.
	return (
		<div className="dark bg-[var(--bg-base)] text-[var(--text-primary)]">
			<Navbar />
			<main>{children}</main>
			<Footer />
			<BackToTop />
		</div>
	)
}
