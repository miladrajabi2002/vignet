'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2, Plus, X, Layers } from 'lucide-react'
import { MaterialSelect } from '@/components/ui/material-select'

export interface CategoryOption {
  id: string
  name: string
}

/**
 * Manual variation entry — mirrors the shape persisted under
 * `attributes._variations` by the WooCommerce ingest
 * (see lib/integrations/woocommerce.ts → mapWooProduct).
 *
 * The form intentionally keeps it minimal: the merchant picks attribute
 * pairs (e.g. رنگ=آبی) and a stock count. Price and image are optional
 * and default to the parent product's values when left blank.
 */
export interface VariationInput {
  /** Stable client-side id (used as React key; not sent to the server). */
  localId: string
  /** Attribute pairs that distinguish this variant. */
  attributes: { key: string; value: string }[]
  /** Stock count; empty string = "not tracked / unlimited". */
  stock: string
  /** Optional per-variant price (overrides parent). */
  price: string
  /** Optional per-variant image URL. */
  image: string
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
  externalUrl: string
  images: string[]
  attributes: { key: string; value: string }[]
  variations: VariationInput[]
  active: boolean
}

function newVariation(): VariationInput {
  return {
    localId: `v_${Math.random().toString(36).slice(2, 10)}`,
    attributes: [{ key: '', value: '' }],
    stock: '',
    price: '',
    image: '',
  }
}

export function ProductForm({
  mode,
  categories,
  initial,
  returnTo,
}: {
  mode: 'create' | 'edit'
  categories: CategoryOption[]
  initial?: ProductFormData
  returnTo?: string
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
      externalUrl: '',
      images: [],
      attributes: [],
      variations: [],
      active: true,
    },
  )
  const [imageUrl, setImageUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const set = <K extends keyof ProductFormData>(k: K, v: ProductFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  async function submit() {
    setSubmitting(true)
    // Build the attributes object. Manual attributes stay as flat string
    // values. If the form has any variations, we append them under the
    // `_variations` key so the storage shape matches what the WooCommerce
    // ingest produces — the product detail page, RAG formatter, and any
    // future UI all read variations from that single well-known location.
    const publicAttrs = Object.fromEntries(
      form.attributes.filter((a) => a.key.trim()).map((a) => [a.key, a.value]),
    )

    const cleanVariations = form.variations
      .filter((v) => v.attributes.some((a) => a.key.trim() && a.value.trim()))
      .map((v, idx) => {
        const attrs = Object.fromEntries(
          v.attributes
            .filter((a) => a.key.trim() && a.value.trim())
            .map((a) => [a.key.trim(), a.value.trim()]),
        )
        const stockNum = v.stock === '' ? null : Number(v.stock)
        const priceNum = v.price === '' ? null : Number(v.price)
        return {
          // Use a negative synthetic id for manual variations to avoid
          // colliding with WooCommerce variation IDs (which are positive).
          // The id is only used as a React key in the detail page; it never
          // maps back to a real WooCommerce entity.
          id: -(idx + 1),
          attributes: attrs,
          stockQuantity: stockNum,
          manageStock: stockNum !== null,
          inStock: stockNum === null ? true : stockNum > 0,
          ...(priceNum != null && priceNum > 0 ? { price: priceNum } : {}),
          ...(v.image.trim() ? { image: v.image.trim() } : {}),
        }
      })

    const attributes =
      Object.keys(publicAttrs).length || cleanVariations.length
        ? {
            ...publicAttrs,
            ...(cleanVariations.length > 0 ? { _variations: cleanVariations } : {}),
          }
        : undefined

    const payload = {
      name: form.name,
      description: form.description || undefined,
      price: form.price ? Number(form.price) : null,
      comparePrice: form.comparePrice ? Number(form.comparePrice) : null,
      sku: form.sku || undefined,
      stock: form.stock === '' ? null : Number(form.stock),
      categoryId: form.categoryId || null,
      tags: form.tags ? form.tags.split(',').map((s) => s.trim()).filter(Boolean) : [],
      externalUrl: form.externalUrl || undefined,
      images: form.images,
      attributes,
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
      router.push(returnTo ?? '/products')
      router.refresh()
    } else {
      setSubmitting(false)
    }
  }

  return (
    <div className="spatial-surface space-y-5 rounded-[1.5rem] p-6">
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
        <MaterialSelect
          value={form.categoryId}
          onValueChange={(value) => set('categoryId', value)}
          ariaLabel={t('category')}
          options={[
            { value: '', label: t('noCategory') },
            ...categories.map((category) => ({ value: category.id, label: category.name })),
          ]}
        />
      </Field>

      <Field label={t('externalUrl')}>
        <input
          dir="ltr"
          value={form.externalUrl}
          onChange={(e) => set('externalUrl', e.target.value)}
          placeholder="https://shop.example.com/product/…"
          className="input font-mono text-sm"
          type="url"
        />
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

      {/* Variations — manual variable-product entry.
          Lets the merchant define per-variant combinations (e.g. each color
          with its own stock count). Stored under `attributes._variations`,
          the same shape the WooCommerce ingest writes, so the detail page,
          RAG formatter, and AI all read variations from one place. */}
      <Field label={t('variations')}>
        <div className="space-y-3">
          {form.variations.map((v, i) => (
            <div key={v.localId} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-muted)] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)]">
                  {t('variation')} {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => set('variations', form.variations.filter((_, j) => j !== i))}
                  className="text-[var(--text-muted)] hover:text-danger"
                  aria-label={t('removeVariation')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {/* Attribute pairs for this variation */}
              <div className="space-y-2">
                {v.attributes.map((attr, ai) => (
                  <div key={ai} className="flex gap-2">
                    <input
                      value={attr.key}
                      onChange={(e) => set('variations', form.variations.map((vv, j) => (j === i ? { ...vv, attributes: vv.attributes.map((a, k) => (k === ai ? { ...a, key: e.target.value } : a)) } : vv)))}
                      placeholder={t('attrKey')}
                      className="input"
                    />
                    <input
                      value={attr.value}
                      onChange={(e) => set('variations', form.variations.map((vv, j) => (j === i ? { ...vv, attributes: vv.attributes.map((a, k) => (k === ai ? { ...a, value: e.target.value } : a)) } : vv)))}
                      placeholder={t('attrValue')}
                      className="input"
                    />
                    <button
                      type="button"
                      onClick={() => set('variations', form.variations.map((vv, j) => (j === i ? { ...vv, attributes: vv.attributes.filter((_, k) => k !== ai) } : vv)))}
                      className="shrink-0 px-2 text-[var(--text-muted)] hover:text-danger"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => set('variations', form.variations.map((vv, j) => (j === i ? { ...vv, attributes: [...vv.attributes, { key: '', value: '' }] } : vv)))}
                  className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('addAttr')}
                </button>
              </div>
              {/* Stock + price + image for this variation */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                <input
                  type="number"
                  value={v.stock}
                  onChange={(e) => set('variations', form.variations.map((vv, j) => (j === i ? { ...vv, stock: e.target.value } : vv)))}
                  placeholder={t('stock')}
                  className="input"
                />
                <input
                  type="number"
                  value={v.price}
                  onChange={(e) => set('variations', form.variations.map((vv, j) => (j === i ? { ...vv, price: e.target.value } : vv)))}
                  placeholder={t('price')}
                  className="input"
                />
                <input
                  dir="ltr"
                  value={v.image}
                  onChange={(e) => set('variations', form.variations.map((vv, j) => (j === i ? { ...vv, image: e.target.value } : vv)))}
                  placeholder="https://…"
                  className="input font-mono text-xs"
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => set('variations', [...form.variations, newVariation()])}
            className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[var(--border-default)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <Layers className="h-4 w-4" />
            {t('addVariation')}
          </button>
        </div>
      </Field>

      <button
        onClick={submit}
        disabled={submitting || !form.name.trim()}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-black px-5 text-sm font-bold text-white shadow-[var(--shadow-control)] transition-transform hover:-translate-y-0.5 disabled:opacity-50 motion-reduce:transform-none"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {mode === 'edit' ? t('save') : submitting ? t('creating') : returnTo ? 'ذخیره و ادامه' : t('create')}
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
