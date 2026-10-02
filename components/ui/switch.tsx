'use client'

import { useState, type ComponentType, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { useLocale } from 'next-intl'
import { cn } from '@/lib/utils'

/**
 * The one toggle switch of the app. Ink track + white knob when on, muted
 * track when off, an optional spinner inside the knob while a save is in
 * flight, and a 44px hit area around the visual track.
 */
export function Switch({
        checked,
        onChange,
        disabled,
        pending,
        className,
        title,
        'aria-label': ariaLabel,
}: {
        checked: boolean
        onChange: (v: boolean) => void
        disabled?: boolean
        /** Shows a spinner in the knob while the new value is being saved. */
        pending?: boolean
        className?: string
        title?: string
        'aria-label'?: string
}) {
        return (
                <button
                        type="button"
                        dir="ltr"
                        role="switch"
                        aria-checked={checked}
                        aria-label={ariaLabel}
                        aria-busy={pending || undefined}
                        title={title}
                        disabled={disabled}
                        onClick={() => onChange(!checked)}
                        className={cn(
                                'relative -m-2.5 inline-flex h-11 w-[3.75rem] shrink-0 items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
                                className,
                        )}
                >
                        <SwitchTrack checked={checked} pending={pending} />
                </button>
        )
}

/**
 * The visual track + knob alone, for rows where the whole row is the switch
 * (the row carries role="switch"; this stays decorative).
 */
export function SwitchTrack({ checked, pending }: { checked: boolean; pending?: boolean }) {
        return (
                <span
                        dir="ltr"
                        aria-hidden="true"
                        className={cn(
                                'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border p-0.5 transition-colors',
                                checked
                                        ? 'border-[var(--text-primary)] bg-[var(--text-primary)]'
                                        : 'border-[var(--border-default)] bg-[var(--bg-muted)]',
                        )}
                >
                        <span
                                className={cn(
                                        'grid h-[18px] w-[18px] place-items-center rounded-full bg-[var(--bg-base)] text-[var(--text-primary)] shadow-sm transition-transform duration-200 motion-reduce:transition-none',
                                        checked ? 'translate-x-4' : 'translate-x-0',
                                )}
                        >
                                {pending && <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" />}
                        </span>
                </span>
        )
}

/**
 * One setting as a list row: title (with an optional count badge), a short
 * description that expands on demand, and the Switch. The switch itself is
 * the on/off status, so no separate "enabled / disabled" text is drawn.
 * Stack several inside `.ui-switch-list` to get the hairline dividers.
 */
export function SwitchCard({
        icon: Icon,
        title,
        description,
        badge,
        checked,
        onChange,
        pending,
        disabled,
        lockedReason,
        enabledLabel,
        disabledLabel,
        children,
}: {
        icon: ComponentType<{ className?: string }>
        title: string
        description: ReactNode
        badge?: string
        checked: boolean
        onChange: (v: boolean) => void
        pending?: boolean
        disabled?: boolean
        /** Why the switch cannot be changed right now; shown under the description. */
        lockedReason?: string
        enabledLabel: string
        disabledLabel: string
        children?: ReactNode
}) {
        const [expanded, setExpanded] = useState(false)
        const fa = useLocale() !== 'en'
        const long = typeof description === 'string' && description.length > 90
        return (
                <div className="flex items-start gap-3 px-3.5 py-3">
                        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--bg-muted)] text-[var(--text-primary)]">
                                <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                                <h3 className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] font-bold leading-6 text-[var(--text-primary)]">
                                        {title}
                                        {badge && (
                                                <span className="inline-flex rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[12px] font-normal leading-5 text-[var(--text-muted)]">
                                                        {badge}
                                                </span>
                                        )}
                                </h3>
                                <p className={cn('text-[12px] leading-6 text-[var(--text-secondary)]', long && !expanded && 'line-clamp-1')}>
                                        {description}
                                </p>
                                {long && (
                                        <button
                                                type="button"
                                                onClick={() => setExpanded((value) => !value)}
                                                aria-expanded={expanded}
                                                className="text-[12px] font-medium text-[var(--text-muted)] underline decoration-dotted underline-offset-4 hover:text-[var(--text-primary)]"
                                        >
                                                {expanded ? (fa ? 'کمتر' : 'Less') : (fa ? 'بیشتر' : 'More')}
                                                <span className="sr-only"> — {title}</span>
                                        </button>
                                )}
                                {lockedReason && (
                                        <p className="mt-1.5 rounded-xl bg-[var(--bg-muted)] px-2.5 py-1.5 text-[12px] leading-5 text-[var(--text-secondary)]">
                                                {lockedReason}
                                        </p>
                                )}
                                {children}
                        </div>
                        <Switch
                                checked={checked}
                                onChange={onChange}
                                pending={pending}
                                disabled={disabled}
                                aria-label={title}
                                title={lockedReason ?? (checked ? enabledLabel : disabledLabel)}
                                className="mt-0.5"
                        />
                </div>
        )
}
