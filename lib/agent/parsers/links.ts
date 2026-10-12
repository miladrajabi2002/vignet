/**
 * Shape-certain link parsing and evidence checks. These are not intent
 * detectors: they only answer «is this address really in what the model was
 * shown?» and cut the sentences that carry one that is not.
 */

export interface LinkEvidence {
  /** host + path + query */
  exact: Set<string>
  /** host + path */
  paths: Set<string>
  hosts: Set<string>
}

interface ParsedLink {
  host: string
  path: string
  query: string
}

interface FoundLink {
  raw: string
  index: number
  parsed: ParsedLink
}

const URL_BODY = String.raw`[^\s<>"'\x60«»()\[\]{}|\\^]+`
const SCHEME_URL_RE = new RegExp(String.raw`https?:\/\/${URL_BODY}`, 'giu')
// A scheme-less domain is a link too («baahamim.ir/events»). The TLD list
// keeps dotted words that are not addresses (file names, versions) out.
const BARE_DOMAIN_TLDS =
  'ir|com|net|org|io|co|app|shop|store|site|me|info|xyz|online|dev|ai|biz|link|page|cloud|tech|club|pro|website|academy|gallery|agency|studio|digital|market|blog|live|tv|cc|ly|gg|eu|uk|de|fr|tr|ae|us|ca'
const BARE_DOMAIN_RE = new RegExp(
  String.raw`(?<![@\w.\-/])((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:${BARE_DOMAIN_TLDS}))(?![\w-])(\/${URL_BODY})?`,
  'giu',
)
const TRAILING_PUNCTUATION_RE = /[.,،؛;:!?؟…*_~]+$/u
// Product and checkout markers are resolved by the server, never read as links.
export const MARKER_RE = /\[\[[a-z_]+:.*?\]\]/giu

/**
 * Public platforms a reply may name by their home address («وارد gmail.com
 * شوید»): general knowledge, not a link of the business. Only the bare
 * address is exempt — a page, a channel or a handle on them
 * (instagram.com/…, t.me/…) is checked like any other link.
 */
const PUBLIC_PLATFORM_DOMAINS = [
  'google.com', 'gmail.com', 'youtube.com', 'instagram.com', 'facebook.com', 'whatsapp.com', 'telegram.org',
  'x.com', 'twitter.com', 'linkedin.com', 'tiktok.com', 'twitch.tv', 'kick.com', 'apple.com', 'microsoft.com',
  'aparat.com', 'bale.ai', 'rubika.ir', 'eitaa.com', 'cafebazaar.ir', 'myket.ir', 't.me', 'wa.me',
]
// «kick.com/نام‌کانال», "instagram.com/username": the shape of an address the
// customer should send, not an address. Real handles there are never Persian.
const PLACEHOLDER_PATH_RE = /^\/@?(?:[^/]*[؀-ۿ][^/]*|user(?:name)?|your[-_]?(?:channel|id|name|username|page)|channel[-_]?name|id|x{3,})$/iu

function comparable(value: string): string {
  let decoded = value
  try {
    decoded = decodeURIComponent(value)
  } catch {
    // A stray «%» is compared as written.
  }
  return decoded
    .normalize('NFKC')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .toLowerCase()
}

function parseLink(raw: string): ParsedLink | null {
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  if (!host.includes('.')) return null
  return {
    host,
    path: comparable(url.pathname).replace(/\/+$/, ''),
    query: comparable(url.search.replace(/^\?/, '')),
  }
}

function blank(text: string, re: RegExp): string {
  return text.replace(re, (match) => ' '.repeat(match.length))
}

function findLinks(text: string): FoundLink[] {
  const found: FoundLink[] = []
  const collect = (source: string, re: RegExp) => {
    for (const match of source.matchAll(re)) {
      const raw = match[0].replace(TRAILING_PUNCTUATION_RE, '')
      const parsed = parseLink(raw)
      if (parsed) found.push({ raw, index: match.index, parsed })
    }
  }
  const withoutMarkers = blank(text, MARKER_RE)
  collect(withoutMarkers, SCHEME_URL_RE)
  collect(blank(withoutMarkers, SCHEME_URL_RE), BARE_DOMAIN_RE)
  return found.sort((a, b) => a.index - b.index)
}

/** Every link in the given texts, as evidence a reply may copy from. */
export function buildLinkEvidence(sources: Array<string | null | undefined>): LinkEvidence {
  const evidence: LinkEvidence = { exact: new Set(), paths: new Set(), hosts: new Set() }
  for (const source of sources) {
    if (!source) continue
    for (const { parsed } of findLinks(source)) {
      evidence.hosts.add(parsed.host)
      evidence.paths.add(`${parsed.host}${parsed.path}`)
      evidence.exact.add(`${parsed.host}${parsed.path}?${parsed.query}`)
    }
  }
  return evidence
}

function isPublicPlatformMention(link: ParsedLink): boolean {
  if (link.query) return false
  if (!PUBLIC_PLATFORM_DOMAINS.some((domain) => link.host === domain || link.host.endsWith(`.${domain}`))) return false
  return !link.path || PLACEHOLDER_PATH_RE.test(link.path)
}

function isGrounded(link: ParsedLink, evidence: LinkEvidence): boolean {
  if (isPublicPlatformMention(link)) return true
  if (!evidence.hosts.has(link.host)) return false
  // The home page of a site the business itself linked to.
  if (!link.path && !link.query) return true
  return link.query
    ? evidence.exact.has(`${link.host}${link.path}?${link.query}`)
    : evidence.paths.has(`${link.host}${link.path}`)
}

/** Links in the text that appear nowhere in the evidence. */
export function findUngroundedLinks(text: string, evidence: LinkEvidence): string[] {
  return [...new Set(findLinks(text).filter((link) => !isGrounded(link.parsed, evidence)).map((link) => link.raw))]
}

function splitSentences(line: string): string[] {
  // Whitespace after the mark keeps the dots inside a URL from cutting it.
  return line.split(/(?<=[.!؟?…])\s+/u).filter((part) => part.trim())
}

/**
 * Cut every sentence that carries an ungrounded link, plus a lead-in that
 * ended with a colon right above a link standing on its own line. `marker`
 * is left on a line of its own where the first cut was made.
 */
export function cutUngroundedLinkSentences(
  text: string,
  evidence: LinkEvidence,
  marker: string,
): { text: string; removed: string[] } {
  const removed = findUngroundedLinks(text, evidence)
  if (!removed.length) return { text, removed }

  let marked = false
  const lines = text.split('\n').flatMap((line) => {
    if (!findUngroundedLinks(line, evidence).length) return [line]
    const kept = splitSentences(line).filter((sentence) => !findUngroundedLinks(sentence, evidence).length)
    const rest = kept.length ? [kept.join(' ')] : []
    if (marked) return rest
    marked = true
    return kept.length ? [...rest, '', marker] : [marker]
  })

  for (let index = lines.indexOf(marker) - 1; index >= 0; index -= 1) {
    if (!lines[index].trim()) continue
    if (/[:：]\s*$/u.test(lines[index])) lines[index] = splitSentences(lines[index]).slice(0, -1).join(' ')
    break
  }

  return {
    text: lines
      .map((line) => line.trimEnd())
      // A list bullet left with nothing after it.
      .filter((line) => !line.trim() || !/^\s*(?:[-*•▪◦]|\d+[.)])\s*$/u.test(line))
      .join('\n'),
    removed,
  }
}
