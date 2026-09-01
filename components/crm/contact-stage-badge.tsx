import { cn } from '@/lib/utils'

export const CONTACT_STAGES = ['lead', 'qualified', 'customer', 'lost'] as const
export type ContactStage = (typeof CONTACT_STAGES)[number]

const STAGE_TONE: Record<ContactStage, string> = {
  lead: 'border-sky-200 bg-sky-50 text-sky-700',
  qualified: 'border-amber-200 bg-amber-50 text-amber-800',
  customer: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  lost: 'border-rose-200 bg-rose-50 text-rose-700',
}

const DOT_TONE: Record<ContactStage, string> = {
  lead: 'bg-sky-500',
  qualified: 'bg-amber-500',
  customer: 'bg-emerald-500',
  lost: 'bg-rose-500',
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
        'inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-4',
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
