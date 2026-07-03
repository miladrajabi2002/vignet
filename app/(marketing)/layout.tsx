import type { ReactNode } from 'react'
import { Navbar } from '@/components/marketing/navbar'
import { Footer } from '@/components/marketing/footer'
import { BackToTop } from '@/components/marketing/back-to-top'

export default function MarketingLayout({ children }: { children: ReactNode }) {
	// Marketing subtree is theme-aware: it inherits the light/dark class that
	// next-themes sets on <html> (default is light), so the header ThemeToggle
	// actually flips the landing page, blog and docs. All marketing components
	// use the inverting CSS variables (--bg-base, --text-primary, --white-*,
	// --ink-rgb), so both themes render correctly. Do NOT hardcode a `dark`
	// class here — that pins the whole subtree black and breaks the toggle.
	return (
		<div className="bg-[var(--bg-base)] text-[var(--text-primary)]">
			<Navbar />
			<main>{children}</main>
			<Footer />
			<BackToTop />
		</div>
	)
}
