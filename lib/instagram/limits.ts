/**
 * What one Instagram Direct message may carry — text lengths, button rules and
 * media sizes.
 *
 * Pure and import-light: the scenario form shows these limits while the
 * operator writes, the upload and automation routes enforce the same numbers,
 * so the dashboard never accepts a message Instagram would cut or reject.
 */
import {
  IG_BUTTON_TEXT_LIMIT,
  IG_BUTTON_TITLE_LIMIT,
  IG_SINGLE_TEXT_LIMIT,
} from '@/lib/instagram/comment-opener'

export { IG_BUTTON_TEXT_LIMIT, IG_BUTTON_TITLE_LIMIT, IG_SINGLE_TEXT_LIMIT }

/** Buttons on one key message (Instagram's button-template limit). */
export const IG_BUTTONS_PER_MESSAGE = 3
/** Longest link a button may open. */
export const IG_BUTTON_URL_LIMIT = 2000

const MB = 1024 * 1024

export type IgMediaKind = 'IMAGE' | 'VIDEO' | 'AUDIO'

/** Largest file Instagram accepts as a Direct attachment, per kind. */
export const IG_MEDIA_MAX_BYTES: Record<IgMediaKind, number> = {
  IMAGE: 8 * MB,
  VIDEO: 25 * MB,
  AUDIO: 25 * MB,
}

export function igMediaKindOfMime(mime: string): IgMediaKind | null {
  const type = mime.split(';')[0].trim().toLowerCase()
  if (type.startsWith('image/')) return 'IMAGE'
  if (type.startsWith('video/')) return 'VIDEO'
  if (type.startsWith('audio/')) return 'AUDIO'
  return null
}

/** Longest body of a key message: the button bubble is shorter than a text. */
export function igKeyTextLimit(buttonType: 'button' | 'quick_reply' | undefined): number {
  return buttonType === 'quick_reply' ? IG_SINGLE_TEXT_LIMIT : IG_BUTTON_TEXT_LIMIT
}

/**
 * The link as it is saved: trimmed, and `example.com/page` gets `https://` in
 * front — Instagram rejects a button whose link has no scheme.
 */
export function normalizeButtonUrl(raw: string): string {
  const url = raw.trim()
  if (!url) return ''
  return /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`
}

/** A link Instagram can open from a button: absolute http(s) with a real host. */
export function isValidButtonUrl(raw: string): boolean {
  const url = normalizeButtonUrl(raw)
  if (!url || url.length > IG_BUTTON_URL_LIMIT) return false
  try {
    const parsed = new URL(url)
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && parsed.hostname.includes('.')
  } catch {
    return false
  }
}
