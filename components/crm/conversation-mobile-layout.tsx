'use client'

import { type ReactNode, useId, useState } from 'react'
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

    setTab(tabs[nextIndex].key)
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    buttons?.[nextIndex]?.focus()
  }

  return (
    <>
      <div
        role="tablist"
        aria-orientation="horizontal"
        aria-label={locale === 'fa' ? 'بخش‌های گفتگو' : 'Conversation sections'}
        className="sticky top-[5.35rem] z-20 grid grid-cols-2 gap-1 rounded-2xl border border-[var(--border-default)] bg-white/95 p-1 shadow-[0_12px_34px_rgba(0,0,0,0.08)] backdrop-blur-xl lg:hidden"
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
            onClick={() => setTab(key)}
            onKeyDown={(event) => moveTab(event, index)}
            className={cn(
              'spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60',
              tab === key
                ? 'bg-black text-white shadow-[var(--shadow-control)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <div className="grid min-h-[calc(100dvh-11rem)] gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <section
          id={`${id}-thread-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-thread-tab`}
          className={cn('min-w-0', tab === 'thread' ? 'block' : 'hidden lg:block')}
        >
          {thread}
        </section>
        <aside
          id={`${id}-details-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-details-tab`}
          className={cn('space-y-3', tab === 'details' ? 'block' : 'hidden lg:block')}
        >
          {details}
        </aside>
      </div>
    </>
  )
}
