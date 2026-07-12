'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Rocket, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/ui/logo'
import { getDashboardNav } from '@/components/dashboard/nav-items'
import { logout } from '@/app/actions/auth'
import type { BusinessTypeValue } from '@/lib/verticals/registry'

export function Sidebar({ businessType }: { businessType?: BusinessTypeValue | null }) {
	const t = useTranslations('dashboard')
	const pathname = usePathname()
	const nav = getDashboardNav(businessType)

	return (
		<aside className="sticky top-0 hidden h-dvh w-[16rem] shrink-0 flex-col border-e border-[var(--border-default)] bg-white px-3 py-4 md:flex">
			{/* Logo — clean, no box */}
			<Link
				href="/overview"
				aria-label={t('overview')}
				className="mb-6 flex min-h-10 items-center justify-center px-2"
			>
				<Logo priority className="h-7 w-28" />
			</Link>

			{/* Onboarding link — subtle */}
			<Link
				href="/onboarding"
				className={cn(
					'mb-2 flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors duration-150',
					pathname.startsWith('/onboarding')
						? 'bg-[var(--bg-surface)] font-medium text-[var(--text-primary)]'
						: 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]',
				)}
			>
				<Rocket className="h-[1.05rem] w-[1.05rem]" />
				{t('onboarding')}
			</Link>

			{/* Navigation — minimal, no scroll, subtle active state */}
			<nav className="flex flex-1 flex-col gap-0.5 overflow-hidden" aria-label={t('overview')}>
				{nav.map(({ key, href, icon: Icon }) => {
					const active = pathname === href || pathname.startsWith(`${href}/`)
					return (
						<Link
							key={key}
							href={href}
							className={cn(
								'group flex min-h-[2.5rem] items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors duration-150',
								active
									? 'bg-[var(--bg-surface)] font-medium text-[var(--text-primary)]'
									: 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]',
							)}
						>
							<Icon className={cn('h-[1.05rem] w-[1.05rem] shrink-0', active ? 'text-[var(--text-primary)]' : 'text-[var(--text-hint)] group-hover:text-[var(--text-muted)]')} />
							{t(key)}
						</Link>
					)
				})}
			</nav>

			<form action={logout} className="mt-2 border-t border-[var(--border-default)] pt-2">
				<button
					type="submit"
					className="flex min-h-[2.5rem] w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
				>
					<LogOut className="h-[1.05rem] w-[1.05rem] rtl:rotate-180" />
					{t('logout')}
				</button>
			</form>
		</aside>
	)
}
