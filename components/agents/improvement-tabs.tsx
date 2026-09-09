'use client'

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { BookOpen, GraduationCap, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLearningCount } from '@/components/agents/learning-count'
import { NavigationCountBadge } from '@/components/ui/navigation-count-badge'

export type ImprovementTab = 'behavior' | 'knowledge' | 'learning'

export function ImprovementTabs({ agentId, initialActive, isFa, panels, learningCount }: {
  agentId: string
  initialActive: ImprovementTab
  isFa: boolean
  learningCount: number
  panels: Record<ImprovementTab, ReactNode>
}) {
  const [active, setActive] = useState(initialActive)
  const learning = useLearningCount()
  const pendingCount = learning?.count ?? learningCount
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  const container = useRef<HTMLDivElement>(null)
  const base = `/agents/${agentId}/improve`
  const tabs = [
    { key: 'behavior', label: isFa ? 'رفتار و لحن' : 'Behavior', icon: SlidersHorizontal },
    { key: 'knowledge', label: isFa ? 'دانش' : 'Knowledge', icon: BookOpen },
    { key: 'learning', label: isFa ? 'تحلیل و بهبود' : 'Analyze & improve', icon: GraduationCap },
  ] as const

  useEffect(() => setActive(initialActive), [initialActive])
  useEffect(() => {
    const header = document.querySelector<HTMLElement>('.dashboard-shell-header')
    if (!header) return
    const updateOffset = () => container.current?.style.setProperty('--improvement-sticky-top', `${header.offsetHeight + 8}px`)
    updateOffset()
    const observer = new ResizeObserver(updateOffset)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const restore = () => {
      const tab = new URLSearchParams(window.location.search).get('tab')
      setActive(tab === 'knowledge' || tab === 'learning' ? tab : 'behavior')
    }
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [])

  function select(tab: ImprovementTab) {
    if (tab === active) return
    setActive(tab)
    // Native history integrates with Next's router without fetching a new page.
    // Keeping the panels mounted also preserves unfinished edits between tabs.
    const url = new URL(window.location.href)
    url.searchParams.delete('view')
    url.searchParams.delete('page')
    if (tab === 'behavior') url.searchParams.delete('tab')
    else url.searchParams.set('tab', tab)
    window.history.pushState(null, '', `${base}${url.search}`)
  }

  function followSectionLink(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const link = event.target instanceof Element ? event.target.closest('a') : null
    if (!link || link.target === '_blank') return
    const url = new URL(link.href, window.location.href)
    if (url.origin !== window.location.origin || url.pathname !== base) return
    if (url.searchParams.has('view') || url.searchParams.has('page')) {
      // History and pagination need fresh server data; the three main tabs do not.
      event.preventDefault()
      window.location.assign(url.href)
      return
    }
    const tab = url.searchParams.get('tab')
    if (tab && tab !== 'knowledge' && tab !== 'learning') return
    event.preventDefault()
    select(tab === 'knowledge' || tab === 'learning' ? tab : 'behavior')
  }

  return (
    <div ref={container} className="min-w-0 space-y-4" onClickCapture={followSectionLink}>
      <div
        role="tablist"
        aria-label={isFa ? 'بخش‌های بهبود ایجنت' : 'Agent improvement sections'}
        className="sticky top-[var(--improvement-sticky-top,calc(max(0.75rem,env(safe-area-inset-top))+5rem))] z-20 grid grid-cols-3 gap-1 rounded-[1.25rem] border border-black/[0.07] bg-white/95 p-1.5 shadow-[var(--shadow-xs)] backdrop-blur-xl"
      >
        {tabs.map(({ key, label, icon: Icon }, index) => (
          <button
            key={key}
            ref={(node) => { buttons.current[index] = node }}
            type="button"
            role="tab"
            id={`improve-tab-${key}`}
            aria-controls={`improve-panel-${key}`}
            aria-selected={active === key}
            tabIndex={active === key ? 0 : -1}
            onClick={() => select(key)}
            onKeyDown={(event) => {
              let next: number | undefined
              if (event.key === 'Home') next = 0
              if (event.key === 'End') next = tabs.length - 1
              if (event.key === 'ArrowRight') next = (index + (isFa ? -1 : 1) + tabs.length) % tabs.length
              if (event.key === 'ArrowLeft') next = (index + (isFa ? 1 : -1) + tabs.length) % tabs.length
              if (next === undefined) return
              event.preventDefault()
              select(tabs[next].key)
              buttons.current[next]?.focus()
            }}
            className={cn(
              'flex min-h-14 min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-2 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 motion-reduce:transition-none sm:min-h-12 sm:flex-row sm:gap-2',
              active === key ? 'bg-black text-white shadow-[var(--shadow-control)]' : 'text-[var(--text-secondary)] hover:bg-black/[0.04]',
            )}
          >
            <span className="relative inline-flex items-center gap-1.5">
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {key === 'learning' && (
                <NavigationCountBadge
                  count={pendingCount}
                  active={active === key}
                  locale={isFa ? 'fa-IR' : 'en-US'}
                  label={isFa ? 'موارد در انتظار' : 'Pending items'}
                  className="text-[10px]"
                />
              )}
            </span>
            <span>{label}</span>
          </button>
        ))}
      </div>
      {tabs.map(({ key }) => (
        <div key={key} id={`improve-panel-${key}`} role="tabpanel" aria-labelledby={`improve-tab-${key}`} hidden={active !== key}>
          {panels[key]}
        </div>
      ))}
    </div>
  )
}
