'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Plus, Trash2, FolderTree, Loader2 } from 'lucide-react'

export interface CategoryNode {
  id: string
  name: string
  parentId: string | null
  products: number
}

export function CategoryTree({ categories }: { categories: CategoryNode[] }) {
  const t = useTranslations('products.categories')
  const router = useRouter()
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [busy, setBusy] = useState(false)

  async function add() {
    if (!name.trim()) return
    setBusy(true)
    await fetch('/api/products/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId: parentId || null }),
    })
    setName('')
    setParentId('')
    setBusy(false)
    router.refresh()
  }

  async function remove(id: string) {
    await fetch(`/api/products/categories/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  const roots = categories.filter((c) => !c.parentId)
  const childrenOf = (id: string) => categories.filter((c) => c.parentId === id)

  const renderRow = (c: CategoryNode, depth: number) => (
    <div key={c.id}>
      <div
        className="flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3"
        style={{ marginInlineStart: depth * 20 }}
      >
        <FolderTree className="h-4 w-4 text-[var(--text-muted)]" />
        <span className="flex-1 text-sm text-[var(--text-primary)]">{c.name}</span>
        <span className="text-xs text-[var(--text-muted)]">
          {t('count', { count: c.products })}
        </span>
        <button onClick={() => remove(c.id)} className="text-[var(--text-muted)] hover:text-danger">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 space-y-2">
        {childrenOf(c.id).map((child) => renderRow(child, depth + 1))}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder={t('namePlaceholder')}
            className="input flex-1"
          />
          <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="input w-auto">
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            onClick={add}
            disabled={busy || !name.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t('add')}
          </button>
        </div>
      </div>

      {categories.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--text-muted)]">{t('empty')}</p>
      ) : (
        <div className="space-y-2">{roots.map((c) => renderRow(c, 0))}</div>
      )}
    </div>
  )
}
