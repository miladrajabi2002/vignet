'use client'

import { useRef, useState, type ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'
import { ORDER_ROW_GRID } from '@/components/products/order-row-grid'

/**
 * One order in the list. `row` is the compact desktop line, `card` the mobile
 * card; both open the same details popup, which is a bottom sheet on phones
 * and a centered dialog on desktop. The details are rendered by the server
 * page and passed in as children.
 */
export function OrderEntry({
  variant,
  orderNumber,
  storeLabel,
  customerName,
  customerContact,
  itemsLabel,
  itemsCountLabel,
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
  variant: 'row' | 'card'
  orderNumber: string
  storeLabel: string
  customerName: string
  customerContact: string | null
  itemsLabel: string
  itemsCountLabel: string | null
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
  const triggerProps = {
    ref: triggerRef,
    type: 'button' as const,
    onClick: () => setOpen(true),
    'aria-haspopup': 'dialog' as const,
    'aria-expanded': open,
    'aria-label': `${detailsLabel}: #${orderNumber}`,
  }

  return (
    <>
      {variant === 'row' ? (
        <button
          {...triggerProps}
          className={cn(
            ORDER_ROW_GRID,
            'w-full px-4 py-3 text-start transition-colors hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] sm:px-5',
          )}
        >
          <span className="min-w-0">
            <span dir="ltr" className="block truncate text-start text-sm font-bold tabular-nums text-[var(--text-primary)]">#{orderNumber}</span>
            <span dir="ltr" className="mt-0.5 block truncate text-start text-[12px] text-[var(--text-muted)]">{storeLabel}</span>
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-[var(--text-primary)]" title={customerName}>{customerName}</span>
            {customerContact && (
              <span dir="ltr" className="mt-0.5 block truncate text-start text-[12px] tabular-nums text-[var(--text-muted)]">{customerContact}</span>
            )}
          </span>
          <span className="hidden min-w-0 lg:block">
            <span className="block truncate text-[13px] text-[var(--text-secondary)]" title={itemsLabel}>{itemsLabel}</span>
            {itemsCountLabel && <span className="mt-0.5 block text-[12px] text-[var(--text-muted)]">{itemsCountLabel}</span>}
          </span>
          <span className={cn('justify-self-start whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold', statusClassName)}>
            {statusLabel}
          </span>
          <span className="whitespace-nowrap text-end text-sm font-bold tabular-nums text-[var(--text-primary)]">{amountLabel}</span>
          <span className="whitespace-nowrap text-end text-[12px] tabular-nums text-[var(--text-secondary)]">{dateLabel}</span>
          <ChevronLeft className="h-4 w-4 text-[var(--text-hint)] ltr:rotate-180" aria-hidden="true" />
        </button>
      ) : (
        <article className="spatial-surface overflow-hidden rounded-card !bg-white">
          <button
            {...triggerProps}
            className="spatial-press block w-full p-4 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
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
                    <span className="block text-[12px] text-[var(--text-muted)]">{amountTitle}</span>
                    <span className="mt-1 block truncate font-bold tabular-nums text-[var(--text-primary)]">{amountLabel}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[12px] text-[var(--text-muted)]">{dateTitle}</span>
                    <span className="mt-1 block truncate font-semibold text-[var(--text-primary)]">{dateLabel}</span>
                  </div>
                </div>
              </div>
              <ChevronLeft className="mt-1 h-4 w-4 shrink-0 text-[var(--text-hint)] ltr:rotate-180" aria-hidden="true" />
            </div>
          </button>
        </article>
      )}

      <MobileBottomSheet
        mobileOnly={false}
        open={open}
        title={`#${orderNumber}`}
        description={`${customerName} · ${statusLabel}`}
        closeLabel={closeLabel}
        motionPreset="detail"
        triggerRef={triggerRef}
        onClose={() => setOpen(false)}
        contentClassName="bg-[color:color-mix(in_srgb,var(--bg-base)_70%,transparent)]"
      >
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-card border border-[var(--border-default)] bg-white p-4 shadow-[var(--shadow-xs)]">
          <div className="min-w-0">
            <span className="block text-[12px] text-[var(--text-muted)]">{amountTitle}</span>
            <span className="mt-1 block truncate font-bold tabular-nums text-[var(--text-primary)]">{amountLabel}</span>
          </div>
          <div className="min-w-0">
            <span className="block text-[12px] text-[var(--text-muted)]">{dateTitle}</span>
            <span className="mt-1 block text-xs font-semibold leading-5 text-[var(--text-primary)]">{dateLabel}</span>
          </div>
        </div>
        {children}
      </MobileBottomSheet>
    </>
  )
}
