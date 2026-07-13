'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

export type RangeKind = '7d' | '30d' | 'monthly'

const OPTIONS: { label: string; value: RangeKind }[] = [
  { label: '۷ روز', value: '7d' },
  { label: '۳۰ روز', value: '30d' },
  { label: 'ماهانه', value: 'monthly' },
]

/** Pill-style range switcher that updates the URL search param `range`. */
export function RangeSwitch({ current, basePath = '/admin' }: { current: RangeKind; basePath?: string }) {
  return (
    <div className="spatial-control inline-flex items-center gap-1 rounded-xl p-1 text-[11px]">
      {OPTIONS.map((o) => (
        <Link
          key={o.value}
          href={`${basePath}?range=${o.value}`}
          className={cn(
            'min-h-9 rounded-lg px-3 py-2 font-bold transition-[background-color,color,transform,box-shadow] duration-200 active:scale-[.97]',
            current === o.value
              ? 'bg-black text-white shadow-[var(--shadow-control)]'
              : 'text-black/45 hover:bg-black/[0.045] hover:text-black',
          )}
        >
          {o.label}
        </Link>
      ))}
    </div>
  )
}
