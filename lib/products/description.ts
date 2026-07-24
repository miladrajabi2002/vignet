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
