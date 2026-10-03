import { cn } from '@/lib/utils'

export const CONTACT_STAGES = ['lead', 'qualified', 'customer', 'lost'] as const
export type ContactStage = (typeof CONTACT_STAGES)[number]

const STAGE_TONE: Record<ContactStage, string> = {
  lead: 'border-black/10 bg-black/[0.04] text-[var(--text-secondary)]',
  qualified: 'border-[color:color-mix(in_srgb,var(--signal)_20%,transparent)] bg-[var(--signal-soft)] text-[var(--signal-strong)]',
  customer: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  lost: 'border-black/10 bg-black/[0.04] text-[var(--text-muted)]',
}

const DOT_TONE: Record<ContactStage, string> = {
  lead: 'bg-black/35',
  qualified: 'bg-[var(--signal)]',
  customer: 'bg-emerald-500',
  lost: 'bg-black/20',
}

export function asContactStage(stage: string): ContactStage {
  return CONTACT_STAGES.includes(stage as ContactStage)
    ? (stage as ContactStage)
    : 'lead'
}

export function ContactStageBadge({
  stage,
  label,
  className,
}: {
  stage: string
  label: string
  className?: string
}) {
  const normalized = asContactStage(stage)
  return (
    <span
      className={cn(
        'inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold leading-4',
        STAGE_TONE[normalized],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT_TONE[normalized])}
      />
      {label}
    </span>
  )
}
