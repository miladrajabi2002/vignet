'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Check, Loader2, Package } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AssignableProduct {
  id: string
  name: string
  category: string | null
}

export function CatalogAssign({
  agentId,
  products,
  initialSelected,
}: {
  agentId: string
  products: AssignableProduct[]
  initialSelected: string[]
}) {
  const t = useTranslations('products.catalog')
  const router = useRouter()
  // Helpful default: a brand-new agent (nothing assigned yet) starts with ALL
  // products selected so it can answer about the whole catalogue out of the
  // box. The user can narrow it down afterwards.
  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(
        initialSelected.length > 0 ? initialSelected : products.map((p) => p.id),
      ),
  )
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  const allSelected = selected.size === products.length && products.length > 0

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleAll = () =>
    setSelected((prev) =>
      prev.size === products.length ? new Set() : new Set(products.map((p) => p.id)),
    )

  async function save() {
    setStatus('saving')
    const res = await fetch(`/api/agents/${agentId}/catalog`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds: [...selected] }),
    })
    if (res.ok) {
      setStatus('saved')
      // Connect the steps: jump straight to the agent's test chat so the user
      // can immediately try asking about the products they just assigned.
      router.push(`/agents/${agentId}`)
    } else {
      setStatus('idle')
    }
  }

  if (products.length === 0) {
    return (
      <section className="spatial-surface flex min-h-64 flex-col items-center justify-center rounded-[1.5rem] p-8 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-[1.15rem] bg-black text-white shadow-[var(--shadow-control)]">
          <Package className="h-6 w-6" />
        </span>
        <p className="mt-4 text-sm font-bold text-[var(--text-primary)]">{t('empty')}</p>
      </section>
    )
  }

  return (
    <section
      className="spatial-surface overflow-hidden rounded-[1.5rem]"
      aria-labelledby="agent-catalog-title"
    >
      <h2 id="agent-catalog-title" className="sr-only">
        {t('title')}
      </h2>

      <div className="flex flex-col gap-4 border-b border-black/[0.055] bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(248,248,250,0.78))] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-black text-white shadow-[var(--shadow-control)]">
            <Package className="h-5 w-5" />
          </span>
          <p className="max-w-2xl text-xs leading-6 text-[var(--text-secondary)]">
            {t('hint')}
          </p>
        </div>
        <span
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full border border-black/[0.06] bg-white px-4 text-xs font-bold tabular-nums text-[var(--text-primary)] shadow-[0_10px_24px_-20px_rgba(0,0,0,0.75)]"
          aria-live="polite"
        >
          {t('selected', { count: selected.size })}
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="mb-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={toggleAll}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border-default)] bg-white px-4 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 focus-visible:ring-offset-2"
          >
            {allSelected ? t('deselectAll') : t('selectAll')}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={status === 'saving'}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-black px-5 text-sm font-bold text-white shadow-[var(--shadow-control)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === 'saving' && (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            )}
            {status === 'saved' ? t('saved') : t('saveAndTest')}
          </button>
        </div>

        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {products.map((p) => {
            const on = selected.has(p.id)
            return (
              <li key={p.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(p.id)}
                  className={cn(
                    'group flex min-h-20 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-start transition-[border-color,background-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 focus-visible:ring-offset-2',
                    on
                      ? 'border-black/15 bg-black/[0.035] shadow-[0_14px_30px_-26px_rgba(0,0,0,0.8)]'
                      : 'border-[var(--border-default)] bg-white hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)]',
                  )}
                >
                  <span
                    className={cn(
                      'grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-colors duration-150',
                      on
                        ? 'border-black bg-black text-white'
                        : 'border-black/[0.055] bg-[var(--bg-muted)] text-[var(--text-muted)] group-hover:text-[var(--text-primary)]',
                    )}
                  >
                    <Package className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-[var(--text-primary)]">
                      {p.name}
                    </span>
                    {p.category && (
                      <span className="mt-1.5 inline-flex max-w-full truncate rounded-full bg-black/[0.045] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                        {p.category}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      'grid h-6 w-6 shrink-0 place-items-center rounded-lg border transition-colors duration-150',
                      on
                        ? 'border-black bg-black text-white'
                        : 'border-[var(--border-hover)] bg-white text-transparent',
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
