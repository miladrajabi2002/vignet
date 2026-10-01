'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { LogOut, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/ui/logo'
import { getDashboardNavForProfile, getDashboardNavFromModules, groupDashboardNav, type DashboardNavGroup } from '@/components/dashboard/nav-items'
import { NavigationCountBadge } from '@/components/ui/navigation-count-badge'
import { logout } from '@/app/actions/auth'
import type { BusinessTypeValue, CapabilityKey, DashboardModuleKey } from '@/lib/verticals/registry'
import { getDashboardModuleLabel } from '@/lib/verticals/registry'

// Stable default: a fresh `[]` per render made the nav effects below see a
// "changed" dependency every render and setState forever. That render loop
// starved React, so the page content under the layout never hydrated when
// the business profile had no capabilities.
const NO_CAPABILITIES: readonly CapabilityKey[] = []

const GROUP_LABEL_KEY: Record<DashboardNavGroup, 'navGroupDaily' | 'navGroupBusiness' | 'navGroupSetup'> = {
	daily: 'navGroupDaily',
	business: 'navGroupBusiness',
	setup: 'navGroupSetup',
}

export function Sidebar({ businessType, capabilities = NO_CAPABILITIES, handedOffCount = 0 }: { businessType?: BusinessTypeValue | null; capabilities?: readonly CapabilityKey[]; handedOffCount?: number }) {
        const t = useTranslations('dashboard')
        const locale = useLocale()
        const pathname = usePathname()
        const capabilitiesKey = capabilities.join(',')
        const initialNav = useMemo(
                () => getDashboardNavForProfile(capabilitiesKey ? capabilitiesKey.split(',') as CapabilityKey[] : []),
                [capabilitiesKey],
        )
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
                <aside className="sticky top-0 hidden h-dvh w-[16.5rem] shrink-0 flex-col border-e border-[var(--border-default)] px-3 pb-3 pt-2 md:flex">
                        {/* Logo — clean, no box */}
                        <Link
                                href="/"
                                aria-label={t('overview')}
                                className="mb-2 flex min-h-12 items-center px-3"
                        >
                                <Logo priority className="h-7 w-28" />
                        </Link>

                        {/* The assistant shortcut is the rail's only ink block; the active
                            page is a raised white row so the two never compete. */}
                        <Link
                                href="/vigento"
                                className="spatial-press mb-3 flex min-h-12 items-center gap-3 rounded-control bg-[#111] px-3.5 text-[13.5px] font-medium text-white shadow-[var(--shadow-control)]"
                        >
                                <span className="grid h-7 w-7 place-items-center rounded-chip bg-white/12">
                                        <Sparkles className="h-4 w-4" />
                                </span>
                                <span className="flex-1">{t('vigentoName')}</span>
                                <span className="text-[12px] font-normal text-white/70">{t('vigentoTagline')}</span>
                        </Link>

                        {/* Keep every module reachable when vertical profiles produce a long rail. */}
                        <nav className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pe-1 [scrollbar-width:thin]" aria-label={t('overview')}>
                                {groupDashboardNav(nav).map((section) => (
                                        <div key={section.group} className="space-y-0.5">
                                                <p className="px-3 pb-0.5 text-[12px] font-medium text-[var(--text-hint)]">{t(GROUP_LABEL_KEY[section.group])}</p>
                                                {section.items.map(({ key, href, icon: Icon }) => {
                                                        const active = pathname === href || pathname.startsWith(`${href}/`)
                                                        return (
                                                                <Link
                                                                        key={key}
                                                                        href={href}
                                                                        aria-current={active ? 'page' : undefined}
                                                                        className={cn(
                                                                                'group flex min-h-10 items-center gap-2.5 rounded-control px-3 py-1.5 text-[13.5px] transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.98]',
                                                                                // The rail has no card of its own, so the current page is the
                                                                                // one raised white row: ink label, ink icon, ink count.
                                                                                active
                                                                                        ? 'bg-white font-bold text-[var(--text-primary)] shadow-[var(--elev-1)] ring-1 ring-black/[0.06]'
                                                                                        : 'text-[var(--text-secondary)] hover:bg-black/[0.045] hover:text-[var(--text-primary)]',
                                                                        )}
                                                                >
                                                                        <Icon className={cn('h-[1.05rem] w-[1.05rem] shrink-0', active ? 'text-[var(--text-primary)]' : 'text-[var(--text-hint)] group-hover:text-[var(--text-muted)]')} strokeWidth={active ? 2.2 : 1.9} />
                                                                        <span className="min-w-0 flex-1 truncate">{getDashboardModuleLabel(key, businessType, locale, t(key))}</span>
                                                                        {key === 'conversations' && (
                                                                                <NavigationCountBadge
                                                                                        count={handedOffCount}
                                                                                        active
                                                                                        locale={locale === 'en' ? 'en-US' : 'fa-IR'}
                                                                                        label={locale === 'en' ? 'Handed to operator' : 'تحویل‌شده به اپراتور'}
                                                                                />
                                                                        )}
                                                                        {newModules.includes(key) && !active && (
                                                                                <span className="rounded-full bg-black px-2 py-0.5 text-[12px] font-bold text-white">{t('newLabel')}</span>
                                                                        )}
                                                                </Link>
                                                        )
                                                })}
                                        </div>
                                ))}
                        </nav>
                        <form action={logout} className="mt-2 border-t border-[var(--border-default)] pt-2">
                                <button
                                        type="submit"
                                        className="flex min-h-10 w-full items-center gap-2.5 rounded-control px-3 py-2 text-[13.5px] text-[var(--text-muted)] transition-colors duration-150 hover:bg-black/[0.045] hover:text-[var(--text-primary)]"
                                >
                                        <LogOut className="h-[1.05rem] w-[1.05rem] rtl:rotate-180" />
                                        {t('logout')}
                                </button>
                        </form>
                </aside>
        )
}
