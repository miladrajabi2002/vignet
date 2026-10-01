import type { ReactNode } from 'react'
import { BookOpen, GraduationCap, SlidersHorizontal } from 'lucide-react'

const icons = { behavior: SlidersHorizontal, knowledge: BookOpen, learning: GraduationCap }

/**
 * Section intro for the improve tabs. `visual` is an optional explainer
 * (components/motion) that sits beside the text on wide screens and below
 * it on phones, so the "how it works" is seen without extra reading.
 */
export function ImprovementIntro({ section, title, description, visual, children }: {
  section: keyof typeof icons
  title: string
  description: string
  visual?: ReactNode
  children?: ReactNode
}) {
  const Icon = icons[section]
  return (
    <section className="spatial-surface min-w-0 space-y-4 rounded-card p-4 sm:p-6">
      <div className={visual ? 'grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] xl:items-center xl:gap-6' : undefined}>
        <div className="min-w-0 space-y-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-[var(--text-primary)]">
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />{title}
          </h2>
          <p className="max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">{description}</p>
        </div>
        {visual}
      </div>
      {children}
    </section>
  )
}
