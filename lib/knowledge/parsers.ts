import { PDFParse } from 'pdf-parse'

/** Extract text from a PDF buffer. */
export async function parsePdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  try {
    const result = await parser.getText()
    return (result.text ?? '').trim()
  } finally {
    await parser.destroy().catch(() => {})
  }
}

/**
 * Convert CSV into readable lines. The header row becomes field names so the
 * embedded text stays meaningful, e.g. "name: Widget | price: 100".
 */
export function parseCsv(content: string): string {
  const rows = parseCsvRows(content)
  if (rows.length === 0) return ''
  const [header, ...body] = rows
  return body
    .map((row) =>
      header
        .map((h, i) => (row[i] ? `${h.trim()}: ${row[i].trim()}` : ''))
        .filter(Boolean)
        .join(' | '),
    )
    .filter(Boolean)
    .join('\n')
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
  const res = await fetch(url, {
    headers: { 'User-Agent': 'VigentBot/1.0' },
  })
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`)
  const html = await res.text()
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
