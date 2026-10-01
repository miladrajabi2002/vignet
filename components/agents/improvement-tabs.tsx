'use client'

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { BookOpen, GraduationCap, SlidersHorizontal } from 'lucide-react'
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
    const header = document.querySelector<HTMLElement>('[data-dashboard-header]')
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
        className="ui-seg ui-seg-solid sticky top-[var(--improvement-sticky-top,calc(env(safe-area-inset-top)+4rem))] z-20 grid-cols-3"
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
            className="ui-seg-tab min-h-[3.75rem] flex-col gap-1 px-1.5 py-1.5 text-[12px] sm:min-h-12 sm:flex-row sm:gap-2.5 sm:text-[13px]"
          >
            <span className="relative">
              <span className="ui-seg-icon h-7 w-7"><Icon className="h-3.5 w-3.5" aria-hidden="true" /></span>
              {key === 'learning' && (
                <NavigationCountBadge
                  count={pendingCount}
                  active={active === key}
                  locale={isFa ? 'fa-IR' : 'en-US'}
                  label={isFa ? 'موارد در انتظار' : 'Pending items'}
                  className="absolute -end-2.5 -top-2 h-[1.1rem] min-w-[1.1rem] text-[12px] ring-0 shadow-[0_0_0_2px_rgba(255,255,255,0.95)]"
                />
              )}
            </span>
            <span className="max-w-full truncate">{label}</span>
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
