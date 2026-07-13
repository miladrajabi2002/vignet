'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { LogOut, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/ui/logo'
import { getDashboardNavForProfile, getDashboardNavFromModules } from '@/components/dashboard/nav-items'
import { logout } from '@/app/actions/auth'
import type { BusinessTypeValue, DashboardModuleKey } from '@/lib/verticals/registry'
import { getDashboardModuleLabel } from '@/lib/verticals/registry'

export function Sidebar({ businessType, services = [] }: { businessType?: BusinessTypeValue | null; services?: readonly string[] }) {
	const t = useTranslations('dashboard')
	const locale = useLocale()
	const pathname = usePathname()
	const initialNav = useMemo(() => getDashboardNavForProfile(businessType, services), [businessType, services])
	const [nav, setNav] = useState(initialNav)
	const [newModules, setNewModules] = useState<DashboardModuleKey[]>([])

	useEffect(() => setNav(initialNav), [initialNav])
	useEffect(() => {
		function onVerticalChange(event: Event) {
			const detail = (event as CustomEvent<{ modules?: DashboardModuleKey[]; newlyEnabled?: DashboardModuleKey[] }>).detail
			if (detail?.modules) setNav(getDashboardNavFromModules(detail.modules))
			setNewModules(detail?.newlyEnabled ?? [])
		}
		window.addEventListener('vigent:vertical-changed', onVerticalChange)
		try {
			const stored = JSON.parse(localStorage.getItem('vigent:vertical-change') ?? 'null')
			if (stored?.businessType === businessType && Date.now() - Number(stored.changedAt) < 7 * 86_400_000) {
				setNewModules(stored.newlyEnabled ?? [])
			}
		} catch {}
		return () => window.removeEventListener('vigent:vertical-changed', onVerticalChange)
	}, [businessType])

	return (
		<aside className="spatial-surface sticky top-3 m-3 me-0 hidden h-[calc(100dvh-1.5rem)] w-[17rem] shrink-0 flex-col rounded-[1.75rem] p-3 md:flex">
			{/* Logo — clean, no box */}
			<Link
				href="/"
				aria-label={t('overview')}
				className="mb-3 flex min-h-12 items-center justify-center px-2"
			>
				<Logo priority className="h-7 w-28" />
			</Link>

			<Link
				href="/vigento"
				className="spatial-press mb-2 flex min-h-12 items-center gap-3 rounded-2xl bg-black px-3.5 text-[13px] font-semibold text-white shadow-[var(--shadow-control)]"
			>
				<span className="grid h-7 w-7 place-items-center rounded-lg bg-white/12">
					<Sparkles className="h-4 w-4" />
				</span>
				<span className="flex-1">Vigento AI</span>
				<span className="text-[8px] font-normal text-white/55">هوش مصنوعی ویجنتو</span>
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
								'group flex min-h-[2.38rem] items-center gap-2.5 rounded-xl px-3 py-1.5 text-[12px] transition-[background-color,color,transform,box-shadow] duration-150 active:scale-[0.98]',
								active
									? 'bg-black font-semibold text-white shadow-[var(--shadow-control)]'
									: 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]',
							)}
						>
							<Icon className={cn('h-[1.05rem] w-[1.05rem] shrink-0', active ? 'text-white' : 'text-[var(--text-hint)] group-hover:text-[var(--text-muted)]')} />
							<span className="min-w-0 flex-1 truncate">{getDashboardModuleLabel(key, businessType, locale, t(key))}</span>
							{newModules.includes(key) && !active && (
								<span className="rounded-full bg-black px-2 py-0.5 text-[8px] font-bold text-white">{t('newLabel')}</span>
							)}
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
