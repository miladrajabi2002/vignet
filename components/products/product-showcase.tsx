import { ExternalLink, Package } from 'lucide-react'
import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

const PRODUCT_PREFIX = '[[product:'
export const MAX_SHOWCASE_PRODUCTS = 10

export type ShowcaseProduct = {
  id: string
  name: string
  price: string
  description: string
  badge: string
  imageUrl: string
  productUrl: string
  specs: string[]
  /** Legacy local-history aliases; new canonical markers use fields above. */
  desc?: string
  image?: string
  url?: string
}

function safeHttpUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return ''
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : ''
  } catch {
    return ''
  }
}

function shortText(value: unknown, max: number): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, max)
    : ''
}

function readSpecs(value: Record<string, unknown>): string[] {
  const raw = value.specs ?? value.attributes
  if (Array.isArray(raw)) {
    return raw
      .map((item) => shortText(item, 70))
      .filter(Boolean)
      .slice(0, 4)
  }
  if (!raw || typeof raw !== 'object') return []
  return Object.entries(raw as Record<string, unknown>)
    .map(([key, item]) => {
      const label = shortText(key, 28)
      const detail = typeof item === 'string' || typeof item === 'number'
        ? shortText(String(item), 38)
        : ''
      return label && detail ? `${label}: ${detail}` : ''
    })
    .filter(Boolean)
    .slice(0, 4)
}

function readProduct(json: string): ShowcaseProduct | null {
  try {
    const value = JSON.parse(json) as Record<string, unknown>
    const name = shortText(value.name, 120)
    if (!name) return null
    const rawPrice = value.price
    return {
      id: shortText(value.id, 80),
      name,
      price:
        typeof rawPrice === 'number' && Number.isFinite(rawPrice)
          ? rawPrice.toLocaleString('fa-IR')
          : shortText(rawPrice, 60),
      description: shortText(value.desc ?? value.description, 240),
      badge: shortText(value.badge, 28),
      imageUrl: safeHttpUrl(value.image ?? value.imageUrl),
      productUrl: safeHttpUrl(value.url ?? value.productUrl),
      specs: readSpecs(value),
    }
  } catch {
    return null
  }
}

function productTokenBounds(
  raw: string,
  jsonStart: number,
): { jsonEnd: number; tokenEnd: number } | null {
  let depth = 0
  let quoted = false
  let escaped = false
  for (let index = jsonStart; index < raw.length; index += 1) {
    const char = raw[index]
    if (quoted) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') quoted = false
      continue
    }
    if (char === '"') {
      quoted = true
      continue
    }
    if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0 && raw.slice(index + 1, index + 3) === ']]') {
        return { jsonEnd: index + 1, tokenEnd: index + 3 }
      }
    }
  }
  return null
}

/**
 * Split a persisted assistant reply into customer-facing text and trusted
 * product snapshots. An unfinished streaming marker is held back so machine
 * syntax never flashes on screen.
 */
export function parseProductShowcaseContent(
  raw: string,
  complete = true,
): { text: string; products: ShowcaseProduct[] } {
  const products: ShowcaseProduct[] = []
  const visible: string[] = []
  const seen = new Set<string>()
  let cursor = 0

  while (cursor < raw.length) {
    const start = raw.indexOf(PRODUCT_PREFIX, cursor)
    if (start < 0) {
      visible.push(raw.slice(cursor))
      break
    }
    visible.push(raw.slice(cursor, start))
    const jsonStart = start + PRODUCT_PREFIX.length
    const bounds = productTokenBounds(raw, jsonStart)
    // A malformed or partial marker is never user-facing, including after a
    // disrupted stream. This also prevents JSON fragments leaking into text.
    if (!bounds) break

    if (complete && products.length < MAX_SHOWCASE_PRODUCTS) {
      const product = readProduct(raw.slice(jsonStart, bounds.jsonEnd))
      if (product) {
        const identity = product.id || product.name.toLocaleLowerCase()
        if (!seen.has(identity)) {
          seen.add(identity)
          products.push(product)
        }
      }
    }
    cursor = bounds.tokenEnd
  }

  return {
    text: visible.join('').replace(/\n{3,}/g, '\n\n').trim(),
    products,
  }
}

export function ProductShowcaseRail({
  products,
  locale = 'fa',
  accent = '#111111',
  onAccent = '#ffffff',
  compact = false,
  className,
}: {
  products: ShowcaseProduct[]
  locale?: 'fa' | 'en'
  accent?: string
  onAccent?: string
  compact?: boolean
  className?: string
}) {
  const items = products.slice(0, MAX_SHOWCASE_PRODUCTS)
  if (!items.length) return null

  const accentStyle = {
    '--showcase-accent': accent,
    '--showcase-on-accent': onAccent,
  } as CSSProperties

  return (
    <section
      aria-label={locale === 'fa' ? 'ویترین محصولات پیشنهادی' : 'Recommended products'}
      dir={locale === 'fa' ? 'rtl' : 'ltr'}
      className={cn('min-w-0 max-w-full', className)}
      style={accentStyle}
    >
      <div className="mb-2 flex items-center justify-between gap-3 px-0.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-black/55">
          <Package aria-hidden="true" className="h-3.5 w-3.5" />
          {locale === 'fa' ? 'ویترین محصولات' : 'Product showcase'}
        </span>
        <span className="text-[10px] tabular-nums text-black/35">
          {items.length.toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')}
        </span>
      </div>

      <div
        className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-1 pb-3 [scrollbar-width:thin] [scrollbar-color:rgba(0,0,0,.16)_transparent]"
        tabIndex={0}
      >
        {items.map((product, index) => {
          const imageUrl = safeHttpUrl(product.imageUrl || product.image)
          const productUrl = safeHttpUrl(product.productUrl || product.url)
          const description = product.description || product.desc || ''
          const specs = Array.isArray(product.specs) ? product.specs : []
          return (
          <article
            key={product.id || `${product.name}-${index}`}
            className={cn(
              'group flex shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-black/[0.09] bg-white text-start text-neutral-900 shadow-[0_12px_32px_-20px_rgba(0,0,0,0.34)]',
              compact ? 'w-[13.25rem]' : 'w-[min(16rem,78vw)]',
            )}
          >
            <div className={cn('relative overflow-hidden bg-neutral-100', compact ? 'aspect-[16/10]' : 'aspect-[4/3]')}>
              {imageUrl ? (
                // Remote product domains are tenant-defined and cannot be listed
                // statically in next/image configuration.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt={product.name}
                  loading="lazy"
                  decoding="async"
                  width={320}
                  height={240}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025] motion-reduce:transform-none"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-neutral-100 text-neutral-300">
                  <Package aria-hidden="true" className="h-8 w-8" />
                </span>
              )}
              {product.badge && (
                <span className="absolute start-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-full border border-white/70 bg-white/92 px-2.5 py-1 text-[10px] font-semibold text-neutral-700 shadow-sm">
                  {product.badge}
                </span>
              )}
            </div>

            <div className="flex flex-1 flex-col p-3.5">
              <h3 className="line-clamp-2 text-[13px] font-bold leading-5 text-neutral-900">
                {product.name}
              </h3>
              {description && (
                <p className="mt-1.5 line-clamp-3 text-[11px] leading-5 text-neutral-500">
                  {description}
                </p>
              )}
              {specs.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1" aria-label={locale === 'fa' ? 'مشخصات محصول' : 'Product specifications'}>
                  {specs.map((spec) => (
                    <li key={spec} className="max-w-full truncate rounded-md bg-neutral-100 px-2 py-1 text-[10px] text-neutral-600">
                      {spec}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-auto pt-3">
                {product.price && (
                  <p className="mb-2 text-[13px] font-black tabular-nums text-neutral-950" dir="auto">
                    {product.price}
                  </p>
                )}
                {productUrl ? (
                  <a
                    href={productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--showcase-accent)] px-3 text-xs font-bold text-[var(--showcase-on-accent)] transition-opacity duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--showcase-accent)] focus-visible:ring-offset-2"
                  >
                    {locale === 'fa' ? 'مشاهده محصول' : 'View product'}
                    <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <div className="flex min-h-11 items-center text-[11px] text-neutral-400">
                    {locale === 'fa' ? 'برای اطلاعات بیشتر پیام دهید' : 'Message us for details'}
                  </div>
                )}
              </div>
            </div>
          </article>
          )
        })}
      </div>
    </section>
  )
}
