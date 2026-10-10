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
import { getDashboardModuleLabel, getVerticalPack } from '@/lib/verticals/registry'

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

export function Sidebar({ businessType, capabilities = NO_CAPABILITIES, handedOffCount = 0, userName }: { businessType?: BusinessTypeValue | null; capabilities?: readonly CapabilityKey[]; handedOffCount?: number; userName?: string | null }) {
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
                        const detail = (event as CustomEvent<{ modules?: DashboardModuleKey[]; capabilities?: CapabilityKey[]; newlyEnabled?: DashboardModuleKey[] }>).detail
                        if (detail?.modules) setNav(getDashboardNavFromModules(detail.modules, detail.capabilities))
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

        const businessLabel = locale === 'en' ? getVerticalPack(businessType).titleEn : getVerticalPack(businessType).titleFa
        const displayName = userName?.trim() || t('welcome')

        // Tablets (md–lg) get a 68px icon rail so the page keeps its width; the
        // full 17rem rail with labels starts at lg. Phones use MobileNav.
        return (
                <aside className="spatial-surface sticky top-3 m-3 me-0 hidden h-[calc(100dvh-1.5rem)] w-[4.25rem] shrink-0 flex-col rounded-sheet p-2 md:flex lg:w-[17rem] lg:p-3">
                        {/* Logo — clean, no box (the rail shows only the mark) */}
                        <Link
                                href="/"
                                aria-label={t('overview')}
                                className="mb-3 flex min-h-12 items-center justify-center px-2"
                        >
                                <Logo priority className="hidden h-7 w-28 lg:block" />
                                <span aria-hidden className="relative block h-7 w-[26px] overflow-hidden lg:hidden" dir="ltr">
                                        <Logo className="absolute left-0 top-0 h-7 w-28" />
                                </span>
                        </Link>

                        {/* The assistant shortcut is the rail's only ink block; the active
                            page is an ink-tinted row so the two never compete. */}
                        <Link
                                href="/vigento"
                                title={t('vigentoName')}
                                className="spatial-press mb-3 flex min-h-12 items-center justify-center gap-3 rounded-control bg-[#111] text-[13px] font-medium text-white shadow-[var(--shadow-control)] lg:justify-start lg:px-3.5"
                        >
                                <span className="grid h-7 w-7 place-items-center rounded-chip bg-white/12">
                                        <Sparkles className="h-4 w-4" />
                                </span>
                                <span className="hidden flex-1 lg:block">{t('vigentoName')}</span>
                                <span className="hidden text-[12px] font-normal text-white/70 lg:block">{t('vigentoTagline')}</span>
                        </Link>

                        {/* Every module stays reachable on short screens: the list scrolls
                            without a visible scrollbar and its bottom edge fades out. */}
                        <nav
                                className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pb-6 [mask-image:linear-gradient(#000_calc(100%-1.75rem),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                                aria-label={t('overview')}
                        >
                                {groupDashboardNav(nav).map((section, sectionIndex) => (
                                        <div key={section.group} className="space-y-0.5">
                                                <p className="hidden px-3 pb-0.5 text-[12px] font-medium text-[var(--text-muted)] lg:block">{t(GROUP_LABEL_KEY[section.group])}</p>
                                                {sectionIndex > 0 && <span aria-hidden className="mx-3 mb-2 block h-px bg-[var(--border-default)] lg:hidden" />}
                                                {section.items.map(({ key, href, icon: Icon }) => {
                                                        const active = pathname === href || pathname.startsWith(`${href}/`)
                                                        const label = getDashboardModuleLabel(key, businessType, locale, t(key))
                                                        return (
                                                                <Link
                                                                        key={key}
                                                                        href={href}
                                                                        title={label}
                                                                        aria-current={active ? 'page' : undefined}
                                                                        className={cn(
                                                                                'group relative flex min-h-10 items-center justify-center gap-2.5 rounded-control text-[13px] transition-[background-color,color,transform] duration-150 active:scale-[0.98] lg:min-h-9 lg:justify-start lg:px-3 lg:py-1',
                                                                                // The rail is a white card, so the current page is an ink-tinted
                                                                                // row with a bold ink label and icon.
                                                                                active
                                                                                        ? 'bg-black/[0.07] font-bold text-[var(--text-primary)]'
                                                                                        : 'text-[var(--text-secondary)] hover:bg-black/[0.035] hover:text-[var(--text-primary)]',
                                                                        )}
                                                                >
                                                                        <Icon className={cn('h-[1.05rem] w-[1.05rem] shrink-0', active ? 'text-[var(--text-primary)]' : 'text-[var(--text-hint)] group-hover:text-[var(--text-muted)]')} strokeWidth={active ? 2.2 : 1.9} />
                                                                        <span className="hidden min-w-0 flex-1 truncate lg:block">{label}</span>
                                                                        {key === 'conversations' && (
                                                                                <>
                                                                                        <NavigationCountBadge
                                                                                                count={handedOffCount}
                                                                                                active
                                                                                                locale={locale === 'en' ? 'en-US' : 'fa-IR'}
                                                                                                label={locale === 'en' ? 'Handed to operator' : 'تحویل‌شده به اپراتور'}
                                                                                                className="hidden lg:inline-flex"
                                                                                        />
                                                                                        {handedOffCount > 0 && <span aria-hidden className="absolute end-2.5 top-2 h-2 w-2 rounded-full bg-[var(--text-primary)] ring-2 ring-white lg:hidden" />}
                                                                                </>
                                                                        )}
                                                                        {newModules.includes(key) && !active && (
                                                                                <span className="hidden rounded-full bg-black px-2 py-0.5 text-[12px] font-bold text-white lg:inline">{t('newLabel')}</span>
                                                                        )}
                                                                </Link>
                                                        )
                                                })}
                                        </div>
                                ))}
                        </nav>
                        {/* Who is signed in, and the one place to sign out of the rail. */}
                        <div className="mt-1 flex items-center justify-center gap-2.5 border-t border-[var(--border-default)] pt-2 lg:justify-start lg:ps-1">
                                <span aria-hidden className="hidden h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--signal-soft)] text-[13px] font-bold text-[var(--signal-strong)] lg:grid">
                                        {displayName.slice(0, 1)}
                                </span>
                                <div className="hidden min-w-0 flex-1 lg:block">
                                        <p className="truncate text-[13px] font-medium leading-5 text-[var(--text-primary)]">{displayName}</p>
                                        <p className="truncate text-[12px] leading-5 text-[var(--text-muted)]">{businessLabel}</p>
                                </div>
                                <form action={logout}>
                                        <button
                                                type="submit"
                                                aria-label={t('logout')}
                                                title={t('logout')}
                                                className="grid h-10 w-10 place-items-center rounded-control text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] lg:h-9 lg:w-9"
                                        >
                                                <LogOut className="h-[1.05rem] w-[1.05rem] rtl:rotate-180" />
                                        </button>
                                </form>
                        </div>
                </aside>
        )
}
