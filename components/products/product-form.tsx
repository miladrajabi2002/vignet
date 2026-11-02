'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUnsavedChangesGuard } from '@/lib/hooks/use-unsaved-changes-guard'
import { cn } from '@/lib/utils'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowRight, ChevronUp, ImageOff, Layers, Link2, ListChecks, Plus, Shirt, Sparkles, Star, Tag, Truck, X, type LucideIcon } from 'lucide-react'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'
import { Switch } from '@/components/ui/switch'
import { MaterialSelect } from '@/components/ui/material-select'
import { NumberField } from '@/components/admin/number-field'
import { SAVED_BEAT_MS, SaveButton, useSaveState } from '@/components/ui/save-button'
import { UploadDropzone, uploadFileWithProgress } from '@/components/ui/upload-dropzone'
import { ProductImage } from '@/components/products/product-image'

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
  /** Saved id — a WooCommerce variation id, or negative for hand-entered
   *  ones. Kept on save so carts, cards and payment links stay valid. */
  id?: number
  sku?: string
  /** Availability when stock is not tracked (blank stock field). */
  inStock?: boolean
}

export interface ProductFormData {
  id?: string
  name: string
  description: string
  price: string
  comparePrice: string
  sku: string
  stock: string
  /** Per-product low-stock alert level; blank = the workspace default. */
  lowStockThreshold?: string
  categoryId: string
  tags: string
  externalUrl: string
  /** SHIPPED asks the chat buyer for an address; the others do not. Missing = SHIPPED. */
  fulfillment?: 'SHIPPED' | 'DIGITAL' | 'SERVICE' | 'PICKUP'
  images: string[]
  attributes: { key: string; value: string }[]
  variations: VariationInput[]
  active: boolean
}

function newVariation(attributes: { key: string; value: string }[] = [{ key: '', value: '' }]): VariationInput {
  return {
    localId: `v_${Math.random().toString(36).slice(2, 10)}`,
    attributes,
    stock: '',
    price: '',
    image: '',
  }
}

type OptionRow = { name: string; values: string }

function splitValues(raw: string): string[] {
  return [...new Set(raw.split(/[,،|\n]/).map((value) => value.trim()).filter(Boolean))]
}

/** Every combination of the options («رنگ × سایز»), in the order typed. */
export function variantCombinations(options: OptionRow[]): Record<string, string>[] {
  const groups = options
    .map((option) => ({ name: option.name.trim(), values: splitValues(option.values) }))
    .filter((option) => option.name && option.values.length)
  if (!groups.length) return []
  return groups.reduce<Record<string, string>[]>(
    (combos, group) => combos.flatMap((combo) => group.values.map((value) => ({ ...combo, [group.name]: value }))),
    [{}],
  )
}

function sameCombo(variation: VariationInput, combo: Record<string, string>): boolean {
  const rows = variation.attributes.filter((a) => a.key.trim() && a.value.trim())
  return rows.length === Object.keys(combo).length && rows.every((a) => combo[a.key.trim()] === a.value.trim())
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
  const persianDigits = useLocale() !== 'en'
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
  // Compare against the form's own starting state: in create mode `initial` is
  // undefined, and snapshotting that made an untouched empty form look dirty.
  const [initialSnapshot] = useState(() => JSON.stringify(form))
  const formDirty = useMemo(() => JSON.stringify(form) !== initialSnapshot, [form, initialSnapshot])
  // Warn before leaving with unsaved product edits.
  useUnsavedChangesGuard(formDirty)

  const [imageUrl, setImageUrl] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [upgradeRequired, setUpgradeRequired] = useState(false)
  const saveState = useSaveState()

  const set = <K extends keyof ProductFormData>(k: K, v: ProductFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }))


  async function submit() {
    saveState.start()
    setFormError(null)
    setUpgradeRequired(false)
    // Build the attributes object. Manual attributes stay as flat string
    // values. If the form has any variations, we append them under the
    // `_variations` key so the storage shape matches what the WooCommerce
    // ingest produces — the product detail page, RAG formatter, and any
    // future UI all read variations from that single well-known location.
    const publicAttrs = Object.fromEntries(
      form.attributes.filter((a) => a.key.trim()).map((a) => [a.key, a.value]),
    )

    // Saved ids are kept; new hand-entered variations get fresh negative ids
    // (never a store id) that stay stable across later edits.
    const savedIds = form.variations.map((v) => v.id).filter((id): id is number => typeof id === 'number')
    let nextManualId = Math.min(0, ...savedIds) - 1
    const cleanVariations = form.variations
      .filter((v) => v.attributes.some((a) => a.key.trim() && a.value.trim()))
      .map((v) => {
        const attrs = Object.fromEntries(
          v.attributes
            .filter((a) => a.key.trim() && a.value.trim())
            .map((a) => [a.key.trim(), a.value.trim()]),
        )
        const stockNum = v.stock === '' ? null : Number(v.stock)
        const priceNum = v.price === '' ? null : Number(v.price)
        return {
          id: v.id ?? nextManualId--,
          ...(v.sku ? { sku: v.sku } : {}),
          attributes: attrs,
          stockQuantity: stockNum,
          manageStock: stockNum !== null,
          inStock: stockNum === null ? v.inStock !== false : stockNum > 0,
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
      lowStockThreshold: form.stock === '' || !form.lowStockThreshold ? null : Math.max(0, Math.round(Number(form.lowStockThreshold))),
      categoryId: form.categoryId || null,
      tags: form.tags ? form.tags.split(',').map((s) => s.trim()).filter(Boolean) : [],
      externalUrl: form.externalUrl || undefined,
      fulfillment: form.fulfillment ?? 'SHIPPED',
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
    ).catch(() => null)
    if (res?.ok) {
      // Let the button confirm the save before the page moves on.
      saveState.done()
      window.setTimeout(() => {
        router.push(returnTo ?? '/products')
        router.refresh()
      }, SAVED_BEAT_MS)
    } else {
      const result = await res?.json().catch(() => null) as { error?: string; limit?: number; upgradeUrl?: string } | null
      const isPlanLimit = result?.error === 'PRODUCT_LIMIT' || result?.error === 'PLAN_BLOCKED'
      setUpgradeRequired(isPlanLimit)
      setFormError(
        result?.error === 'PRODUCT_LIMIT' && result.limit
          ? t('productLimitReached', { limit: result.limit })
          : result?.error === 'PLAN_BLOCKED'
            ? t('planBlocked')
          : t('saveFailed'),
      )
      saveState.fail()
    }
  }

  const L = (fa: string, en: string) => (persianDigits ? fa : en)
  const num = (v: string | number) => Number(v).toLocaleString(persianDigits ? 'fa-IR' : 'en-US')
  const fulfillment = form.fulfillment ?? 'SHIPPED'
  const FULFILLMENTS = [
    ['SHIPPED', 'ارسال پستی یا پیک', 'Shipped', 'ایجنت آدرس و شماره تماس را می‌گیرد', 'The agent asks for an address and phone'],
    ['DIGITAL', 'دیجیتال (فایل، اشتراک، کد)', 'Digital', 'ایجنت آدرس نمی‌پرسد', 'The agent never asks for an address'],
    ['SERVICE', 'خدمت', 'Service', 'انجام کار یا مشاوره', 'A job or a consultation'],
    ['PICKUP', 'تحویل حضوری', 'Pickup', 'مشتری از فروشگاه تحویل می‌گیرد', 'The customer collects it in store'],
  ] as const
  const fulfillmentRow = FULFILLMENTS.find((row) => row[0] === fulfillment) ?? FULFILLMENTS[0]
  const categoryName = categories.find((c) => c.id === form.categoryId)?.name ?? t('noCategory')
  const tagList = form.tags.split(',').map((s) => s.trim()).filter(Boolean)
  const filledAttrs = form.attributes.filter((a) => a.key.trim())
  const unlimited = form.stock === ''

  // Which sections differ from what was loaded — names the save bar's count.
  const changedLabels = useMemo(() => {
    const base = JSON.parse(initialSnapshot) as ProductFormData
    const groups: [string, (keyof ProductFormData)[]][] = [
      [L('تصاویر', 'Images'), ['images']],
      [L('اطلاعات اصلی', 'Details'), ['name', 'description']],
      [L('قیمت', 'Price'), ['price', 'comparePrice']],
      [L('موجودی', 'Stock'), ['sku', 'stock', 'lowStockThreshold']],
      [L('نوع تحویل', 'Delivery'), ['fulfillment']],
      [L('مشخصات', 'Specs'), ['attributes']],
      [L('تنوع‌ها', 'Variations'), ['variations']],
      [L('دسته و تگ', 'Category & tags'), ['categoryId', 'tags']],
      [L('لینک', 'Link'), ['externalUrl']],
      [L('وضعیت', 'Status'), ['active']],
    ]
    return groups
      .filter(([, keys]) => keys.some((k) => JSON.stringify(form[k]) !== JSON.stringify(base[k])))
      .map(([label]) => label)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, initialSnapshot, persianDigits])

  const card = 'spatial-surface rounded-card p-4 sm:p-5'
  const cardTitle = 'text-[15px] font-medium text-[var(--text-primary)]'
  const cardHint = 'mt-1 text-[12.5px] leading-6 text-[var(--text-muted)]'

  return (
    <div className="space-y-4">
      {mode === 'edit' && (
        <div className="flex items-center gap-3.5">
          <div className="h-[76px] w-[76px] shrink-0 overflow-hidden rounded-[18px] bg-[var(--bg-muted)] md:h-[60px] md:w-[60px] md:rounded-2xl">
            {form.images[0] ? <ProductImage src={form.images[0]} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center text-[var(--text-muted)]"><ImageOff className="h-5 w-5" aria-hidden="true" /></span>}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-medium leading-7 text-[var(--text-primary)] md:text-[22px]">{form.name || t('namePlaceholder')}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs font-medium">
              <span className={cn('inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5', form.active ? 'bg-[#e8f4ec] text-[#11622f]' : 'bg-[var(--bg-muted)] text-[var(--text-secondary)]')}>
                <span className="h-[7px] w-[7px] rounded-full bg-current" aria-hidden="true" />{form.active ? L('فعال', 'Active') : L('غیرفعال', 'Inactive')}
              </span>
              <span className="inline-flex h-[26px] items-center rounded-full bg-[var(--bg-muted)] px-2.5 text-[var(--text-secondary)]">{unlimited ? L('نامحدود', 'Unlimited') : `${num(form.stock)} ${L('عدد', 'in stock')}`}</span>
              {form.price && <span className="inline-flex h-[26px] items-center rounded-full bg-[var(--bg-muted)] px-2.5 text-[var(--text-secondary)]">{num(form.price)} {t('priceUnit')}</span>}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 md:gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-5">
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-5">
          <section className={cn(card, 'max-lg:order-1')} aria-labelledby="pf-images">
            <h2 id="pf-images" className={cn(cardTitle, 'mb-1')}>{t('images')}</h2>
            <p className={cn(cardHint, 'mb-3 mt-0')}>{L('تصویر اول در کارت محصول و پاسخ ایجنت نشان داده می‌شود.', 'The first image is shown on the product card and in agent replies.')}</p>
        {form.images.length > 0 && (
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {form.images.map((img, i) => (
              <div key={`${img}-${i}`} className="group relative aspect-square overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-muted)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <ProductImage src={img} alt={`${form.name || t('images')} ${i + 1}`} className="h-full w-full object-cover" />
                {i === 0 && (
                  <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[12px] font-bold text-white backdrop-blur">
                    <Star className="h-3 w-3" aria-hidden="true" />{t('primaryImage')}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => set('images', form.images.filter((_, index) => index !== i))}
                  className="absolute end-2 top-2 grid h-11 w-11 place-items-center rounded-xl bg-white/90 text-black shadow-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  aria-label={t('removeImage')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Drag-and-drop image queue: real per-file progress, retry from the
            same file after a failure, and independent uploads — one failing
            image never discards the rest of the batch. */}
        <UploadDropzone<{ url?: string }>
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          maxFiles={Math.max(0, 10 - form.images.length)}
          upload={async (file, onProgress) => {
            const body = new FormData()
            body.set('file', file)
            const { response, status } = await uploadFileWithProgress('/api/uploads/products', body, onProgress)
            if (status === 401) throw new Error(t('imageUploadFailed'))
            const data = response as { url?: string } | null
            if (!data?.url) throw new Error(t('imageUploadFailed'))
            return data
          }}
          onFileUploaded={(_item, result) => {
            if (result.url) setForm((current) => ({ ...current, images: [...current.images, result.url!].slice(0, 10) }))
          }}
          labels={{
            dropHint: t('dropImagesHere'),
            formatsHint: t('imageHelp'),
            browse: t('uploadImages'),
            retry: t('retryUpload'),
            remove: t('removeImage'),
            failed: t('imageUploadFailed'),
          }}
        />

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
          </section>

          <section className={cn(card, 'space-y-4 max-lg:order-2')} aria-labelledby="pf-info">
            <h2 id="pf-info" className={cardTitle}>{L('اطلاعات اصلی', 'Details')}</h2>
            <Field label={t('name')} hint={t('nameHint')}>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={t('namePlaceholder')} className="input" />
            </Field>
            <Field label={t('description')} hint={L('ایجنت از همین متن برای جواب دادن به سؤال مشتری استفاده می‌کند.', 'The agent answers customer questions from this text.')}>
              <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={6} className="input min-h-[170px] resize-y py-3 leading-8" />
            </Field>
          </section>

          <section className={cn(card, 'max-lg:order-3')} aria-labelledby="pf-price">
            <h2 id="pf-price" className={cn(cardTitle, 'mb-4')}>{L('قیمت و موجودی', 'Price & stock')}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('price')}>
                <NumberField value={form.price} onChange={(raw) => set('price', raw)} unit={t('priceUnit')} persian={persianDigits} ariaLabel={t('price')} />
              </Field>
              <Field label={t('comparePrice')} optional={t('optional')} hint={t('comparePriceHint')}>
                <NumberField value={form.comparePrice} onChange={(raw) => set('comparePrice', raw)} unit={t('priceUnit')} persian={persianDigits} ariaLabel={t('comparePrice')} />
              </Field>
              <Field label={t('sku')}>
                <input dir="ltr" value={form.sku} onChange={(e) => set('sku', e.target.value)} className="input font-mono text-sm" />
              </Field>
              <Field label={t('stock')} hint={unlimited ? undefined : t('stockHint')}>
                <input type="number" inputMode="numeric" value={form.stock} disabled={unlimited} onChange={(e) => set('stock', e.target.value)} className="input disabled:opacity-50" />
              </Field>
              {!unlimited && (
                <Field label={t('lowStockThreshold')}>
                  <input
                    type="number"
                    min={0}
                    value={form.lowStockThreshold ?? ''}
                    onChange={(e) => set('lowStockThreshold', e.target.value)}
                    placeholder={t('lowStockThresholdPlaceholder')}
                    className="input"
                  />
                </Field>
              )}
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[var(--bg-muted)] px-3.5 py-3">
              <div className="min-w-0 flex-1 text-sm leading-7 text-[var(--text-primary)]">
                {L('موجودی نامحدود', 'Unlimited stock')}
                <span className="block text-xs text-[var(--text-muted)]">{L('برای خدمت، فایل یا محصولی که تمام نمی‌شود؛ ایجنت هیچ‌وقت «ناموجود» نمی‌گوید.', 'For services, files or anything that never runs out.')}</span>
              </div>
              <Switch checked={unlimited} onChange={(on) => set('stock', on ? '' : '0')} aria-label={L('موجودی نامحدود', 'Unlimited stock')} />
            </div>
          </section>

          <SheetSection
            className="max-lg:order-5"
            icon={ListChecks}
            title={t('attributes')}
            hint={L('ایجنت این‌ها را مثل جدول مشخصات جواب می‌دهد: «حجمش چقدره؟»', 'The agent answers from these like a spec table.')}
            summary={filledAttrs.length ? filledAttrs.map((a) => `${a.key}: ${a.value}`).join(' · ') : L('ندارد', 'None')}
            closeLabel={L('بستن', 'Close')}
            doneLabel={L('تأیید', 'Done')}
          >
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
          </SheetSection>

          <SheetSection
            className="max-lg:order-6"
            icon={Shirt}
            size="large"
            title={t('variations')}
            summary={form.variations.length ? `${num(form.variations.length)} ${L('تنوع', 'variations')}` : L('ندارد · رنگ یا سایز اضافه کنید', 'None · add colors or sizes')}
            closeLabel={L('بستن', 'Close')}
            doneLabel={L('تأیید', 'Done')}
          >
        <div className="space-y-3">
          <VariantBuilder
            onGenerate={(combos) => setForm((current) => {
              const kept = current.variations.filter((v) => !combos.some((combo) => sameCombo(v, combo)))
              const generated = combos.map((combo) =>
                current.variations.find((v) => sameCombo(v, combo))
                  ?? newVariation(Object.entries(combo).map(([key, value]) => ({ key, value }))))
              return { ...current, variations: [...generated, ...kept] }
            })}
          />
          {form.variations.length > 1 && (
            <BulkVariationFill
              onApply={(field, value) => set('variations', form.variations.map((v) => ({ ...v, [field]: value })))}
            />
          )}
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
              {form.images.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label={t('variationImage')}>
                  <span className="me-1 text-xs text-[var(--text-muted)]">{t('variationImage')}:</span>
                  <button
                    type="button"
                    onClick={() => set('variations', form.variations.map((vv, j) => (j === i ? { ...vv, image: '' } : vv)))}
                    aria-pressed={!v.image}
                    title={t('noVariationImage')}
                    className={`grid h-11 w-11 place-items-center rounded-lg border text-[var(--text-muted)] ${!v.image ? 'border-[var(--text-primary)]' : 'border-[var(--border-default)]'}`}
                  >
                    <ImageOff className="h-4 w-4" />
                  </button>
                  {form.images.map((img) => (
                    <button
                      key={img}
                      type="button"
                      onClick={() => set('variations', form.variations.map((vv, j) => (j === i ? { ...vv, image: img } : vv)))}
                      aria-pressed={v.image === img}
                      className={`h-11 w-11 overflow-hidden rounded-lg border-2 ${v.image === img ? 'border-[var(--text-primary)]' : 'border-transparent'}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <ProductImage src={img} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
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
          </SheetSection>
        </div>

        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-5">
          <section className={cn(card, 'max-lg:order-9')} aria-labelledby="pf-status">
            <div className="flex items-center justify-between gap-3">
              <h2 id="pf-status" className={cardTitle}>{L('وضعیت', 'Status')}</h2>
              <Switch checked={form.active} onChange={(on) => set('active', on)} aria-label={L('محصول فعال است', 'Product is active')} />
            </div>
            <p className={cardHint}>
              {form.active ? L('فعال — ایجنت‌ها این محصول را در گفتگو به مشتری پیشنهاد می‌دهند.', 'Active — agents offer this product in chats.') : L('غیرفعال — ایجنت‌ها این محصول را پیشنهاد نمی‌دهند.', 'Inactive — agents will not offer this product.')}
            </p>
          </section>

          <SheetSection
            className="max-lg:order-4"
            icon={Truck}
            title={L('نوع تحویل', 'Delivery')}
            hint={L('فقط برای «ارسال پستی» ایجنت در گفتگو آدرس می‌پرسد.', 'The agent asks for an address only for shipped products.')}
            summary={persianDigits ? fulfillmentRow[1] : fulfillmentRow[2]}
            closeLabel={L('بستن', 'Close')}
            doneLabel={L('تأیید', 'Done')}
          >
            <div role="radiogroup" aria-label={L('نوع تحویل', 'Delivery')} className="flex flex-col gap-2">
              {FULFILLMENTS.map(([value, fa, en, faHint, enHint]) => {
                const on = fulfillment === value
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set('fulfillment', value)}
                    className={cn('flex min-h-14 items-center gap-3 rounded-2xl border px-3.5 py-2 text-start transition-colors', on ? 'border-[var(--text-primary)] shadow-[inset_0_0_0_1px_var(--text-primary)]' : 'border-[var(--border-default)] hover:border-[var(--border-strong)]')}
                  >
                    <span className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-full border-2', on ? 'border-[var(--text-primary)]' : 'border-[var(--border-strong)]')} aria-hidden="true">
                      {on && <span className="h-2.5 w-2.5 rounded-full bg-[var(--text-primary)]" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[var(--text-primary)]">{persianDigits ? fa : en}</span>
                      <span className="block text-xs text-[var(--text-muted)]">{persianDigits ? faHint : enHint}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </SheetSection>

          <SheetSection
            className="max-lg:order-7"
            icon={Tag}
            title={`${t('category')} ${L('و', '&')} ${t('tags')}`}
            summary={`${categoryName} · ${tagList.length ? tagList.join('، ') : L('بدون تگ', 'No tags')}`}
            closeLabel={L('بستن', 'Close')}
            doneLabel={L('تأیید', 'Done')}
          >
            <div className="space-y-4">
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
              <Field label={t('tags')} hint={L('با کاما جدا کنید.', 'Separate with commas.')}>
                <input value={form.tags} onChange={(e) => set('tags', e.target.value)} className="input" />
              </Field>
            </div>
          </SheetSection>

          <SheetSection
            className="max-lg:order-8"
            icon={Link2}
            title={L('لینک و شناسه', 'Link & ID')}
            summary={form.externalUrl ? form.externalUrl.replace(/^https?:\/\//, '') : L('بدون لینک', 'No link')}
            summaryLtr
            closeLabel={L('بستن', 'Close')}
            doneLabel={L('تأیید', 'Done')}
          >
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
            {form.id && (
              <p className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-3 text-[13px] text-[var(--text-muted)]">
                {L('شناسه', 'ID')}
                <span dir="ltr" className="truncate font-mono text-xs text-[var(--text-secondary)]">{form.id}</span>
              </p>
            )}
          </SheetSection>
        </div>
      </div>

      {formError && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-danger/25 bg-danger/5 p-3 text-sm text-danger sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1 leading-6">{formError}</p>
          {upgradeRequired && (
            <Link
              href="/billing#vigent-plans"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-black px-4 text-xs font-bold text-white"
            >
              {t('upgradePlan')}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </Link>
          )}
        </div>
      )}

      <div
        data-sticky-actions
        className="sticky z-30 flex items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-white/95 p-2 ps-4 shadow-[var(--elev-2)] backdrop-blur [bottom:calc(5.75rem+env(safe-area-inset-bottom))] md:bottom-3 md:z-10"
      >
        <div className="min-w-0 flex-1 text-[12.5px] leading-6">
          {mode === 'edit' && changedLabels.length > 0 ? (
            <>
              <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
                <span className="h-[7px] w-[7px] rounded-full bg-amber-600" aria-hidden="true" />
                {num(changedLabels.length)} {L('تغییر ذخیره نشده', 'unsaved changes')}
              </span>
              <span className="block truncate text-[var(--text-muted)]">{changedLabels.join('، ')}</span>
            </>
          ) : (
            <span className="text-[var(--text-muted)]">{mode === 'edit' ? L('همه تغییرات ذخیره شده', 'All changes saved') : ''}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => router.push(returnTo ?? '/products')}
          className="min-h-11 shrink-0 rounded-xl border border-[var(--border-default)] bg-white px-4 text-sm font-bold text-[var(--text-primary)] hover:border-[var(--border-strong)]"
        >
          {L('انصراف', 'Cancel')}
        </button>
        <SaveButton
          state={saveState.state}
          onClick={submit}
          disabled={!form.name.trim() || (mode === 'edit' && !formDirty)}
          label={mode === 'edit' ? t('save') : returnTo ? t('saveAndContinue') : t('create')}
          savingLabel={mode === 'edit' ? undefined : t('creating')}
          className="shrink-0"
        />
      </div>
    </div>
  )
}

/**
 * Wide screens: a plain card. Phones: a one-line row (title + what is set)
 * that opens the same fields in a sheet rising from the bottom.
 */
function SheetSection({
  icon: Icon,
  title,
  hint,
  summary,
  summaryLtr,
  size = 'auto',
  closeLabel,
  doneLabel,
  className,
  children,
}: {
  icon: LucideIcon
  title: string
  hint?: string
  summary: string
  summaryLtr?: boolean
  size?: 'auto' | 'large'
  closeLabel: string
  doneLabel: string
  className?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  return (
    <div className={className}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="spatial-surface flex min-h-16 w-full items-center gap-3 rounded-card px-4 py-3 text-start md:hidden"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--bg-muted)] text-[var(--text-secondary)]">
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium text-[var(--text-primary)]">{title}</span>
          <span dir={summaryLtr ? 'ltr' : undefined} className={cn('mt-0.5 block truncate text-[12.5px] text-[var(--text-muted)]', summaryLtr && 'text-end')}>{summary}</span>
        </span>
        <ChevronUp className="h-[18px] w-[18px] shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
      </button>

      <MobileBottomSheet
        open={open}
        title={title}
        description={hint}
        closeLabel={closeLabel}
        size={size}
        triggerRef={triggerRef}
        onClose={() => setOpen(false)}
        footer={
          <button type="button" onClick={() => setOpen(false)} className="min-h-12 w-full rounded-xl bg-black px-4 text-sm font-bold text-white">
            {doneLabel}
          </button>
        }
      >
        {children}
      </MobileBottomSheet>

      <section className="spatial-surface hidden rounded-card p-5 md:block" aria-label={title}>
        <h2 className="text-[15px] font-medium text-[var(--text-primary)]">{title}</h2>
        {hint && <p className="mb-3 mt-1 text-[12.5px] leading-6 text-[var(--text-muted)]">{hint}</p>}
        <div className={hint ? undefined : 'mt-3'}>{children}</div>
      </section>
    </div>
  )
}

/** «رنگ: مشکی، سفید» × «سایز: S، M، L» → six variations in one click. */
function VariantBuilder({ onGenerate }: { onGenerate: (combos: Record<string, string>[]) => void }) {
  const t = useTranslations('products.form')
  const [options, setOptions] = useState<OptionRow[]>([{ name: '', values: '' }, { name: '', values: '' }])
  const combos = variantCombinations(options)
  return (
    <details className="group rounded-xl border border-dashed border-[var(--border-default)] p-3">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
        <Sparkles className="h-4 w-4 text-[var(--text-secondary)]" />
        {t('variantBuilder')}
      </summary>
      <p className="mt-1 text-xs leading-6 text-[var(--text-muted)]">{t('variantBuilderHint')}</p>
      <div className="mt-3 space-y-2">
        {options.map((option, i) => (
          <div key={i} className="flex flex-col gap-2 sm:flex-row">
            <input
              value={option.name}
              onChange={(e) => setOptions(options.map((o, j) => (j === i ? { ...o, name: e.target.value } : o)))}
              placeholder={t('optionName')}
              aria-label={t('optionName')}
              className="input sm:max-w-[180px]"
            />
            <input
              value={option.values}
              onChange={(e) => setOptions(options.map((o, j) => (j === i ? { ...o, values: e.target.value } : o)))}
              placeholder={t('optionValues')}
              aria-label={t('optionValues')}
              className="input"
            />
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOptions([...options, { name: '', values: '' }])}
            className="inline-flex min-h-11 items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <Plus className="h-4 w-4" />
            {t('addOption')}
          </button>
          <button
            type="button"
            disabled={!combos.length}
            onClick={() => onGenerate(combos)}
            className="ms-auto inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-black px-4 text-sm font-bold text-white disabled:opacity-40"
          >
            <Layers className="h-4 w-4" />
            {t('generateVariations', { count: combos.length })}
          </button>
        </div>
      </div>
    </details>
  )
}

/** Stock or price for every variation at once. */
function BulkVariationFill({ onApply }: { onApply: (field: 'stock' | 'price', value: string) => void }) {
  const t = useTranslations('products.form')
  const [stock, setStock] = useState('')
  const [price, setPrice] = useState('')
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {([
        ['stock', stock, setStock, t('bulkStock')],
        ['price', price, setPrice, t('bulkPrice')],
      ] as const).map(([field, value, setValue, label]) => (
        <div key={field} className="flex gap-2">
          <input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder={label} aria-label={label} className="input" />
          <button
            type="button"
            disabled={value === ''}
            onClick={() => onApply(field, value)}
            className="min-h-11 shrink-0 rounded-xl border border-[var(--border-default)] px-3 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40"
          >
            {t('applyToAll')}
          </button>
        </div>
      ))}
    </div>
  )
}

function Field({ label, hint, optional, children }: { label: string; hint?: string; optional?: string; children: React.ReactNode }) {
  return (
    <fieldset className="block min-w-0">
      <legend className="ui-field-label">
        {label}
        {optional ? <span className="ui-field-opt">{optional}</span> : null}
      </legend>
      {children}
      {hint ? <p className="ui-field-hint">{hint}</p> : null}
    </fieldset>
  )
}
