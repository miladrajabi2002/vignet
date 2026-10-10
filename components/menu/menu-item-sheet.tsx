'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, ImagePlus, Loader2, Plus, RefreshCw, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toEnglishDigits } from '@/lib/phone'
import { queueUndo } from '@/lib/undo-queue'
import { SideSheet } from '@/components/ui/side-sheet'
import { Switch } from '@/components/ui/switch'
import { MaterialSelect } from '@/components/ui/material-select'
import { SAVED_BEAT_MS, SaveButton, useSaveState } from '@/components/ui/save-button'
import { uploadFileWithProgress } from '@/components/ui/upload-dropzone'
import { ProductImage } from '@/components/products/product-image'
import { BADGE_LABELS, badgeTag, badgesFromTags, withoutBadge, type MenuBadge } from '@/lib/menu/settings'
import type { MenuCategory, MenuItem } from '@/components/menu/menu-workspace'

/** Above this many categories the chips become a dropdown. */
const CHIP_LIMIT = 10
const fa = (value: number) => value.toLocaleString('fa-IR')
const digits = (value: string) => toEnglishDigits(value).replace(/\D/g, '').slice(0, 12)

/**
 * The menu's own item editor. A menu item is a product row, but a restaurant
 * only needs a photo, a name, a price, a category and a line of description —
 * so this writes to /api/products with just those, and leaves SKU, variations
 * and counted stock to the full product form.
 */
export function MenuItemSheet({
  item,
  categories,
  defaultCategoryId,
  onClose,
  onSaved,
  onDeleted,
  onCategoryCreated,
}: {
  /** null = a new item. */
  item: MenuItem | null
  categories: MenuCategory[]
  defaultCategoryId?: string
  onClose: () => void
  onSaved: (item: MenuItem) => void
  onDeleted: (id: string) => void
  onCategoryCreated: (category: MenuCategory) => void
}) {
  const [name, setName] = useState(item?.name ?? '')
  const [price, setPrice] = useState(item?.price != null ? String(Math.round(item.price)) : '')
  const [comparePrice, setComparePrice] = useState(item?.comparePrice != null ? String(Math.round(item.comparePrice)) : '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? defaultCategoryId ?? '')
  const [image, setImage] = useState(item?.image ?? '')
  const [tags, setTags] = useState(item?.tags ?? [])
  const [active, setActive] = useState(item?.active ?? true)
  const [soldOut, setSoldOut] = useState(item?.stock === 0)
  const [error, setError] = useState<{ text: string; upgrade?: boolean } | null>(null)
  const [added, setAdded] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const saveState = useSaveState()
  const nameInput = useRef<HTMLInputElement>(null)
  const closeTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  const badges = badgesFromTags(tags)
  // Counted stock belongs to the full product form; here it is only in / out.
  const countedStock = item?.stock != null && item.stock > 0 ? item.stock : null

  async function save(another: boolean) {
    const cleanName = name.trim()
    const priceValue = price ? Number(price) : null
    const compareValue = priceValue != null && comparePrice ? Number(comparePrice) : null
    if (!cleanName) {
      setError({ text: 'نام آیتم را بنویسید.' })
      nameInput.current?.focus()
      return
    }
    if (priceValue != null && compareValue != null && compareValue <= priceValue) {
      setError({ text: 'قیمت قبل از تخفیف باید از قیمت فعلی بیشتر باشد.' })
      return
    }
    setError(null)
    setAdded('')
    saveState.start()

    const cleanDescription = description.trim()
    const images = image ? [image, ...(item?.images.slice(1) ?? [])] : item?.images.slice(1) ?? []
    const stock = countedStock ?? (soldOut ? 0 : null)
    const response = await fetch(item ? `/api/products/${item.id}` : '/api/products', {
      method: item ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: cleanName,
        description: item ? cleanDescription : cleanDescription || undefined,
        price: priceValue,
        comparePrice: compareValue,
        categoryId: categoryId || null,
        tags,
        active,
        ...(countedStock == null ? { stock } : {}),
        // Other photos of a synced product stay untouched unless this one changed.
        ...(!item || image !== (item.image ?? '') ? { images } : {}),
      }),
    }).catch(() => null)
    const body = await response?.json().catch(() => null) as { product?: { id: string } } | null

    if (!response?.ok || !body?.product) {
      saveState.fail()
      setError(
        response?.status === 402
          ? { text: 'پلن فضای کاری فعال نیست؛ برای تغییر منو، پلن را تمدید کنید.', upgrade: true }
          : response?.status === 409
            ? { text: 'به سقف تعداد آیتم پلن رسیده‌اید.', upgrade: true }
            : { text: 'ذخیره نشد؛ دوباره تلاش کنید.' },
      )
      return
    }

    onSaved({
      id: body.product.id,
      name: cleanName,
      description: cleanDescription || null,
      price: priceValue,
      comparePrice: compareValue,
      stock,
      image: images[0] ?? null,
      images,
      categoryId: categoryId || null,
      active,
      synced: item?.synced ?? false,
      tags,
    })

    if (another) {
      // Entering a whole menu: keep the category, clear the rest.
      saveState.fail()
      setAdded(cleanName)
      setName('')
      setPrice('')
      setComparePrice('')
      setDescription('')
      setImage('')
      setTags([])
      setSoldOut(false)
      nameInput.current?.focus()
      return
    }
    saveState.done()
    closeTimer.current = window.setTimeout(onClose, SAVED_BEAT_MS)
  }

  async function remove() {
    if (!item) return
    setError(null)
    setDeleting(true)
    const response = await fetch(`/api/products/${item.id}`, { method: 'DELETE' }).catch(() => null)
    setDeleting(false)
    if (!response?.ok) {
      setConfirmDelete(false)
      setError({ text: 'حذف نشد؛ دوباره تلاش کنید.' })
      return
    }
    // Same undo offer as every other delete in the panel.
    queueUndo('product', [item.id], 'آیتم')
    onDeleted(item.id)
    onClose()
  }

  return (
    <SideSheet
      title={item ? 'ویرایش آیتم منو' : 'آیتم جدید منو'}
      subtitle="همین‌ها را مشتری در منو می‌بیند."
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2">
          <SaveButton state={saveState.state} label={item ? 'ذخیره' : 'افزودن به منو'} onClick={() => void save(false)} className="flex-1 sm:flex-none" />
          {!item && (
            <button type="button" disabled={saveState.state !== 'idle'} onClick={() => void save(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-control border border-[var(--border-default)] bg-white px-4 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] disabled:opacity-50">
              <Plus className="h-4 w-4" />ذخیره و آیتم بعدی
            </button>
          )}
        </div>
      }
    >
      <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); void save(false) }}>
        {added && (
          <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-500/[0.07] px-3 py-2.5 text-[13px] font-medium text-emerald-900">
            <Check className="h-4 w-4 shrink-0" />«{added}» به منو اضافه شد. آیتم بعدی را وارد کنید.
          </p>
        )}
        {item?.synced && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-500/[0.08] px-3 py-2.5 text-[13px] leading-6 text-amber-900">
            <RefreshCw className="mt-1 h-3.5 w-3.5 shrink-0" />این آیتم از فروشگاه متصل آمده است؛ همگام‌سازی بعدی ممکن است نام، قیمت و عکس را بازنویسی کند.
          </p>
        )}

        <PhotoField value={image} onChange={setImage} />

        <label className="block">
          <span className="mb-1.5 block text-[13px] text-[var(--text-secondary)]">نام آیتم</span>
          <input ref={nameInput} data-sheet-initial-focus={item ? undefined : ''} value={name} maxLength={160} onChange={(event) => setName(event.target.value)} placeholder="مثلاً چلوکباب کوبیده" className="input w-full" />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <PriceField label="قیمت (تومان)" value={price} onChange={setPrice} empty="بدون قیمت: «برای قیمت پیام دهید»" />
          <PriceField label="قبل از تخفیف (اختیاری)" value={comparePrice} onChange={setComparePrice} disabled={!price} />
        </div>

        <CategoryField
          categories={categories}
          value={categoryId}
          onChange={setCategoryId}
          onCreated={(category) => { onCategoryCreated(category); setCategoryId(category.id) }}
        />

        <label className="block">
          <span className="mb-1.5 block text-[13px] text-[var(--text-secondary)]">توضیح یا مواد تشکیل‌دهنده (اختیاری)</span>
          <textarea value={description} maxLength={600} rows={3} onChange={(event) => setDescription(event.target.value)} placeholder="دو سیخ کوبیدهٔ گوسفندی، برنج ایرانی، گوجهٔ کبابی" className="input w-full resize-none leading-7" />
        </label>

        <div>
          <p className="mb-1.5 text-[13px] text-[var(--text-secondary)]">برچسب روی منو</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="برچسب‌های آیتم">
            {(Object.keys(BADGE_LABELS) as MenuBadge[]).map((badge) => {
              const on = badges.includes(badge)
              return (
                <button key={badge} type="button" aria-pressed={on} onClick={() => setTags(on ? withoutBadge(tags, badge) : [...tags, badgeTag(badge)])} className={chip(on)}>
                  {BADGE_LABELS[badge]}
                </button>
              )
            })}
          </div>
        </div>

        <div className="divide-y divide-[var(--border-subtle)] rounded-2xl border border-[var(--border-subtle)] px-3.5">
          <ToggleRow title="نمایش در منو" description="خاموش که باشد، مشتری این آیتم را نمی‌بیند." checked={active} onChange={setActive} />
          {countedStock == null ? (
            <ToggleRow title="امروز تمام شده" description="در منو می‌ماند، با برچسب «تمام شد»." checked={soldOut} onChange={setSoldOut} />
          ) : (
            <p className="py-3 text-[13px] leading-6 text-[var(--text-muted)]">موجودی این آیتم شمارش می‌شود ({fa(countedStock)} عدد) و با رسیدن به صفر خودش «تمام شد» می‌شود.</p>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2.5 text-[13px] font-medium text-red-700">
            {error.text}{error.upgrade && <> <Link href="/billing#vigent-plans" className="font-bold underline underline-offset-4">دیدن پلن‌ها</Link></>}
          </p>
        )}

        {item && (
          <div className="space-y-1 border-t border-[var(--border-subtle)] pt-4">
            <Link href={`/products/${item.id}/edit?from=menu`} className="inline-flex min-h-11 items-center gap-2 text-[13px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <SlidersHorizontal className="h-4 w-4" />تنظیمات پیشرفته: تنوع، موجودی عددی، چند عکس
            </Link>
            {confirmDelete ? (
              <div className="rounded-2xl bg-red-500/[0.06] p-3.5">
                <p className="text-[13px] leading-6 text-red-900">«{item.name}» از منو و از پاسخ‌های ایجنت حذف می‌شود. اگر فقط امروز ندارید، «نمایش در منو» را خاموش کنید.</p>
                <div className="mt-2.5 flex gap-2">
                  <button type="button" disabled={deleting} onClick={() => void remove()} className="inline-flex min-h-11 items-center gap-1.5 rounded-control bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}حذف آیتم
                  </button>
                  <button type="button" disabled={deleting} onClick={() => setConfirmDelete(false)} className="inline-flex min-h-11 items-center rounded-control px-4 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">انصراف</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="flex min-h-11 items-center gap-2 text-[13px] font-bold text-red-700 hover:underline">
                <Trash2 className="h-4 w-4" />حذف آیتم
              </button>
            )}
          </div>
        )}
        {/* Enter in a text field saves, like any form. */}
        <button type="submit" hidden />
      </form>
    </SideSheet>
  )
}

const chip = (on: boolean) => cn(
  'min-h-10 rounded-full border px-3.5 text-[13px] font-bold transition-colors disabled:opacity-50',
  on ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white' : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]',
)

function PriceField({ label, value, onChange, disabled, empty }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; empty?: string }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block truncate text-[13px] text-[var(--text-secondary)]">{label}</span>
      <input dir="ltr" inputMode="numeric" value={value} disabled={disabled} onChange={(event) => onChange(digits(event.target.value))} placeholder="0" className="input w-full text-left tabular-nums disabled:opacity-50" />
      <span className="mt-1 block min-h-5 text-[12px] leading-5 text-[var(--text-muted)]">{value ? `${fa(Number(value))} تومان` : empty}</span>
    </label>
  )
}

function ToggleRow({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[var(--text-primary)]">{title}</p>
        <p className="mt-0.5 text-[13px] leading-6 text-[var(--text-muted)]">{description}</p>
      </div>
      <Switch checked={checked} onChange={onChange} aria-label={title} />
    </div>
  )
}

function PhotoField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState('')

  async function upload(file: File) {
    setError('')
    setProgress(0)
    try {
      const body = new FormData()
      body.set('file', file)
      const { response, status } = await uploadFileWithProgress('/api/uploads/products', body, setProgress)
      const url = (response as { url?: string } | null)?.url
      if (status >= 400 || !url) throw new Error('upload')
      onChange(url)
    } catch {
      setError('آپلود نشد؛ JPG، PNG یا WebP تا ۵ مگابایت را امتحان کنید.')
    } finally {
      setProgress(null)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => input.current?.click()} aria-label={value ? 'عوض کردن عکس' : 'انتخاب عکس'} className="relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]">
          {progress != null ? (
            <span className="flex flex-col items-center gap-1 text-[12px]"><Loader2 className="h-5 w-5 animate-spin" />{fa(Math.round(progress))}٪</span>
          ) : value ? (
            <ProductImage src={value} alt="" width={96} height={96} className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-6 w-6" />
          )}
        </button>
        <div className="min-w-0">
          <p className="text-sm font-bold text-[var(--text-primary)]">عکس آیتم</p>
          <p className="mt-0.5 text-[13px] leading-6 text-[var(--text-muted)]">آیتم با عکس بیشتر انتخاب می‌شود. مربعی و روشن بهتر دیده می‌شود.</p>
          {value && progress == null && (
            <button type="button" onClick={() => onChange('')} className="mt-1 inline-flex min-h-9 items-center gap-1.5 text-[13px] font-bold text-red-700 hover:underline">
              <Trash2 className="h-3.5 w-3.5" />حذف عکس
            </button>
          )}
        </div>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" tabIndex={-1} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = '' }} />
      {error && <p role="alert" className="mt-2 text-[12px] text-red-700">{error}</p>}
    </div>
  )
}

/** Pick the menu section, or name a new one without leaving the sheet. */
function CategoryField({ categories, value, onChange, onCreated }: { categories: MenuCategory[]; value: string; onChange: (value: string) => void; onCreated: (category: MenuCategory) => void }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function create() {
    const clean = name.trim()
    if (!clean || busy) return
    const existing = categories.find((category) => category.name.trim() === clean)
    if (existing) {
      onChange(existing.id)
      setAdding(false)
      setName('')
      return
    }
    setBusy(true)
    setError('')
    // New sections land at the end of the menu.
    const sortOrder = Math.max(0, ...categories.map((category) => category.sortOrder)) + 10
    const response = await fetch('/api/products/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: clean, sortOrder }),
    }).catch(() => null)
    const body = await response?.json().catch(() => null) as { category?: MenuCategory } | null
    setBusy(false)
    if (!response?.ok || !body?.category) {
      setError('دسته ساخته نشد؛ دوباره تلاش کنید.')
      return
    }
    onCreated({ id: body.category.id, name: body.category.name, sortOrder: body.category.sortOrder })
    setAdding(false)
    setName('')
  }

  return (
    <div>
      <p className="mb-1.5 text-[13px] text-[var(--text-secondary)]">دسته در منو</p>
      {categories.length > CHIP_LIMIT ? (
        <MaterialSelect
          ariaLabel="دسته در منو"
          value={value}
          onValueChange={onChange}
          options={[{ value: '', label: 'بدون دسته' }, ...categories.map((category) => ({ value: category.id, label: category.name }))]}
        />
      ) : (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="دسته در منو">
          {categories.map((category) => (
            <button key={category.id} type="button" aria-pressed={value === category.id} onClick={() => onChange(value === category.id ? '' : category.id)} className={chip(value === category.id)}>
              {category.name}
            </button>
          ))}
          {!adding && (
            <button type="button" onClick={() => setAdding(true)} className="inline-flex min-h-10 items-center gap-1 rounded-full border border-dashed border-[var(--border-default)] px-3.5 text-[13px] font-bold text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]">
              <Plus className="h-3.5 w-3.5" />دستهٔ جدید
            </button>
          )}
        </div>
      )}
      {categories.length > CHIP_LIMIT && !adding && (
        <button type="button" onClick={() => setAdding(true)} className="mt-1 inline-flex min-h-10 items-center gap-1 text-[13px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <Plus className="h-3.5 w-3.5" />دستهٔ جدید
        </button>
      )}
      {adding && (
        <div className="mt-2 flex items-center gap-2">
          <input
            autoFocus
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              // Enter names the section; it must not submit the item.
              if (event.key === 'Enter') { event.preventDefault(); void create() }
            }}
            placeholder="مثلاً پیش‌غذا"
            aria-label="نام دستهٔ جدید"
            className="input min-w-0 flex-1"
          />
          <button type="button" disabled={!name.trim() || busy} onClick={() => void create()} className="inline-flex min-h-11 items-center gap-1.5 rounded-control bg-[var(--text-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}ساخت
          </button>
          <button type="button" aria-label="انصراف" onClick={() => { setAdding(false); setName(''); setError('') }} className="grid h-11 w-11 shrink-0 place-items-center rounded-control text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {!value && !adding && categories.length > 0 && <p className="mt-1.5 text-[12px] text-[var(--text-muted)]">بدون دسته، آیتم زیر «بدون دسته‌بندی» می‌آید.</p>}
      {error && <p role="alert" className="mt-1.5 text-[12px] text-red-700">{error}</p>}
    </div>
  )
}
