'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2, Plus, X } from 'lucide-react'

export interface CategoryOption {
  id: string
  name: string
}

export interface ProductFormData {
  id?: string
  name: string
  description: string
  price: string
  comparePrice: string
  sku: string
  stock: string
  categoryId: string
  tags: string
  images: string[]
  attributes: { key: string; value: string }[]
  active: boolean
}

export function ProductForm({
  mode,
  categories,
  initial,
}: {
  mode: 'create' | 'edit'
  categories: CategoryOption[]
  initial?: ProductFormData
}) {
  const t = useTranslations('products.form')
  const router = useRouter()

  const [form, setForm] = useState<ProductFormData>(
    initial ?? {
      name: '',
      description: '',
      price: '',
      comparePrice: '',
      sku: '',
      stock: '',
      categoryId: '',
      tags: '',
      images: [],
      attributes: [],
      active: true,
    },
  )
  const [imageUrl, setImageUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const set = <K extends keyof ProductFormData>(k: K, v: ProductFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  async function submit() {
    setSubmitting(true)
    const attributes = Object.fromEntries(
      form.attributes.filter((a) => a.key.trim()).map((a) => [a.key, a.value]),
    )
    const payload = {
      name: form.name,
      description: form.description || undefined,
      price: form.price ? Number(form.price) : null,
      comparePrice: form.comparePrice ? Number(form.comparePrice) : null,
      sku: form.sku || undefined,
      stock: form.stock === '' ? null : Number(form.stock),
      categoryId: form.categoryId || null,
      tags: form.tags ? form.tags.split(',').map((s) => s.trim()).filter(Boolean) : [],
      images: form.images,
      attributes: Object.keys(attributes).length ? attributes : undefined,
      active: form.active,
    }

    const res = await fetch(
      mode === 'edit' ? `/api/products/${form.id}` : '/api/products',
      {
        method: mode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    )
    if (res.ok) {
      router.push('/products')
      router.refresh()
    } else {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
      <Field label={t('name')}>
        <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={t('namePlaceholder')} className="input" />
      </Field>
      <Field label={t('description')}>
        <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} className="input resize-none" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label={t('price')}>
          <input type="number" value={form.price} onChange={(e) => set('price', e.target.value)} className="input" />
        </Field>
        <Field label={t('comparePrice')}>
          <input type="number" value={form.comparePrice} onChange={(e) => set('comparePrice', e.target.value)} className="input" />
        </Field>
        <Field label={t('sku')}>
          <input dir="ltr" value={form.sku} onChange={(e) => set('sku', e.target.value)} className="input font-mono text-sm" />
        </Field>
        <Field label={t('stock')}>
          <input type="number" value={form.stock} onChange={(e) => set('stock', e.target.value)} className="input" />
        </Field>
      </div>

      <Field label={t('category')}>
        <select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} className="input">
          <option value="">{t('noCategory')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </Field>

      <Field label={t('tags')}>
        <input value={form.tags} onChange={(e) => set('tags', e.target.value)} className="input" />
      </Field>

      {/* Images (by URL) */}
      <Field label="Images">
        <div className="flex gap-2">
          <input dir="ltr" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" className="input font-mono text-sm" />
          <button
            type="button"
            onClick={() => {
              if (/^https?:\/\//.test(imageUrl)) {
                set('images', [...form.images, imageUrl])
                setImageUrl('')
              }
            }}
            className="shrink-0 rounded-xl border border-[var(--border-default)] px-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {form.images.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {form.images.map((img, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-default)] px-2 py-1 text-xs text-[var(--text-secondary)]">
                <span className="max-w-[160px] truncate font-mono">{img}</span>
                <button onClick={() => set('images', form.images.filter((_, j) => j !== i))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </Field>

      {/* Attributes */}
      <Field label={t('attributes')}>
        <div className="space-y-2">
          {form.attributes.map((attr, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={attr.key}
                onChange={(e) => set('attributes', form.attributes.map((a, j) => (j === i ? { ...a, key: e.target.value } : a)))}
                placeholder={t('attrKey')}
                className="input"
              />
              <input
                value={attr.value}
                onChange={(e) => set('attributes', form.attributes.map((a, j) => (j === i ? { ...a, value: e.target.value } : a)))}
                placeholder={t('attrValue')}
                className="input"
              />
              <button onClick={() => set('attributes', form.attributes.filter((_, j) => j !== i))} className="shrink-0 px-2 text-[var(--text-muted)] hover:text-danger">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => set('attributes', [...form.attributes, { key: '', value: '' }])}
            className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <Plus className="h-4 w-4" />
            {t('addAttr')}
          </button>
        </div>
      </Field>

      <button
        onClick={submit}
        disabled={submitting || !form.name.trim()}
        className="inline-flex items-center gap-2 rounded-xl bg-[var(--white)] px-5 py-2 text-sm font-medium text-[var(--bg-base)] transition-transform hover:scale-[1.02] disabled:opacity-50"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {mode === 'edit' ? t('save') : submitting ? t('creating') : t('create')}
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-[var(--text-secondary)]">{label}</span>
      {children}
    </label>
  )
}
