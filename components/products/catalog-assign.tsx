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
      <p className="py-8 text-center text-sm text-[var(--text-muted)]">
        {t('empty')}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-xs leading-relaxed text-[var(--text-secondary)]">
        {t('hint')}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
          >
            {allSelected ? t('deselectAll') : t('selectAll')}
          </button>
          <span className="text-sm text-[var(--text-secondary)]">
            {t('selected', { count: selected.size })}
          </span>
        </div>
        <button
          onClick={save}
          disabled={status === 'saving'}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--white)] px-5 py-2 text-sm font-medium text-[var(--bg-base)] transition-transform hover:scale-[1.02] disabled:opacity-50"
        >
          {status === 'saving' && <Loader2 className="h-4 w-4 animate-spin" />}
          {status === 'saved' ? t('saved') : t('saveAndTest')}
        </button>
      </div>

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {products.map((p) => {
          const on = selected.has(p.id)
          return (
            <li key={p.id}>
              <button
                onClick={() => toggle(p.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border p-3 text-start transition-colors',
                  on
                    ? 'border-[var(--border-strong)] bg-[var(--bg-hover)]'
                    : 'border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)]',
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                    on ? 'border-[var(--white)] bg-[var(--white)] text-[var(--bg-base)]' : 'border-[var(--border-hover)]',
                  )}
                >
                  {on && <Check className="h-3.5 w-3.5" />}
                </span>
                <Package className="h-4 w-4 text-[var(--text-muted)]" />
                <div className="min-w-0">
                  <div className="truncate text-sm text-[var(--text-primary)]">{p.name}</div>
                  {p.category && (
                    <div className="text-xs text-[var(--text-muted)]">{p.category}</div>
                  )}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
