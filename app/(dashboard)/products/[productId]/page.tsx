import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import {
  Pencil,
  Package,
  Search,
  Bot,
  Boxes,
  Tag,
} from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { formatDateTime } from '@/lib/format'
import { BackButton } from '@/components/dashboard/back-button'

export default async function ProductDetailPage(
  props: {
    params: Promise<{ productId: string }>
  }
) {
  const params = await props.params;
  const user = await requireUser()
  const t = await getTranslations('products')
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
  const fmt = (n: number) => n.toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')

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

  const stockLabel =
    product.stock === null
      ? t('unlimited')
      : product.stock > 0
        ? `${fmt(product.stock)}`
        : t('outOfStock')

  // ─── Attributes normalization ───────────────────────────────────────────
  // The `attributes` JSON column accepts several shapes depending on the source:
  //
  //   1. Manual product form:   { "color": "blue", "size": "XL" }
  //   2. WooCommerce REST poll: { "color": "blue", "size": "XL" }  (already
  //      flattened by `mapWooProduct` in lib/integrations/woocommerce.ts)
  //   3. WooCommerce webhook:   sometimes { "color": { name, options } } when
  //      the plugin sends a raw attribute object — this is the source of the
  //      `[object Object]` bug.
  //   4. WooCommerce description blob:  the merchant put <ul><li>…</li></ul>
  //      directly inside the description field (or the description is the only
  //      place where attributes live) — this is the source of the raw-HTML
  //      rendering bug.
  //
  // We normalize all of these into a flat `{ label: string, value: string }[]`
  // and also extract any <li> items found inside the description so they show
  // up as proper attribute rows instead of as raw HTML.
  const attributes = normalizeAttributes(product.attributes)

  // If the description contains <ul>…<li>…</li>…</ul> blocks (a common
  // WooCommerce pattern where the merchant puts material/sizing info as a
  // bullet list in the description), extract those <li> items and merge them
  // into the attributes list so they render cleanly instead of as raw HTML.
  const descriptionItems = extractListItems(product.description ?? '')
  const mergedAttributes = [...attributes, ...descriptionItems]

  // Re-render the description without the <ul>/<li> blocks so they don't
  // appear twice (once as attributes, once as raw HTML).
  const cleanDescription = stripListBlocks(product.description ?? '')

  const stats = [
    {
      icon: Search,
      label: t('detail.queryCount'),
      value: fmt(product.queryCount),
    },
    {
      icon: Bot,
      label: t('detail.agentCoverage'),
      value: fmt(product.catalogItems.length),
    },
    {
      icon: Boxes,
      label: t('detail.stock'),
      value: stockLabel,
    },
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <BackButton href="/products" label={t('title')} />
        {/* Edit button — matches the rest of the dashboard's primary-button
            style (min-h-11, rounded-xl, bold) so it doesn't look out of place
            next to the other action buttons. */}
        <Link
          href={`/products/${product.id}/edit`}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-sm font-bold text-[var(--bg-base)] shadow-[var(--shadow-control)] transition-opacity hover:opacity-90"
        >
          <Pencil className="h-4 w-4" />
          {t('edit')}
        </Link>
      </div>

      {/* Header */}
      <div className="spatial-surface flex flex-col gap-5 rounded-[1.5rem] p-5 sm:flex-row">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-[var(--bg-muted)] sm:w-56">
          {product.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            (<img
              src={product.images[0]}
              alt={product.name}
              width={640}
              height={640}
              decoding="async"
              className="h-full w-full object-cover"
            />)
          ) : (
            <div className="flex h-full items-center justify-center text-[var(--text-hint)]">
              <Package className="h-8 w-8" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-light text-[var(--text-primary)]">
              {product.name}
            </h1>
            {!product.active && (
              <span className="rounded-full border border-[var(--border-default)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                {t('detail.inactive')}
              </span>
            )}
          </div>
          {product.category && (
            <span className="mt-1 inline-block text-sm text-[var(--text-muted)]">
              {product.category.name}
            </span>
          )}
          <div className="mt-3 flex items-baseline gap-2">
            {product.price != null && (
              <span className="text-xl text-[var(--text-primary)]">
                {fmt(product.price)}{' '}
                <span className="text-sm text-[var(--text-muted)]">
                  {t('toman')}
                </span>
              </span>
            )}
            {product.comparePrice != null && (
              <span className="text-sm text-[var(--text-muted)] line-through">
                {fmt(product.comparePrice)}
              </span>
            )}
          </div>
          {product.sku && (
            <p className="mt-2 text-xs text-[var(--text-muted)]" dir="ltr">
              SKU: {product.sku}
            </p>
          )}
          {/* Description — rendered as plain text; <ul>/<li> blocks were
              extracted into the attributes list above so they don't leak raw
              HTML here. */}
          {cleanDescription && (
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[var(--text-secondary)]">
              {cleanDescription}
            </p>
          )}
          {product.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {product.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--border-default)] px-2 py-0.5 text-xs text-[var(--text-secondary)]"
                >
                  <Tag className="h-3 w-3" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Analytics stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="spatial-surface rounded-[1.5rem] p-5"
          >
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <s.icon className="h-4 w-4" />
              {s.label}
            </div>
            <p className="mt-2 text-2xl font-light text-[var(--text-primary)]">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Agent coverage */}
      <div className="spatial-surface rounded-[1.5rem] p-5">
        <h2 className="text-sm font-medium text-[var(--text-secondary)]">
          {t('detail.knownByAgents')}
        </h2>
        {product.catalogItems.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            {t('detail.noAgents')}
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {product.catalogItems.map(({ agent }) => (
              <Link
                key={agent.id}
                href={`/agents/${agent.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                <Bot className="h-3.5 w-3.5" />
                {agent.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Attributes — rendered from the normalized list, so <ul>/<li>
          descriptions and `[object Object]` attribute values both resolve
          into clean rows instead of raw HTML / object dumps. */}
      {mergedAttributes.length > 0 && (
        <div className="spatial-surface rounded-[1.5rem] p-5">
          <h2 className="text-sm font-medium text-[var(--text-secondary)]">
            {t('form.attributes')}
          </h2>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            {mergedAttributes.map((attr, idx) => (
              <div
                key={`${attr.label}-${idx}`}
                className="flex items-center justify-between rounded-lg bg-[var(--bg-muted)] px-3 py-2 text-sm"
              >
                <dt className="text-[var(--text-muted)]">{attr.label}</dt>
                <dd className="text-[var(--text-primary)]">{attr.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <p className="text-xs text-[var(--text-muted)]">
        {t('detail.updatedAt')}: {formatDateTime(product.updatedAt, locale)}
      </p>
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────

type AttrRow = { label: string; value: string }

/**
 * Normalize the `attributes` JSON column into a flat list of
 * `{ label, value }` rows. Handles every shape we've seen in the wild:
 *
 *   - { color: "blue" }                        → [ { color, blue } ]
 *   - { color: { name: "رنگ", options: ["blue"] } }   (webhook path)
 *   - { color: ["blue", "red"] }               (multi-value)
 *   - [ { name: "color", options: ["blue"] } ] (WC REST shape)
 *
 * Without this, the detail page would call `String(value)` on each value and
 * print `[object Object]` for the nested-object shapes.
 */
function normalizeAttributes(raw: unknown): AttrRow[] {
  if (!raw || typeof raw !== 'object') return []
  const out: AttrRow[] = []

  // Array shape: [{ name, options }] (WC REST poll path).
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue
      const obj = item as Record<string, unknown>
      const label = typeof obj.name === 'string' ? obj.name : '—'
      const value = formatAttrValue(obj.options ?? obj.value)
      if (value) out.push({ label, value })
    }
    return out
  }

  // Object shape: { key: value | { name, options } | array }
  const entries = Object.entries(raw as Record<string, unknown>)
  for (const [key, value] of entries) {
    if (value == null) continue

    // Nested WC attribute object: { name: "رنگ", options: ["blue"] } or
    // { name: "رنگ", option: "blue" }.
    if (typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>
      const label = typeof obj.name === 'string' && obj.name ? obj.name : key
      const inner = obj.options ?? obj.option ?? obj.value
      const formatted = formatAttrValue(inner)
      if (formatted) out.push({ label, value: formatted })
      continue
    }

    // Primitive or array.
    const formatted = formatAttrValue(value)
    if (formatted) out.push({ label: key, value: formatted })
  }
  return out
}

/** Format a single attribute value into a display string. */
function formatAttrValue(v: unknown): string {
  if (v == null) return ''
  if (Array.isArray(v)) {
    return v.map((x) => formatAttrValue(x)).filter(Boolean).join('، ')
  }
  if (typeof v === 'object') {
    // Last-resort fallback: try common fields, then stringify.
    const obj = v as Record<string, unknown>
    if (typeof obj.name === 'string') return obj.name
    if (Array.isArray(obj.options)) return formatAttrValue(obj.options)
    if (typeof obj.value === 'string') return obj.value
    // Avoid the `[object Object]` bug — JSON is at least readable.
    try {
      return JSON.stringify(obj)
    } catch {
      return ''
    }
  }
  return String(v)
}

/**
 * Extract every <li>…</li> body from an HTML string. Used when a WooCommerce
 * merchant writes their product specs as a bullet list inside the description
 * (e.g. "<ul><li>جنس: پنبه‌ای</li><li>سایزبندی: فری سایز</li></ul>"). The
 * extracted items are merged into the attributes list so they render as
 * proper label/value rows.
 *
 * The list items are expected to be in `label: value` form; we split on the
 * first colon (Persian or ASCII). Items without a colon become label-only
 * rows with an empty value.
 */
function extractListItems(html: string): AttrRow[] {
  if (!html || !html.includes('<li')) return []
  const out: AttrRow[] = []
  const re = /<li[^>]*>([\s\S]*?)<\/li>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const raw = m[1]
      .replace(/<[^>]+>/g, '')   // strip nested tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim()
    if (!raw) continue
    // Split on first ASCII or Persian colon.
    const colonIdx = raw.search(/[:：]/)
    if (colonIdx > 0) {
      const label = raw.slice(0, colonIdx).trim()
      const value = raw.slice(colonIdx + 1).trim()
      out.push({ label, value })
    } else {
      out.push({ label: raw, value: '' })
    }
  }
  return out
}

/**
 * Strip <ul>…</ul> blocks from an HTML string. Used after extracting list
 * items into the attributes list so the description doesn't show the same
 * content twice (once as attributes, once as raw HTML).
 *
 * Also strips any other HTML tags so the description renders as plain text.
 */
function stripListBlocks(html: string): string {
  if (!html) return ''
  return html
    .replace(/<ul[^>]*>[\s\S]*?<\/ul>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}
