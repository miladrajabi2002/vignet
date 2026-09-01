'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SlidersHorizontal } from 'lucide-react'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'
import { cn } from '@/lib/utils'

export interface AdminFilterGroup {
  label: string
  options: Array<{ label: string; href: string; active: boolean }>
}

export function AdminFilterSheet({
  groups,
  clearHref,
  activeCount,
  title = 'فیلترها',
  description = 'نتایج را محدود کنید',
  className,
}: {
  groups: AdminFilterGroup[]
  clearHref: string
  activeCount: number
  title?: string
  description?: string
  className?: string
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => setOpen(false), [pathname])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn('relative inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-3 text-xs font-bold text-black/70', className)}
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        {title}
        {activeCount > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-black px-1 text-[9px] text-white">
            {activeCount.toLocaleString('fa-IR')}
          </span>
        )}
      </button>

      <MobileBottomSheet
        open={open}
        title={title}
        description={description}
        closeLabel="بستن فیلترها"
        triggerRef={triggerRef}
        onClose={() => setOpen(false)}
        footer={(
          <div className="grid grid-cols-2 gap-2">
            <Link href={clearHref} onClick={() => setOpen(false)} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border-default)] px-4 text-sm font-semibold text-black">
              پاک‌کردن
            </Link>
            <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-xl bg-black px-4 text-sm font-bold text-white">
              نمایش نتایج
            </button>
          </div>
        )}
      >
        <div className="space-y-5">
          {groups.map((group) => (
            <fieldset key={group.label}>
              <legend className="mb-2 text-sm font-bold text-black">{group.label}</legend>
              <div className="grid grid-cols-2 gap-2">
                {group.options.map((option) => (
                  <Link
                    key={option.href}
                    href={option.href}
                    onClick={() => setOpen(false)}
                    aria-current={option.active ? 'true' : undefined}
                    className={cn(
                      'inline-flex min-h-11 items-center justify-center rounded-xl border px-3 text-center text-xs font-semibold',
                      option.active ? 'border-black bg-black text-white' : 'border-zinc-200 bg-white text-zinc-700',
                    )}
                  >
                    {option.label}
                  </Link>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </MobileBottomSheet>
    </>
  )
}
