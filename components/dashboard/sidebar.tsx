'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Rocket } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/ui/logo'
import { getDashboardNav } from '@/components/dashboard/nav-items'
import type { BusinessTypeValue } from '@/lib/verticals/registry'

export function Sidebar({ businessType }: { businessType?: BusinessTypeValue | null }) {
	const t = useTranslations('dashboard')
	const pathname = usePathname()
	const nav = getDashboardNav(businessType)

	return (
		<aside className="sticky top-0 hidden h-dvh w-[17rem] shrink-0 flex-col border-e border-[var(--border-default)] bg-white/90 px-4 py-5 backdrop-blur-xl md:flex">
			<Link
				href="/overview"
				aria-label={t('overview')}
				className="mb-6 flex min-h-14 items-center rounded-2xl border border-[var(--border-subtle)] bg-white px-3 shadow-[var(--shadow-soft)]"
			>
				<Logo priority className="h-9 w-36" />
			</Link>

			<Link
				href="/onboarding"
				className={cn(
					'mb-5 flex min-h-12 items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm transition-[background-color,border-color,color,transform] duration-200 hover:-translate-y-0.5',
					pathname.startsWith('/onboarding')
						? 'border-[var(--accent-border)] bg-[var(--accent-soft)] font-medium text-[var(--accent-foreground)]'
						: 'border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:border-[var(--accent-border)] hover:text-[var(--text-primary)]',
				)}
			>
				<span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
					<Rocket className="h-4 w-4" />
				</span>
				{t('onboarding')}
			</Link>

			<nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto" aria-label={t('overview')}>
				{nav.map(({ key, href, icon: Icon }) => {
					const active = pathname === href || pathname.startsWith(`${href}/`)
					return (
						<Link
							key={key}
							href={href}
							className={cn(
								'group relative flex min-h-11 items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm transition-[background-color,color] duration-200',
								active
									? 'bg-[var(--accent-soft)] font-semibold text-[var(--accent-foreground)]'
									: 'text-[var(--text-secondary)] hover:bg-white hover:text-[var(--text-primary)]',
							)}
						>
							{active && <span aria-hidden className="absolute inset-y-2 start-0 w-0.5 rounded-full bg-[var(--accent)]" />}
							<span className={cn('grid h-7 w-7 place-items-center rounded-lg transition-colors', active ? 'bg-white text-[var(--accent-strong)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-primary)]')}>
								<Icon className="h-4 w-4" />
							</span>
							{t(key)}
						</Link>
					)
				})}
			</nav>
		</aside>
	)
}
