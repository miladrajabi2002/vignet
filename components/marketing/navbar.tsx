'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowLeft, ArrowRight, Menu, X } from 'lucide-react'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { Logo } from '@/components/ui/logo'
import { cn } from '@/lib/utils'

const SECTION_IDS = ['product', 'demo', 'businesses', 'pricing'] as const

const LOCAL_COPY = {
	fa: { product: 'محصول', demo: 'دموی زنده', businesses: 'برای کسب‌وکارها', resources: 'یادگیری', start: 'شروع رایگان', menu: 'باز کردن منو', close: 'بستن منو' },
	en: { product: 'Product', demo: 'Live demo', businesses: 'For business', resources: 'Learn', start: 'Start free', menu: 'Open menu', close: 'Close menu' },
} as const

export function Navbar() {
	const t = useTranslations('nav')
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = LOCAL_COPY[locale]
	const pathname = usePathname()
	const [scrolled, setScrolled] = useState(false)
	const [open, setOpen] = useState(false)
	const [activeSection, setActiveSection] = useState('')
	const Arrow = locale === 'fa' ? ArrowLeft : ArrowRight

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 12)
		onScroll()
		window.addEventListener('scroll', onScroll, { passive: true })
		return () => window.removeEventListener('scroll', onScroll)
	}, [])

	useEffect(() => {
		setOpen(false)
	}, [pathname])

	useEffect(() => {
		if (!open) return
		const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
		document.addEventListener('keydown', onKeyDown)
		document.body.style.overflow = 'hidden'
		return () => {
			document.removeEventListener('keydown', onKeyDown)
			document.body.style.overflow = ''
		}
	}, [open])

	useEffect(() => {
		if (pathname !== '/') {
			setActiveSection('')
			return
		}
		const sections = SECTION_IDS.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null)
		if (!sections.length) return
		const visible = new Map<string, number>()
		const observer = new IntersectionObserver((entries) => {
			entries.forEach((entry) => entry.isIntersecting ? visible.set(entry.target.id, entry.intersectionRatio) : visible.delete(entry.target.id))
			const current = [...visible.entries()].sort((a, b) => b[1] - a[1])[0]
			setActiveSection(current?.[0] ?? '')
		}, { rootMargin: '-38% 0px -50% 0px', threshold: [0, 0.2, 0.5] })
		sections.forEach((section) => observer.observe(section))
		return () => observer.disconnect()
	}, [pathname])

	const sectionLinks = [
		{ href: '/#product', id: 'product', label: copy.product },
		{ href: '/#demo', id: 'demo', label: copy.demo },
		{ href: '/#businesses', id: 'businesses', label: copy.businesses },
		{ href: '/#pricing', id: 'pricing', label: t('pricing') },
	]
	const resourceLinks = [
		{ href: '/blog', label: t('blog') },
		{ href: '/docs', label: t('docs') },
	]

	return (
		<header className={cn('fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color] duration-300', scrolled || open ? 'border-black/10 bg-white/95 backdrop-blur-xl' : 'border-transparent bg-white/80 backdrop-blur-md')}>
			<nav className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8" aria-label="Primary navigation">
				<Link href="/" aria-label="Vigent home" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">
					<Logo priority className="h-9 w-28 sm:w-36" />
				</Link>

				<div className="hidden items-center gap-1 rounded-full border border-black/10 bg-white p-1 shadow-sm lg:flex">
					{sectionLinks.map((link) => (
						<Link key={link.id} href={link.href} className={cn('inline-flex min-h-9 items-center rounded-full px-3.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black', pathname === '/' && activeSection === link.id ? 'bg-black text-white' : 'text-black/55 hover:bg-black/[0.04] hover:text-black')}>
							{link.label}
						</Link>
					))}
					<span className="mx-1 h-4 w-px bg-black/10" />
					{resourceLinks.map((link) => (
						<Link key={link.href} href={link.href} className={cn('inline-flex min-h-9 items-center rounded-full px-3 text-[11px] font-medium transition-colors', pathname.startsWith(link.href) ? 'bg-black text-white' : 'text-black/55 hover:bg-black/[0.04] hover:text-black')}>{link.label}</Link>
					))}
				</div>

				<div className="hidden items-center gap-2 lg:flex">
					<LanguageSwitcher />
					<Link href="/login" className="inline-flex min-h-11 items-center px-3 text-[11px] font-medium text-black/55 transition-colors hover:text-black">{t('login')}</Link>
					<Link href="/login?next=/onboarding" className="group inline-flex min-h-11 items-center gap-2 rounded-full bg-black px-4 text-[11px] font-medium text-white shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">
						{copy.start}<Arrow className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" />
					</Link>
				</div>

				<div className="flex items-center gap-2 lg:hidden">
					<Link href="/login?next=/onboarding" className="inline-flex min-h-11 items-center rounded-full bg-black px-4 text-[11px] font-medium text-white">{copy.start}</Link>
					<button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="mobile-marketing-menu" aria-label={open ? copy.close : copy.menu} className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black">
						{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
					</button>
				</div>
			</nav>

			{open && (
				<div id="mobile-marketing-menu" className="h-[calc(100dvh-72px)] overflow-y-auto border-t border-black/10 bg-white px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5 lg:hidden">
					<div className="mx-auto max-w-2xl">
						<p className="mb-3 text-[10px] font-medium uppercase tracking-[0.15em] text-black/35">{copy.product}</p>
						<div className="divide-y divide-black/10 border-y border-black/10">
							{sectionLinks.map((link) => <Link key={link.id} href={link.href} onClick={() => setOpen(false)} className="flex min-h-14 items-center justify-between text-base font-medium text-black"><span>{link.label}</span><Arrow className="h-4 w-4 text-black/35" /></Link>)}
						</div>
						<p className="mb-3 mt-8 text-[10px] font-medium uppercase tracking-[0.15em] text-black/35">{copy.resources}</p>
						<div className="grid grid-cols-2 gap-3">
							{resourceLinks.map((link) => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="flex min-h-14 items-center justify-center rounded-xl border border-black/10 text-sm font-medium text-black">{link.label}</Link>)}
						</div>
						<div className="mt-8 flex items-center justify-between border-t border-black/10 pt-5"><LanguageSwitcher /><Link href="/login" onClick={() => setOpen(false)} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-black/60">{t('login')}<Arrow className="h-4 w-4" /></Link></div>
					</div>
				</div>
			)}
		</header>
	)
}
