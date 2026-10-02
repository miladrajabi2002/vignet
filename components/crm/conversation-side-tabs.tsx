'use client'

import { type KeyboardEvent, type ReactNode, useId, useState } from 'react'
import { cn } from '@/lib/utils'

type SideTab = 'summary' | 'customer' | 'sales'

/**
 * The conversation's side column as three tabs. One question per tab: what is
 * going on, who is this, how likely is a sale.
 */
export function ConversationSideTabs({
  locale,
  summary,
  customer,
  sales,
  attention = false,
}: {
  locale: 'fa' | 'en'
  summary: ReactNode
  customer: ReactNode
  sales: ReactNode
  /** Marks the summary tab while the conversation waits for a person. */
  attention?: boolean
}) {
  const id = useId()
  const fa = locale === 'fa'
  const [active, setActive] = useState<SideTab>('summary')
  const tabs: Array<{ key: SideTab; label: string; content: ReactNode }> = [
    { key: 'summary', label: fa ? 'خلاصه' : 'Summary', content: summary },
    { key: 'customer', label: fa ? 'مشتری' : 'Customer', content: customer },
    { key: 'sales', label: fa ? 'فروش' : 'Sales', content: sales },
  ]

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    let next = index
    if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    else {
      const visual = event.key === 'ArrowRight' ? 1 : -1
      next = (index + (fa ? -visual : visual) + tabs.length) % tabs.length
    }
    setActive(tabs[next].key)
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }

  return (
    <div className="flex min-h-0 flex-col">
      <div
        role="tablist"
        aria-label={fa ? 'جزئیات گفتگو' : 'Conversation details'}
        className="flex shrink-0 gap-1 border-b border-[var(--border-subtle)] bg-white px-2"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`${id}-${tab.key}-tab`}
            aria-controls={`${id}-${tab.key}-panel`}
            aria-selected={active === tab.key}
            tabIndex={active === tab.key ? 0 : -1}
            onClick={() => setActive(tab.key)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              '-mb-px inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 border-b-2 px-2 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]',
              active === tab.key
                ? 'border-[var(--text-primary)] font-bold text-[var(--text-primary)]'
                : 'border-transparent font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]',
            )}
          >
            {tab.label}
            {tab.key === 'summary' && attention && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.key}
          role="tabpanel"
          id={`${id}-${tab.key}-panel`}
          aria-labelledby={`${id}-${tab.key}-tab`}
          hidden={active !== tab.key}
          className="space-y-3 p-3"
        >
          {tab.content}
        </div>
      ))}
    </div>
  )
}
