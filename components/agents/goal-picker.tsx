'use client'

import { Check } from 'lucide-react'
import type { BusinessGoal } from '@/lib/ai/prompt-builder'
import { cn } from '@/lib/utils'

/** Multi-select of the jobs the agent should cover; at least one stays chosen. */
export function GoalPicker({
  id,
  goals,
  selected,
  onChange,
  fa,
  className,
}: {
  id: string
  goals: BusinessGoal[]
  selected: string[]
  onChange: (keys: string[]) => void
  fa: boolean
  className?: string
}) {
  function toggle(key: string) {
    const next = selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]
    if (next.length > 0) onChange(next)
  }

  return (
    <div className={className}>
      <span id={id} className="ui-field-label">{fa ? 'هدف ایجنت' : 'Agent goals'}</span>
      <div role="group" aria-labelledby={id} className="grid gap-2">
        {goals.map((goal) => {
          const active = selected.includes(goal.key)
          return (
            <button
              key={goal.key}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(goal.key)}
              className={cn(
                'flex min-h-11 w-full items-center gap-3 rounded-xl border px-3.5 py-2 text-start transition-[border-color,box-shadow] duration-150',
                active
                  ? 'border-[var(--text-primary)] shadow-[0_0_0_1px_var(--text-primary)]'
                  : 'border-[var(--border-default)] bg-white hover:border-black/25',
              )}
            >
              <span className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-md border', active ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white' : 'border-black/30 bg-white text-transparent')}>
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-bold text-[var(--text-primary)]">{fa ? goal.nameFa : goal.nameEn}</span>
                <span className="block text-[12px] leading-5 text-[var(--text-muted)]">{fa ? goal.descFa : goal.descEn}</span>
              </span>
            </button>
          )
        })}
      </div>
      <p className="ui-field-hint">
        {fa ? 'هر چند مورد که می‌خواهید؛ رفتار ایجنت روی همین‌ها تنظیم می‌شود و بعداً هم قابل تغییر است.' : 'Pick as many as you like; the agent is tuned for these and you can change it later.'}
      </p>
    </div>
  )
}
