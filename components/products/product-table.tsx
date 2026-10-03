'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2, MoreVertical, Package, Pencil, Store, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Switch } from '@/components/ui/switch'
import { queueUndo } from '@/lib/undo-queue'
import { cn } from '@/lib/utils'
import { productImageSrc } from '@/lib/products/image-src'

export interface ProductRow {
  id: string
  name: string
  sku: string | null
  price: number | null
  comparePrice: number | null
  stock: number | null
  lowStockThreshold: number | null
  images: string[]
  active: boolean
  queryCount: number
  externalId: string | null
  category: { name: string } | null
}

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

/** "۱٬۸۵۰٬۰۰۰" / "1,850,000" → 1850000. Empty → null. Anything else → undefined. */
function parseAmount(raw: string): number | null | undefined {
  const ascii = raw
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[\s,٬،]/g, '')
  if (!ascii) return null
  if (!/^\d+$/.test(ascii)) return undefined
  return Number(ascii)
}

/**
 * Products as a table: the view for running a catalog. Price and stock are
 * edited in the row, visibility is one switch, and the customer-question
 * column shows what people actually ask about.
 */
export function ProductTable({
  products,
  lowStockThreshold,
  storeSynced,
}: {
  products: ProductRow[]
  /** Workspace default; a product can override it. 0 turns the warning off. */
  lowStockThreshold: number
  /** A connected store owns price and stock of the products it syncs. */
  storeSynced: boolean
}) {
  const t = useTranslations('products')
  const locale = useLocale()
  const fa = locale !== 'en'
  const router = useRouter()
  const [rows, setRows] = useState(products)
  const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [failedId, setFailedId] = useState<string | null>(null)
  const nf = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')
  const maxQueries = Math.max(1, ...rows.map((row) => row.queryCount))

  useEffect(() => setRows(products), [products])

  async function patch(id: string, data: Partial<Pick<ProductRow, 'price' | 'stock' | 'active'>>) {
    const before = rows
    setFailedId(null)
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...data } : row)))
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('PATCH_FAILED')
      // Tab counts and the low-stock figure are server-rendered.
      router.refresh()
    } catch {
      setRows(before)
      setFailedId(id)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    setDeleteError(null)
    const target = deleteTarget
    try {
      const res = await fetch(`/api/products/${target.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('DELETE_FAILED')
      setDeleteTarget(null)
      router.refresh()
      queueUndo('product', [target.id], fa ? 'محصول' : 'product')
    } catch {
      setDeleteError(t('deleteFailed'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="ui-ptable rounded-card border border-[var(--border-subtle)] bg-white shadow-[var(--elev-1)]">
        <div className="ui-ptable-row ui-ptable-head border-b border-[var(--border-subtle)] px-3 py-2.5 text-[12px] font-medium text-[var(--text-muted)] sm:px-4" aria-hidden="true">
          <span />
          <span>{fa ? 'محصول' : 'Product'}</span>
          <span>{fa ? 'قیمت (تومان)' : 'Price (Toman)'}</span>
          <span>{fa ? 'موجودی' : 'Stock'}</span>
          <span className="ui-ptable-ask">{fa ? 'پرسش مشتری' : 'Customer questions'}</span>
          <span className="text-center">{fa ? 'نمایش' : 'Visible'}</span>
          <span />
        </div>

        <ul className="divide-y divide-[var(--border-subtle)]">
          {rows.map((product) => {
            const level = product.lowStockThreshold ?? lowStockThreshold
            const out = product.stock === 0
            const low = !out && product.stock !== null && level > 0 && product.stock <= level
            const locked = storeSynced && Boolean(product.externalId)
            const lockedTitle = fa ? 'قیمت و موجودی این محصول از فروشگاه همگام می‌شود.' : 'Price and stock of this product sync from the store.'
            return (
              <li key={product.id} className={cn('ui-ptable-row px-3 py-2 sm:px-4', !product.active && 'bg-[var(--bg-base)]')}>
                <span className={cn('grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-[var(--bg-muted)] text-[var(--text-muted)]', !product.active && 'opacity-60')}>
                  {product.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={productImageSrc(product.images[0])} alt="" width={88} height={88} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  ) : (
                    <Package className="h-5 w-5" aria-hidden="true" />
                  )}
                </span>

                <div className="ui-ptable-name min-w-0">
                  <Link
                    href={`/products/${product.id}`}
                    title={product.name}
                    className={cn('block truncate text-[13px] font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]', product.active ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]')}
                  >
                    {product.name}
                  </Link>
                  <p className="flex min-w-0 items-center gap-1.5 truncate text-[12px] text-[var(--text-muted)]">
                    {locked && <Store className="h-3 w-3 shrink-0" aria-label={fa ? 'همگام با فروشگاه' : 'Synced from the store'} />}
                    <span className="truncate">{product.category?.name ?? (fa ? 'بدون دسته' : 'No category')}</span>
                    {failedId === product.id && <span role="alert" className="shrink-0 text-[var(--red)]">· {fa ? 'ذخیره نشد' : 'Not saved'}</span>}
                  </p>
                </div>

                <div className="ui-ptable-price min-w-0">
                  <InlineNumber
                    value={product.price}
                    display={product.price != null ? nf.format(product.price) : '—'}
                    muted={product.price == null}
                    label={fa ? `قیمت ${product.name}` : `Price of ${product.name}`}
                    disabled={locked}
                    disabledTitle={lockedTitle}
                    suffix={product.comparePrice != null && product.price != null && product.comparePrice > product.price ? (
                      <span className="ui-ptable-compare shrink-0 text-[12px] text-[var(--text-muted)] line-through">{nf.format(product.comparePrice)}</span>
                    ) : null}
                    onSave={(value) => patch(product.id, { price: value })}
                  />
                </div>

                <div className="ui-ptable-stock min-w-0">
                  <InlineNumber
                    value={product.stock}
                    display={product.stock === null ? t('unlimited') : out ? t('outOfStock') : (fa ? `${nf.format(product.stock)} عدد` : `${product.stock} units`)}
                    tone={out ? 'danger' : low ? 'warn' : undefined}
                    muted={product.stock === null}
                    label={fa ? `موجودی ${product.name}` : `Stock of ${product.name}`}
                    hint={fa ? 'خالی = نامحدود' : 'Empty = unlimited'}
                    disabled={locked}
                    disabledTitle={lockedTitle}
                    onSave={(value) => patch(product.id, { stock: value })}
                  />
                </div>

                <div className="ui-ptable-ask flex min-w-0 items-center gap-2" title={product.queryCount > 0 ? t('queries', { count: nf.format(product.queryCount) }) : t('noQueries')}>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]" aria-hidden="true">
                    <span className="block h-full rounded-full bg-[var(--text-primary)]" style={{ width: `${Math.round((product.queryCount / maxQueries) * 100)}%` }} />
                  </span>
                  <span className="w-7 shrink-0 text-end text-[12px] tabular-nums text-[var(--text-secondary)]">{nf.format(product.queryCount)}</span>
                </div>

                <div className="ui-ptable-switch flex justify-center">
                  <Switch
                    checked={product.active}
                    onChange={(value) => void patch(product.id, { active: value })}
                    aria-label={fa ? `نمایش ${product.name} به مشتری` : `Show ${product.name} to customers`}
                  />
                </div>

                <RowMenu
                  fa={fa}
                  editHref={`/products/${product.id}/edit`}
                  editLabel={t('edit')}
                  deleteLabel={t('delete')}
                  onDelete={() => {
                    setDeleteError(null)
                    setDeleteTarget(product)
                  }}
                />
              </li>
            )
          })}
        </ul>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t('deleteTitle')}
        description={deleteTarget ? t('deleteDescription', { name: deleteTarget.name }) : ''}
        confirmLabel={deleting ? t('deleting') : t('deleteConfirm')}
        cancelLabel={t('deleteCancel')}
        tone="danger"
        busy={deleting}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
        onClose={() => {
          if (!deleting) setDeleteTarget(null)
        }}
      />
    </>
  )
}

/** A figure that turns into a field on click. Enter or leaving saves, Esc cancels. */
function InlineNumber({
  value,
  display,
  label,
  hint,
  tone,
  muted = false,
  disabled = false,
  disabledTitle,
  suffix,
  onSave,
}: {
  value: number | null
  display: string
  label: string
  hint?: string
  tone?: 'warn' | 'danger'
  muted?: boolean
  disabled?: boolean
  disabledTitle?: string
  suffix?: React.ReactNode
  onSave: (value: number | null) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [saving, setSaving] = useState(false)
  const cancelled = useRef(false)

  function open() {
    cancelled.current = false
    setDraft(value == null ? '' : String(value))
    setInvalid(false)
    setEditing(true)
  }

  async function commit() {
    if (cancelled.current) return
    const parsed = parseAmount(draft)
    if (parsed === undefined) {
      setInvalid(true)
      return
    }
    setEditing(false)
    if (parsed === value) return
    setSaving(true)
    try {
      await onSave(parsed)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        inputMode="numeric"
        dir="ltr"
        value={draft}
        aria-label={label}
        aria-invalid={invalid}
        placeholder={hint}
        onChange={(event) => {
          setDraft(event.target.value)
          setInvalid(false)
        }}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void commit()
          } else if (event.key === 'Escape') {
            cancelled.current = true
            setEditing(false)
          }
        }}
        className={cn('input h-10 min-h-10 w-full max-w-[9rem] px-2.5 text-end text-base tabular-nums sm:text-[13px]', invalid && '!border-[var(--red)]')}
      />
    )
  }

  const text = (
    <span className={cn(
      'truncate text-[13px] tabular-nums',
      tone === 'danger' ? 'font-bold text-[var(--red)]' : tone === 'warn' ? 'font-bold text-amber-700' : muted ? 'text-[var(--text-muted)]' : 'font-medium text-[var(--text-primary)]',
    )}>
      {display}
    </span>
  )

  if (disabled) {
    return <span className="flex min-h-10 min-w-0 items-center gap-2 px-2" title={disabledTitle}>{text}{suffix}</span>
  }

  return (
    <button
      type="button"
      onClick={open}
      aria-label={`${label}: ${display}`}
      className="group/cell flex min-h-10 w-full min-w-0 items-center gap-2 rounded-control border border-transparent px-2 text-start transition-colors hover:border-[var(--border-default)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
    >
      {text}
      {suffix}
      {saving
        ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--text-muted)] motion-reduce:animate-none" aria-hidden="true" />
        : <Pencil className="h-3 w-3 shrink-0 text-[var(--text-muted)] opacity-0 transition-opacity group-hover/cell:opacity-100 group-focus-visible/cell:opacity-100" aria-hidden="true" />}
    </button>
  )
}

function RowMenu({
  fa,
  editHref,
  editLabel,
  deleteLabel,
  onDelete,
}: {
  fa: boolean
  editHref: string
  editLabel: string
  deleteLabel: string
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const iconButton = 'grid h-10 w-10 place-items-center rounded-control text-[var(--text-muted)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]'
  return (
    <div className="ui-ptable-menu">
      {/* Wide tables: the two actions as plain icons, no menu to open first. */}
      <div className="ui-ptable-actions">
        <Link href={editHref} aria-label={editLabel} title={editLabel} className={cn(iconButton, 'hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]')}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </Link>
        <button type="button" onClick={onDelete} aria-label={deleteLabel} title={deleteLabel} className={cn(iconButton, 'hover:bg-red-50 hover:text-red-700')}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {/* Phones: the row is tight, so the same two actions sit behind ⋮. */}
      <div className="ui-ptable-more relative" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={fa ? 'کارهای دیگر' : 'More actions'}
          className="grid h-10 w-10 place-items-center rounded-control text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <MoreVertical className="h-4 w-4" aria-hidden="true" />
        </button>
        {open && (
          <div role="menu" className="absolute end-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-[var(--border-default)] bg-white py-1 shadow-[var(--elev-2)]">
            <Link href={editHref} role="menuitem" className="flex min-h-11 w-full items-center gap-2 px-3 text-start text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]">
              <Pencil className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
              {editLabel}
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onDelete()
              }}
              className="flex min-h-11 w-full items-center gap-2 px-3 text-start text-[13px] text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {deleteLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
