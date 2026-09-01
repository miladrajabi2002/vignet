'use client'

import { type KeyboardEvent, type ReactNode, useRef, useState } from 'react'
import { Building2, Headphones, Mail, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type SettingsTab = 'business' | 'operator' | 'reports'

export function SettingsMobileTabs({
  business,
  operator,
  reports,
  labels,
  navigationLabel,
}: {
  business: ReactNode
  operator: ReactNode
  reports: ReactNode
  labels: Record<SettingsTab, string>
  navigationLabel: string
}) {
  const [active, setActive] = useState<SettingsTab>('business')
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const tabs: Array<{ key: SettingsTab; icon: LucideIcon; content: ReactNode }> = [
    { key: 'business', icon: Building2, content: business },
    { key: 'operator', icon: Headphones, content: operator },
    { key: 'reports', icon: Mail, content: reports },
  ]

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    else return
    event.preventDefault()
    const nextTab = tabs[next]
    setActive(nextTab.key)
    tabRefs.current[next]?.focus()
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-[5.25rem] z-30 -mx-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/95 p-1.5 shadow-sm backdrop-blur-xl md:hidden">
        <div role="tablist" aria-label={navigationLabel} className="grid grid-cols-3 gap-1">
          {tabs.map(({ key, icon: Icon }, index) => (
            <button
              key={key}
              ref={(node) => { tabRefs.current[index] = node }}
              type="button"
              role="tab"
              id={`settings-tab-${key}`}
              aria-selected={active === key}
              aria-controls={`settings-panel-${key}`}
              tabIndex={active === key ? 0 : -1}
              onClick={() => setActive(key)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              className={cn(
                'inline-flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition-colors',
                active === key
                  ? 'bg-[var(--text-primary)] text-[var(--bg-base)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="max-w-full truncate">{labels[key]}</span>
            </button>
          ))}
        </div>
      </div>

      {tabs.map(({ key, content }) => (
        <section
          key={key}
          id={`settings-panel-${key}`}
          role="tabpanel"
          aria-labelledby={`settings-tab-${key}`}
          className={cn(active === key ? 'block' : 'hidden', 'md:block')}
        >
          {content}
        </section>
      ))}
    </div>
  )
}
