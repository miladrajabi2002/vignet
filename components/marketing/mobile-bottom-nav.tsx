'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bot, CircleDollarSign, House, LayoutDashboard, LogIn, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

type MobileNavCopy = {
	home: string
	solutions: string
	vigento: string
	pricing: string
	login: string
	dashboard: string
	primaryNav: string
	dashboardAria: string
}

export function MarketingMobileBottomNav({
	authenticated,
	homeHref,
	isLandingPath,
	activeSection,
	copy,
}: {
	authenticated: boolean
	homeHref: string
	isLandingPath: boolean
	activeSection: string
	copy: MobileNavCopy
}) {
	const pathname = usePathname()
	const items = [
		{
			id: 'home',
			href: homeHref,
			label: copy.home,
			icon: House,
			active: isLandingPath && activeSection === '',
		},
		{
			id: 'solutions',
			href: `${homeHref}#solutions`,
			label: copy.solutions,
			icon: Sparkles,
			active: pathname.startsWith('/solutions/') || (isLandingPath && (activeSection === 'solutions' || activeSection === 'product')),
		},
		{
			id: 'vigento',
			href: `${homeHref}#vigento`,
			label: copy.vigento,
			icon: Bot,
			active: isLandingPath && activeSection === 'vigento',
		},
		{
			id: 'pricing',
			href: `${homeHref}#pricing`,
			label: copy.pricing,
			icon: CircleDollarSign,
			active: pathname === '/pricing' || (isLandingPath && activeSection === 'pricing'),
		},
	] as const

	return (
		<nav
			aria-label={copy.primaryNav}
			className="fixed inset-x-3 z-50 mx-auto grid max-w-lg grid-cols-5 gap-1 rounded-[1.4rem] border border-black/[0.09] bg-white/[0.92] p-1.5 shadow-[0_18px_55px_rgba(0,0,0,0.18)] backdrop-blur-xl [bottom:max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
		>
			{items.map(({ id, href, label, icon: Icon, active }) => (
				<Link
					key={id}
					href={href}
					aria-current={active ? (id === 'home' ? 'page' : 'location') : undefined}
					className={cn(
						'spatial-press relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold transition-[background-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 motion-reduce:transition-none',
						active
							? 'bg-black/[0.065] text-black'
							: 'text-black/48 hover:bg-black/[0.035] hover:text-black',
					)}
				>
					{active && <span aria-hidden className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-black" />}
					<Icon className="h-[1.15rem] w-[1.15rem]" strokeWidth={active ? 2.25 : 1.8} aria-hidden="true" />
					<span className="max-w-full truncate">{label}</span>
				</Link>
			))}

			<Link
				href={authenticated ? '/overview' : '/login'}
				aria-label={authenticated ? copy.dashboardAria : copy.login}
				className="marketing-pressable relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl bg-black px-1 text-[11px] font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
			>
				{authenticated ? (
					<>
						<span aria-hidden className="absolute end-2 top-2 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.16)]" />
						<LayoutDashboard className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.1} aria-hidden="true" />
						<span className="max-w-full truncate">{copy.dashboard}</span>
					</>
				) : (
					<>
						<LogIn className="h-[1.15rem] w-[1.15rem] rtl:rotate-180" strokeWidth={2.1} aria-hidden="true" />
						<span>{copy.login}</span>
					</>
				)}
			</Link>
		</nav>
	)
}
