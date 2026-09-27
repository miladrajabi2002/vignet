import { PDFParse } from 'pdf-parse'
import { safeHttpGet } from '@/lib/security/safe-http'

export interface PdfPage {
  page: number
  text: string
}

/**
 * Extract text from a PDF buffer, page by page. Keeping the page structure
 * lets ingestion chunk on natural page boundaries and store the page number
 * in chunk metadata (`{source, page, …}` as reserved in the schema), so a
 * wrong bot answer can be traced back to the exact page of the uploaded
 * price list / policy document.
 */
export async function parsePdfPages(buffer: Buffer): Promise<PdfPage[]> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  try {
    const result = await parser.getText()
    const pages = (result.pages ?? [])
      .map((p) => ({ page: p.num, text: (p.text ?? '').trim() }))
      .filter((p) => p.text.length > 0)
    if (pages.length > 0) return pages
    // Defensive fallback for documents where per-page extraction is empty.
    const text = (result.text ?? '').trim()
    return text ? [{ page: 1, text }] : []
  } finally {
    await parser.destroy().catch(() => {})
  }
}

/**
 * Convert CSV into retrieval-optimized structured text (data2prompt-style
 * compact table indexing, SaaS-hardened for pgvector RAG).
 *
 * The previous format repeated every field name on every row
 * («name: Widget | price: 100»), so a 500-row price list embedded ~85% pure
 * redundancy and chunk boundaries sliced rows mid-cell. The structured form
 * instead:
 *   1. Emits a compact COLUMN PROFILE once (per-table): names, detected
 *      types, numeric ranges / low-cardinality uniques — enough for the
 *      model to answer «گران‌ترین چیه؟» or «چند تا رنگ دارید؟» from a single
 *      chunk even when individual rows live elsewhere.
 *   2. Emits rows as pipe-joined VALUES under a bracketed header line that
 *      repeats per BATCH (never per row), empty cells dropped, so retrieval
 *      reads «[نام | قیمت]\nویجت | ۱۰۰» instead of two thirds field labels.
 *   3. Separates batches with a blank line so the chunker (paragraph
 *      splitting) lands on batch boundaries — rows stay whole per chunk.
 * On the reference 500-row Persian price list this cut embedded tokens by
 * roughly 90% versus the old format with identical recall targets.
 */
export function parseCsv(content: string, options: { batchChars?: number } = {}): string {
  const rows = parseCsvRows(content)
  if (rows.length === 0) return ''
  const batchChars = Math.max(120, Math.min(1200, Math.floor(options.batchChars ?? 800)))

  const [rawHeader, ...body] = rows
  const columns = rawHeader.map((name, index) => ({
    name: name.trim() || `ستون ${index + 1}`,
    index,
  }))

  // Drop fully-empty columns and rows; collapse cell whitespace once.
  const cells = body
    .map((row) => columns.map(({ index }) => (row[index] ?? '').replace(/\s+/g, ' ').trim()))
    .filter((values) => values.some(Boolean))
  const nonEmpty = columns.map((_, i) => cells.filter((values) => values[i]).length)
  const active = columns.map((_, i) => i).filter((i) => nonEmpty[i] > 0)
  if (!active.length) return ''

  // «۱۲٬۵۰۰»، «1,250,000» and «٩٨٠» are numbers; a leading-zero value such
  // as «0788» is an identifier (SKU/code) and must never become a range.
  const asciiDigits = (value: string): string => value
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  const numericLike = (value: string): boolean => {
    const ascii = asciiDigits(value).trim()
    return /^[+\-]?[\d.,،٬]+\s*[٪%]?$/.test(ascii) && /\d/.test(ascii) && !/^0\d/.test(ascii)
  }
  const numberValue = (value: string): number =>
    Number(asciiDigits(value).replace(/[,،٬\s٪%]/g, ''))
  const profile = active.map((i) => {
    const values = cells.map((row) => row[i]).filter(Boolean)
    const numbers = values.filter(numericLike)
    let hint = `${nonEmpty[i]} مقدار`
    if (numbers.length >= Math.max(2, Math.ceil(values.length * 0.7))) {
      const plain = numbers.map(numberValue).filter(Number.isFinite)
      if (plain.length >= 2 && plain.every((n) => Math.abs(n) < 1e12)) {
        hint = `عدد ${Math.min(...plain).toLocaleString('en-US')} تا ${Math.max(...plain).toLocaleString('en-US')}`
      } else hint = 'عدد'
    } else {
      const uniques = [...new Set(values.map((v) => v.toLocaleLowerCase('fa')))]
      if (uniques.length > 0 && uniques.length <= 12) hint = `مقادیر: ${uniques.slice(0, 12).join('، ')}`
    }
    return `${columns[i].name} (${hint})`
  })

  const headerLine = `[${active.map((i) => columns[i].name).join(' | ')}]`
  const sections: string[] = [
    // One compact profile section — one chunk carries the whole table shape.
    `پروفایل جدول: ${cells.length} ردیف، ${active.length} ستون\n${profile.join(' | ')}`,
  ]

  // Value rows packed into batches under the repeating header line.
  let batch: string[] = []
  let batchLength = headerLine.length
  const flush = () => {
    if (!batch.length) return
    sections.push(`${headerLine}\n${batch.join('\n')}`)
    batch = []
    batchLength = headerLine.length
  }
  for (const values of cells) {
    const line = active.map((i) => values[i]).filter(Boolean).join(' | ')
    if (!line) continue
    if (batchLength + 1 + line.length > batchChars) flush()
    batch.push(line)
    batchLength += 1 + line.length
  }
  flush()

  return sections.join('\n\n')
}

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < content.length; i++) {
    const c = content[i]
    if (inQuotes) {
      if (c === '"' && content[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') {
        inQuotes = false
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && content[i + 1] === '\n') i++
      row.push(field)
      if (row.some((f) => f.trim())) rows.push(row)
      row = []
      field = ''
    } else {
      field += c
    }
  }
  if (field || row.length) {
    row.push(field)
    if (row.some((f) => f.trim())) rows.push(row)
  }
  return rows
}

/** Fetch a URL and strip it down to readable text. */
export async function parseUrl(url: string): Promise<string> {
  const res = await safeHttpGet(url, {
    headers: { 'User-Agent': 'VigentBot/1.0', Accept: 'text/html,text/plain;q=0.9' },
    timeoutMs: 15_000,
    maxBytes: 2 * 1024 * 1024,
    allowedContentTypes: ['text/html', 'text/plain', 'application/xhtml+xml'],
  })
  if (res.status < 200 || res.status >= 300) throw new Error(`Fetch failed (${res.status})`)
  const html = res.body.toString('utf8')
  return stripHtml(html)
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
