'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type MaterialSelectOption = {
        value: string
        label: string
        description?: string
        meta?: string | number
        disabled?: boolean
}

type MenuPosition = {
        left: number
        top?: number
        bottom?: number
        width: number
}

export function MaterialSelect({
        value,
        onValueChange,
        options,
        placeholder,
        ariaLabel,
        label,
        icon,
        name,
        disabled = false,
        className,
        buttonClassName,
        menuClassName,
}: {
        value: string
        onValueChange: (value: string) => void
        options: readonly MaterialSelectOption[]
        placeholder?: string
        ariaLabel: string
        label?: string
        icon?: ReactNode
        name?: string
        disabled?: boolean
        className?: string
        buttonClassName?: string
        menuClassName?: string
}) {
        const id = useId()
        const triggerRef = useRef<HTMLButtonElement>(null)
        const menuRef = useRef<HTMLDivElement>(null)
        const [open, setOpen] = useState(false)
        const [mounted, setMounted] = useState(false)
        const [position, setPosition] = useState<MenuPosition | null>(null)
        const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value))
        const [highlighted, setHighlighted] = useState(selectedIndex)
        const selected = options.find((option) => option.value === value)

        useEffect(() => setMounted(true), [])
        useEffect(() => setHighlighted(selectedIndex), [selectedIndex])

        const updatePosition = useCallback(() => {
                const trigger = triggerRef.current
                if (!trigger) return
                const rect = trigger.getBoundingClientRect()
                const width = Math.max(rect.width, 220)
                const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8)
                const below = window.innerHeight - rect.bottom
                const placeAbove = below < 250 && rect.top > below
                setPosition(placeAbove
                        ? { left, bottom: window.innerHeight - rect.top + 8, width }
                        : { left, top: rect.bottom + 8, width })
        }, [])

        useEffect(() => {
                if (!open) return
                updatePosition()
                function onPointerDown(event: PointerEvent) {
                        const target = event.target as Node
                        if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false)
                }
                function onResize() { setOpen(false) }
                function onScroll(event: Event) {
                        const target = event.target
                        // Ignore the listbox's own scroll. This listener runs in capture
                        // phase, so menu scrolling otherwise closes long option lists.
                        if (target instanceof Node && menuRef.current?.contains(target)) return
                        setOpen(false)
                }
                document.addEventListener('pointerdown', onPointerDown)
                window.addEventListener('resize', onResize, { passive: true })
                window.addEventListener('scroll', onScroll, { passive: true, capture: true })
                return () => {
                        document.removeEventListener('pointerdown', onPointerDown)
                        window.removeEventListener('resize', onResize)
                        window.removeEventListener('scroll', onScroll, true)
                }
        }, [open, updatePosition])

        function move(direction: 1 | -1) {
                let next = highlighted
                for (let attempt = 0; attempt < options.length; attempt += 1) {
                        next = (next + direction + options.length) % options.length
                        if (!options[next]?.disabled) break
                }
                setHighlighted(next)
        }

        function select(index: number) {
                const option = options[index]
                if (!option || option.disabled) return
                onValueChange(option.value)
                setOpen(false)
                requestAnimationFrame(() => triggerRef.current?.focus())
        }

        function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault()
                        if (!open) {
                                updatePosition()
                                setOpen(true)
                        } else move(event.key === 'ArrowDown' ? 1 : -1)
                        return
                }
                if ((event.key === 'Enter' || event.key === ' ') && open) {
                        event.preventDefault()
                        select(highlighted)
                        return
                }
                if (event.key === 'Escape' && open) {
                        event.preventDefault()
                        setOpen(false)
                }
        }

        return (
                <div className={cn('relative min-w-0', className)}>
                        {name && <input type="hidden" name={name} value={value} />}
                        <button
                                ref={triggerRef}
                                type="button"
                                disabled={disabled}
                                aria-label={ariaLabel}
                                role="combobox"
                                aria-haspopup="listbox"
                                aria-expanded={open}
                                aria-controls={`${id}-menu`}
                                aria-activedescendant={open ? `${id}-option-${highlighted}` : undefined}
                                onClick={() => {
                                        if (!open) updatePosition()
                                        setOpen((current) => !current)
                                }}
                                onKeyDown={onKeyDown}
                                className={cn(
                                        'spatial-press flex min-h-11 w-full min-w-0 items-center gap-2 rounded-[0.75rem] border border-black/[0.08] bg-white px-3 text-start shadow-[0_6px_18px_rgba(0,0,0,0.055)] transition-[border-color,box-shadow,background-color] duration-150 hover:border-black/[0.14] focus-visible:border-black/20 focus-visible:shadow-[0_10px_28px_rgba(0,0,0,0.09)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45',
                                        open && 'border-black/20 shadow-[0_10px_28px_rgba(0,0,0,0.09)]',
                                        buttonClassName,
                                )}
                        >
                                {icon && <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black/[0.045] text-black/55">{icon}</span>}
                                <span className="min-w-0 flex-1">
                                        {label && <span className="block text-[9px] font-medium leading-3 text-black/35">{label}</span>}
                                        <span className={cn('block truncate text-xs font-medium leading-5', selected ? 'text-black/75' : 'text-black/35')}>{selected?.label ?? placeholder ?? ariaLabel}</span>
                                </span>
                                {selected?.meta !== undefined && <span className="shrink-0 rounded-full bg-black/[0.045] px-2 py-0.5 text-[9px] tabular-nums text-black/45">{selected.meta}</span>}
                                <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-black/35 transition-transform duration-150', open && 'rotate-180')} />
                        </button>

                        {mounted && open && position && createPortal(
                                <div
                                        ref={menuRef}
                                        id={`${id}-menu`}
                                        role="listbox"
                                        aria-label={ariaLabel}
                                        className={cn('material-select-menu fixed z-[120] max-h-[min(22rem,60dvh)] overscroll-contain overflow-y-auto rounded-[1.15rem] border border-black/10 bg-white/95 p-1.5 shadow-[0_22px_70px_rgba(0,0,0,0.2)] backdrop-blur-xl', menuClassName)}
                                        style={position}
                                >
                                        {options.map((option, index) => {
                                                const active = index === highlighted
                                                const checked = option.value === value
                                                return (
                                                        <button
                                                                key={option.value || `empty-${index}`}
                                                                id={`${id}-option-${index}`}
                                                                type="button"
                                                                role="option"
                                                                aria-selected={checked}
                                                                disabled={option.disabled}
                                                                onPointerMove={() => setHighlighted(index)}
                                                                onClick={() => select(index)}
                                                                className={cn(
                                                                        'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-start transition-colors duration-100 disabled:opacity-40',
                                                                        active ? 'bg-black text-white' : 'text-black/65 hover:bg-black/[0.045]',
                                                                )}
                                                        >
                                                                <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{option.label}</span>{option.description && <span className={cn('mt-0.5 block line-clamp-2 text-[10px] leading-4', active ? 'text-white/50' : 'text-black/40')}>{option.description}</span>}</span>
                                                                {option.meta !== undefined && <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[9px] tabular-nums', active ? 'bg-white/12 text-white/70' : 'bg-black/[0.045] text-black/40')}>{option.meta}</span>}
                                                                <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full', checked ? (active ? 'bg-white text-black' : 'bg-black text-white') : 'opacity-0')}><Check className="h-3 w-3" /></span>
                                                        </button>
                                                )
                                        })}
                                </div>,
                                document.body,
                        )}
                </div>
        )
}
