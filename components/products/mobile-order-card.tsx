'use client'

import { useRef, useState, type ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'

export function MobileOrderCard({
  orderNumber,
  customerName,
  statusLabel,
  statusClassName,
  amountLabel,
  dateLabel,
  amountTitle,
  dateTitle,
  detailsLabel,
  closeLabel,
  children,
}: {
  orderNumber: string
  customerName: string
  statusLabel: string
  statusClassName: string
  amountLabel: string
  dateLabel: string
  amountTitle: string
  dateTitle: string
  detailsLabel: string
  closeLabel: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <article className="spatial-surface overflow-hidden rounded-[1.35rem] !bg-white">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`${detailsLabel}: #${orderNumber}`}
          className="spatial-press block w-full p-4 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/60"
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p dir="ltr" className="truncate text-start font-bold tabular-nums text-[var(--text-primary)]">
                    #{orderNumber}
                  </p>
                  <p className="mt-1 truncate text-sm text-[var(--text-secondary)]">
                    {customerName}
                  </p>
                </div>
                <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold', statusClassName)}>
                  {statusLabel}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-black/[0.025] p-3 text-xs">
                <div className="min-w-0">
                  <span className="block text-[10px] text-[var(--text-muted)]">{amountTitle}</span>
                  <span className="mt-1 block truncate font-bold tabular-nums text-[var(--text-primary)]">{amountLabel}</span>
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] text-[var(--text-muted)]">{dateTitle}</span>
                  <span className="mt-1 block truncate font-semibold text-[var(--text-primary)]">{dateLabel}</span>
                </div>
              </div>
            </div>
            <ChevronLeft className="mt-1 h-4 w-4 shrink-0 text-[var(--text-hint)] ltr:rotate-180" aria-hidden="true" />
          </div>
        </button>
      </article>

      <MobileBottomSheet
        open={open}
        title={`#${orderNumber}`}
        description={`${customerName} · ${statusLabel}`}
        closeLabel={closeLabel}
        motionPreset="detail"
        triggerRef={triggerRef}
        onClose={() => setOpen(false)}
        contentClassName="bg-[var(--bg-base)]/70"
      >
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-[1.35rem] border border-[var(--border-default)] bg-white p-4 shadow-[var(--shadow-xs)]">
          <div className="min-w-0">
            <span className="block text-[10px] text-[var(--text-muted)]">{amountTitle}</span>
            <span className="mt-1 block truncate font-bold tabular-nums text-[var(--text-primary)]">{amountLabel}</span>
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] text-[var(--text-muted)]">{dateTitle}</span>
            <span className="mt-1 block text-xs font-semibold leading-5 text-[var(--text-primary)]">{dateLabel}</span>
          </div>
        </div>
        {children}
      </MobileBottomSheet>
    </>
  )
}
