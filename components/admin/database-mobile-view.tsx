'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Database, Eye } from 'lucide-react'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'
import { cn } from '@/lib/utils'

export function DatabaseModelPicker({
  models,
  selectedKey,
}: {
  models: Array<{ key: string; label: string }>
  selectedKey: string
}) {
  const [open, setOpen] = useState(false)
  const selected = models.find((model) => model.key === selectedKey) ?? models[0]
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-expanded={open} className="sticky top-20 z-20 flex min-h-12 w-full items-center gap-3 rounded-2xl border border-black/[0.08] bg-white/95 px-4 text-start shadow-sm backdrop-blur-xl lg:hidden">
        <Database className="h-4 w-4" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-black">{selected?.label}</span>
        <code dir="ltr" className="text-[10px] text-black/35">{selected?.key}</code>
        <ChevronDown className="h-4 w-4 text-black/40" aria-hidden="true" />
      </button>
      <MobileBottomSheet open={open} title="مدل‌های Prisma" description="جدول موردنظر را برای مرور انتخاب کنید" closeLabel="بستن فهرست مدل‌ها" size="large" onClose={() => setOpen(false)}>
        <nav className="grid grid-cols-2 gap-2" aria-label="مدل‌های Prisma">
          {models.map((model) => (
            <Link key={model.key} href={`/admin/database?model=${model.key}`} onClick={() => setOpen(false)} aria-current={selectedKey === model.key ? 'page' : undefined} className={cn('flex min-h-12 min-w-0 flex-col justify-center rounded-xl border px-3', selectedKey === model.key ? 'border-black bg-black text-white' : 'border-zinc-200 bg-white text-zinc-800')}>
              <span className="truncate text-xs font-bold">{model.label}</span>
              <code dir="ltr" className={cn('mt-1 truncate text-[9px]', selectedKey === model.key ? 'text-white/55' : 'text-zinc-400')}>{model.key}</code>
            </Link>
          ))}
        </nav>
      </MobileBottomSheet>
    </>
  )
}

export function DatabaseMobileRows({
  modelLabel,
  columns,
  rows,
}: {
  modelLabel: string
  columns: string[]
  rows: Array<Record<string, string>>
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const selected = selectedIndex === null ? null : rows[selectedIndex]
  return (
    <>
      <div className="grid gap-2 p-3 md:hidden">
        {rows.map((row, index) => (
          <button key={index} type="button" onClick={() => setSelectedIndex(index)} className="flex min-h-20 w-full items-center gap-3 rounded-2xl border border-black/[0.07] bg-white p-3 text-start shadow-sm">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-zinc-100 text-zinc-600"><Database className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
              {columns.slice(0, 3).map((column) => <span key={column} className="block truncate font-mono text-[10px] leading-5 text-zinc-600"><b className="text-zinc-400">{column}:</b> {row[column]}</span>)}
            </span>
            <Eye className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
          </button>
        ))}
      </div>
      <MobileBottomSheet open={selected !== null} title={`${modelLabel} · رکورد ${(selectedIndex ?? 0) + 1}`} description="نمای کامل فیلدهای رکورد فقط‌خواندنی" closeLabel="بستن جزئیات رکورد" size="large" onClose={() => setSelectedIndex(null)}>
        {selected && (
          <dl dir="ltr" className="space-y-2 text-left">
            {columns.map((column) => (
              <div key={column} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <dt className="font-mono text-[10px] font-bold text-zinc-400">{column}</dt>
                <dd className="mt-1 whitespace-pre-wrap break-all font-mono text-xs leading-6 text-zinc-700">{selected[column]}</dd>
              </div>
            ))}
          </dl>
        )}
      </MobileBottomSheet>
    </>
  )
}
