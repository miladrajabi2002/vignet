'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Package, Pencil, Trash2, Search as SearchIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ProductCard {
  id: string
  name: string
  price: number | null
  comparePrice: number | null
  stock: number | null
  images: string[]
  active: boolean
  queryCount: number
  category: { name: string } | null
}

export function ProductGrid({ products }: { products: ProductCard[] }) {
  const t = useTranslations('products')
  const locale = useLocale()
  const router = useRouter()

  const fmt = (n: number) =>
    n.toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')

  async function remove(id: string) {
    if (!confirm(t('deleteConfirm'))) return
    await fetch(`/api/products/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => {
        const stockLabel =
          p.stock === null
            ? t('unlimited')
            : p.stock > 0
              ? t('inStock')
              : t('outOfStock')
        const stockClass =
          p.stock === null
            ? 'text-[var(--text-muted)]'
            : p.stock > 0
              ? 'text-success'
              : 'text-danger'
        return (
          <div
            key={p.id}
            className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] transition-colors hover:border-[var(--border-hover)]"
          >
            <div className="relative aspect-video bg-[var(--bg-muted)]">
              {p.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-[var(--text-hint)]">
                  <Package className="h-8 w-8" />
                </div>
              )}
              <span className={cn('absolute end-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs backdrop-blur', stockClass)}>
                {stockLabel}
              </span>
            </div>

            <div className="flex flex-1 flex-col p-4">
              <h3 className="truncate font-medium text-[var(--text-primary)]">{p.name}</h3>
              {p.category && (
                <span className="mt-0.5 text-xs text-[var(--text-muted)]">{p.category.name}</span>
              )}
              <div className="mt-2 flex items-baseline gap-2">
                {p.price != null && (
                  <span className="text-[var(--text-primary)]">
                    {fmt(p.price)} <span className="text-xs text-[var(--text-muted)]">{t('toman')}</span>
                  </span>
                )}
                {p.comparePrice != null && (
                  <span className="text-xs text-[var(--text-muted)] line-through">{fmt(p.comparePrice)}</span>
                )}
              </div>

              <div className="mt-auto flex items-center justify-between pt-4">
                <span className="text-xs text-[var(--text-muted)]">
                  {t('queries', { count: p.queryCount })}
                </span>
                <div className="flex items-center gap-2">
                  <Link href={`/products/${p.id}/edit`} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]" aria-label={t('edit')}>
                    <Pencil className="h-4 w-4" />
                  </Link>
                  <button onClick={() => remove(p.id)} className="text-[var(--text-muted)] hover:text-danger" aria-label={t('delete')}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ProductsToolbar({
  categories,
  defaultQuery,
  defaultSort,
  defaultCategory,
}: {
  categories: { id: string; name: string }[]
  defaultQuery: string
  defaultSort: string
  defaultCategory: string
}) {
  const t = useTranslations('products')
  const router = useRouter()

  function update(params: Record<string, string>) {
    const sp = new URLSearchParams()
    const merged = { q: defaultQuery, sort: defaultSort, categoryId: defaultCategory, ...params }
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v)
    router.push(`/products?${sp.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1">
        <SearchIcon className="absolute top-1/2 ms-3 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          defaultValue={defaultQuery}
          onKeyDown={(e) => e.key === 'Enter' && update({ q: (e.target as HTMLInputElement).value })}
          placeholder={t('search')}
          className="input ps-9"
        />
      </div>
      <select defaultValue={defaultCategory} onChange={(e) => update({ categoryId: e.target.value })} className="input w-auto">
        <option value="">{t('allCategories')}</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <select defaultValue={defaultSort} onChange={(e) => update({ sort: e.target.value })} className="input w-auto">
        <option value="newest">{t('sortNewest')}</option>
        <option value="price_asc">{t('sortPriceAsc')}</option>
        <option value="price_desc">{t('sortPriceDesc')}</option>
        <option value="queried">{t('sortQueried')}</option>
      </select>
    </div>
  )
}
