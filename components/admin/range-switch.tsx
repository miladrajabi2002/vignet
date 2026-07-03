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
export function RangeSwitch({ current }: { current: RangeKind }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1 text-xs">
      {OPTIONS.map((o) => (
        <Link
          key={o.value}
          href={`/admin?range=${o.value}`}
          className={cn(
            'rounded-lg px-3 py-1.5 font-medium transition-colors',
            current === o.value
              ? 'bg-zinc-900 text-white'
              : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900',
          )}
        >
          {o.label}
        </Link>
      ))}
    </div>
  )
}
