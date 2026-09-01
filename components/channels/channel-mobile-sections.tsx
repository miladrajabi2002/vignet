'use client'

import { type ReactNode, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ChannelMobileSection {
  key: string
  label: string
  hint?: string
  content: ReactNode
}

export function ChannelMobileSections({
  sections,
  navigationLabel,
}: {
  sections: ChannelMobileSection[]
  navigationLabel: string
}) {
  const [openKey, setOpenKey] = useState(sections[0]?.key ?? '')

  return (
    <>
      <div className="space-y-2 md:hidden" aria-label={navigationLabel}>
        {sections.map((section) => {
          const open = openKey === section.key
          const panelId = `channel-panel-${section.key.toLowerCase()}`
          return (
            <section key={section.key} className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenKey(open ? '' : section.key)}
                className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-start"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-[var(--text-primary)]">{section.label}</span>
                  {section.hint && <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">{section.hint}</span>}
                </span>
                <ChevronDown className={cn('h-5 w-5 shrink-0 text-[var(--text-muted)] transition-transform motion-reduce:transition-none', open && 'rotate-180')} aria-hidden="true" />
              </button>
              {open && (
                <div id={panelId} className="border-t border-[var(--border-subtle)] bg-[var(--bg-base)] p-2">
                  {section.content}
                </div>
              )}
            </section>
          )
        })}
      </div>

      <div className="hidden space-y-6 md:block">
        {sections.map((section) => <div key={section.key}>{section.content}</div>)}
      </div>
    </>
  )
}
