import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import {
  Pencil,
  Package,
  Bot,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { formatDateTime } from '@/lib/format'
import { BackButton } from '@/components/dashboard/back-button'
import { normalizeAttributes, extractTypedVariations, type VariationRow } from '@/lib/products/description'
import {
  extractListItems,
  stripListBlocks,
} from '@/lib/products/description'
import { CopyButton } from '@/components/ui/copy-button'
import { ProductImage } from '@/components/products/product-image'
import { dashboardTitle } from '@/lib/dashboard/page-title'

export const generateMetadata = dashboardTitle('محصول', 'Product')

const FULFILLMENT_LABEL = {
  SHIPPED: ['ارسال پستی یا پیک', 'Shipped', 'ایجنت آدرس و شماره تماس را می‌گیرد', 'The agent asks for an address and phone'],
  DIGITAL: ['دیجیتال (فایل، اشتراک، کد)', 'Digital', 'ایجنت آدرس نمی‌پرسد', 'The agent never asks for an address'],
  SERVICE: ['خدمت', 'Service', 'انجام کار یا مشاوره', 'A job or a consultation'],
  PICKUP: ['تحویل حضوری', 'Pickup', 'مشتری از فروشگاه تحویل می‌گیرد', 'The customer collects it in store'],
} as const

export default async function ProductDetailPage(
  props: {
    params: Promise<{ productId: string }>
  }
) {
  const params = await props.params;
  const user = await requireUser()
  const t = await getTranslations('products')
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
  const fa = locale === 'fa'
  const L = (faText: string, enText: string) => (fa ? faText : enText)
  const fmt = (n: number) => n.toLocaleString(fa ? 'fa-IR' : 'en-US')

  const product = await prisma.product.findFirst({
    where: { id: params.productId, workspaceId: user.workspaceId },
    include: {
      category: { select: { name: true } },
      catalogItems: {
        select: { agent: { select: { id: true, name: true } } },
      },
    },
  })
  if (!product) notFound()

  // Variable products carry per-variant stock/price/attributes inside
  // `attributes._variations`; the parent stock is misleading for them, so the
  // stock label switches to a per-variant summary.
  const variations: VariationRow[] = extractTypedVariations(product.attributes)
  const inStockVariations = variations.filter((v) =>
    v.manageStock ? (v.stockQuantity ?? 0) > 0 : v.inStock,
  )

  let stockLabel: string
  if (variations.length > 0) {
    stockLabel = fa
      ? `${fmt(inStockVariations.length)} تنوع موجود از ${fmt(variations.length)}`
      : `${fmt(inStockVariations.length)} of ${fmt(variations.length)} variants in stock`
  } else if (product.stock === null) {
    stockLabel = t('unlimited')
  } else {
    stockLabel = product.stock > 0 ? `${fmt(product.stock)}` : t('outOfStock')
  }

  // `attributes` arrives in several shapes (manual form, Woo REST, Woo webhook
  // objects, <ul><li> in the description) — normalise to flat label/value rows
  // and keep list items out of the description text so no raw HTML shows.
  const attributes = normalizeAttributes(product.attributes)
  const descriptionItems = extractListItems(product.description ?? '')
  const mergedAttributes = [...attributes, ...descriptionItems]
  const cleanDescription = stripListBlocks(product.description ?? '')

  const fulfillment = FULFILLMENT_LABEL[product.fulfillment ?? 'SHIPPED'] ?? FULFILLMENT_LABEL.SHIPPED
  const extraImages = product.images.slice(1, 9)

  const card = 'spatial-surface rounded-card p-4 sm:p-5'
  const cardTitle = 'text-[15px] font-medium text-[var(--text-primary)]'
  const rows = 'mt-3 divide-y divide-[var(--border-subtle)]'
  const row = 'flex items-center justify-between gap-3 py-2.5 text-[13.5px]'
  const pill = 'inline-flex h-[26px] items-center gap-1.5 rounded-full bg-[var(--bg-muted)] px-2.5 text-xs font-medium text-[var(--text-secondary)]'

  return (
    <div className="mx-auto max-w-6xl space-y-4 sm:space-y-5">
      <div className="flex items-center justify-between">
        <BackButton href="/products" label={t('title')} />
        <Link
          href={`/products/${product.id}/edit`}
          className="fixed inset-x-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-sm font-bold text-[var(--bg-base)] shadow-[var(--shadow-floating)] transition-opacity hover:opacity-90 md:static md:min-h-11 md:shadow-[var(--shadow-control)]"
        >
          <Pencil className="h-4 w-4" />
          {t('edit')}
        </Link>
      </div>

      {/* Summary */}
      <header className="flex items-center gap-3.5">
        <div className="h-[76px] w-[76px] shrink-0 overflow-hidden rounded-[18px] bg-[var(--bg-muted)] md:h-[60px] md:w-[60px] md:rounded-2xl">
          {product.images[0] ? (
            <ProductImage src={product.images[0]} alt="" width={160} height={160} decoding="async" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center text-[var(--text-muted)]"><Package className="h-6 w-6" aria-hidden="true" /></span>
          )}
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-medium leading-7 text-[var(--text-primary)] md:text-[22px]">{product.name}</h1>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className={`inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ${product.active ? 'bg-[#e8f4ec] text-[#11622f]' : 'bg-[var(--bg-muted)] text-[var(--text-secondary)]'}`}>
              <span className="h-[7px] w-[7px] rounded-full bg-current" aria-hidden="true" />
              {product.active ? L('فعال · در دسترس ایجنت', 'Active · available to agents') : t('detail.inactive')}
            </span>
            <span className={pill}>{stockLabel}</span>
            <span className={pill}>{fa ? fulfillment[0] : fulfillment[1]}</span>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-3 md:gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-5">
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-5">
          {/* Images */}
          <section className={`${card} max-lg:order-1`} aria-labelledby="pd-images">
            <h2 id="pd-images" className={cardTitle}>{L('تصاویر', 'Images')}</h2>
            {product.images.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--text-muted)]">{L('تصویری ندارد. ایجنت در کارت محصول فقط متن می‌فرستد.', 'No images. The agent sends text only on the product card.')}</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-3">
                <div className="relative h-56 w-full overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-muted)] sm:h-[236px] sm:w-[236px]">
                  <ProductImage src={product.images[0]} alt={product.name} width={640} height={640} decoding="async" className="h-full w-full object-cover" />
                  <span className="absolute end-2.5 top-2.5 inline-flex h-[26px] items-center rounded-full bg-black/80 px-2.5 text-xs font-medium text-white">{L('تصویر اصلی', 'Main image')}</span>
                </div>
                {extraImages.length > 0 && (
                  <div className="grid w-full grid-cols-4 gap-3 sm:w-[236px] sm:grid-cols-2">
                    {extraImages.map((src, i) => (
                      <div key={`${src}-${i}`} className="aspect-square overflow-hidden rounded-2xl bg-[var(--bg-muted)] sm:aspect-auto sm:h-28">
                        <ProductImage src={src} alt={`${product.name} ${i + 2}`} width={240} height={240} className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Description */}
          {cleanDescription && (
            <section className={`${card} max-lg:order-2`} aria-labelledby="pd-desc">
              <h2 id="pd-desc" className={cardTitle}>{t('form.description')}</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-8 text-[var(--text-secondary)]">{cleanDescription}</p>
            </section>
          )}

          {/* Price & stock */}
          <section className={`${card} max-lg:order-3`} aria-labelledby="pd-price">
            <h2 id="pd-price" className={cardTitle}>{L('قیمت و موجودی', 'Price & stock')}</h2>
            <dl className={rows}>
              <div className={row}>
                <dt className="text-[var(--text-muted)]">{t('form.price')}</dt>
                <dd className="font-medium text-[var(--text-primary)]">
                  {product.price != null ? <>{fmt(product.price)} <span className="font-normal text-[var(--text-muted)]">{t('toman')}</span></> : '—'}
                </dd>
              </div>
              {product.comparePrice != null && (
                <div className={row}>
                  <dt className="text-[var(--text-muted)]">{t('form.comparePrice')}</dt>
                  <dd className="text-[var(--text-muted)] line-through">{fmt(product.comparePrice)}</dd>
                </div>
              )}
              <div className={row}>
                <dt className="text-[var(--text-muted)]">{t('detail.stock')}</dt>
                <dd className="text-[var(--text-primary)]">{stockLabel}</dd>
              </div>
              {product.lowStockThreshold != null && product.stock !== null && (
                <div className={row}>
                  <dt className="text-[var(--text-muted)]">{t('form.lowStockThreshold')}</dt>
                  <dd className="text-[var(--text-primary)]">{fmt(product.lowStockThreshold)}</dd>
                </div>
              )}
              {product.sku && (
                <div className={row}>
                  <dt className="text-[var(--text-muted)]">{t('form.sku')}</dt>
                  <dd className="flex min-w-0 items-center gap-1.5">
                    <span dir="ltr" className="truncate font-mono text-xs text-[var(--text-secondary)]">{product.sku}</span>
                    <CopyButton value={product.sku} label={t('copySku')} copiedLabel={t('copied')} />
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {/* Specs */}
          {mergedAttributes.length > 0 && (
            <section className={`${card} max-lg:order-5`} aria-labelledby="pd-specs">
              <h2 id="pd-specs" className={cardTitle}>{t('form.attributes')}</h2>
              <dl className={rows}>
                {mergedAttributes.map((attr, idx) => (
                  <div key={`${attr.label}-${idx}`} className={row}>
                    <dt className="text-[var(--text-muted)]">{attr.label}</dt>
                    <dd className="text-end text-[var(--text-primary)]">{attr.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* Variations */}
          {variations.length > 0 && (
            <section className={`${card} max-lg:order-6`} aria-labelledby="pd-vars">
              <div className="flex items-center justify-between gap-3">
                <h2 id="pd-vars" className={cardTitle}>{L('تنوع‌ها', 'Variants')}</h2>
                <span className="text-xs text-[var(--text-muted)]">
                  {fa
                    ? `${fmt(inStockVariations.length)} موجود از ${fmt(variations.length)}`
                    : `${fmt(inStockVariations.length)} in stock of ${fmt(variations.length)}`}
                </span>
              </div>
              <VariationMatrix variations={variations} locale={locale} fmt={fmt} />
              <div className="mt-3 grid gap-3">
                {variations.map((v) => {
                  const inStock = v.manageStock ? (v.stockQuantity ?? 0) > 0 : v.inStock
                  const stockText = v.manageStock
                    ? (v.stockQuantity ?? 0) > 0
                      ? `${fmt(v.stockQuantity ?? 0)} ${L('عدد', 'pcs')}`
                      : L('ناموجود', 'Out of stock')
                    : v.inStock
                      ? L('موجود', 'In stock')
                      : L('ناموجود', 'Out of stock')
                  return (
                    <div
                      key={v.id}
                      className={`flex items-center gap-3 rounded-2xl border border-[var(--border-default)] p-3 ${inStock ? 'bg-[var(--bg-base)]' : 'bg-[var(--bg-muted)] opacity-70'}`}
                    >
                      {v.image ? (
                        <ProductImage
                          src={v.image}
                          alt={Object.values(v.attributes).join('، ') || `#${v.id}`}
                          width={56}
                          height={56}
                          className="h-14 w-14 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[var(--bg-muted)] text-[var(--text-muted)]">
                          <Package className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-sm">
                          {Object.entries(v.attributes).map(([k, val]) => (
                            <span key={k} className="text-[var(--text-secondary)]">
                              <span className="text-[var(--text-muted)]">{k}:</span>{' '}
                              <span className="text-[var(--text-primary)]">{val}</span>
                            </span>
                          ))}
                        </div>
                        {v.sku && (
                          <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]" dir="ltr">SKU: {v.sku}</p>
                        )}
                      </div>
                      {v.price != null && (
                        <div className="shrink-0 text-end">
                          <p className="text-sm text-[var(--text-primary)]">{fmt(v.price)}</p>
                          <p className="text-xs text-[var(--text-muted)]">{t('toman')}</p>
                        </div>
                      )}
                      <div className={`flex shrink-0 items-center gap-1 text-xs ${inStock ? 'text-emerald-600' : 'text-red-500'}`}>
                        {inStock ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                        <span>{stockText}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>

        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-5">
          {/* Status + agents */}
          <section className={`${card} max-lg:order-9`} aria-labelledby="pd-status">
            <div className="flex items-center justify-between gap-3">
              <h2 id="pd-status" className={cardTitle}>{L('وضعیت', 'Status')}</h2>
              <span className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ${product.active ? 'bg-[#e8f4ec] text-[#11622f]' : 'bg-[var(--bg-muted)] text-[var(--text-secondary)]'}`}>
                <span className="h-[7px] w-[7px] rounded-full bg-current" aria-hidden="true" />
                {product.active ? L('فعال', 'Active') : t('detail.inactive')}
              </span>
            </div>
            <p className="mt-2 text-[12.5px] leading-6 text-[var(--text-muted)]">
              {product.active ? L('ایجنت‌ها این محصول را در گفتگو به مشتری پیشنهاد می‌دهند.', 'Agents offer this product in chats.') : L('ایجنت‌ها این محصول را پیشنهاد نمی‌دهند.', 'Agents do not offer this product.')}
            </p>
            <h3 className="mt-3 border-t border-[var(--border-subtle)] pt-3 text-[13px] text-[var(--text-muted)]">{t('detail.knownByAgents')}</h3>
            {product.catalogItems.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--text-muted)]">{t('detail.noAgents')}</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {product.catalogItems.map(({ agent }) => (
                  <Link
                    key={agent.id}
                    href={`/agents/${agent.id}`}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[var(--border-default)] px-3 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                  >
                    <Bot className="h-3.5 w-3.5" />
                    {agent.name}
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Delivery */}
          <section className={`${card} max-lg:order-4`} aria-labelledby="pd-ful">
            <h2 id="pd-ful" className={cardTitle}>{L('نوع تحویل', 'Delivery')}</h2>
            <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">{fa ? fulfillment[0] : fulfillment[1]}</p>
            <p className="mt-0.5 text-xs leading-6 text-[var(--text-muted)]">{fa ? fulfillment[2] : fulfillment[3]}</p>
          </section>

          {/* Category & tags */}
          <section className={`${card} max-lg:order-7`} aria-labelledby="pd-cat">
            <h2 id="pd-cat" className={cardTitle}>{L('دسته و تگ', 'Category & tags')}</h2>
            <p className="mt-3 text-sm text-[var(--text-primary)]">{product.category?.name ?? t('form.noCategory')}</p>
            {product.tags.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {product.tags.map((tag) => (
                  <span key={tag} className={pill}>{tag}</span>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-[var(--text-muted)]">{L('بدون تگ', 'No tags')}</p>
            )}
          </section>

          {/* Link & ID */}
          <section className={`${card} max-lg:order-8`} aria-labelledby="pd-link">
            <h2 id="pd-link" className={cardTitle}>{L('لینک و شناسه', 'Link & ID')}</h2>
            {product.externalUrl && (
              <div className="mt-3 flex min-w-0 items-center gap-2">
                <a
                  href={product.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  dir="ltr"
                  className="inline-flex min-h-11 min-w-0 flex-1 items-center gap-1.5 rounded-xl border border-[var(--border-default)] px-3 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{product.externalUrl.replace(/^https?:\/\//, '')}</span>
                </a>
                <CopyButton value={product.externalUrl} label={t('copyLink')} copiedLabel={t('copied')} />
              </div>
            )}
            <dl className={rows}>
              <div className={row}>
                <dt className="text-[var(--text-muted)]">{L('شناسه', 'ID')}</dt>
                <dd className="flex min-w-0 items-center gap-1.5">
                  <span dir="ltr" className="truncate font-mono text-xs text-[var(--text-secondary)]">{product.id}</span>
                  <CopyButton value={product.id} label={t('copyId')} copiedLabel={t('copied')} />
                </dd>
              </div>
            </dl>
          </section>

          {/* Performance */}
          <section className={`${card} max-lg:order-10`} aria-labelledby="pd-perf">
            <h2 id="pd-perf" className={cardTitle}>{L('عملکرد', 'Performance')}</h2>
            <dl className={rows}>
              <div className={row}>
                <dt className="text-[var(--text-muted)]">{t('detail.queryCount')}</dt>
                <dd className="font-medium text-[var(--text-primary)]">{fmt(product.queryCount)}</dd>
              </div>
              <div className={row}>
                <dt className="text-[var(--text-muted)]">{t('detail.agentCoverage')}</dt>
                <dd className="font-medium text-[var(--text-primary)]">{fmt(product.catalogItems.length)}</dd>
              </div>
              <div className={row}>
                <dt className="text-[var(--text-muted)]">{t('detail.updatedAt')}</dt>
                <dd className="text-[var(--text-primary)]">{formatDateTime(product.updatedAt, locale)}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
      <div className="h-16 md:hidden" aria-hidden="true" />
    </div>
  );
}

/**
 * Two-option products (رنگ × سایز) read best as a grid: one row per first
 * option, one column per second, stock in each cell. Other shapes keep only
 * the list below.
 */
function VariationMatrix({ variations, locale, fmt }: { variations: VariationRow[]; locale: string; fmt: (value: number) => string }) {
  const keys = [...new Set(variations.flatMap((v) => Object.keys(v.attributes)))]
  if (keys.length !== 2 || variations.length < 2 || variations.some((v) => Object.keys(v.attributes).length !== 2)) return null
  const [rowKey, colKey] = keys
  const rows = [...new Set(variations.map((v) => v.attributes[rowKey]))]
  const cols = [...new Set(variations.map((v) => v.attributes[colKey]))]
  const cell = (row: string, col: string) => variations.find((v) => v.attributes[rowKey] === row && v.attributes[colKey] === col)
  const fa = locale === 'fa'
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--border-default)]">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="bg-[var(--bg-muted)] text-xs text-[var(--text-muted)]">
            <th scope="col" className="px-3 py-2 text-start font-medium">{rowKey} × {colKey}</th>
            {cols.map((col) => <th key={col} scope="col" className="px-3 py-2 text-center font-medium text-[var(--text-secondary)]">{col}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row} className="border-t border-[var(--border-subtle)]">
              <th scope="row" className="px-3 py-2 text-start font-medium text-[var(--text-primary)]">{row}</th>
              {cols.map((col) => {
                const v = cell(row, col)
                if (!v) return <td key={col} className="px-3 py-2 text-center text-[var(--text-muted)]">—</td>
                const count = v.manageStock ? v.stockQuantity ?? 0 : null
                const inStock = count != null ? count > 0 : v.inStock !== false
                return (
                  <td key={col} className="px-3 py-2 text-center tabular-nums">
                    <span className={`inline-flex min-w-[2.5rem] justify-center rounded-full px-2 py-0.5 text-xs font-medium ${inStock ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                      {count != null ? fmt(count) : inStock ? (fa ? 'موجود' : 'In stock') : (fa ? 'ناموجود' : 'Out')}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
