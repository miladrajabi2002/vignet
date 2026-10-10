/**
 * What an Instagram scenario really sent, part by part.
 *
 * A scenario reply is rarely one text: it can be a button message, media, a
 * product rail and a public reply under the comment. The receipt message keeps
 * the plain text in `content` (search, list preview, older clients) and this
 * ordered list in `metadata.vigentoOutbound`, so the inbox can show each part
 * the way the customer saw it and say which scenario produced it.
 *
 * Pure and import-free: the automation engine writes it, the dashboard reads it.
 */

export type OutboundButton = { title: string; url?: string }

export type OutboundPart =
  /** A text message. `via: 'comment'` is the public reply under the comment. */
  | { kind: 'text'; text: string; via?: 'comment' }
  /**
   * A text with tappable buttons. `role` says why the scenario sent it;
   * `style: 'chips'` are quick-reply chips above the keyboard (they vanish
   * with the next message), the default is buttons inside the bubble.
   */
  | {
      kind: 'buttons'
      text: string
      buttons: OutboundButton[]
      role?: 'follow_gate' | 'opener'
      style?: 'chips'
    }
  | { kind: 'media'; media: 'photo' | 'video' | 'audio'; mediaUrl?: string; caption?: string }
  /** Where the product rail sits; the cards themselves are markers in `content`. */
  | { kind: 'products' }

export type OutboundScenario = {
  id: string
  name: string
  type: 'DIRECT_MESSAGE' | 'COMMENT' | 'STORY'
}

export type OutboundReceipt = {
  scenario: OutboundScenario | null
  parts: OutboundPart[]
}

const MAX_PARTS = 24
const MAX_TEXT = 2000

function clip(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, MAX_TEXT) : ''
}

function readButtons(value: unknown): OutboundButton[] {
  if (!Array.isArray(value)) return []
  return value
    .map((raw): OutboundButton | null => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
      const row = raw as Record<string, unknown>
      const title = typeof row.title === 'string' ? row.title.trim().slice(0, 40) : ''
      if (!title) return null
      const url = typeof row.url === 'string' && /^https?:\/\//i.test(row.url) ? row.url : undefined
      return url ? { title, url } : { title }
    })
    .filter((button): button is OutboundButton => button !== null)
    .slice(0, 13)
}

function readPart(raw: unknown): OutboundPart | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  if (row.kind === 'text') {
    const text = clip(row.text)
    if (!text) return null
    return row.via === 'comment' ? { kind: 'text', text, via: 'comment' } : { kind: 'text', text }
  }
  if (row.kind === 'buttons') {
    const buttons = readButtons(row.buttons)
    const text = clip(row.text)
    if (!buttons.length && !text) return null
    const role = row.role === 'follow_gate' || row.role === 'opener' ? row.role : undefined
    return {
      kind: 'buttons',
      text,
      buttons,
      ...(role ? { role } : {}),
      ...(row.style === 'chips' ? { style: 'chips' as const } : {}),
    }
  }
  if (row.kind === 'media') {
    if (row.media !== 'photo' && row.media !== 'video' && row.media !== 'audio') return null
    const mediaUrl = typeof row.mediaUrl === 'string' && row.mediaUrl.startsWith('https://')
      ? row.mediaUrl
      : undefined
    const caption = clip(row.caption)
    return { kind: 'media', media: row.media, ...(mediaUrl ? { mediaUrl } : {}), ...(caption ? { caption } : {}) }
  }
  if (row.kind === 'products') return { kind: 'products' }
  return null
}

/** Trim a collected receipt to what is safe to persist on a message row. */
export function sanitizeOutboundParts(parts: readonly OutboundPart[]): OutboundPart[] {
  return parts
    .map((part) => readPart(part))
    .filter((part): part is OutboundPart => part !== null)
    .slice(0, MAX_PARTS)
}

/** The structured receipt of an assistant message, or null for ordinary replies. */
export function readOutboundReceipt(metadata: unknown): OutboundReceipt | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const outbound = (metadata as Record<string, unknown>).vigentoOutbound
  if (!outbound || typeof outbound !== 'object' || Array.isArray(outbound)) return null
  const row = outbound as Record<string, unknown>
  if (!Array.isArray(row.parts)) return null
  const parts = sanitizeOutboundParts(row.parts as OutboundPart[])
  if (!parts.length) return null
  const rawScenario = row.scenario
  let scenario: OutboundScenario | null = null
  if (rawScenario && typeof rawScenario === 'object' && !Array.isArray(rawScenario)) {
    const s = rawScenario as Record<string, unknown>
    if (
      typeof s.id === 'string'
      && typeof s.name === 'string'
      && (s.type === 'DIRECT_MESSAGE' || s.type === 'COMMENT' || s.type === 'STORY')
    ) {
      scenario = { id: s.id, name: s.name.slice(0, 120), type: s.type }
    }
  }
  return { scenario, parts }
}
