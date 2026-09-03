'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpenText, CircleDollarSign, House, LayoutDashboard, LogIn, Rocket } from 'lucide-react'
import { cn } from '@/lib/utils'

type MobileNavCopy = {
	home: string
	docs: string
	startFree: string
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
			id: 'docs',
			href: '/docs',
			label: copy.docs,
			icon: BookOpenText,
			active: pathname.startsWith('/docs'),
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
			className="marketing-mobile-bottom-nav fixed inset-x-3 isolate z-50 mx-auto grid h-[4.65rem] max-w-lg grid-cols-5 items-end gap-0.5 rounded-[1.65rem] border border-black/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(249,249,247,0.9))] p-1.5 shadow-[0_1px_1px_rgba(255,255,255,0.95)_inset,0_18px_45px_-18px_rgba(0,0,0,0.38),0_4px_12px_-6px_rgba(0,0,0,0.12)] backdrop-blur-2xl before:pointer-events-none before:absolute before:inset-px before:z-0 before:rounded-[calc(1.65rem-2px)] before:border before:border-white/70 [bottom:max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
		>
			{items.slice(0, 2).map(({ id, href, label, icon: Icon, active }) => (
				<Link
					key={id}
					href={href}
					aria-current={active ? (id === 'home' ? 'page' : 'location') : undefined}
					className={cn(
						'group relative z-10 flex min-h-[3.75rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[1.15rem] px-0.5 text-[11px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-accent)] focus-visible:ring-offset-1 motion-reduce:transition-none',
						active ? 'font-semibold text-black' : 'font-medium text-black/48 hover:text-black',
					)}
				>
					<span
						aria-hidden
						className={cn(
							'relative grid h-8 w-8 place-items-center rounded-[0.8rem] transition-[transform,background-color,color,box-shadow] duration-200 group-active:scale-[0.92] motion-reduce:transition-none',
							active
								? 'bg-black text-white shadow-[0_8px_18px_-8px_rgba(0,0,0,0.7),0_1px_0_rgba(255,255,255,0.18)_inset]'
								: 'text-black/42 group-hover:bg-black/[0.045] group-hover:text-black/75',
						)}
					>
						<Icon className="h-[1.05rem] w-[1.05rem]" strokeWidth={active ? 2.2 : 1.8} />
					</span>
					<span className="max-w-full truncate leading-4">{label}</span>
				</Link>
			))}

			<Link
				href="/login?next=/onboarding"
				aria-label={copy.startFree}
				className="group relative z-20 min-h-[3.75rem] min-w-0 rounded-[1.15rem] focus-visible:outline-none"
			>
				<span className="absolute -top-5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-0.5 text-[11px] font-bold text-black">
					<span className="grid h-[3.35rem] w-[3.35rem] place-items-center rounded-[1.15rem] border-[5px] border-white bg-black text-white shadow-[0_14px_28px_-12px_rgba(0,0,0,0.72)] transition-[transform,background-color,box-shadow] duration-200 group-hover:bg-black/85 group-active:scale-[0.92] group-focus-visible:ring-2 group-focus-visible:ring-[var(--blue-accent)] group-focus-visible:ring-offset-2 motion-reduce:transition-none">
						<Rocket className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
					</span>
					<span className="whitespace-nowrap leading-4">{copy.startFree}</span>
				</span>
			</Link>

			{items.slice(2).map(({ id, href, label, icon: Icon, active }) => (
				<Link
					key={id}
					href={href}
					aria-current={active ? 'location' : undefined}
					className={cn(
						'group relative z-10 flex min-h-[3.75rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[1.15rem] px-0.5 text-[11px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-accent)] focus-visible:ring-offset-1 motion-reduce:transition-none',
						active ? 'font-semibold text-black' : 'font-medium text-black/48 hover:text-black',
					)}
				>
					<span
						aria-hidden
						className={cn(
							'grid h-8 w-8 place-items-center rounded-[0.8rem] transition-[transform,background-color,color,box-shadow] duration-200 group-active:scale-[0.92] motion-reduce:transition-none',
							active
								? 'bg-black text-white shadow-[0_8px_18px_-8px_rgba(0,0,0,0.7),0_1px_0_rgba(255,255,255,0.18)_inset]'
								: 'text-black/42 group-hover:bg-black/[0.045] group-hover:text-black/75',
						)}
					>
						<Icon className="h-[1.05rem] w-[1.05rem]" strokeWidth={active ? 2.2 : 1.8} />
					</span>
					<span className="max-w-full truncate leading-4">{label}</span>
				</Link>
			))}

			<Link
				href={authenticated ? '/overview' : '/login'}
				aria-label={authenticated ? copy.dashboardAria : copy.login}
				className="group relative z-10 flex min-h-[3.75rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[1.15rem] px-0.5 text-[11px] font-medium text-black/48 transition-colors duration-200 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-accent)] focus-visible:ring-offset-1 motion-reduce:transition-none"
			>
				<span className="relative grid h-8 w-8 place-items-center rounded-[0.8rem] text-black/42 transition-[transform,background-color,color] duration-200 group-hover:bg-black/[0.045] group-hover:text-black/75 group-active:scale-[0.92] motion-reduce:transition-none">
					{authenticated ? (
						<LayoutDashboard className="h-[1.05rem] w-[1.05rem]" strokeWidth={2.1} aria-hidden="true" />
					) : (
						<LogIn className="h-[1.05rem] w-[1.05rem] rtl:rotate-180" strokeWidth={2.1} aria-hidden="true" />
					)}
					{authenticated && (
						<span aria-hidden className="absolute -end-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-[3px] ring-white" />
					)}
				</span>
				<span className="max-w-full truncate leading-4">{authenticated ? copy.dashboard : copy.login}</span>
			</Link>
		</nav>
	)
}
