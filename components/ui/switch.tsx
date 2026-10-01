'use client'

import type { ComponentType, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
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
 * A settings card built around one Switch: icon, title and switch on the
 * first line, a description, then an optional badge, a live on/off status
 * and — when the switch is locked — the reason it is locked.
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
        return (
                <div className="flex h-full flex-col gap-2.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3.5">
                        <div className="flex items-center gap-3">
                                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--bg-muted)] text-[var(--text-primary)]">
                                        <Icon className="h-4 w-4" />
                                </span>
                                <h3 className="min-w-0 flex-1 text-sm font-bold leading-6 text-[var(--text-primary)]">
                                        {title}
                                </h3>
                                <Switch
                                        checked={checked}
                                        onChange={onChange}
                                        pending={pending}
                                        disabled={disabled}
                                        aria-label={title}
                                        title={lockedReason ?? (checked ? enabledLabel : disabledLabel)}
                                />
                        </div>
                        <p className="text-xs leading-6 text-[var(--text-secondary)]">
                                {description}
                        </p>
                        {lockedReason && (
                                <p className="rounded-xl bg-[var(--bg-muted)] px-2.5 py-1.5 text-[12px] leading-5 text-[var(--text-secondary)]">
                                        {lockedReason}
                                </p>
                        )}
                        {children}
                        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-0.5">
                                {badge && (
                                        <span className="inline-flex rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[12px] text-[var(--text-muted)]">
                                                {badge}
                                        </span>
                                )}
                                <span className={cn('inline-flex items-center gap-1 text-[12px] font-medium', checked ? 'text-success' : 'text-[var(--text-muted)]')}>
                                        <span className={cn('h-1.5 w-1.5 rounded-full', checked ? 'bg-success' : 'bg-[var(--border-strong)]')} />
                                        {checked ? enabledLabel : disabledLabel}
                                </span>
                        </div>
                </div>
        )
}
