'use client'

/* eslint-disable @next/next/no-img-element -- QR codes are generated data URLs and item photos come from arbitrary store hosts. */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import {
  AlertTriangle,
  ArrowDown,
  Tag,
  ArrowUp,
  Check,
  Copy,
  Download,
  ExternalLink,
  ImageOff,
  Loader2,
  MessageCircle,
  PackagePlus,
  Pencil,
  Plug,
  QrCode,
  RefreshCw,
  Search,
  UtensilsCrossed,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { StatusChip } from '@/components/ui/status-chip'
import { normalizePersian } from '@/lib/search/persian'
import { MenuDesign } from '@/components/menu/menu-design'
import { BADGE_LABELS, badgeTag, badgesFromTags, withoutBadge, type MenuBadge, type MenuSettings } from '@/lib/menu/settings'
import { buildMenuSections } from '@/lib/menu/public-data'

export interface MenuItem {
  id: string
  name: string
  description: string | null
  price: number | null
  comparePrice: number | null
  /** null = not tracked (always available), 0 = sold out. */
  stock: number | null
  image: string | null
  categoryId: string | null
  active: boolean
  /** Imported from a connected store; the next sync may overwrite edits. */
  synced: boolean
  /** Product tags; badge tags («پیشنهاد سرآشپز»، «تند»…) show on the menu. */
  tags: string[]
}

export interface MenuCategory {
  id: string
  name: string
  sortOrder: number
}

type Filter = 'all' | 'visible' | 'hidden' | 'attention'

const UNCATEGORIZED = '__none'
const fa = (value: number) => value.toLocaleString('fa-IR')
const soldOut = (item: MenuItem) => item.stock === 0
/** In the menu but missing a price or photo. */
const needsAttention = (item: MenuItem) => item.active && (item.price == null || !item.image)

/**
 * /menu — what customers see on the public menu, and the few controls a
 * restaurant needs every day: hide an item, mark it sold out, reorder
 * categories, and share the link / table QR.
 */
export function MenuWorkspace({
  businessName,
  slug,
  publicUrl,
  chatUrl,
  settings,
  categories: initialCategories,
  initialItems,
  truncated,
}: {
  businessName: string
  slug: string
  publicUrl: string
  chatUrl: string | null
  settings: MenuSettings
  categories: MenuCategory[]
  initialItems: MenuItem[]
  truncated: boolean
}) {
  const [tab, setTab] = useState<'items' | 'design'>('items')
  const [items, setItems] = useState(initialItems)
  const [categories, setCategories] = useState(initialCategories)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const stats = useMemo(() => {
    const visible = items.filter((item) => item.active)
    return {
      visible: visible.length,
      soldOut: visible.filter(soldOut).length,
      noPrice: visible.filter((item) => item.price == null).length,
      noImage: visible.filter((item) => !item.image).length,
    }
  }, [items])

  const sections = useMemo(() => {
    const needle = normalizePersian(query.trim())
    const shown = items
      .filter((item) => (filter === 'all' ? true : filter === 'visible' ? item.active : filter === 'hidden' ? !item.active : needsAttention(item)))
      .filter((item) => !needle || normalizePersian(`${item.name} ${item.description ?? ''}`).includes(needle))
    const known = new Set(categories.map((category) => category.id))
    const groups = [...categories.map((category) => ({ id: category.id, name: category.name, real: true })), { id: UNCATEGORIZED, name: 'بدون دسته‌بندی', real: false }]
    return groups
      .map((group) => ({
        ...group,
        items: shown.filter((item) => (group.real ? item.categoryId === group.id : !item.categoryId || !known.has(item.categoryId))),
        total: items.filter((item) => item.active && (group.real ? item.categoryId === group.id : !item.categoryId || !known.has(item.categoryId))).length,
      }))
      .filter((group) => group.items.length > 0)
  }, [items, categories, query, filter])

  // The design tab's live preview renders the real menu (visible items only).
  const previewSections = useMemo(() => buildMenuSections(
    categories,
    items.filter((item) => item.active).map((item) => ({ ...item, images: item.image ? [item.image] : [] })),
  ), [categories, items])

  // Only categories that actually hold items are reorderable, in menu order.
  const orderable = useMemo(
    () => categories.filter((category) => items.some((item) => item.categoryId === category.id)),
    [categories, items],
  )

  async function patchItem(item: MenuItem, data: Partial<Pick<MenuItem, 'active' | 'stock' | 'tags'>>) {
    setError('')
    setBusy(item.id)
    setItems((rows) => rows.map((row) => (row.id === item.id ? { ...row, ...data } : row)))
    const response = await fetch(`/api/products/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(() => null)
    setBusy(null)
    if (!response?.ok) {
      setItems((rows) => rows.map((row) => (row.id === item.id ? item : row)))
      setError(response?.status === 402 ? 'پلن فضای کاری فعال نیست؛ برای تغییر منو، پلن را تمدید کنید.' : 'تغییر ذخیره نشد؛ دوباره تلاش کنید.')
    }
  }

  async function moveCategory(categoryId: string, direction: -1 | 1) {
    const index = orderable.findIndex((category) => category.id === categoryId)
    const target = orderable[index + direction]
    if (index < 0 || !target) return
    const nextOrderable = [...orderable]
    nextOrderable[index] = target
    nextOrderable[index + direction] = orderable[index]
    // Rewrite a clean 10-step order for every category so the result is
    // stable no matter what sortOrder values existed before.
    const rest = categories.filter((category) => !nextOrderable.some((item) => item.id === category.id))
    const next = [...nextOrderable, ...rest].map((category, position) => ({ ...category, sortOrder: (position + 1) * 10 }))
    const previous = categories
    setCategories(next)
    setBusy(categoryId)
    setError('')
    const changed = next.filter((category) => previous.find((item) => item.id === category.id)?.sortOrder !== category.sortOrder)
    const results = await Promise.all(changed.map((category) => fetch(`/api/products/categories/${category.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sortOrder: category.sortOrder }),
    }).then((response) => response.ok).catch(() => false)))
    setBusy(null)
    if (results.some((ok) => !ok)) {
      setCategories(previous)
      setError('ترتیب دسته‌ها ذخیره نشد؛ دوباره تلاش کنید.')
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="dashboard-page-header spatial-surface overflow-hidden rounded-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--text-primary)] text-white shadow-[var(--shadow-control)]">
              <UtensilsCrossed className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="ui-h1">منوی دیجیتال</h1>
              <p className="ui-body mt-0.5 max-w-xl">همان چیزی که مشتری با اسکن QR می‌بیند. هر تغییر اینجا یا در محصولات، همان لحظه در منو دیده می‌شود.</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-default)] bg-white px-4 text-sm font-bold text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]">
              <ExternalLink className="h-4 w-4" />دیدن منوی مشتری
            </a>
            <Link href="/products/new" className="spatial-press inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-sm font-bold text-white shadow-[var(--shadow-control)] transition-opacity hover:opacity-90">
              <PackagePlus className="h-4 w-4" />افزودن آیتم
            </Link>
          </div>
        </div>
      </header>

      <div className="ui-seg grid-cols-2 sm:w-[22rem]" role="tablist" aria-label="بخش‌های منو">
        <button type="button" role="tab" aria-selected={tab === 'items'} onClick={() => setTab('items')} className="ui-seg-tab">آیتم‌ها</button>
        <button type="button" role="tab" aria-selected={tab === 'design'} onClick={() => setTab('design')} className="ui-seg-tab">طراحی و اطلاعات</button>
      </div>

      {tab === 'design' ? (
        <MenuDesign
          businessName={businessName}
          slug={slug}
          publicUrl={publicUrl}
          chatUrl={chatUrl}
          initial={settings}
          sections={previewSections}
        />
      ) : items.length === 0 ? (
        <EmptyMenu />
      ) : (
        <>
          <dl className="grid grid-cols-2 divide-[var(--border-subtle)] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white/80 sm:grid-cols-4 sm:divide-x sm:rtl:divide-x-reverse">
            <Kpi label="آیتم در منو" value={fa(stats.visible)} />
            <Kpi label="تمام‌شده" value={fa(stats.soldOut)} tone={stats.soldOut ? 'warn' : undefined} />
            <Kpi label="بدون قیمت" value={fa(stats.noPrice)} tone={stats.noPrice ? 'warn' : undefined} onClick={stats.noPrice ? () => setFilter('attention') : undefined} />
            <Kpi label="بدون عکس" value={fa(stats.noImage)} tone={stats.noImage ? 'warn' : undefined} onClick={stats.noImage ? () => setFilter('attention') : undefined} />
          </dl>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
            <section className="min-w-0 space-y-4" aria-label="آیتم‌های منو">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="relative block flex-1">
                  <span className="sr-only">جستجو در منو</span>
                  <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-hint)]" aria-hidden />
                  <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جستجوی آیتم…" className="input min-h-12 w-full rounded-2xl ps-10" />
                </label>
                <div className="ui-seg grid-cols-4 sm:w-[20rem]" role="tablist" aria-label="فیلتر آیتم‌ها">
                  {([['all', 'همه'], ['visible', 'در منو'], ['hidden', 'پنهان'], ['attention', 'ناقص']] as const).map(([key, label]) => (
                    <button key={key} type="button" role="tab" aria-selected={filter === key} onClick={() => setFilter(key)} className="ui-seg-tab text-[12.5px]">{label}</button>
                  ))}
                </div>
              </div>

              {error && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2.5 text-xs font-medium text-red-700">{error}</p>}
              {filter === 'attention' && (
                <p className="rounded-xl bg-amber-500/[0.08] px-3.5 py-2.5 text-[12.5px] leading-6 text-amber-900">آیتم‌های داخل منو که قیمت یا عکس ندارند. مشتری برای آیتم بی‌قیمت «برای قیمت پیام دهید» می‌بیند و آیتم با عکس بیشتر انتخاب می‌شود.</p>
              )}

              {sections.length ? sections.map((section) => {
                const position = orderable.findIndex((category) => category.id === section.id)
                return (
                  <section key={section.id} className="spatial-surface rounded-card p-3 sm:p-4" aria-label={section.name}>
                    <div className="flex items-center gap-2 px-1 pb-2">
                      <h2 className="ui-h3 min-w-0 flex-1 truncate">{section.name}</h2>
                      <span className="text-[12px] text-[var(--text-muted)]">{fa(section.total)} آیتم در منو</span>
                      {section.real && orderable.length > 1 && (
                        <span className="flex items-center gap-0.5">
                          <OrderButton label={`بالاتر بردن ${section.name}`} disabled={position <= 0 || busy !== null} onClick={() => void moveCategory(section.id, -1)}><ArrowUp className="h-3.5 w-3.5" /></OrderButton>
                          <OrderButton label={`پایین‌تر بردن ${section.name}`} disabled={position < 0 || position >= orderable.length - 1 || busy !== null} onClick={() => void moveCategory(section.id, 1)}><ArrowDown className="h-3.5 w-3.5" /></OrderButton>
                        </span>
                      )}
                    </div>
                    <ul className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white">
                      {section.items.map((item) => (
                        <ItemRow key={item.id} item={item} busy={busy === item.id} onPatch={(data) => void patchItem(item, data)} />
                      ))}
                    </ul>
                  </section>
                )
              }) : (
                <div className="grid min-h-40 place-items-center rounded-card border border-dashed border-[var(--border-default)] bg-white/60 p-8 text-center">
                  <div>
                    <Search className="mx-auto h-6 w-6 text-[var(--text-hint)]" />
                    <p className="mt-2 text-sm font-bold text-[var(--text-primary)]">آیتمی با این مشخصات نیست</p>
                    <button type="button" onClick={() => { setQuery(''); setFilter('all') }} className="mt-3 min-h-10 rounded-xl px-3 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">پاک کردن فیلترها</button>
                  </div>
                </div>
              )}
              {truncated && (
                <p className="text-center text-[12px] text-[var(--text-muted)]">فقط ۵۰۰ آیتم تازه‌تر اینجا آمده‌اند؛ بقیه را از <Link href="/products" className="font-bold underline underline-offset-4">محصولات</Link> مدیریت کنید.</p>
              )}
            </section>

            <SharePanel businessName={businessName} publicUrl={publicUrl} chatUrl={chatUrl} />
          </div>
        </>
      )}
    </div>
  )
}

function ItemRow({ item, busy, onPatch }: { item: MenuItem; busy: boolean; onPatch: (data: Partial<Pick<MenuItem, 'active' | 'stock' | 'tags'>>) => void }) {
  const badges = badgesFromTags(item.tags)
  const toggleBadge = (badge: MenuBadge) => onPatch({
    tags: badges.includes(badge) ? withoutBadge(item.tags, badge) : [...item.tags, badgeTag(badge)],
  })
  const discount = item.price != null && item.comparePrice != null && item.comparePrice > item.price
  // A quick "sold out today" only makes sense when stock is not counted.
  const quickStock = item.stock === null || item.stock === 0
  return (
    <li className={cn('flex items-center gap-3 p-2.5 sm:p-3', !item.active && 'bg-[var(--bg-base)]')}>
      {item.image ? (
        <img src={item.image} alt="" loading="lazy" decoding="async" width={56} height={56} className={cn('h-14 w-14 shrink-0 rounded-xl object-cover', (!item.active || soldOut(item)) && 'opacity-50 grayscale')} />
      ) : (
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[var(--bg-surface)] text-[var(--text-hint)]" title="بدون عکس"><ImageOff className="h-4 w-4" /></span>
      )}
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-bold', item.active ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]')}>{item.name}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
          {item.price == null ? (
            <span className="font-medium text-amber-700">بدون قیمت</span>
          ) : (
            <span className="font-bold tabular-nums text-[var(--text-secondary)]">{fa(Math.round(item.price))} <span className="font-normal text-[var(--text-muted)]">تومان</span></span>
          )}
          {discount && <span className="tabular-nums text-[var(--text-hint)] line-through">{fa(Math.round(item.comparePrice!))}</span>}
          {!item.active && <StatusChip tone="neutral">پنهان از منو</StatusChip>}
          {item.active && soldOut(item) && <StatusChip tone="warn">تمام شده</StatusChip>}
          {item.stock != null && item.stock > 0 && <span className="text-[var(--text-muted)]">موجودی {fa(item.stock)}</span>}
          {item.active && quickStock && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onPatch({ stock: soldOut(item) ? null : 0 })}
              className={cn(
                'inline-flex min-h-8 items-center rounded-lg border px-2.5 text-[12px] font-bold transition-colors disabled:opacity-50',
                soldOut(item) ? 'border-emerald-600/25 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-50' : 'border-transparent text-[var(--text-muted)] hover:border-[var(--border-default)] hover:text-[var(--text-primary)]',
              )}
            >
              {soldOut(item) ? 'موجود شد' : 'تمام شد'}
            </button>
          )}
          {item.synced && <span className="inline-flex items-center gap-1 text-[var(--text-hint)]" title="از فروشگاه متصل وارد شده؛ همگام‌سازی بعدی ممکن است تغییرات را بازنویسی کند."><RefreshCw className="h-3 w-3" />همگام با فروشگاه</span>}
          {badges.map((badge) => <span key={badge} className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[11.5px] font-bold text-[var(--text-secondary)]">{BADGE_LABELS[badge]}</span>)}
        </p>
        <details className="group mt-1">
          <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 rounded-lg px-1.5 text-[12px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] [&::-webkit-details-marker]:hidden">
            <Tag className="h-3.5 w-3.5" />برچسب منو
          </summary>
          <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label={`برچسب‌های ${item.name}`}>
            {(Object.keys(BADGE_LABELS) as MenuBadge[]).map((badge) => (
              <button
                key={badge}
                type="button"
                disabled={busy}
                aria-pressed={badges.includes(badge)}
                onClick={() => toggleBadge(badge)}
                className={cn('min-h-9 rounded-full border px-3 text-[12px] font-bold transition-colors disabled:opacity-50', badges.includes(badge) ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white' : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]')}
              >
                {BADGE_LABELS[badge]}
              </button>
            ))}
          </div>
        </details>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Link href={`/products/${item.id}/edit`} aria-label={`ویرایش ${item.name}`} className="grid h-9 w-9 place-items-center rounded-lg text-[var(--text-hint)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
          <Pencil className="h-4 w-4" />
        </Link>
        {busy ? <Loader2 className="mx-2.5 h-4 w-4 animate-spin text-[var(--text-hint)]" /> : (
          <Switch checked={item.active} onChange={(active) => onPatch({ active })} aria-label={item.active ? `پنهان کردن ${item.name} از منو` : `نمایش ${item.name} در منو`} />
        )}
      </div>
    </li>
  )
}

function OrderButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="grid h-8 w-8 place-items-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-30">
      {children}
    </button>
  )
}

function Kpi({ label, value, tone, onClick }: { label: string; value: string; tone?: 'warn'; onClick?: () => void }) {
  const body = (
    <>
      <dt className="truncate text-[12.5px] text-[var(--text-muted)]">{label}</dt>
      <dd className={cn('text-lg font-bold tabular-nums leading-7', tone === 'warn' ? 'text-amber-700' : 'text-[var(--text-primary)]')}>{value}</dd>
    </>
  )
  return onClick ? (
    <button type="button" onClick={onClick} className="flex min-w-0 flex-col-reverse px-2 py-2.5 text-center transition-colors hover:bg-[var(--bg-hover)]">{body}</button>
  ) : (
    <div className="flex min-w-0 flex-col-reverse px-2 py-2.5 text-center">{body}</div>
  )
}

function EmptyMenu() {
  return (
    <section className="spatial-surface rounded-sheet p-6 text-center sm:p-10">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--text-primary)] text-white shadow-[var(--shadow-control)]"><UtensilsCrossed className="h-6 w-6" /></span>
      <h2 className="ui-h2 mt-4">منو هنوز خالی است</h2>
      <p className="ui-body mx-auto mt-1 max-w-md">منو از محصولات شما ساخته می‌شود: هر آیتم با دسته، قیمت و عکسش. اولین آیتم را اضافه کنید یا کاتالوگ فروشگاهتان را وصل کنید.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link href="/products/new" className="spatial-press inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[var(--text-primary)] px-6 text-sm font-bold text-white shadow-[var(--shadow-control)]"><PackagePlus className="h-4 w-4" />افزودن اولین آیتم</Link>
        <Link href="/integrations" className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-[var(--border-default)] bg-white px-5 text-sm font-bold text-[var(--text-secondary)] hover:border-[var(--border-strong)]"><Plug className="h-4 w-4" />اتصال فروشگاه</Link>
      </div>
    </section>
  )
}

function SharePanel({ businessName, publicUrl, chatUrl }: { businessName: string; publicUrl: string; chatUrl: string | null }) {
  const [qr, setQr] = useState('')
  const [copied, setCopied] = useState(false)
  const [making, setMaking] = useState(false)
  // A QR per table: the menu shows «میز ۷» and passes it to the chat.
  const [table, setTable] = useState('')
  const tableId = table.replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/[^A-Za-z0-9-]/g, '').slice(0, 8)
  const qrUrl = tableId ? `${publicUrl}?t=${tableId}` : publicUrl

  useEffect(() => {
    let alive = true
    void QRCode.toDataURL(qrUrl, { width: 640, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#111111', light: '#ffffff' } }).then((value) => { if (alive) setQr(value) })
    return () => { alive = false }
  }, [qrUrl])

  async function copy() {
    try { await navigator.clipboard.writeText(publicUrl) } catch { return }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  async function downloadCard() {
    if (!qr) return
    setMaking(true)
    try { save(await tableCard(qr, businessName, publicUrl, tableId), `menu-card${tableId ? `-table-${tableId}` : ''}-${Date.now()}.png`) } finally { setMaking(false) }
  }

  return (
    <aside className="spatial-surface space-y-4 rounded-card p-4 lg:sticky lg:top-24" aria-label="اشتراک منو">
      <div className="rounded-card border border-[var(--border-subtle)] bg-white p-4">
        {qr ? <img src={qr} alt={`کد QR منوی ${businessName}`} className="mx-auto aspect-square w-full max-w-[14rem]" /> : <span className="mx-auto grid aspect-square w-full max-w-[14rem] place-items-center rounded-xl bg-[var(--bg-surface)]"><QrCode className="h-10 w-10 animate-pulse text-[var(--text-hint)]" /></span>}
        <p className="mt-2 text-center text-[13px] font-bold text-[var(--text-primary)]">{tableId ? `QR میز ${tableId.replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)])}` : 'اسکن کنید و منو را ببینید'}</p>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-[12.5px] text-[var(--text-secondary)]">شمارهٔ میز (اختیاری)</span>
        <input value={table} onChange={(event) => setTable(event.target.value)} inputMode="numeric" placeholder="مثلاً ۷" className="input w-full" />
      </label>
      <div dir="ltr" className="flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-1 ps-3">
        <code className="min-w-0 flex-1 truncate text-left text-[12px] text-[var(--text-secondary)]">{publicUrl.replace(/^https?:\/\//, '')}</code>
        <button type="button" onClick={() => void copy()} aria-label="کپی لینک منو" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white shadow-sm">{copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={!qr} onClick={() => save(qr, `menu-qr-${Date.now()}.png`)} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-default)] bg-white text-xs font-bold text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] disabled:opacity-50">
          <Download className="h-4 w-4" />فقط QR
        </button>
        <button type="button" disabled={!qr || making} onClick={() => void downloadCard()} className="spatial-press inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[var(--text-primary)] text-xs font-bold text-white disabled:opacity-50">
          {making ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}کارت رومیزی
        </button>
      </div>
      <p className="text-[12.5px] leading-5 text-[var(--text-muted)]">کارت رومیزی یک تصویر آماده چاپ با نام کسب‌وکار و QR است (اندازه A6).</p>
      {chatUrl ? (
        <p className="flex items-start gap-2 rounded-xl bg-emerald-500/[0.07] px-3 py-2.5 text-[12px] leading-6 text-emerald-900">
          <MessageCircle className="mt-1 h-3.5 w-3.5 shrink-0" />دکمه «سؤال یا سفارش» در منو، مشتری را به گفتگو با ایجنت شما می‌برد.
        </p>
      ) : (
        <p className="flex items-start gap-2 rounded-xl bg-amber-500/[0.08] px-3 py-2.5 text-[12px] leading-6 text-amber-900">
          <AlertTriangle className="mt-1 h-3.5 w-3.5 shrink-0" /><span>لینک گفتگو فعال نیست؛ مشتری از منو نمی‌تواند سؤال بپرسد. <Link href="/integrations" className="font-bold underline underline-offset-4">فعال‌سازی لینک گفتگو</Link></span>
        </p>
      )}
    </aside>
  )
}

function save(dataUrl: string, filename: string) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

/** A6 table card (1240×1748 px ≈ 300 dpi): business name, QR, short hint, link. */
async function tableCard(qrDataUrl: string, businessName: string, publicUrl: string, table = ''): Promise<string> {
  const width = 1240
  const height = 1748
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return qrDataUrl
  const family = getComputedStyle(document.body).fontFamily || 'sans-serif'
  await document.fonts?.ready

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.strokeStyle = '#e6e6e6'
  context.lineWidth = 6
  context.strokeRect(40, 40, width - 80, height - 80)

  context.direction = 'rtl'
  context.textAlign = 'center'
  context.fillStyle = '#6b6b6b'
  context.font = `500 56px ${family}`
  context.fillText(table ? `منوی دیجیتال · میز ${table.replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)])}` : 'منوی دیجیتال', width / 2, 250)
  context.fillStyle = '#111111'
  context.font = `800 104px ${family}`
  context.fillText(fitText(context, businessName, width - 200), width / 2, 390)

  const image = new Image()
  image.src = qrDataUrl
  await image.decode()
  const size = 820
  context.drawImage(image, (width - size) / 2, 500, size, size)

  context.fillStyle = '#111111'
  context.font = `700 64px ${family}`
  context.fillText('با دوربین گوشی اسکن کنید', width / 2, 1470)
  context.direction = 'ltr'
  context.fillStyle = '#8a8a8a'
  context.font = `500 40px ${family}`
  context.fillText(publicUrl.replace(/^https?:\/\//, ''), width / 2, 1570)
  return canvas.toDataURL('image/png')
}

function fitText(context: CanvasRenderingContext2D, text: string, max: number): string {
  if (context.measureText(text).width <= max) return text
  let value = text
  while (value.length > 1 && context.measureText(`${value}…`).width > max) value = value.slice(0, -1)
  return `${value}…`
}
