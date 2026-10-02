'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from 'next-intl'
import {
  MessageSquare,
  Settings,
  SlidersHorizontal,
  Database,
  Share2,
  Package,
  BarChart3,
  GraduationCap,
  MoreHorizontal,
  Check,
  ChevronLeft,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'
import { NavigationCountBadge } from '@/components/ui/navigation-count-badge'
import { useLearningCount } from '@/components/agents/learning-count'

const ICONS: Record<string, LucideIcon> = {
  overview: MessageSquare,
  settings: Settings,
  improve: SlidersHorizontal,
  knowledge: Database,
  catalog: Package,
  channels: Share2,
  learning: GraduationCap,
  analytics: BarChart3,
}

const DESCRIPTIONS: Record<string, { fa: string; en: string }> = {
  overview: { fa: 'گفتگوی آزمایشی و خلاصهٔ وضعیت', en: 'Test chat and status at a glance' },
  improve: { fa: 'رفتار و لحن، دانش و یادگیری از گفتگوها', en: 'Behavior, knowledge and learning' },
  settings: { fa: 'مدل، انتقال به اپراتور و قابلیت‌ها', en: 'Model, handoff and capabilities' },
  channels: { fa: 'اینستاگرام، تلگرام، سایت و کانال‌های دیگر', en: 'Instagram, Telegram, website and more' },
  analytics: { fa: 'عملکرد، پاسخ‌ها و روند گفتگوها', en: 'Performance and conversation trends' },
  knowledge: { fa: 'منابع و اطلاعاتی که ایجنت از آن جواب می‌دهد', en: 'Sources the agent answers from' },
  catalog: { fa: 'محصولاتی که ایجنت معرفی می‌کند', en: 'Products the agent can offer' },
  learning: { fa: 'پیشنهادهای بهبود از گفتگوها', en: 'Improvement suggestions' },
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
  const learning = useLearningCount()
  const base = `/agents/${agentId}`
  const [moreOpen, setMoreOpen] = useState(false)
  const moreTriggerRef = useRef<HTMLButtonElement>(null)

  const activeTab = tabs.find(({ href }) => href === base ? pathname === base : pathname.startsWith(href))
  const mobileTabs = useMemo(() => {
    const preferred = ['overview', 'improve', 'settings']
      .map((key) => tabs.find((tab) => tab.key === key))
      .filter((tab): tab is AgentTabItem => Boolean(tab))
    if (activeTab && !preferred.some((tab) => tab.key === activeTab.key)) {
      return [...preferred.slice(0, 2), activeTab]
    }
    return preferred.slice(0, 3)
  }, [activeTab, tabs])

  useEffect(() => setMoreOpen(false), [pathname])

  function renderTab({ key, href, label, badge }: AgentTabItem, compact = false) {
    if (key === 'improve' && learning) badge = learning.count
    const Icon = ICONS[key] ?? MessageSquare
    const active = href === base ? pathname === base : pathname.startsWith(href)
    return (
      <Link
        key={key}
        href={href}
        aria-current={active ? 'page' : undefined}
        // Page-level navigation: the current section is ink text on an ink
        // underline. The filled pill is reserved for view switches (.ui-seg).
        className={cn(
          'group relative inline-flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-chip text-[13px] transition-colors duration-150 after:pointer-events-none after:absolute after:bottom-0 after:h-0.5 after:rounded-full after:bg-[var(--text-primary)] after:opacity-0 after:transition-opacity after:duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1',
          compact ? 'flex-col gap-1 px-1 py-1.5 text-[12px] after:inset-x-3' : 'shrink-0 whitespace-nowrap px-3.5 after:inset-x-2.5',
          active
            ? 'font-bold text-[var(--text-primary)] after:opacity-100'
            : 'font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
        )}
      >
        <Icon
          className={cn('h-[1.05rem] w-[1.05rem] shrink-0 transition-colors duration-150', active ? 'text-[var(--text-primary)]' : 'text-[var(--text-hint)] group-hover:text-[var(--text-muted)]')}
          strokeWidth={active ? 2.2 : 1.9}
          aria-hidden="true"
        />
        <span className="flex max-w-full min-w-0 items-center justify-center gap-1.5">
          <span className="min-w-0 truncate">{label}</span>
          {typeof badge === 'number' && (
            <NavigationCountBadge
              count={badge}
              active={active}
              locale={locale === 'fa' ? 'fa-IR' : 'en-US'}
              label={locale === 'fa' ? 'موارد در انتظار' : 'Pending items'}
            />
          )}
        </span>
      </Link>
    )
  }

  function renderSheetRow({ key, href, label, badge }: AgentTabItem) {
    if (key === 'improve' && learning) badge = learning.count
    const Icon = ICONS[key] ?? MessageSquare
    const active = href === base ? pathname === base : pathname.startsWith(href)
    const description = DESCRIPTIONS[key]
    return (
      <li key={key}>
        <Link
          href={href}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'flex min-h-[4.25rem] items-center gap-3 px-3.5 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]',
            active ? 'bg-[var(--bg-surface)]' : 'active:bg-[var(--bg-hover)]',
          )}
        >
          <span
            className={cn(
              'grid h-10 w-10 shrink-0 place-items-center rounded-xl border',
              active
                ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white shadow-[var(--shadow-control)]'
                : 'border-black/[0.06] bg-[var(--bg-surface)] text-[var(--text-secondary)]',
            )}
          >
            <Icon className="h-[1.1rem] w-[1.1rem]" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-[15px] font-bold text-[var(--text-primary)]">{label}</span>
              {typeof badge === 'number' && (
                <NavigationCountBadge
                  count={badge}
                  locale={locale === 'fa' ? 'fa-IR' : 'en-US'}
                  label={locale === 'fa' ? 'موارد در انتظار' : 'Pending items'}
                />
              )}
            </span>
            {description && (
              <span className="mt-0.5 block truncate text-[12px] text-[var(--text-muted)]">
                {locale === 'fa' ? description.fa : description.en}
              </span>
            )}
          </span>
          {active ? (
            <Check className="h-4 w-4 shrink-0 text-[var(--text-primary)]" strokeWidth={2.75} aria-hidden="true" />
          ) : (
            <ChevronLeft className="h-4 w-4 shrink-0 text-[var(--text-hint)] ltr:rotate-180" aria-hidden="true" />
          )}
        </Link>
      </li>
    )
  }

  return (
    <>
      <nav className="grid grid-cols-4 gap-1 border-t border-black/[0.055] bg-white/95 px-1.5 backdrop-blur-xl md:hidden" aria-label={locale === 'fa' ? 'بخش‌های ایجنت' : 'Agent sections'}>
        {mobileTabs.map((tab) => renderTab(tab, true))}
        <button
          ref={moreTriggerRef}
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-expanded={moreOpen}
          className="inline-flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-chip px-1 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <MoreHorizontal className="h-[1.05rem] w-[1.05rem] text-[var(--text-hint)]" aria-hidden="true" />
          <span>{locale === 'fa' ? 'بیشتر' : 'More'}</span>
        </button>
      </nav>

      <nav className="scrollbar-none hidden gap-1 overflow-x-auto border-t border-black/[0.055] px-2.5 md:flex" aria-label={locale === 'fa' ? 'بخش‌های ایجنت' : 'Agent sections'}>
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
        <nav aria-label={locale === 'fa' ? 'همه بخش‌های ایجنت' : 'All agent sections'}>
          <ul className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-card border border-[var(--border-subtle)] bg-white">
            {tabs.map((tab) => renderSheetRow(tab))}
          </ul>
        </nav>
      </MobileBottomSheet>
    </>
  )
}
