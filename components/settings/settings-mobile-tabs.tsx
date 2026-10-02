'use client'

import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { Bot, Building2, Mail, SlidersHorizontal, type LucideIcon } from 'lucide-react'

type SettingsTab = 'business' | 'capabilities' | 'operator' | 'reports'

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
  const barRef = useRef<HTMLDivElement>(null)
  // "Business" and "Capabilities" are two views of one panel (they share its
  // unsaved state), so the panel list has three entries and the nav has four.
  const tabs: Array<{ key: SettingsTab; icon: LucideIcon }> = [
    { key: 'business', icon: Building2 },
    { key: 'capabilities', icon: SlidersHorizontal },
    { key: 'operator', icon: Bot },
    { key: 'reports', icon: Mail },
  ]
  const panels: Array<{ key: Exclude<SettingsTab, 'capabilities'>; content: ReactNode }> = [
    { key: 'business', content: business },
    { key: 'operator', content: operator },
    { key: 'reports', content: reports },
  ]
  const activePanel = active === 'capabilities' ? 'business' : active

  // Deep links such as /settings#telegram-operator point at an element inside
  // one panel. On mobile only the active panel is visible, so open the panel
  // that holds the target first, then scroll to it once it is laid out.
  useEffect(() => {
    function openHashTarget() {
      const id = decodeURIComponent(window.location.hash.slice(1))
      if (!id) return
      const target = document.getElementById(id)
      const panel = target?.closest<HTMLElement>('[id^="settings-panel-"]')
      const panelKey = panel?.id.replace('settings-panel-', '') as SettingsTab | undefined
      if (!target || !panelKey) return
      const key: SettingsTab = panelKey === 'business' && target.closest('.settings-capabilities') ? 'capabilities' : panelKey
      setActive(key)
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          // Land below the sticky tab bar (mobile) or the shell header.
          const bar = barRef.current
          const offset = bar && bar.offsetParent ? parseFloat(getComputedStyle(bar).top) + bar.offsetHeight + 12 : 96
          window.scrollTo({ top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset) })
        })
      })
    }
    // Client navigations may commit the new URL a frame after mount.
    const frame = window.requestAnimationFrame(openHashTarget)
    window.addEventListener('hashchange', openHashTarget)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('hashchange', openHashTarget)
    }
  }, [])

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
    <div className="space-y-4 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start lg:gap-4 lg:space-y-0" data-view={active}>
      <div ref={barRef} className="sticky top-[5.25rem] z-30 -mx-1 lg:top-24 lg:mx-0">
        <div role="tablist" aria-label={navigationLabel} className="ui-seg ui-seg-solid improve-nav grid-cols-4">
          {tabs.map(({ key, icon: Icon }, index) => (
            <button
              key={key}
              ref={(node) => { tabRefs.current[index] = node }}
              type="button"
              role="tab"
              id={`settings-tab-${key}`}
              aria-selected={active === key}
              aria-controls={`settings-panel-${key === 'capabilities' ? 'business' : key}`}
              tabIndex={active === key ? 0 : -1}
              onClick={() => setActive(key)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              className="ui-seg-tab min-h-12 flex-col gap-1 px-1 text-[12px] lg:flex-row lg:text-[13px]"
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="max-w-full truncate">{labels[key]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="min-w-0">
        {panels.map(({ key, content }) => (
          <section
            key={key}
            id={`settings-panel-${key}`}
            role="tabpanel"
            aria-labelledby={`settings-tab-${active === 'capabilities' && key === 'business' ? 'capabilities' : key}`}
            hidden={activePanel !== key}
          >
            {content}
          </section>
        ))}
      </div>
    </div>
  )
}
