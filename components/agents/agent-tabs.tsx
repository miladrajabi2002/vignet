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
  Camera,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const ICONS: Record<string, LucideIcon> = {
  overview: MessageSquare,
  settings: Settings,
  knowledge: Database,
  catalog: Package,
  channels: Share2,
  instagram: Camera,
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
      className="spatial-control scrollbar-none sticky top-[4.65rem] z-20 -mx-1 flex gap-1 overflow-x-auto rounded-[1.25rem] p-1.5 shadow-[var(--shadow-sm)]"
      aria-label="Agent sections"
    >
      {tabs.map(({ key, href, label, badge }) => {
        const Icon = ICONS[key] ?? MessageSquare
        const active = href === base ? pathname === base : pathname.startsWith(href)
        return (
          <Link
            key={key}
            href={href}
            className={cn(
              'relative inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-medium transition-[background-color,color,transform] active:scale-[0.98]',
              active
                ? 'bg-black text-white shadow-[var(--shadow-control)]'
                : 'text-[var(--text-secondary)] hover:bg-black/[0.04] hover:text-[var(--text-primary)]',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {typeof badge === 'number' && badge > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--bg-muted)] px-1.5 text-[11px] text-[var(--text-secondary)]">
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
