'use client'

import Link from 'next/link'

export type RangeKind = '7d' | '30d' | 'monthly'

const OPTIONS: { label: string; value: RangeKind }[] = [
  { label: '۷ روز', value: '7d' },
  { label: '۳۰ روز', value: '30d' },
  { label: 'ماهانه', value: 'monthly' },
]

/** Pill-style range switcher that updates the URL search param `range`. */
export function RangeSwitch({ current, basePath = '/admin' }: { current: RangeKind; basePath?: string }) {
  return (
    <div className="ui-seg inline-grid grid-flow-col text-[12px]">
      {OPTIONS.map((o) => (
        <Link
          key={o.value}
          href={`${basePath}?range=${o.value}`}
          aria-current={current === o.value ? 'page' : undefined}
          className="ui-seg-tab min-h-9 px-3"
        >
          {o.label}
        </Link>
      ))}
    </div>
  )
}
