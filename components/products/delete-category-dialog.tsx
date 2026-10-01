'use client'

import { useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { AlertTriangle, FolderInput, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { DialogShell } from '@/components/ui/dialog-shell'
import type { CategoryNode } from '@/components/products/category-tree'

type Impact = { products: number; activeProducts: number; children: string[]; synced: boolean }

function num(value: number, fa: boolean) {
  return value.toLocaleString(fa ? 'fa-IR' : 'en-US')
}

/**
 * Delete a product category, saying first exactly what happens: how many
 * products lose their category (or move into another one the owner picks),
 * which subcategories move up a level, and whether a connected store will
 * recreate it on the next sync. Products themselves are never deleted.
 */
export function DeleteCategoryDialog({
  category,
  categories,
  onDeleted,
  onCancel,
}: {
  category: CategoryNode
  categories: readonly CategoryNode[]
  onDeleted: () => void
  onCancel: () => void
}) {
  const fa = useLocale() !== 'en'
  const [impact, setImpact] = useState<Impact | null>(null)
  const [moveTo, setMoveTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    fetch(`/api/products/categories/${category.id}?impact=1`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error())))
      .then((data: { impact: Impact }) => { if (alive) setImpact(data.impact) })
      .catch(() => { if (alive) setError(fa ? 'اطلاعات این دسته دریافت نشد؛ دوباره تلاش کنید.' : 'Could not check this category.') })
    return () => { alive = false }
  }, [category.id, fa])

  // A category cannot receive its own products, nor move them into one of
  // its children (those move up a level in the same delete).
  const targets = categories.filter((item) => item.id !== category.id)

  async function remove() {
    setBusy(true)
    setError('')
    const query = moveTo ? `?moveTo=${encodeURIComponent(moveTo)}` : ''
    const response = await fetch(`/api/products/categories/${category.id}${query}`, { method: 'DELETE' }).catch(() => null)
    setBusy(false)
    if (response?.ok) { onDeleted(); return }
    setError(fa ? 'حذف انجام نشد؛ دوباره تلاش کنید.' : 'Delete failed. Try again.')
  }

  const target = targets.find((item) => item.id === moveTo)

  return (
    <DialogShell compact title={fa ? 'حذف دسته‌بندی' : 'Delete category'} onClose={() => !busy && onCancel()}>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-red-500/10 text-red-600"><Trash2 className="h-5 w-5" /></span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--text-primary)]">{fa ? `حذف «${category.name}»` : `Delete “${category.name}”`}</p>
            <p className="mt-1 text-[12.5px] leading-6 text-[var(--text-secondary)]">
              {fa ? 'خود محصولات حذف نمی‌شوند؛ فقط این دسته از ساختار کاتالوگ و منو برداشته می‌شود.' : 'Products are never deleted; only this category leaves the catalog and menu structure.'}
            </p>
          </div>
        </div>

        {!impact && !error && (
          <p className="flex items-center gap-2 rounded-2xl bg-[var(--bg-subtle)] px-3.5 py-3 text-xs text-[var(--text-muted)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />{fa ? 'بررسی محصولات این دسته…' : 'Checking this category…'}
          </p>
        )}

        {impact && (
          <ul className="space-y-2 text-[12.5px] leading-6">
            <li className="rounded-2xl bg-[var(--bg-subtle)] px-3.5 py-3 text-[var(--text-secondary)]">
              {impact.products
                ? (fa
                    ? <><b className="text-[var(--text-primary)]">{num(impact.products, true)} محصول</b>{impact.activeProducts !== impact.products ? ` (${num(impact.activeProducts, true)} فعال)` : ''} {target ? <>به دسته «{target.name}» منتقل می‌شوند.</> : 'بدون دسته می‌مانند و در منو زیر «سایر» نمایش داده می‌شوند.'}</>
                    : <><b className="text-[var(--text-primary)]">{impact.products} products</b>{impact.activeProducts !== impact.products ? ` (${impact.activeProducts} active)` : ''} {target ? <>move to “{target.name}”.</> : 'are left without a category.'}</>)
                : (fa ? 'این دسته محصولی ندارد.' : 'This category has no products.')}
            </li>
            {impact.children.length > 0 && (
              <li className="rounded-2xl bg-[var(--bg-subtle)] px-3.5 py-3 text-[var(--text-secondary)]">
                {fa
                  ? <><b className="text-[var(--text-primary)]">{num(impact.children.length, true)} زیردسته</b> ({impact.children.join('، ')}) دسته اصلی می‌شوند.</>
                  : <><b className="text-[var(--text-primary)]">{impact.children.length} subcategories</b> ({impact.children.join(', ')}) move to the top level.</>}
              </li>
            )}
            {impact.synced && (
              <li className="flex items-start gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/[0.08] px-3.5 py-3 text-amber-900">
                <RefreshCw className="mt-1 h-4 w-4 shrink-0" />
                <span>{fa ? 'این دسته از فروشگاه متصل آمده؛ اگر در خود فروشگاه حذفش نکنید، همگام‌سازی بعدی دوباره آن را می‌سازد.' : 'This category comes from your connected store; the next sync recreates it unless you delete it there too.'}</span>
              </li>
            )}
          </ul>
        )}

        {impact && impact.products > 0 && targets.length > 0 && (
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
              <FolderInput className="h-3.5 w-3.5" />
              {fa ? 'محصولاتش کجا بروند؟' : 'Where should its products go?'}
            </span>
            <select value={moveTo} onChange={(event) => setMoveTo(event.target.value)} className="input min-h-11 w-full">
              <option value="">{fa ? 'بدون دسته بمانند' : 'Leave without a category'}</option>
              {targets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        )}

        {error && (
          <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2.5 text-xs font-medium text-red-700">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={busy} className="min-h-11 rounded-xl border border-[var(--border-default)] bg-white px-4 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50">
            {fa ? 'انصراف' : 'Cancel'}
          </button>
          <button
            type="button"
            data-dialog-initial-focus
            disabled={!impact || busy}
            onClick={() => void remove()}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {target ? (fa ? 'انتقال و حذف دسته' : 'Move and delete') : (fa ? 'حذف دسته' : 'Delete category')}
          </button>
        </div>
      </div>
    </DialogShell>
  )
}
