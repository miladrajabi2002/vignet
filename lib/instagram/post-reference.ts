const INSTAGRAM_POST_URL = /(?:https?:\/\/)?(?:www\.|m\.)?(?:instagram\.com|instagr\.am)\/(?:[^/?#\s]+\/)*(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i
const NUMERIC_MEDIA_ID = /^\d{5,30}$/
const RAW_SHORTCODE = /^[A-Za-z0-9_-]{5,30}$/

export interface ParsedInstagramPostReferences {
  ids: string[]
  shortcodes: string[]
  invalid: string[]
}

/** Extract the public shortcode from a copied Instagram post/reel reference. */
export function instagramPostShortcode(reference: string): string | null {
  const urlMatch = reference.match(INSTAGRAM_POST_URL)
  if (urlMatch?.[1]) return urlMatch[1]
  return RAW_SHORTCODE.test(reference) && !NUMERIC_MEDIA_ID.test(reference)
    ? reference
    : null
}

/**
 * Accept the formats operators commonly copy from Instagram:
 * - numeric media ids
 * - raw shortcodes
 * - post/reel URLs, with or without protocol/www and with an optional username
 *   segment (some share surfaces include it before `/p/`).
 */
export function parseInstagramPostReferences(input: string): ParsedInstagramPostReferences {
  const ids: string[] = []
  const shortcodes: string[] = []
  const invalid: string[] = []
  const references = input
    .split(/[\s,،;]+/)
    .map((item) => item.trim().replace(/^[([{<]+|[\])}>.]+$/g, ''))
    .filter(Boolean)

  for (const reference of references) {
    if (NUMERIC_MEDIA_ID.test(reference)) {
      ids.push(reference)
      continue
    }

    const shortcode = instagramPostShortcode(reference)
    if (shortcode) shortcodes.push(shortcode)
    else invalid.push(reference)
  }

  return {
    ids: [...new Set(ids)],
    shortcodes: [...new Set(shortcodes)],
    invalid: [...new Set(invalid)],
  }
}
