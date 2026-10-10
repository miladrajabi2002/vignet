'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BellRing, PackageMinus, Pencil } from 'lucide-react'
import { AutoSaveStatus } from '@/components/ui/auto-save-status'
import { useAutoSave } from '@/lib/hooks/use-auto-save'
import { cn } from '@/lib/utils'

function num(value: number, fa: boolean) {
  return value.toLocaleString(fa ? 'fa-IR' : 'en-US')
}

/**
 * Products page strip: how many tracked products are running low, and the
 * level that triggers the owner alert (panel + manager bot). The level is
 * edited in place and saved on leaving the field (or Enter; Escape takes the
 * edit back); each product can still override it in its own form.
 */
export function LowStockCard({
  fa,
  lowCount,
  threshold: initialThreshold,
  telegramConnected,
  filtering,
}: {
  fa: boolean
  lowCount: number
  threshold: number
  telegramConnected: boolean
  filtering: boolean
}) {
  const router = useRouter()
  const [threshold, setThreshold] = useState(initialThreshold)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(initialThreshold))
  const off = threshold === 0

  const auto = useAutoSave({
    value: threshold,
    delay: 0,
    save: async (value) => {
      const response = await fetch('/api/workspace/stock-alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold: value }),
      }).catch(() => null)
      if (!response?.ok) throw new Error('SAVE_FAILED')
      router.refresh()
    },
  })

  // Escape closes the field without keeping the edit, whatever the blur that follows carries.
  const discarded = useRef(false)

  /** Leaving the field keeps what was typed; an empty or non-numeric field changes nothing. */
  function commit() {
    if (discarded.current) return
    const digits = draft.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).trim()
    const value = /^\d+$/.test(digits) ? Math.min(1000, Number(digits)) : threshold
    setThreshold(value)
    setDraft(String(value))
    setEditing(false)
  }

  return (
    <section className={cn(
      'flex flex-col gap-3 rounded-card border p-3.5 sm:flex-row sm:items-center sm:p-4',
      lowCount > 0 && !off ? 'border-amber-500/25 bg-amber-500/[0.06]' : 'border-[var(--border-default)] bg-white',
    )}>
      <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-2xl', lowCount > 0 && !off ? 'bg-amber-500/15 text-amber-700' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]')}>
        {lowCount > 0 && !off ? <PackageMinus className="h-5 w-5" /> : <BellRing className="h-5 w-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-[var(--text-primary)]">
          {off
            ? (fa ? 'هشدار موجودی کم خاموش است' : 'Low-stock alerts are off')
            : lowCount > 0
              ? (fa ? `${num(lowCount, fa)} محصول رو به اتمام است` : `${lowCount} products running low`)
              : (fa ? 'موجودی همه محصولات کافی است' : 'Stock is fine everywhere')}
        </p>
        {editing ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-[var(--text-secondary)]">
            <label htmlFor="low-stock-threshold">{fa ? 'وقتی موجودی به' : 'Alert at'}</label>
            <input
              id="low-stock-threshold"
              inputMode="numeric"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commit}
              onFocus={(event) => event.currentTarget.select()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
                if (event.key === 'Escape') { discarded.current = true; setDraft(String(threshold)); setEditing(false) }
              }}
              enterKeyHint="done"
              className="input h-9 min-h-9 w-20 text-center tabular-nums"
              autoFocus
            />
            <span>{fa ? 'عدد یا کمتر رسید خبرم کن (۰ = خاموش)' : 'units or fewer (0 = off)'}</span>
          </div>
        ) : (
          <p className="mt-0.5 text-[13px] leading-5 text-[var(--text-muted)]">
            {off
              ? (fa ? 'با روشن کردن، وقتی موجودی محصولی کم شود در پنل خبر می‌دهیم.' : 'Turn it on to hear when a product runs low.')
              : fa
                ? `وقتی موجودی محصولی به ${num(threshold, fa)} عدد یا کمتر برسد، در پنل${telegramConnected ? ' و ربات تلگرام مدیریت' : ''} خبر می‌دهیم.`
                : `You hear in the panel${telegramConnected ? ' and the manager bot' : ''} when a product drops to ${threshold} or fewer.`}
          </p>
        )}
        <AutoSaveStatus status={auto.status} onRetry={auto.flush} idleLabel={null} className="-ms-2.5 mt-1" />
      </div>
      {!editing && (
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => { discarded.current = false; setEditing(true) }} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border-default)] bg-white px-3 text-xs font-bold text-[var(--text-secondary)] hover:border-[var(--border-strong)]">
            <Pencil className="h-3.5 w-3.5" />
            {off ? (fa ? 'روشن کردن' : 'Turn on') : (fa ? 'تغییر حد' : 'Change level')}
          </button>
          {lowCount > 0 && !off && !filtering && (
            <Link href="/products?stock=low_stock" className="inline-flex min-h-11 items-center rounded-xl bg-[var(--text-primary)] px-3.5 text-xs font-bold text-white">
              {fa ? 'نمایش' : 'Show'}
            </Link>
          )}
        </div>
      )}
    </section>
  )
}
