/**
 * Product description HTML helpers.
 *
 * WooCommerce merchants frequently write product specs as a bullet list inside
 * the description field — e.g.
 *
 *     <ul><li>جنس: پنبه‌ای</li><li>سایزبندی: فری سایز</li></ul>
 *
 * The dashboard's product detail page extracts those <li> items into clean
 * attribute rows so they don't render as raw HTML (see
 * `app/(dashboard)/products/[productId]/page.tsx`). The Instagram automation
 * engine needs the same treatment: a product card's subtitle must be plain
 * text, not HTML — Meta rejects (or silently mangles) HTML inside the
 * Generic Template `subtitle` field.
 *
 * This module centralizes the HTML-stripping + list-extraction logic so both
 * the dashboard and the Instagram media layer stay in sync.
 */

export type AttrRow = { label: string; value: string }

/**
 * Pull the `_variations` array out of a product's `attributes` JSON column.
 *
 * Variations are stashed under the `_variations` key by the WooCommerce ingest
 * (see lib/integrations/woocommerce.ts → mapWooProduct) so we don't need a
 * Prisma migration. Returns `null` when the attribute column doesn't carry
 * variations (e.g. simple products, manual products without variations, or
 * integrations that haven't been re-synced since v4.3.5).
 *
 * Shared by `normalizeAttributes` (which strips `_variations` from the
 * human-readable attribute rows) and by the product detail page (which
 * renders the variations as a dedicated grid below the attributes).
 */
export function extractVariations(attrs: unknown): Array<Record<string, unknown>> | null {
  if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs)) return null
  const obj = attrs as Record<string, unknown>
  const v = obj._variations
  if (!Array.isArray(v) || v.length === 0) return null
  return v.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
}

/**
 * Type describing a single variation, used by the product detail page to
 * render the variations grid. Mirrors the shape persisted by
 * `mapWooProduct` in lib/integrations/woocommerce.ts.
 */
export interface VariationRow {
  id: number
  sku?: string | null
  price?: number | null
  regularPrice?: number | null
  salePrice?: number | null
  manageStock?: boolean
  stockQuantity?: number | null
  inStock?: boolean
  attributes: Record<string, string>
  image?: string | null
}

/**
 * Strictly-typed variation extractor. Returns the same data as
 * `extractVariations` but cast to `VariationRow[]` so the React component
 * can read fields without `unknown` narrowing on each access. Unknown /
 * malformed entries are dropped.
 */
export function extractTypedVariations(attrs: unknown): VariationRow[] {
  const raw = extractVariations(attrs)
  if (!raw) return []
  const out: VariationRow[] = []
  for (const v of raw) {
    const attrs = v.attributes
    if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs)) continue
    const typedAttrs: Record<string, string> = {}
    for (const [k, val] of Object.entries(attrs as Record<string, unknown>)) {
      if (val == null) continue
      typedAttrs[k] = String(val)
    }
    const id = typeof v.id === 'number' ? v.id : 0
    if (id <= 0) continue
    out.push({
      id,
      sku: typeof v.sku === 'string' && v.sku ? v.sku : null,
      price: typeof v.price === 'number' && v.price > 0 ? v.price : null,
      regularPrice: typeof v.regularPrice === 'number' && v.regularPrice > 0 ? v.regularPrice : null,
      salePrice: typeof v.salePrice === 'number' && v.salePrice > 0 ? v.salePrice : null,
      manageStock: v.manageStock === true,
      stockQuantity: typeof v.stockQuantity === 'number' ? v.stockQuantity : null,
      inStock: v.inStock !== false,
      attributes: typedAttrs,
      image: typeof v.image === 'string' && v.image ? v.image : null,
    })
  }
  return out
}

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
 *
 * NOTE: the `_variations` key (when present) is intentionally skipped here.
 * It's a structured array, not a human-readable attribute, and is rendered
 * separately by the product detail page via `extractTypedVariations`.
 */
export function normalizeAttributes(raw: unknown): AttrRow[] {
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
    // Skip the internal `_variations` key — it's rendered separately.
    if (key === '_variations') continue
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
export function formatAttrValue(v: unknown): string {
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
 * extracted items are returned as `{ label, value }` rows so they can be
 * rendered as proper attribute rows.
 *
 * The list items are expected to be in `label: value` form; we split on the
 * first colon (Persian or ASCII). Items without a colon become label-only
 * rows with an empty value.
 */
export function extractListItems(html: string): AttrRow[] {
  if (!html || !html.includes('<li')) return []
  const out: AttrRow[] = []
  const re = /<li[^>]*>([\s\S]*?)<\/li>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const raw = m[1]
      .replace(/<[^>]+>/g, '') // strip nested tags
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
 * This is the function the Instagram product card uses to clean the subtitle
 * before sending it to Meta — Meta's Generic Template `subtitle` field does
 * NOT support HTML.
 */
export function stripListBlocks(html: string): string {
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

/**
 * Collapse a possibly-HTML product description into a single clean line of
 * plain text suitable for chat bubbles (Instagram subtitle, WhatsApp body,
 * etc.).
 *
 * - <ul>/<li> blocks are removed (their text content is preserved as
 *   "label: value" pairs joined by separators, so the info isn't lost).
 * - All remaining HTML tags are stripped.
 * - HTML entities are decoded.
 * - Whitespace is collapsed.
 *
 * Truncated to `maxLen` characters (default 80 — Instagram's Generic Template
 * subtitle limit).
 */
export function cleanDescriptionForChat(
  html: string | null | undefined,
  maxLen = 80,
): string {
  if (!html) return ''
  // Pull list-item text out as "label: value" pairs so the bullet content
  // survives the strip — Meta's subtitle would otherwise drop it entirely.
  const items = extractListItems(html)
  const listText = items
    .map((it) => (it.value ? `${it.label}: ${it.value}` : it.label))
    .join('، ')
  const stripped = stripListBlocks(html)
  const merged = listText && stripped ? `${stripped} — ${listText}` : (listText || stripped)
  if (merged.length <= maxLen) return merged
  // Truncate at a word boundary when possible.
  const slice = merged.slice(0, maxLen - 1)
  const lastSpace = slice.lastIndexOf(' ')
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : maxLen - 1)}…`
}
