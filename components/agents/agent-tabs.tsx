'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from 'next-intl'
import {
  MessageSquare,
  Settings,
  Database,
  Share2,
  Package,
  BarChart3,
  GraduationCap,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'

const ICONS: Record<string, LucideIcon> = {
  overview: MessageSquare,
  settings: Settings,
  knowledge: Database,
  catalog: Package,
  channels: Share2,
  learning: GraduationCap,
  analytics: BarChart3,
}

export interface AgentTabItem {
  key: string
  href: string
  label: string
  badge?: number
}

export function AgentTabs({ agentId, tabs }: { agentId: string; tabs: AgentTabItem[] }) {
  const pathname = usePathname()
  const locale = useLocale()
  const base = `/agents/${agentId}`
  const [moreOpen, setMoreOpen] = useState(false)
  const moreTriggerRef = useRef<HTMLButtonElement>(null)

  const activeTab = tabs.find(({ href }) => href === base ? pathname === base : pathname.startsWith(href))
  const mobileTabs = useMemo(() => {
    const preferred = ['overview', 'knowledge', 'channels']
      .map((key) => tabs.find((tab) => tab.key === key))
      .filter((tab): tab is AgentTabItem => Boolean(tab))
    if (activeTab && !preferred.some((tab) => tab.key === activeTab.key)) {
      return [...preferred.slice(0, 2), activeTab]
    }
    return preferred.slice(0, 3)
  }, [activeTab, tabs])

  useEffect(() => setMoreOpen(false), [pathname])

  function renderTab({ key, href, label, badge }: AgentTabItem, compact = false) {
    const Icon = ICONS[key] ?? MessageSquare
    const active = href === base ? pathname === base : pathname.startsWith(href)
    return (
      <Link
        key={key}
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'group relative inline-flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-[1.05rem] px-3 py-2.5 text-xs font-semibold transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 focus-visible:ring-offset-1',
          compact ? 'flex-col gap-1 px-1 py-1 text-[10px]' : 'min-w-fit shrink-0 whitespace-nowrap sm:min-w-[7rem] sm:flex-1',
          active
            ? 'bg-black text-white shadow-[0_14px_28px_-20px_rgba(0,0,0,0.95)]'
            : 'text-[var(--text-secondary)] hover:bg-black/[0.04] hover:text-[var(--text-primary)]',
        )}
      >
        <span className={cn(
          'grid shrink-0 place-items-center rounded-[0.7rem] border transition-colors duration-150',
          compact ? 'h-7 w-7' : 'h-8 w-8',
          active
            ? 'border-white/15 bg-white/10 text-white'
            : 'border-black/[0.055] bg-white text-[var(--text-muted)] group-hover:text-[var(--text-primary)]',
        )}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="max-w-full truncate">{label}</span>
        {typeof badge === 'number' && badge > 0 && (
          <span className={cn(
            'absolute -end-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums',
            active ? 'bg-white text-black' : 'bg-black text-white',
          )}>
            {badge.toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')}
          </span>
        )}
      </Link>
    )
  }

  return (
    <>
      <nav className="sticky top-[5.25rem] z-30 grid grid-cols-4 gap-1 border-t border-black/[0.055] bg-white/95 p-1.5 backdrop-blur-xl md:hidden" aria-label={locale === 'fa' ? 'بخش‌های ایجنت' : 'Agent sections'}>
        {mobileTabs.map((tab) => renderTab(tab, true))}
        <button
          ref={moreTriggerRef}
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-expanded={moreOpen}
          className="inline-flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-[1.05rem] px-1 py-1 text-[10px] font-semibold text-[var(--text-secondary)] hover:bg-black/[0.04]"
        >
          <span className="grid h-7 w-7 place-items-center rounded-[0.7rem] border border-black/[0.055] bg-white text-[var(--text-muted)]">
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </span>
          <span>{locale === 'fa' ? 'بیشتر' : 'More'}</span>
        </button>
      </nav>

      <nav className="scrollbar-none hidden gap-1.5 overflow-x-auto border-t border-black/[0.055] bg-black/[0.018] p-2 md:flex" aria-label={locale === 'fa' ? 'بخش‌های ایجنت' : 'Agent sections'}>
        {tabs.map((tab) => renderTab(tab))}
      </nav>

      <MobileBottomSheet
        open={moreOpen}
        title={locale === 'fa' ? 'همه بخش‌های ایجنت' : 'All agent sections'}
        description={locale === 'fa' ? 'بخش موردنظر را انتخاب کنید.' : 'Choose the section you need.'}
        closeLabel={locale === 'fa' ? 'بستن' : 'Close'}
        triggerRef={moreTriggerRef}
        onClose={() => setMoreOpen(false)}
      >
        <nav className="grid grid-cols-2 gap-2" aria-label={locale === 'fa' ? 'همه بخش‌های ایجنت' : 'All agent sections'}>
          {tabs.map((tab) => renderTab(tab))}
        </nav>
      </MobileBottomSheet>
    </>
  )
}
