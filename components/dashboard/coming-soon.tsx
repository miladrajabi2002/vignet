import { Construction } from 'lucide-react'

export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-light text-[var(--text-primary)]">{title}</h1>
      <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-16 text-center">
        <Construction className="h-8 w-8 text-[var(--text-muted)]" />
        <p className="mt-4 text-sm text-[var(--text-secondary)]">
          {title} — coming soon
        </p>
      </div>
    </div>
  )
}
