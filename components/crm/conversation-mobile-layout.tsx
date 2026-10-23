'use client'

import { type ReactNode, useId, useLayoutEffect, useRef, useState } from 'react'
import { MessageSquareText, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

type MobileConversationTab = 'thread' | 'details'

export function ConversationMobileLayout({
  locale,
  thread,
  details,
}: {
  locale: 'fa' | 'en'
  thread: ReactNode
  details: ReactNode
}) {
  const id = useId()
  const [tab, setTab] = useState<MobileConversationTab>('thread')
  const barRef = useRef<HTMLDivElement>(null)
  const panelsRef = useRef<HTMLDivElement>(null)
  // On a phone the page itself scrolls, so each tab keeps its own place:
  // back on the thread lands where the operator left it, and the details
  // open at their top instead of wherever the long thread had scrolled to.
  const scrollByTab = useRef<Partial<Record<MobileConversationTab, number>>>({})
  const switched = useRef(false)

  function selectTab(next: MobileConversationTab) {
    if (next === tab) return
    scrollByTab.current[tab] = window.scrollY
    switched.current = true
    setTab(next)
  }

  useLayoutEffect(() => {
    if (!switched.current) return
    switched.current = false
    const bar = barRef.current
    const panels = panelsRef.current
    if (!bar || !panels || getComputedStyle(bar).display === 'none') return
    const saved = scrollByTab.current[tab]
    if (saved !== undefined) {
      window.scrollTo({ top: saved, behavior: 'auto' })
      return
    }
    // First visit: start the panel right under the docked bar, but never
    // scroll down past where the operator already is.
    const panelsTop = panels.getBoundingClientRect().top + window.scrollY - bar.offsetHeight - parseFloat(getComputedStyle(bar).top) - 12
    if (window.scrollY > panelsTop) window.scrollTo({ top: Math.max(0, panelsTop), behavior: 'auto' })
  }, [tab])
  const tabs: Array<{
    key: MobileConversationTab
    label: string
    icon: typeof MessageSquareText
  }> = [
    {
      key: 'thread',
      label: locale === 'fa' ? 'گفتگو' : 'Conversation',
      icon: MessageSquareText,
    },
    {
      key: 'details',
      label: locale === 'fa' ? 'جزئیات و وضعیت' : 'Details & status',
      icon: SlidersHorizontal,
    },
  ]

  function moveTab(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()

    let nextIndex = index
    if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = tabs.length - 1
    else {
      const visualDirection = event.key === 'ArrowRight' ? 1 : -1
      const direction = locale === 'fa' ? -visualDirection : visualDirection
      nextIndex = (index + direction + tabs.length) % tabs.length
    }

    selectTab(tabs[nextIndex].key)
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    buttons?.[nextIndex]?.focus()
  }

  return (
    <>
      {/* The strip under the bar is painted in the page colour, so messages
          scrolling past never show through the gap below the app header. */}
      <div
        ref={barRef}
        role="tablist"
        aria-orientation="horizontal"
        aria-label={locale === 'fa' ? 'بخش‌های گفتگو' : 'Conversation sections'}
        className="ui-seg ui-seg-solid sticky top-[5.35rem] z-20 grid-cols-2 before:pointer-events-none before:absolute before:inset-x-[-0.75rem] before:-top-3 before:bottom-full before:-z-10 before:bg-[var(--bg-base)] lg:hidden"
      >
        {tabs.map(({ key, label, icon: Icon }, index) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`${id}-${key}-tab`}
            aria-controls={`${id}-${key}-panel`}
            aria-selected={tab === key}
            tabIndex={tab === key ? 0 : -1}
            onClick={() => selectTab(key)}
            onKeyDown={(event) => moveTab(event, index)}
            className="ui-seg-tab px-3 text-xs"
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {/* Phones and tablets: one column and the page scrolls. Desktop: the
          grid fills what is left of the screen, the thread scrolls inside its
          own card with the reply box always in view, the details beside it. */}
      <div ref={panelsRef} className="grid min-h-[calc(100dvh-11rem)] gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <section
          id={`${id}-thread-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-thread-tab`}
          className={cn('min-w-0 lg:flex lg:min-h-0 lg:flex-col', tab === 'thread' ? 'flex flex-col' : 'hidden')}
        >
          {thread}
        </section>
        <aside
          id={`${id}-details-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-details-tab`}
          className={cn('space-y-3 lg:block lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:rounded-card lg:[scrollbar-width:thin]', tab === 'details' ? 'block' : 'hidden')}
        >
          {details}
        </aside>
      </div>
    </>
  )
}
