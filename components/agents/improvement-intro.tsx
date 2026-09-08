import type { ReactNode } from 'react'
import { BookOpen, GraduationCap, SlidersHorizontal } from 'lucide-react'

const icons = { behavior: SlidersHorizontal, knowledge: BookOpen, learning: GraduationCap }

export function ImprovementIntro({ section, title, description, children }: {
  section: keyof typeof icons
  title: string
  description: string
  children?: ReactNode
}) {
  const Icon = icons[section]
  return (
    <section className="spatial-surface min-w-0 space-y-4 rounded-[1.5rem] p-4 sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-bold text-[var(--text-primary)]">
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />{title}
      </h2>
      <p className="max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">{description}</p>
      {children}
    </section>
  )
}
