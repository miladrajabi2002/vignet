'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  MessageSquare,
  Settings,
  Database,
  Share2,
  Package,
  BarChart3,
  GraduationCap,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

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
  const base = `/agents/${agentId}`

  return (
    <nav
      className="scrollbar-none flex gap-1.5 overflow-x-auto border-t border-black/[0.055] bg-black/[0.018] p-1.5 sm:p-2"
      aria-label="Agent sections"
    >
      {tabs.map(({ key, href, label, badge }) => {
        const Icon = ICONS[key] ?? MessageSquare
        const active = href === base ? pathname === base : pathname.startsWith(href)
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group relative inline-flex min-h-12 min-w-fit shrink-0 items-center justify-center gap-2.5 whitespace-nowrap rounded-[1.05rem] px-3.5 py-2.5 text-xs font-semibold transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 focus-visible:ring-offset-1 sm:min-w-[7rem] sm:flex-1',
              active
                ? 'bg-black text-white shadow-[0_14px_28px_-20px_rgba(0,0,0,0.95)]'
                : 'text-[var(--text-secondary)] hover:bg-black/[0.04] hover:text-[var(--text-primary)]',
            )}
          >
            <span
              className={cn(
                'grid h-8 w-8 shrink-0 place-items-center rounded-[0.7rem] border transition-colors duration-150',
                active
                  ? 'border-white/15 bg-white/10 text-white'
                  : 'border-black/[0.055] bg-white text-[var(--text-muted)] group-hover:text-[var(--text-primary)]',
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span>{label}</span>
            {typeof badge === 'number' && badge > 0 && (
              <span
                className={cn(
                  'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums',
                  active
                    ? 'bg-white text-black'
                    : 'bg-black/[0.06] text-[var(--text-secondary)]',
                )}
              >
                {badge.toLocaleString('fa-IR')}
              </span>
            )}
            {active && (
              <span className="sr-only">Current</span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
