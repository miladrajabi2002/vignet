'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ImagePlus, Layers, Loader2, Plus, Star, X } from 'lucide-react'
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
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const set = <K extends keyof ProductFormData>(k: K, v: ProductFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  async function uploadImages(files: FileList | null) {
    if (!files?.length || form.images.length >= 10) return
    setUploadingImage(true)
    setImageError(null)
    const available = 10 - form.images.length
    const nextUrls: string[] = []
    try {
      for (const file of Array.from(files).slice(0, available)) {
        const body = new FormData()
        body.set('file', file)
        const response = await fetch('/api/uploads/products', { method: 'POST', body })
        if (!response.ok) throw new Error('UPLOAD_FAILED')
        const data = await response.json() as { url?: string }
        if (!data.url) throw new Error('UPLOAD_FAILED')
        nextUrls.push(data.url)
      }
      setForm((current) => ({ ...current, images: [...current.images, ...nextUrls].slice(0, 10) }))
    } catch {
      setImageError(t('imageUploadFailed'))
    } finally {
      setUploadingImage(false)
    }
  }

  async function submit() {
    setSubmitting(true)
    setFormError(null)
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
      const result = await res.json().catch(() => null) as { error?: string; limit?: number } | null
      setFormError(
        result?.error === 'PRODUCT_LIMIT' && result.limit
          ? t('productLimitReached', { limit: result.limit })
          : t('saveFailed'),
      )
      setSubmitting(false)
    }
  }

  return (
    <div className="spatial-surface space-y-5 rounded-[1.5rem] p-4 sm:p-6">
      <Field label={t('name')}>
        <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={t('namePlaceholder')} className="input" />
      </Field>
      <Field label={t('description')}>
        <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} className="input resize-none" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
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

      <Field label={t('images')}>
        {form.images.length > 0 && (
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {form.images.map((img, i) => (
              <div key={`${img}-${i}`} className="group relative aspect-square overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-muted)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt={`${form.name || t('images')} ${i + 1}`} className="h-full w-full object-cover" />
                {i === 0 && (
                  <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
                    <Star className="h-3 w-3" aria-hidden="true" />{t('primaryImage')}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => set('images', form.images.filter((_, index) => index !== i))}
                  className="absolute end-2 top-2 grid h-11 w-11 place-items-center rounded-xl bg-white/90 text-black shadow-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                  aria-label={t('removeImage')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-muted)]/60 p-4">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-black px-4 text-sm font-bold text-white transition-opacity hover:opacity-90 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
            {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {t('uploadImages')}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              multiple
              disabled={uploadingImage || form.images.length >= 10}
              className="sr-only"
              onChange={(event) => {
                void uploadImages(event.target.files)
                event.target.value = ''
              }}
            />
          </label>
          <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{t('imageHelp')}</p>
        </div>

        <div className="mt-3 flex gap-2">
          <input aria-label={t('imageUrl')} dir="ltr" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder={t('imageUrl')} className="input font-mono text-sm" />
          <button
            type="button"
            aria-label={t('imageUrl')}
            disabled={form.images.length >= 10}
            onClick={() => {
              if (/^https?:\/\//.test(imageUrl) && form.images.length < 10) {
                set('images', [...form.images, imageUrl])
                setImageUrl('')
              }
            }}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {imageError && <p role="alert" className="mt-2 text-sm text-danger">{imageError}</p>}
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
              <button type="button" onClick={() => set('attributes', form.attributes.filter((_, j) => j !== i))} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--text-muted)] hover:bg-danger/5 hover:text-danger" aria-label={t('removeAttribute')}>
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
                  className="grid h-11 w-11 place-items-center rounded-xl text-[var(--text-muted)] hover:bg-danger/5 hover:text-danger"
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
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--text-muted)] hover:bg-danger/5 hover:text-danger"
                      aria-label={t('removeAttribute')}
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
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
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

      {formError && (
        <p role="alert" className="rounded-xl border border-danger/25 bg-danger/5 p-3 text-sm text-danger">
          {formError}
        </p>
      )}

      <button
        onClick={submit}
        disabled={submitting || !form.name.trim()}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-black px-5 text-sm font-bold text-white shadow-[var(--shadow-control)] transition-transform hover:-translate-y-0.5 disabled:opacity-50 motion-reduce:transform-none sm:w-auto"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {mode === 'edit' ? t('save') : submitting ? t('creating') : returnTo ? 'ذخیره و ادامه' : t('create')}
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="block min-w-0">
      <legend className="mb-2 block text-sm text-[var(--text-secondary)]">{label}</legend>
      {children}
    </fieldset>
  )
}
